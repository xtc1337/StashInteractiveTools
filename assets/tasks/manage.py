from dataclasses import dataclass
from enum import Enum
from typing import Generic, TypeVar
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from assets.config import Config


config: 'Config'


T = TypeVar("T")
class ManageAction(Enum):
    SET_AS_DEFAULT = "SET_AS_DEFAULT"
    UPDATE_NAME   = "UPDATE_NAME"

@dataclass
class BasePayload:
    scene_id:str

@dataclass
class SetAsDefaultPayload(BasePayload):
    script_id:int

@dataclass
class UpdateNamePayload(BasePayload):
    script_id:int
    name:str


@dataclass
class ManageActionRequest(Generic[T]):
    action: ManageAction
    payload: T



def manage_set_as_default(payload: SetAsDefaultPayload):
    from peewee import Case
    Funscript = config.Funscript()
    Funscript.update(
        is_default=Case(
            None,
            ((Funscript.id == payload.script_id, True),),
            False,
        )
    ).where(Funscript.scene_id == payload.scene_id).execute()
    return {"success":True}

def manage_update_name(payload:UpdateNamePayload):
    Funscript = config.Funscript()
    Funscript.update(Funscript.name == payload.name).where(Funscript.id ==payload.script_id).execute()
    return {"success":True}


ACTIONS={
    ManageAction.SET_AS_DEFAULT: [SetAsDefaultPayload, manage_set_as_default],
    ManageAction.UPDATE_NAME:[UpdateNamePayload,manage_update_name]
}

def resolve_payload(raw_value, parent_data, path):
    action = ManageAction(parent_data.get("action"))
    return ACTIONS.get(action,[None])[0]


def run(c: 'Config'):
    global config
    config = c
    request = config.bind(ManageActionRequest,{
        'payload':resolve_payload
    })
    action = ACTIONS.get(request.action,[None,None])[1]
    results = {"error":"Invalid Action"}
    if action:
        results = action(request.payload)

    config.log.exit(results)
