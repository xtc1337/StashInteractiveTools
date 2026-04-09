import glob
import os
import os.path
import re
import shutil
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, List, AnyStr, Optional

import requests

if TYPE_CHECKING:
    from assets.config import Config
    from assets.db import Funscript as FunscriptModel

Funscript: type['FunscriptModel']

config: type['Config']


@dataclass
class StashFunscript:
    label: str
    path: str
    true_path: str
    is_default: bool = False
    id: Optional[int] = None
    sort_order: int = 0

    @staticmethod
    def from_db(data: type['FunscriptModel']):
        return StashFunscript(
            id=data.id,
            label=data.name,
            path=data.path,
            true_path=data.true_path,
            is_default=data.is_default,
            sort_order=data.sort_order,
        )

    def for_json(self):
        return {
            'id': self.id,
            'label': self.label,
            'path': self.path,
            'truePath': self.true_path,
            'isDefault': self.is_default,
            'sortOrder': self.sort_order
        }


def parse_label_regex(script_filename, file_filename):
    pass


def parse_label_default(script_filename, file_filename):
    same_name = script_filename == file_filename
    label = 'Default' if same_name else script_filename.replace(
        file_filename, '')
    return re.sub(r'[()]', '', label).strip()


def map_script(script: Path, file: str, scene_id) -> StashFunscript:
    output = os.path.join(config.PLUGIN_DIR, '.scripts',
                          scene_id)  # type: ignore
    if not os.path.exists(output):
        os.makedirs(output, exist_ok=True)

    file_filename = os.path.splitext(os.path.basename(file))[0]
    script_base_name = os.path.basename(script)
    script_filename = os.path.splitext(script_base_name)[0]

    shutil.copyfile(script, os.path.join(output, script_base_name))

    path = f'{config.PLUGIN_HTTP_ASSETS_PATH}/.scripts/{scene_id}/{urllib.parse.quote(script_filename)}.funscript'
    parser = parse_label_default  # if not config.NAMING_CONVENTION else parse_label_regex
    label = parser(script_filename, file_filename)
    return StashFunscript(label=label, path=path, true_path=script.as_posix())


VIDEO_EXTENSIONS = ['mp4', 'mov', 'wmv', 'avi', 'mkv']


def filter_out_false_versions(base_name, file):
    file_dir = os.path.dirname(file)
    name = os.path.splitext(os.path.basename(file))[0]
    # keep
    if name == base_name:
        return True
    for ext in VIDEO_EXTENSIONS:
        to_check = os.path.join(file_dir, f'{name}.{ext}')
        if os.path.exists(to_check):
            return False
    return True


def deterministic_sort_scripts(scripts: List[StashFunscript]):
    return sorted(
        scripts,
        key=lambda x: (0 if x.is_default else 1, x.sort_order),
    )

def get_funscripts(file, scene_id) -> List[Path]:
    filename = os.path.basename(file)
    file_dir = Path(os.path.dirname(file))
    name = os.path.splitext(filename)[0]
    name_escaped = glob.escape(name)
    files = list(file_dir.glob(f'{name_escaped}*.funscript'))
    return list(filter(lambda f: filter_out_false_versions(name, f), files))


def insert_funscript_records(
        to_insert: List[StashFunscript],
        scene_id: AnyStr,
        starting_sort_order=0,
):
    rows = [
        Funscript(scene_id=scene_id, path=f.path,
                  true_path=f.true_path,
                  name=f.label,
                  is_default=f.label == 'Default',
                  sort_order=starting_sort_order + i).__data__

        for i, f in enumerate(to_insert)
    ]
    return list(Funscript.insert_many(rows).returning(Funscript).execute())


def ensure_funscript_records(auto_discovered_scripts: List[StashFunscript],
                             scene_id: AnyStr) -> List[StashFunscript]:
    """Ensures known funscript records include newly discovered ones"""

    known_scripts = list(Funscript.select().where(
        Funscript.scene_id == scene_id).order_by(
        Funscript.sort_order.asc()).execute())
    known_scripts_paths = [script.true_path for script in known_scripts]

    newly_discovered = list(
        filter(lambda f: f.true_path not in known_scripts_paths,
               auto_discovered_scripts))
    config.log.debug(f'Auto discovered scripts: ${auto_discovered_scripts}')
    if len(newly_discovered) > 0:
        list(known_scripts).append(
            insert_funscript_records(newly_discovered, scene_id,
                                     len(known_scripts)))
    config.log.debug(f'Known scripts: {known_scripts}')
    return [StashFunscript.from_db(script) for script in known_scripts]


def analyze_file(file: str, scene_id: str):
    script_file_paths = get_funscripts(file, scene_id)
    auto_discovered_scripts =  [map_script(script_file_path, file, scene_id) for script_file_path in
         script_file_paths]
    scripts = deterministic_sort_scripts(ensure_funscript_records(auto_discovered_scripts, scene_id))

    if 'omit_default' in config.FRAGMENT['args']:
        scripts = list(
            filter(lambda script: script.name != 'Default', scripts))
    return [script.for_json() for script in scripts]


def contains_value(array, value):
    # Check if any string in the array contains the given value
    return any(
        value in element for element in array if isinstance(element, str))


def find_single_element(array, value):
    # Iterate over the array to find the first matching element
    for element in array:
        if isinstance(element, str) and value in element:
            return element
    return None  # Return None if no match is found


BASE_IVDB_URL = 'https://scripts01.handyfeeling.com/api/script/index/v0/videos/'


def lookup_ivdb_script(url, token):
    partner_video_id = url.split('/')[-1]
    response = requests.get(f'{BASE_IVDB_URL}{partner_video_id}/scripts')
    if response.status_code == 200:
        data = response.json()
        script_id = data[0]['scriptId']
        token_url = f'{BASE_IVDB_URL}{partner_video_id}/scripts/{script_id}/token'
        config.log.debug(
            f'Looking up ivdb script {script_id} for {partner_video_id}: {token_url}')
        response = requests.get(token_url
                                ,
                                headers={'Authorization': f'Bearer {token}'})
        if response.status_code == 200:
            data = response.json()
            script_url = data['url']
            return {'label': 'Ivdb.io', 'path': script_url}
    return None


def analyze_scene():
    if 'scene_id' not in config.FRAGMENT['args']:
        return []
    scene_id = config.FRAGMENT["args"]['scene_id']
    fragment = """
       interactive
		urls
        files{
         id
          path
        }
		"""
    scene = config.stash.find_scene(scene_id, fragment)
    # log.info(json.dumps(scene))
    scripts = []
    if scene['interactive']:
        scripts.extend(analyze_file(scene['files'][0]['path'], scene_id))
    ivdb_url = find_single_element(scene['urls'], 'ivdb.io/#/videos/')
    if not scene['interactive'] and ivdb_url:
        sql = f"UPDATE video_files SET interactive_speed = 1 , interactive = 1  WHERE file_id = {scene['files'][0]['id']}"
        config.log.info(sql)
        results = config.stash.sql_query(sql)
        config.log.info(results)

    if ivdb_url and config.HANDY_TOKEN:

        ivdb_script = lookup_ivdb_script(ivdb_url, config.HANDY_TOKEN)
        if ivdb_script:
            scripts.append(ivdb_script)
    return scripts


def run(c: 'Config'):
    global config, Funscript
    config = c

    Funscript = c.Funscript()

    scripts = analyze_scene()
    config.log.exit({'scripts': scripts})
