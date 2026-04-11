from peewee import fn
from typing import TYPE_CHECKING
from playhouse.migrate import SqliteMigrator, migrate
if TYPE_CHECKING:
    from assets.db import Funscript as FunscriptModel
def migration_2026_04_10_add_unique_true_path(migrator: SqliteMigrator,helpers) -> None:
    # Find duplicate true_path values
    Funscript: type['FunscriptModel'] = helpers.config.Funscript()
    dupes = (
        Funscript
        .select(Funscript.true_path, fn.COUNT(Funscript.id).alias("count"))
        .group_by(Funscript.true_path)
        .having(fn.COUNT(Funscript.id) > 1)
    )
    print(list(dupes.dicts()))
    for row in dupes:
        # Keep the first row by id, delete the rest
        keep_id = (
            Funscript
            .select(fn.MIN(Funscript.id))
            .where(Funscript.true_path == row.true_path)
            .scalar()
        )

        (
            Funscript
            .delete()
            .where(
                (Funscript.true_path == row.true_path) &
                (Funscript.id != keep_id)
            )
            .execute()
        )
    if not helpers.index_exists("funscript_true_path"):
        migrate(
            migrator.add_index("funscript", ("true_path",), unique=True)
        )

