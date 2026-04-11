from datetime import datetime, timezone
from pathlib import Path

from peewee import *

current_path = Path(__file__).absolute()


db_path = current_path.parent / 'stash_interactive_tools.db'
db = SqliteDatabase(db_path)
class BaseModel(Model):
    class Meta:
        database = db
class SchemaMigration(BaseModel):
    name = CharField(unique=True)
    applied_at = DateTimeField(default=lambda: datetime.now(timezone.utc))
    duration_ms = IntegerField(null=True)
    success = BooleanField(default=False)
    error = TextField(null=True)

class Funscript(BaseModel):
    name = CharField()
    scene_id = CharField()
    sort_order = IntegerField()
    path = TextField()
    true_path = TextField(unique=True,constraints=[SQL('ON CONFLICT IGNORE')])
    is_default = BooleanField(default=False)



def ensure_db():
    db.connect(reuse_if_open=True)
    db.create_tables([Funscript,SchemaMigration],safe=True)
    return





