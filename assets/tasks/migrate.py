from __future__ import annotations

from time import perf_counter
from typing import Callable, Iterable, Tuple ,TYPE_CHECKING

from playhouse.migrate import SqliteMigrator

if TYPE_CHECKING:
    from assets.config import Config

if TYPE_CHECKING:
    from assets.config import Config
    from assets.db import SchemaMigration as SchemaMigrationModel

SchemaMigration: type['SchemaMigrationModel']
config: 'Config'


class MigrationHelpers:
    config: 'Config'
    def __init__(self,c: 'Config'):
        self.config = c
    @staticmethod
    def index_exists(index_name: str) -> bool:
        cursor = config.db().execute_sql(
            "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
            (index_name,),
        )
        return cursor.fetchone() is not None
MigrationFn = Callable[[SqliteMigrator,MigrationHelpers], None]

Migration = Tuple[str, MigrationFn]

if TYPE_CHECKING:
    from assets.config import Config


def _get_applied_names() -> set[str]:
    return {row.name for row in SchemaMigration.select(SchemaMigration.name).where(SchemaMigration.success == True)}




def _record_migration(name: str, duration_ms: int, success: bool,
                      error: str | None = None) -> None:
    SchemaMigration.insert(
        name=name,
        duration_ms=duration_ms,
        success=success,
        error=error,
    ).on_conflict(
        conflict_target=[SchemaMigration.name],
        preserve=[SchemaMigration.applied_at],
        update={
            SchemaMigration.duration_ms: duration_ms,
            SchemaMigration.success: success,
            SchemaMigration.error: error,
        },
    ).execute()


def run_migrations(migrations: Iterable[Migration]) -> list[dict]:
    db = config.db()
    db.connect(reuse_if_open=True)
    db.create_tables([SchemaMigration], safe=True)

    helpers = MigrationHelpers(config)
    migrator = SqliteMigrator(db)
    applied = _get_applied_names()
    results: list[dict] = []

    for migration in migrations:
        (name,run_migration) = migration
        if name in applied:
            results.append({
                "name": name,
                "skipped": True,
                "reason": "already_applied",
            })
            continue

        start = perf_counter()
        try:
            with db.atomic():
                run_migration(migrator,helpers)
            duration_ms = int((perf_counter() - start) * 1000)
            _record_migration(name, duration_ms, True, None)
            results.append({
                "name": name,
                "skipped": False,
                "success": True,
                "duration_ms": duration_ms,
            })
        except Exception as exc:
            duration_ms = int((perf_counter() - start) * 1000)
            _record_migration(name, duration_ms, False, str(exc))
            results.append({
                "name": name,
                "skipped": False,
                "success": False,
                "duration_ms": duration_ms,
                "error": str(exc),
            })
            raise

    return results

def run(c: 'Config'):
    global config,SchemaMigration
    config = c
    SchemaMigration = c.SchemaMigration()
    run_migrations(
       c.migrations()
    )
    c.log.warning(f"All migrations completed successfully")




