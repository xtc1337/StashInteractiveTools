from peewee import *
from pathlib import Path
from inspect import stack



paths = [frame.filename for frame in stack() if not frame.filename.startswith("<")]
current_path = Path(paths[1]).absolute()


db_path = current_path.parent / 'stash_interactive_tools.db'
db = SqliteDatabase(db_path)
class BaseModel(Model):
    class Meta:
        database = db
class Funscript(BaseModel):
    name = CharField()
    scene_id = CharField()
    sort_order = IntegerField()
    path = TextField()
    true_path = TextField()
    is_default = BooleanField(default=False)



def ensure_db():
    db.connect(reuse_if_open=True)
    db.create_tables([Funscript],safe=True)
    return





