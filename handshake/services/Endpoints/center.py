from handshake.services.Endpoints.core import service_provider
from handshake.services.DBService.lifecycle import init_tortoise_orm, close_connection
from handshake.services.DBService.shared import set_test_id
import asyncio
from loguru import logger
from signal import signal, SIGTERM, SIGINT
from sanic import Sanic


@service_provider.before_server_start
async def before_start_of_day(app: Sanic, loop):
    set_test_id()
    await init_tortoise_orm()


def close_app(*args):
    asyncio.run(close_connection())


@service_provider.main_process_ready
def handle_signals(app, loop):
    signal(SIGINT, close_app)
    signal(SIGTERM, close_app)
