from sqlite3 import connect
from handshake.services.DBService import DB_VERSION
from handshake.services.DBService.models.enums import ConfigKeys
from sqlite3.dbapi2 import Connection
from typing import Optional, Tuple
from pathlib import Path
from loguru import logger


def check_version(
    path: Path = None, connection: Optional[Connection] = None
) -> Tuple[bool, Connection, bool, Optional[int]]:
    connection = connection if connection else connect(path)
    query = f"select value from configbase where key = '{ConfigKeys.version}'"
    result = connection.execute(query).fetchone()

    version_stored = False
    migration_required = False

    if not result:
        logger.warning(
            f"Could not find the version, Please raise this as an issue or re-run after deleting the folder {path}."
        )
    else:
        version_stored = result if not result else int(result[0])
        migration_required = version_stored != DB_VERSION

        logger.log(
            "INFO" if not migration_required else "ERROR",
            "Currently at: v{}."
            if not migration_required
            else 'Found version: v{}. but required is v{}. Please execute: \n"handshake migrate [COLLECTION_PATH]"',
            result[0],
            DB_VERSION,
        )
    return (
        migration_required,
        connection,
        version_stored < DB_VERSION,
        version_stored,
    )


# returns True if it requires further migration
def migrate(connection, db_path=None) -> bool:
    if db_path:
        connection = connect(db_path)

    try:
        is_required, connection, bump_if_required, version_stored = check_version(
            connection=connection
        )

        if not is_required:
            logger.info("Already migrated to required version")
            return False

        if not bump_if_required:
            logger.error(
                "You have more recent version of database, v{}. but we can only support: v{}. "
                "Hence requesting either to update your reporter",
                # "use your backup database inside the collection_path.",
                version_stored,
                DB_VERSION,
            )
            return False

        script = Path(__file__).parent / "scripts" / f"bump-v{version_stored}.sql"
        logger.info("Executing {} to migrate from v{}", script.name, version_stored)
        connection.executescript(script.read_text())
    finally:
        if db_path:
            connection.close()

    return (version_stored + 1) < DB_VERSION


def migration(path):
    connection = connect(path)

    try:
        while migrate(connection):
            ...

        connection.commit()
    except Exception as error:
        logger.error(f"Failed to execute migration script, due to {error}")
        return True
    finally:
        connection.close()
