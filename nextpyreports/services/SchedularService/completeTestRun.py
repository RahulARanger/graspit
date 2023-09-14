from nextpyreports.services.DBService.models.result_base import SessionBase, RunBase, SuiteBase
from nextpyreports.services.DBService.models.task_base import TaskBase
from nextpyreports.services.DBService.models.types import Status, SuiteType
from nextpyreports.services.SchedularService.refer_types import PathTree, PathItem
from nextpyreports.services.SchedularService.modifySuites import fetch_key_from_status
from tortoise.functions import Sum, Max, Min
from datetime import datetime
from typing import List
from pathlib import Path
from os.path import join
from loguru import logger
from tortoise.expressions import Q


def simplify_file_paths(paths: List[str]):
    tree: PathTree = {"<path>": ""}
    _paths: List[PathItem] = [
        dict(
            children=list(reversed(Path(path).parts)),
            pointer=tree,
        ) for path in paths
    ]

    while _paths:
        path_to_include = _paths[-1]
        if not path_to_include['children']:
            _paths.pop()
            continue

        parent_pointer: PathTree = path_to_include["pointer"]
        possible_parent: str = path_to_include["children"].pop()
        # that dict will be inside the tree

        pointing_to = parent_pointer.setdefault(
            possible_parent,
            {
                "<path>": join(parent_pointer["<path>"], possible_parent)
            }
        )
        path_to_include["pointer"] = pointing_to

    while True:
        stack = [(_, tree) for _ in tree.keys() if not _.startswith("<")]
        movements = 0

        while stack:
            node_key, parent_node = stack.pop()
            target_node = parent_node[node_key]

            children = set(target_node.keys())
            children.remove("<path>")

            if len(children) > 1:
                for child_key in target_node.keys():
                    if child_key.startswith("<"):
                        continue
                    stack.append((child_key, target_node))
                continue

            if not children:
                continue
            child_key = children.pop()

            movements += 1
            target_popped = parent_node.pop(node_key)
            new_key = join(node_key, child_key)
            parent_node[new_key] = target_popped.pop(child_key)
            new_child = parent_node[new_key]
            new_child["<path>"] = join(target_popped["<path>"], child_key)

            for child_key in new_child.keys():
                if child_key.startswith("<"):
                    continue
                stack.append((child_key, new_child))

        if not movements:
            break

    return tree


async def complete_test_run(test_id: str, current_test_id: str):
    logger.info("Patching up the test run... {}", test_id)

    test_run = await RunBase.filter(testID=test_id).first()
    task = await TaskBase.filter(ticketID=test_run.testID).first()

    if test_run.standing != Status.PENDING:
        logger.warning("Invalid task for completing the test run | {}", test_id)
        return await task.delete()

    filtered = SessionBase.filter(test_id=test_id)

    pending_items = await SuiteBase.filter(
        session__test_id=test_id).filter(
        Q(standing=Status.YET_TO_CALCULATE) | Q(standing=Status.PENDING)).count()

    if pending_items > 0:
        logger.warning("Fix test run: {} was picked but some of its test entities were not processed yet.", test_id)
        await task.update_from_dict(dict(picked=False))
        return await task.save()  # continue in the next run

    if await filtered.count() == 0:
        logger.warning("Detected test run: {} with no sessions", test_id)
        await task.delete()
        return await test_run.delete()

    test_result = await filtered.annotate(
        total_passed=Sum("passed"),
        total_failed=Sum("failed"),
        total_skipped=Sum("skipped"),
        total_retried=Sum("retried"),
        total_tests=Sum("tests"),
        actual_end=Max("ended"),
        actual_start=Min("started")
    ).first().values(
        "total_passed", "total_failed", "total_skipped", "total_retried", "total_tests",
        "actual_end", "actual_start"
    )
    passed = test_result.get("total_passed", 0)
    failed = test_result.get("total_failed", 0)
    skipped = test_result.get("total_skipped", 0)

    filtered_suites = SuiteBase.filter(session__test_id=test_id, suiteType=SuiteType.SUITE)
    summary = dict(
        passed=await filtered_suites.filter(standing=Status.PASSED).count(),
        failed=await filtered_suites.filter(standing=Status.FAILED).count(),
        skipped=await filtered_suites.filter(standing=Status.SKIPPED).count(),
        count=await filtered_suites.count(),
    )

    # start date was initially when we start the shipment
    # now it is when the first session starts
    started = test_result.get("actual_start", test_run.started)
    ended = test_result.get("actual_end", datetime.now())

    await test_run.update_from_dict(dict(
        started=started,
        ended=ended,
        tests=test_result.get("total_tests", 0),
        passed=passed,
        failed=failed,
        skipped=skipped,
        duration=(ended - started).total_seconds() * 1000,
        retried=test_result.get("total_retried", 0),
        specStructure=simplify_file_paths([
            path
            for paths in await filtered.all().distinct().values_list("specs", flat=True)
            for path in paths
        ]),
        standing=fetch_key_from_status(passed, failed, skipped),
        suiteSummary=summary
    ))

    await test_run.save()
    logger.info("Completed the patch for test run | {}", test_id)
    return await task.delete()
