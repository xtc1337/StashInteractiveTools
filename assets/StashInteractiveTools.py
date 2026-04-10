import sys
import traceback
from pathlib import Path

from config import get_config


current_path = Path(__file__).resolve()
sys.path.insert(0, str(current_path.parent))
sys.path.insert(0, str(current_path.parent/"automatic_dependencies"))

def main():
    config = get_config()
    config.log.debug(f"Running task paths:'{current_path.parent}'")

    try:
      task = config.get_task(config.mode)
      if hasattr(task,'run'):
          config.log.debug(f"Running task paths:'{current_path.parent}'")
          task.run(config)
      else:
          config.log.error(f"'run' function not found in module {config.mode}")
    except Exception:
        error = traceback.format_exc()
        config.log.exit({},f"Error running task '{config.mode}' ${error}")

        #config.log.error(f"Task module '{config.mode}' not found.")
        #config.log.error(traceback.format_exc())
        #f = open(
        #    './error-{}.json'.format(datetime.now().strftime("%Y%m%d-%H%M%S")),
        #    'w+')
        #f.write(traceback.format_exc())
        #f.close()
        #



if __name__ == "__main__":
        main()


