# Torque Auto Parts 

React in JavaScript, FastAPI in Python


## URLs and accounts

- App: http://localhost:5173
- API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/health (reports `mysql` or `sqlite`)

| Username | Password | Role |
|---|---|---|
| customer | DemoPass123! | Shop and view own orders |
| employee | DemoPass123! | Denton store operations |
| manager | DemoPass123! | All-store administration |

Stop both servers with Ctrl+C in the one running terminal. Cart contents are not persisted across refreshes; saved orders and inventory are persisted in the chosen database.

## Root commands

| Command | Purpose |
|---|---|
| `npm run install:all` | Install frontend/backend dependencies and initialize local settings |
| `npm run dev` | Start FastAPI and React together, using backend/.env (MySQL by default) |
| `npm run dev:demo` | Start both with a separate local SQLite preview database |
| `npm run dev:open` | Start configured database mode and open the browser |
| `npm run dev:backend` | Run only FastAPI |
| `npm run dev:frontend` | Run only React |
| `npm run db:check` | Diagnose configured database connection |
| `npm run db:seed` | Create missing tables and seed an empty store database |
| `npm run build` | Build frontend production assets |
| `npm test` | Run API tests and frontend interaction/error-handling tests |

For a reproducible install after lockfiles already exist: `npm ci`, `node scripts/setup.mjs`, then `cd backend` and `uv sync --locked`.

## Structure

- `package.json` / `package-lock.json`: npm workspace, shared startup commands, locked JS dependencies.
- `scripts/`: setup and explicit SQLite preview launcher.
- `backend/pyproject.toml` / `uv.lock`: Python project and locked dependencies.
- `backend/.env.example`: sample settings; setup creates the ignored `.env`.
- `backend/app/config.py`: loads backend/.env and environment variables.
- `backend/app/db.py`: database engine and SQLite foreign-key handling.
- `backend/app/models.py`: relational tables and constraints.
- `backend/app/main.py`: FastAPI startup and routes.
- `backend/app/security.py`: password hashing helpers.
- `backend/app/seed.py`: sample data and schema initialization.
- `backend/tests/`: API integration tests.
- `frontend/src/main.jsx`: React bootstrap.
- `frontend/src/App.jsx`: application views.
- `frontend/src/api.js`: API client with readable server/network errors.
- `frontend/src/style.css`: original Torque styling.
