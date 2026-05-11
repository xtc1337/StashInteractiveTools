import os
import shutil
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
    DELETE_SCENES  = "DELETE_SCENES"

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
class DeleteScenesPayload:
    ids:list[str]
    delete_file:bool
    delete_generated:bool

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


def scene_destroy(payload:DeleteScenesPayload):
    query = """
		mutation ScenesDestroy($input:ScenesDestroyInput!) {
			scenesDestroy(input: $input)
		}
		"""
    variables = {
        "input": {
            "delete_file": payload.delete_file,
            "delete_generated": payload.delete_generated,
            "ids": payload.ids
        }
    }
    return config.stash.call_GQL(query, variables)




def backup_before_scene_destroy(payload:DeleteScenesPayload):
    init_task = config.get_task('init')
    query = """
		query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType, $scene_ids: [Int!]) {
			findScenes(filter: $filter, scene_filter: $scene_filter, scene_ids: $scene_ids) {				
				scenes {
				  id
				  files{
				    path
				}				
				}
			}
		}
		"""
    find_results = config.stash.call_GQL(query,{
        "scene_ids":payload.ids,
        "filter":{
            "per_page":-1
        },
        "scene_filter":{}
    })
    scenes = find_results['findScenes']['scenes']
    copied_scene_ids = []
    if len(scenes) != len(payload.ids):
        config.log.error(f"Error backing up {len(payload.ids)} scenes, only {len(scenes)} found")
        return {}
    for scene in scenes:
        file = scene['files'][0]['path']
        scene_id = scene['id']
        scripts = init_task.analyze_file(file,scene_id)
        for script in scripts:
            script_path = script['truePath']
            script_base_name = str(os.path.basename(script_path))
            try:
                shutil.copyfile(script_path, os.path.join(config.BACKUP_DIRECTORY, script_base_name))
                copied_scene_ids.append(scene_id)
            except Exception as e:
                config.log.error(f"Error backing up {script_path}: {e}")
                pass

    payload.scene_ids = list(set(copied_scene_ids))
    return scene_destroy(payload)




def manage_delete_scene(payload:DeleteScenesPayload):
    if not config.BACKUP_ON_SCENES_DELETE:
          return scene_destroy(payload)
    return backup_before_scene_destroy(payload)

ACTIONS={
    ManageAction.SET_AS_DEFAULT: [SetAsDefaultPayload, manage_set_as_default],
    ManageAction.UPDATE_NAME:[UpdateNamePayload,manage_update_name],
    ManageAction.DELETE_SCENES:[DeleteScenesPayload,manage_delete_scene]
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
