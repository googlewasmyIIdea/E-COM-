from sqlalchemy.engine import make_url

from backend.core.config import Settings


def test_docker_database_credentials_are_url_encoded() -> None:
    settings = Settings(
        _env_file=None,
        postgres_user="store",
        postgres_password="p@ss:/?#",
        postgres_db="shop",
        postgres_host="database",
    )
    parsed = make_url(settings.database_url)
    assert parsed.password == "p@ss:/?#"
    assert parsed.host == "database"
    assert parsed.drivername == "postgresql+asyncpg"


def test_explicit_database_url_is_preserved() -> None:
    url = "postgresql+asyncpg://existing:secret@localhost/store"
    assert (
        Settings(
            _env_file=None, database_url=url, postgres_password="different"
        ).database_url
        == url
    )
