from tortoise.models import Model
from tortoise.fields import (
    CharField,
    DatetimeField,
    JSONField,
    CharEnumField,
    ForeignKeyField,
    ForeignKeyRelation,
    BooleanField,
    TextField,
)
from handshake.services.SchedularService.constants import JobType
from handshake.services.DBService.models.result_base import RunBase
from handshake.services.DBService.models.enums import PrunedRecords


class TaskBase(Model):
    table = "TaskBase"

    ticketID = CharField(max_length=45, pk=True)
    type = CharEnumField(JobType, null=False)
    dropped = DatetimeField(auto_now=True)  # use modified timestamp
    # this would schedule the parent suites in the later rounds
    meta = JSONField(
        null=True,
        default={},
        description="Data required to process the task, Not used as of now though",
    )
    test: ForeignKeyRelation[RunBase] = ForeignKeyField(
        "models.RunBase", related_name="tasks", to_field="testID"
    )
    picked = BooleanField(
        null=True,
        default=False,
        description="True if the task is picked by the job else False",
    )


class PrunedBase:
    prunedID = CharField(
        max_length=36, description="possibly uuid of length 36 that was pruned"
    )
    reason = TextField(description="Reason for its existence here")
    details = JSONField(
        null=True, default={}, description="If any details were required"
    )
    type = CharEnumField(PrunedRecords, null=False)
