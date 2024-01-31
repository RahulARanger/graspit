from loguru import logger
from handshake.services.DBService.models.dynamic_base import TaskBase, JobType
from uuid import uuid4, UUID
from typing import Union
from handshake.services.DBService.models.result_base import TestLogBase, LogType
from handshake.services.DBService.lifecycle import init_tortoise_orm, close_connection
from handshake.services.DBService.models.config_base import ExportBase
from handshake.services.DBService.models.result_base import RunBase
from pathlib import Path
from typing import List
from os import getenv


async def register_patch_suite(suiteID: str, testID: str) -> TaskBase:
    return await TaskBase.create(
        ticketID=suiteID, test_id=testID, type=JobType.MODIFY_SUITE
    )


async def register_patch_test_run(testID: str) -> TaskBase:
    return await TaskBase.create(
        type=JobType.MODIFY_TEST_RUN, test_id=testID, ticketID=testID
    )


async def mark_for_prune_task(test_id: str):
    logger.warning("Requested to prune some tasks")
    await TaskBase.create(
        ticketID=str(uuid4()), type=JobType.PRUNE_TASKS, test_id=test_id
    )


async def skip_test_run(test_id: Union[str, UUID], reason: str, **extra) -> False:
    logger.error(reason)
    await TestLogBase.create(
        test_id=str(test_id), message=reason, type=LogType.ERROR, feed=extra
    )
    await mark_for_prune_task(test_id)
    return False


async def warn_about_test_run(test_id: Union[str, UUID], about: str, **extra) -> True:
    logger.warning(about)
    await TestLogBase.create(
        test_id=str(test_id), message=about, type=LogType.WARN, feed=extra
    )
    return True


async def createExportTicket(
    maxTestRuns: int, path: Path, store: List[str], runs: List[str], clarity
):
    await init_tortoise_orm(path)
    ticket = await ExportBase.create(
        maxTestRuns=maxTestRuns, clarity="" if not clarity else getenv("CLARITY")
    )

    runs.extend(
        await RunBase.all()
        .order_by("-started")
        .limit(maxTestRuns)
        .values_list("testID", flat=True)
    )

    await close_connection()
    store.append(str(ticket.ticketID))


async def deleteExportTicket(ticketID: str):
    task = await ExportBase.filter(ticketID=ticketID).first()
    logger.info("Deleting the Export ticket: {}", ticketID)
    await task.delete()
