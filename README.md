# Torque Auto Parts — Study Companion-style setup

React in JavaScript, FastAPI in Python, and MySQL. No Docker required.

This version adopts Study Companion's development conventions: a root npm workspace, separate `backend/` and `frontend/`, `backend/app/main.py`, uv-managed Python dependencies, a backend `.env`, and one command to start both servers. Study Companion itself was inspected read-only and was not modified.

## Start here on Windows

1. Extract this updated ZIP into a **new folder**, then open its `auto-parts` folder in VS Code. Do not overlay it on the old version: the Python files moved into `backend/app/`.
2. Stop the previous React and FastAPI terminals with Ctrl+C so ports 5173 and 8000 are available.
3. You need Node.js 22+, Python 3.12+, and uv. If you already run Study Companion on this PC, you likely have these. Check `node --version`, `py --version`, and `uv --version`. If uv is missing, run `py -m pip install uv`, then reopen VS Code.
4. In a terminal at the project root, run:

```powershell
npm run install:all
```

This installs root/frontend packages, creates `backend/.env` only if it does not exist, and runs `uv sync` for the backend. It does not require administrator rights or install a database server.

### Try it immediately, without installing MySQL

```powershell
npm run dev:demo
```

Open http://localhost:5173. This explicit **SQLite preview** uses `backend/torque_demo.db`, like Study Companion's local SQLite setup. It creates the demo tables and accounts automatically. The file persists between runs.

This is an optional preview, **not the MySQL project database**. MySQL and SQLite data are separate; there is no automatic migration or silent fallback. Use MySQL mode for your requested MySQL demonstration. SQLite preview is intended for one local user, not concurrent inventory correctness under multiple users.

### Run the requested MySQL version

MySQL Server must be installed and running (Workbench alone is not the server). One time:

1. Open your local server connection in MySQL Workbench.
2. Open and execute all of `database/create-database.sql` using your administrator/root connection.
3. Check the connection in `backend/.env`. The sample is:

```env
DATABASE_URL=mysql+pymysql://autoparts:local-demo-password@127.0.0.1:3306/autoparts
```

Then run:

```powershell
npm run db:check
npm run dev
```

On a successful connection, the app creates missing tables and inserts demo data only if no stores exist. Startup preserves existing data. Later, just keep the MySQL service running and use `npm run dev`.

If you previously set `$env:DATABASE_URL` in PowerShell, it takes precedence over `.env`. Close that terminal and open a fresh one, or clear the old variable:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

MySQL error 2003 / WinError 10061 means the server/port is unreachable. `npm run db:check` gives a short diagnosis instead of the old JSON parsing error. On Windows, use `Get-Service *mysql*` to find the server; start the returned service name in an administrator PowerShell if it is stopped. If no service exists, install MySQL Server or use the explicit SQLite preview meanwhile.

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
- `database/`: MySQL creation script and schema.
- `docs/`: requirements, database design, user manual, test results and report outline.

The UI remains Torque's auto-parts design. This change matches Study Companion's development structure/startup workflow, not its study-material features. Frontend files remain JavaScript, not TypeScript. Authentication remains the original Torque opaque-session implementation; no Study Companion secrets, accounts or authentication code were copied.

## Testing with MySQL

Default tests use an isolated SQLite test file. To include the concurrency test:

```powershell
$env:TEST_DATABASE_URL="mysql+pymysql://autoparts:local-demo-password@127.0.0.1:3306/autoparts_test"
npm run test:backend
Remove-Item Env:TEST_DATABASE_URL
```

Tests delete and recreate tables. Use only the dedicated `autoparts_test` database; the suite rejects other non-SQLite names unless they end in `_test`. Never point tests at data you want to keep. See `docs/TEST_RESULTS.md` for verification actually performed on this revision.

## Project scope

Includes multi-store catalog, customer accounts, cart/checkout, order history, deliveries, cancellation and full-order returns, inventory, supplier orders/reorders/receipts, employee management, and rolling daily/weekly/monthly reports.

Credit-card payments are explicitly simulated. No real cards or payment API keys are needed. Taxes, shipping fees, partial returns and external supplier/carrier integrations are not implemented. Keep this classroom app local; production deployment needs security and operational hardening.

Your final course submission still needs your actual Phase I/II reports, true team contributions and presentation slides. The report outline and documentation support that work but do not replace it.
