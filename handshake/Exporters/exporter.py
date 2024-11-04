from ANSIToHTML.parser import Parser
from loguru import logger
from typing import Optional
from abc import ABC, abstractmethod
from handshake.services.DBService.models.attachmentBase import AssertBase
from handshake.services.DBService.models.result_base import (
    SuiteBase,
    SuiteType,
    SessionBase,
)
from handshake.services.DBService.models.static_base import StaticBase
from handshake.services.SchedularService.refer_types import (
    SubSetOfRunBaseRequiredForProjectExport,
    SuiteSummary,
)
from json import loads
from asyncio import TaskGroup
from tortoise import BaseDBAsyncClient
from tortoise.connection import connections
from tortoise.expressions import Q, RawSQL
from asyncio import gather


class Exporter(ABC):
    connection: BaseDBAsyncClient

    def __init__(
        self,
        dev_run: bool = False,
    ):
        self.converter = Parser()
        self.dev_run = dev_run
        self.export_mode = dict(json=False, excel=False)

    def convert_from_ansi_to_html(self, refer_from: dict, key: str):
        refer_from[key] = self.converter.parse(refer_from[key])

    async def start_exporting(
        self, run_id: Optional[str] = None, skip_project_summary: bool = False
    ):
        self.connection: BaseDBAsyncClient = connections.get("default")
        self.prepare()
        await self.export_runs_page(run_id, skip_project_summary)
        logger.info("Done!")

    @abstractmethod
    def prepare(self): ...

    async def export_runs_page(
        self, run_id: Optional[str] = None, skip_project_summary=False
    ):
        logger.debug("Exporting Runs Page...")

        async with TaskGroup() as exporter:
            runs = []
            projects = {}
            extra_join_query = f"and rb.testID = '{run_id}'" if run_id else ""
            for row in (
                await self.connection.execute_query(
                    f"""
    select rb.*, cb.*,
    rank() over (order by rb.ended desc) as timelineIndex,
    rank() over (partition by projectName order by rb.ended desc) as projectIndex
    from RUNBASE rb
    join testconfigbase cb 
    on rb.testID = cb.test_id
    {extra_join_query} 
    WHERE rb.ended <> '' order by rb.started;
    -- note for: projectIndex and timelineIndex, latest -> oldest => 0 - ...
    """
                )
            )[-1]:
                run = dict(row)
                test_run = SubSetOfRunBaseRequiredForProjectExport.model_validate(run)
                runs.append(run)

                logger.info(
                    "Exporting runs page for {} - {}",
                    test_run.projectName,
                    test_run.testID,
                )

                exporter.create_task(
                    self.export_test_run_summary(test_run.testID, run),
                    name=f"export-test-run-summary-{test_run.testID}",
                )

                if not skip_project_summary:
                    projects[test_run.projectName] = projects.get(
                        test_run.projectName, []
                    )
                    suite_summary: SuiteSummary = loads(test_run.suiteSummary)
                    projects[test_run.projectName].append(
                        dict(
                            testID=test_run.testID,
                            passed=test_run.passed,
                            failed=test_run.failed,
                            skipped=test_run.skipped,
                            tests=test_run.tests,
                            passedSuites=suite_summary["passed"],
                            failedSuites=suite_summary["failed"],
                            skippedSuites=suite_summary["skipped"],
                            suites=suite_summary["count"],
                            duration=test_run.duration,
                        )
                    )

                exporter.create_task(
                    self.export_run_page(test_run.testID),
                    name="export-more-for-run-page",
                )

            if not skip_project_summary:
                exporter.create_task(
                    self.export_project_summary(runs, projects),
                    name="export-project-summary",
                )

            logger.info("Exported Runs Page!")

    @abstractmethod
    def export_test_run_summary(self, testID: str, results): ...

    async def export_run_page(self, run_id: str, skip_recent_suites: bool = False):
        await gather(
            self.export_overview_page(run_id, skip_recent_suites),
            self.export_all_suites(run_id),
        )

    @abstractmethod
    async def export_project_summary(self, run_feed, projects_feed): ...

    async def export_overview_page(self, run_id: str, skip_recent_suites: bool = False):
        if not skip_recent_suites:
            recent_suites = await (
                SuiteBase.filter(
                    Q(session__test_id=run_id) & Q(suiteType=SuiteType.SUITE)
                )
                .order_by("-started")
                .limit(6)
                .annotate(
                    # numberOfErrors=RawSQL("json_array_length(errors)"),
                    id=RawSQL("suiteID"),
                    s=RawSQL("suitebase.started"),
                )
                .values(
                    "title",
                    "passed",
                    "failed",
                    "skipped",
                    "duration",
                    suiteID="id",
                    started="s",
                )
            )
        else:
            recent_suites = []

        aggregated = (
            await SuiteBase.filter(session__test_id=run_id)
            .annotate(
                sessions=RawSQL("count(DISTINCT session_id)"),
                files=RawSQL("count(DISTINCT file)"),
            )
            .only("sessions", "files")
            .first()
            .values("sessions", "files")
        )

        platforms = (
            await SessionBase.filter(test_id=run_id)
            .only("entityName", "entityVersion", "simplified")
            .distinct()
            .values("entityName", "entityVersion", "simplified")
        )

        await self.export_overview_of_test_run(
            run_id,
            dict(
                recentSuites=recent_suites,
                aggregated=aggregated,
                platforms=platforms,
            ),
        ),

    @abstractmethod
    async def export_overview_of_test_run(self, run_id: str, summary): ...

    async def export_all_suites(self, run_id: str):
        all_suites = await (
            SuiteBase.filter(Q(session__test_id=run_id) & Q(suiteType=SuiteType.SUITE))
            .order_by("started")
            .prefetch_related("rollup")
            .annotate(
                numberOfErrors=RawSQL("json_array_length(errors)"),
                id=RawSQL("suiteID"),
                p_id=RawSQL("parent"),
                s=RawSQL("suitebase.started"),
                e=RawSQL("suitebase.ended"),
                error=RawSQL("errors ->> '[0]'"),
                nextSuite=RawSQL(
                    "(select suiteID from suitebase sb join sessionbase ssb on sb.session_id = ssb.sessionID"
                    " where sb.suiteType = 'SUITE' AND sb.standing <> 'RETRIED' "
                    " and suitebase.started <= sb.started and sb.suiteID <> suitebase.suiteID"
                    " and 'suitebase__session'.'test_id' = ssb.test_id order by sb.started)"
                ),
                prevSuite=RawSQL(
                    "(select suiteID from suitebase sb join sessionbase ssb on sb.session_id = ssb.sessionID"
                    " where sb.suiteType = 'SUITE' AND sb.standing <> 'RETRIED' "
                    " and suitebase.started >= sb.started and sb.suiteID <> suitebase.suiteID"
                    " and 'suitebase__session'.'test_id' = ssb.test_id order by sb.started)"
                ),
                hasChildSuite=RawSQL(
                    "(select count(*) from suitebase sb where sb.parent=suitebase.suiteID "
                    "and sb.suiteType='SUITE' LIMIT 1)"
                ),
            )
            .values(
                "title",
                "passed",
                "failed",
                "standing",
                "tests",
                "skipped",
                "duration",
                "file",
                "retried",
                "tags",
                "description",
                "errors",
                "error",
                "numberOfErrors",
                "hasChildSuite",
                "nextSuite",
                "prevSuite",
                suiteID="id",
                parent="p_id",
                started="s",
                ended="e",
                entityName="session__entityName",
                entityVersion="session__entityVersion",
                hooks="session__hooks",
                simplified="session__simplified",
                rollup_passed="rollup__passed",
                rollup_failed="rollup__failed",
                rollup_skipped="rollup__skipped",
                rollup_tests="rollup__tests",
            )
        )
        # keep here as we would need to create directory first for the suite
        await self.export_all_suites_of_test_run(
            run_id,
            all_suites,
        )
        await gather(
            *[
                self.export_suite(run_id, str(suite))
                for suite in await SuiteBase.filter(
                    Q(session__test_id=run_id) & Q(suiteType=SuiteType.SUITE)
                ).values_list("suiteID", flat=True)
            ],
        )

    @abstractmethod
    async def export_all_suites_of_test_run(self, run_id, all_suites): ...

    async def export_suite(self, run_id: str, suite_id: str):
        tests = await (
            SuiteBase.filter(Q(parent=suite_id))
            .order_by("started")
            .prefetch_related("rollup")
            .annotate(
                numberOfErrors=RawSQL("json_array_length(errors)"),
                id=RawSQL("suiteID"),
                s=RawSQL("suitebase.started"),
                e=RawSQL("suitebase.ended"),
                error=RawSQL("errors ->> '[0]'"),
                assertions=RawSQL(
                    "(select count(ab.entity_id) from assertbase ab where ab.entity_id=suitebase.suiteID)"
                ),
            )
            .values(
                "title",
                "standing",
                "assertions",
                "duration",
                "file",
                "retried",
                "tags",
                "suiteType",
                "description",
                "errors",
                "error",
                "numberOfErrors",
                suiteID="id",
                started="s",
                ended="e",
                hooks="session__hooks",
                rollup_passed="rollup__passed",
                rollup_failed="rollup__failed",
                rollup_skipped="rollup__skipped",
                rollup_tests="rollup__tests",
            )
        )

        assertions = (
            await AssertBase.filter(entity__parent=suite_id)
            .annotate(id=RawSQL("entity_id"))
            .all()
            .values("title", "message", "interval", "passed", "wait", entity_id="id")
        )

        written_records = {}
        assertion_records = {}
        written = (
            await StaticBase.filter(entity__parent=suite_id)
            .annotate(
                id=RawSQL("entity_id"),
                file=RawSQL("value"),
                url=RawSQL(
                    f"'/api/Attachments' || '/{run_id}/' || entity_id || '/' || value"
                    if self.dev_run
                    else f"'/Attachments' || '/{run_id}/' || entity_id || '/' || value"
                ),
            )
            .all()
            .values("type", "title", "description", "file", "url", entity_id="id")
        )

        for refer_from, save_in, for_records in zip(
            (written, assertions),
            (written_records, assertion_records),
            ("written", "assertions"),
        ):
            for record in refer_from:
                records = save_in.get(record["entity_id"], [])
                records.append(record)
                if for_records == "assertions":
                    self.convert_from_ansi_to_html(record, "message")
                save_in[record["entity_id"]] = records

        retried_map = {}

        _, rows = await connections.get("default").execute_query(
            "select key, value as suite, rb.tests, length, suite_id"
            " from retriedbase rb join json_each(rb.tests)"
            " join suitebase sb on suite = sb.suiteID"
            " join sessionbase ssb on ssb.sessionID = sb.session_id"
            " where ssb.test_id = ?",
            (run_id,),
        )

        for row in rows:
            retried_map[row["suite"]] = dict(row)

        await gather(
            self.export_tests(run_id, suite_id, tests),
            self.export_attachments(
                run_id, suite_id, assertion_records, written_records
            ),
            self.export_retries_map(run_id, suite_id, retried_map),
        )

    @abstractmethod
    def export_tests(self, run_id, suite_id, tests): ...

    @abstractmethod
    def export_attachments(
        self, run_id, suite_id, assertion_records, written_records
    ): ...

    @abstractmethod
    def export_retries_map(self, run_id, suite_id, retried_map): ...
