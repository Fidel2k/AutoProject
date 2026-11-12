"""Connection diagnosis without displaying a password or raw database URL."""
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from app.db import engine

def main():
    try:
        with engine.connect() as connection:
            connection.execute(text('SELECT 1'))
        print(f'Connected successfully: {engine.dialect.name}.')
        return 0
    except OperationalError as exc:
        code = getattr(exc.orig, 'args', [None])[0]
        messages = {
            2003: 'MySQL is not reachable. Start the MySQL Windows service and verify the port in backend/.env.',
            1045: 'MySQL rejected the login. Check the app user and password in backend/.env.',
            1049: 'The database does not exist. Run database/create-database.sql in MySQL Workbench.',
            1044: 'The app user lacks database access. Run the GRANT statements in database/create-database.sql.'
        }
        print(messages.get(code, 'Database connection failed. Check backend/.env and the database server.'))
        print('Optional immediate preview: npm run dev:demo (separate SQLite data, not MySQL).')
        return 1
if __name__ == '__main__':
    raise SystemExit(main())
