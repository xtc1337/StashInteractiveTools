from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from assets.config import Config

import time
config:'Config'

BULK_SCENE_UPDATE = "mutation BulkSceneUpdate($input: BulkSceneUpdateInput!) {\n  bulkSceneUpdate(input: $input) { id } } "
SCENE_FRAGMENT = """
id
tags { id }
files {
 path
}
"""
def tag_scenes():
    tag_id = config.stash.find_tag(config.TAG_NAME, create=True).get('id')
    page = 1
    total = -1
    seen = 0
    init_task = config.get_task('init')

    while seen != total:
        to_tag = []
        remove_tag = []
        total, scenes = config.stash.find_scenes({
            'interactive': True
        }, {
            'page': page,
            'per_page': 100,
            'direction': 'DESC',
            'sort': 'updated_at'
        }, "", SCENE_FRAGMENT, True)
        seen += len(scenes)
        if not len(scenes):
            break
        for scene in scenes:
            file = scene['files'][0]['path']
            funcount = len(init_task.get_funscripts(file))
            config.log.debug(f'Scanning {file} with {funcount} funscripts')
            if funcount > 1:
                if {'id': tag_id} not in scene['tags']:
                   config.log.info(f'Tagging {file} with {funcount} funscripts')
                   to_tag.append(scene['id'])
                else:
                   config.log.debug(f'Already Tagged: {file}')
            else:
                if {'id': tag_id} in scene['tags']:
                   config.log.info(f'Untagging {file}, only 1 funscript')
                   remove_tag.append(scene['id'])
        if len(to_tag):
            update_tags(to_tag, tag_id)
            time.sleep(0.200)
        if len(remove_tag):
            update_tags(remove_tag, tag_id, mode='REMOVE')
            time.sleep(0.200)
        config.log.progress(seen/total)
        page += 1

    scenes = config.stash.find_scenes({
                 'interactive': False,
                 'file_count': {
                    'value': 1,
                    'modifier': 'EQUALS'
                    },
                 'tags_filter': {
                    'name': {
                        'modifier': "EQUALS",
                        'value': config.TAG_NAME,
                     }
                 }
             }, fragment=" id ")
    if len(scenes):
           config.log.info(f"found {len(scenes)} noninteractive scenes tagged")
           remove_ids = [item['id'] for item in scenes]
           update_tags(remove_ids, tag_id, mode='REMOVE')

def update_tags(ids, tag_id, mode='ADD'):
    config.log.debug(f'processing: {mode} tag {tag_id} on scene ids: {ids}')
    config.stash.call_GQL(BULK_SCENE_UPDATE, {
        'input': {'ids': ids,
                  'tag_ids': {
                      'mode': mode,
                      'ids': [tag_id]
                  }
                 }
    })

def run(c:'Config'):
    global config
    config = c
    tag_scenes()


