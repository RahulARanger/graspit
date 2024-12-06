from handshake.services.DBService.models.result_base import SuiteBase, RunBase
from tortoise.models import Model
from tortoise.fields import (
    ForeignKeyField,
    ForeignKeyRelation,
    TextField,
    IntField,
    DatetimeField,
    CharField,
    BooleanField,
    CharEnumField,
    JSONField,
)
from handshake.services.DBService.models.enums import LogType
from handshake.services.SchedularService.register import JobType


class AssertBase(Model):
    entity: ForeignKeyRelation[SuiteBase] = ForeignKeyField(
        "models.SuiteBase", related_name="assertion", to_field="suiteID"
    )
    passed = BooleanField(
        default=False, description="Whether the assertion passed or not"
    )
    wait = IntField(
        description="Number of milli-seconds configured to wait for this test",
        default=-1,
        null=True,
    )
    interval = IntField(
        description="interval (in milli-seconds) to test this assertion until it passes",
        default=-1,
        null=True,
    )
    title = TextField(description="Name of the Assertion")
    message = TextField(description="Message attached to the assertion")


class EntityLogBase(Model):
    entity: ForeignKeyRelation[SuiteBase] = ForeignKeyField(
        "models.SuiteBase", related_name="entityLog", to_field="suiteID"
    )
    title = TextField(description="title for the log", null=False)
    message = TextField(description="formatted log message", null=False)
    type = CharEnumField(LogType, description="Log type", null=False)
    dropped = DatetimeField(auto_now=True, description="timestamp", null=False)
    generatedBy = CharEnumField(
        JobType,
        description="which job generated this, Null if generated by the user",
        null=True,
        default=None,
    )
    tags = JSONField(
        description="comma separated list of tags used by the framework to filter the suites or spec files",
        default=[],
    )


class TestLogBase(Model):
    test: ForeignKeyRelation[RunBase] = ForeignKeyField(
        "models.RunBase", related_name="log", to_field="testID", pk=True
    )
    type = CharEnumField(LogType, description="Log type", null=False)
    message = TextField(description="Log Message", null=False)
    generatedBy = CharField(
        description="which job generated this, Null if generated by the user",
        null=True,
        default="NA",
        max_length=200,
    )
    tags = JSONField(
        description="comma separated list of tags used by the framework to filter the suites or spec files",
        default=[],
    )
    dropped = DatetimeField(auto_now=True, description="timestamp", null=False)
    apiGenerated = BooleanField(
        default=False,
        description="is it generated by api endpoints, if so generatedBy will have api endpoint name",
    )
    schedulerGenerated = BooleanField(
        default=False,
        description="is it generated by the scheduler jobs, if so the generatedBy will have job Name",
    )

    userGenerated = BooleanField(
        default=False,
        description="is it attached by the user, if so generatedBy will be NULL",
    )
