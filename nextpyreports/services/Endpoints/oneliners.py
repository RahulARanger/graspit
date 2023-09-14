from nextpyreports.services.DBService.models.task_base import TaskBase
from nextpyreports.services.DBService.shared import get_test_id
from nextpyreports.services.DBService.lifecycle import close_connection
from sanic.blueprints import Blueprint
from nextpyreports.services.SchedularService.constants import JobType
from sanic.response import HTTPResponse, text
from sanic.request import Request

one_liners = Blueprint(name="one_liners", url_prefix="/")


# Here we will have requests which are very simple but used at crucial points

@one_liners.get("/")
async def health_status(request: Request) -> HTTPResponse:
    return text("1")


@one_liners.put("/done")
async def set_done(request: Request) -> HTTPResponse:
    task = await TaskBase.create(
        type=JobType.MODIFY_TEST_RUN,
        test_id=get_test_id(), ticketID=get_test_id()
    )
    return text(task.ticketID)


# bye is core request, so make sure to handle it carefully
@one_liners.post("/bye")
async def bye(request: Request) -> HTTPResponse:
    await close_connection()
    request.app.m.terminate()
    return text("1")
