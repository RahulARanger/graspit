from handshake.services.Endpoints.core import service_provider
from handshake.services.DBService.lifecycle import init_tortoise_orm, close_connection
from handshake.services.DBService.shared import set_test_id
import asyncio
from signal import signal, SIGTERM, SIGINT
from sanic import Sanic


@service_provider.before_server_start
async def before_start_of_day(*args):
    set_test_id()
    await init_tortoise_orm()

@service_provider.after_server_stop
async def close_app(*args):
    await close_connection()
