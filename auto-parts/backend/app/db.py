from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from app.config import settings, BACKEND_DIR
url = make_url(settings.database_url)
if url.get_backend_name() == 'sqlite' and url.database and url.database != ':memory:':
    path = __import__('pathlib').Path(url.database)
    if not path.is_absolute():
        url = url.set(database=str(BACKEND_DIR / path))
connect_args = {'check_same_thread': False, 'timeout': 20} if url.get_backend_name() == 'sqlite' else {'connect_timeout': 5}
engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)
if engine.dialect.name == 'sqlite':
    @event.listens_for(engine, 'connect')
    def enforce_foreign_keys(connection, record):
        connection.execute('PRAGMA foreign_keys=ON')
