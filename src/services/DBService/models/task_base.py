from tortoise.models import Model
from tortoise.fields import CharField, DatetimeField, JSONField, CharEnumField, ForeignKeyField, ForeignKeyRelation
from src.services.SchedularService.constants import JobType


class TaskBase(Model):
    table = "TaskBase"

    ticketID = CharField(max_length=45, pk=True)
    type = CharEnumField(JobType, null=False)
    dropped = DatetimeField(auto_now=True)
    meta = JSONField(null=True, default={}, description="Data required to process the task, Not used as of now though")
    test = ForeignKeyField(
        "models.RunBase", related_name="tasks", to_field="testID"
    )
