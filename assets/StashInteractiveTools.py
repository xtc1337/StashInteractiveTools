import traceback
from datetime import datetime
from config import get_config
import sys
from pathlib import Path

current_path = Path(__file__).resolve()
sys.path.insert(0, str(current_path.parent))
sys.path.insert(0, str(current_path.parent/"automatic_dependencies"))

def main():
    config = get_config()
    try:
      task = config.get_task(config.mode)
      if hasattr(task,'run'):
          task.run(config)
      else:
          config.log.error(f"'run' function not found in module {config.mode}")
    except Exception:
        config.log.error(f"Task module '{config.mode}' not found.")
        config.log.error(traceback.format_exc())
        f = open(
            './error-{}.json'.format(datetime.now().strftime("%Y%m%d-%H%M%S")),
            'w+')
        f.write(traceback.format_exc())
        f.close()




if __name__ == "__main__":
        main()


