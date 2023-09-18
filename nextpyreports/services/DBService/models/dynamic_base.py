from nextpyreports.services.DBService.models.config_base import AttachmentFields
from nextpyreports.services.DBService.models.result_base import SuiteBase
from typing import TypedDict
from tortoise.models import Model
from tortoise.fields import CharField, DatetimeField, JSONField, CharEnumField, ForeignKeyField, ForeignKeyRelation, \
    BooleanField
from nextpyreports.services.SchedularService.constants import JobType
from nextpyreports.services.DBService.models.result_base import RunBase


class TaskBase(Model):
    table = "TaskBase"

    ticketID = CharField(max_length=45, pk=True)
    type = CharEnumField(JobType, null=False)
    dropped = DatetimeField(auto_now=True)  # use modified timestamp
    # this would schedule the parent suites in the later rounds
    meta = JSONField(null=True, default={}, description="Data required to process the task, Not used as of now though")
    test: ForeignKeyRelation[RunBase] = ForeignKeyField(
        "models.RunBase", related_name="tasks", to_field="testID"
    )
    picked = BooleanField(null=True, default=False, description="True if the task is picked by the job else False")


class DynamicVideoBase(AttachmentFields):
    table = "VideoBase"
    test: ForeignKeyRelation[SuiteBase] = ForeignKeyField(
        "models.SuiteBase", related_name="attachments", to_field="suiteID"
    )

# class DynamicVideoBase(TypedDict):
