#!/bin/bash
set -e

echo "========================================"
echo "  Taskflow — HF Spaces Startup"
echo "========================================"

# Pre-cleanup to ensure fresh start if restarted
rm -rf /tmp/pg_setup.log /run/postgresql/*.pid /run/nginx.pid 2>/dev/null || true

# ── 1. Initialise PostgreSQL data directory ────────────────────────
if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
    echo "▶ Initialising PostgreSQL data directory..."
    /usr/lib/postgresql/14/bin/initdb -D /var/lib/postgresql/data --auth=trust --username=hfuser
    echo "  Done."
fi

# ── 2. Start PostgreSQL temporarily to set up DB + user ────────────
echo "▶ Starting PostgreSQL for setup..."
/usr/lib/postgresql/14/bin/pg_ctl -D /var/lib/postgresql/data -l /tmp/pg_setup.log start -w

# Wait for postgres to be ready
for i in {1..20}; do
    if pg_isready -h 127.0.0.1 -U hfuser >/dev/null 2>&1; then
        echo "  PostgreSQL is ready."
        break
    fi
    echo "  Waiting for PostgreSQL... ($i)"
    sleep 1
done

# ── 3. Create database and user if they don't exist ────────────────
echo "▶ Setting up database..."
psql -h 127.0.0.1 -U hfuser -d postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='taskflow_user'" | grep -q 1 || psql -h 127.0.0.1 -U hfuser -d postgres -c "CREATE USER taskflow_user WITH PASSWORD 'taskflow_hf_secret';"
psql -h 127.0.0.1 -U hfuser -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='taskflow'" | grep -q 1 || psql -h 127.0.0.1 -U hfuser -d postgres -c "CREATE DATABASE taskflow OWNER taskflow_user;"
psql -h 127.0.0.1 -U hfuser -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE taskflow TO taskflow_user;"
echo "  Database ready."

# ── 4. Run migrations ──────────────────────────────────────────────
echo "▶ Running migrations..."
cd /app/backend
node src/utils/migrate.js
echo "  Migrations complete."

# ── 5. Seed demo data (only if users table is empty) ───────────────
USER_COUNT=$(psql -h 127.0.0.1 -U hfuser -d taskflow -tAc "SELECT COUNT(*) FROM users 2>/dev/null || echo 0" 2>/dev/null || echo "0")
if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
    echo "▶ Seeding demo data..."
    node src/utils/seed.js || echo "  Seed skipped (already exists)."
else
    echo "  Demo data already present. Skipping seed."
fi

# ── 6. Stop the temporary postgres (supervisord will restart it) ───
echo "▶ Handing off PostgreSQL to supervisord..."
/usr/lib/postgresql/14/bin/pg_ctl -D /var/lib/postgresql/data stop -m fast || true

# ── 7. Hand off to supervisord ────────────────────────────────────
echo "▶ Starting all services via supervisord..."
echo "========================================"
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/taskflow.conf
