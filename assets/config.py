import importlib
import json
import os.path
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from stashapi.stashapp import StashInterface
    import stashapi.log as stash_log

DEBUG = False
DEBUG = os.environ.get('STASH_INTERACTIVE_TOOLS_DEBUG',DEBUG)



class Config:
    """
    Configuration container for plugin behavior, logging, and runtime state.

    Attributes:
        PLUGIN_DIR (str): Filesystem path to the plugin directory.
        PLUGIN_HTTP_ASSETS_PATH (str): URL path to access HTTP assets.
        FRAGMENT (dict): Arbitrary configuration or state fragment.
        stash (StashInterface): Interface for stash operations.
        log (stash_log): Logger instance tied to the stash system.
        mode (str): Current mode of operation (e.g., 'init', 'run').
        ENABLE_TAGGING (bool): Flag to enable or disable tagging behavior.
        TAG_NAME (str): Tag format used when tagging is enabled.
        NAMING_CONVENTION (str): Pattern used for naming conventions.
    """

    PLUGIN_DIR: str = ''
    PLUGIN_HTTP_ASSETS_PATH: str = ''
    FRAGMENT: dict = {}
    stash: 'StashInterface'
    log: 'stash_log'
    mode: str = 'init'
    ID = 'StashInteractiveTools'
    ENABLE_TAGGING: bool = False
    TAG_NAME: str = '[SIT: Multi-Script]'
    NAMING_CONVENTION: str = ''
    HANDY_TOKEN: str = ''
    PAYLOAD_FILE = os.path.join(os.path.dirname(os.path.realpath(__file__)),
                                'payload.json')

    def get_task(self,name=None):
        if name is None:
            name = self.mode
        task_module = f'tasks.{name}'
        return importlib.import_module(task_module)

config: Config


def get_stash_client():
    global config
    try:
        import stashapi.log as log
        from stashapi.stashapp import StashInterface
    except (ImportError, ModuleNotFoundError) as e:
        from tasks.install import run
        run()
    import stashapi.log as log
    from stashapi.stashapp import StashInterface
    stash = StashInterface(config.FRAGMENT['server_connection'])
    config.stash = stash
    config.log = log
    return stash


def get_config():
    global config

    config = Config()

    if DEBUG :
        handle = open(config.PAYLOAD_FILE)
        config.FRAGMENT = json.load(handle)
        handle.close()

    else:
        config.FRAGMENT = json.loads(sys.stdin.read())
        config.mode = config.FRAGMENT["args"]["mode"]
        handle = open(config.PAYLOAD_FILE, 'w+')
        handle.write(json.dumps(config.FRAGMENT))

        handle.close()

    stash = get_stash_client()

    config.PLUGIN_DIR = config.FRAGMENT["server_connection"]['PluginDir']
    origin = config.FRAGMENT["args"].get("origin", stash.url.replace('/graphql', ''))
    config.PLUGIN_HTTP_ASSETS_PATH = f'{origin}/plugin/StashInteractiveTools/assets'

    c = stash.find_plugin_config(config.ID)
    config.ENABLE_TAGGING = bool(c.get('enable_tagging'))
    tag_name = c.get('multi_script_tag')
    config.NAMING_CONVENTION = c.get('naming_convention')
    if not tag_name:
        tag_name = '[SIT: Multi-Script]'
    config.TAG_NAME = tag_name
    config.HANDY_TOKEN = config.FRAGMENT["args"].get("handy_token","")
    return config
