# Deploying Taskflow to Hugging Face Spaces

This folder contains everything needed to run the full Taskflow app on
Hugging Face Spaces for free — no local Docker, no paid server.

When you push these files to a HF Space, HF automatically:
1. Builds the Docker image
2. Initialises PostgreSQL
3. Runs migrations and seeds demo data
4. Starts nginx, the Node API, and the database
5. Serves your app at `https://your-username-taskflow.hf.space`

---

## What runs inside the container

```
Port 7860 (public)
    └── Nginx
         ├── /api/*  →  Node.js Express (port 5000, internal)
         └── /*      →  React SPA (static files)

PostgreSQL (port 5432, internal only)
```

All three services are managed by supervisord so they restart
automatically if they crash.

---

## Step-by-step deployment

### Step 1 — Create a Hugging Face account

Go to https://huggingface.co and sign up (free).

---

### Step 2 — Create a new Space

1. Click your profile picture → **New Space**
2. Fill in the form:
   - **Space name**: `taskflow` (or any name you like)
   - **License**: MIT
   - **SDK**: Select **Docker**  ← this is the important one
   - **Docker template**: Blank
   - **Hardware**: CPU Basic (free)
   - **Visibility**: Public or Private
3. Click **Create Space**

HF will create an empty git repository for your space.

---

### Step 3 — Get the repository URL

After creating the space, you'll see a page with a Git URL like:

```
https://huggingface.co/spaces/YOUR_USERNAME/taskflow
```

The git remote URL will be:

```
https://huggingface.co/YOUR_USERNAME/taskflow
```

---

### Step 4 — Copy these files into the space repository

You have two options:

#### Option A — Upload via the HF web UI (easiest, no git needed)

1. Open your Space on huggingface.co
2. Click **Files** tab
3. Click **+ Add file → Upload files**
4. Upload all files from this `huggingface/` folder:
   - `Dockerfile`
   - `hf.nginx.conf`
   - `supervisord.conf`
   - `start.sh`
   - `README.md`
5. Also upload the entire `backend/` folder
6. Also upload the entire `frontend/` folder (without `node_modules`)
7. Commit the changes

The folder structure in your Space should look like:

```
your-space/
├── README.md          ← the one from this folder (has the --- header block)
├── Dockerfile
├── hf.nginx.conf
├── supervisord.conf
├── start.sh
├── backend/
│   ├── package.json
│   ├── src/
│   └── ...
└── frontend/
    ├── package.json
    ├── public/
    ├── src/
    └── ...
```

#### Option B — Use Git (if you have Git installed)

```bash
# Clone your HF space repository
git clone https://huggingface.co/spaces/YOUR_USERNAME/taskflow
cd taskflow

# Copy everything from the huggingface/ folder to the root
cp path/to/taskflow/huggingface/Dockerfile .
cp path/to/taskflow/huggingface/hf.nginx.conf .
cp path/to/taskflow/huggingface/supervisord.conf .
cp path/to/taskflow/huggingface/start.sh .
cp path/to/taskflow/huggingface/README.md .

# Copy backend and frontend
cp -r path/to/taskflow/backend ./backend
cp -r path/to/taskflow/frontend ./frontend

# Remove node_modules if they exist
rm -rf backend/node_modules frontend/node_modules frontend/build

# Push
git add .
git commit -m "Initial deployment"
git push
```

---

### Step 5 — Watch the build

After pushing, go to your Space URL and click the **Logs** tab.

You'll see:
```
▶ Initialising PostgreSQL data directory...
▶ Starting PostgreSQL for setup...
  PostgreSQL is ready.
▶ Setting up database...
▶ Running migrations...
▶ Seeding demo data...
▶ Starting all services via supervisord...
```

The build typically takes **3–6 minutes** the first time (npm install + React build).
After that, rebuilds are faster because HF caches Docker layers.

---

### Step 6 — Open the app

Once the build finishes, click **App** in your Space.

Your app will be live at:
```
https://YOUR_USERNAME-taskflow.hf.space
```

Log in with any demo account:

| Email | Password | Role |
|---|---|---|
| alice@acme.com | Password123! | Admin |
| bob@acme.com | Password123! | Member |
| carol@globex.com | Password123! | Admin |

---

## Important notes about HF Spaces

### Data persistence

HF Spaces on the **free tier use ephemeral storage** — if the space restarts
or is rebuilt, the PostgreSQL data is wiped and the seed data is re-applied.

This is fine for demo and internship purposes. For permanent data, you would
connect to an external PostgreSQL service (Neon, Supabase, Railway, etc.)
by setting environment variables in the Space settings.

### Environment variables / secrets

You can override any environment variable from the Space settings:

1. Go to your Space → **Settings** → **Variables and Secrets**
2. Add secrets (they won't appear in logs):
   - `JWT_SECRET` → set a strong random value for any real use
   - `DB_PASSWORD` → only needed if using external Postgres
   - `DB_HOST`, `DB_NAME`, `DB_USER` → for external Postgres

### Waking up from sleep

Free HF Spaces pause after ~30 minutes of inactivity.
The first request after sleeping takes ~30 seconds to wake up.
This is normal for the free tier.

### Port

HF Spaces only allows port **7860** to be public. The Dockerfile
and nginx config are already set up correctly for this.

---

## Connecting to an external PostgreSQL (optional)

For data that survives restarts, use a free external Postgres:

**Neon** (recommended, free tier): https://neon.tech
1. Create a free project
2. Copy the connection string
3. In your HF Space settings → Secrets, add:
   - `DB_HOST` = your-neon-host.neon.tech
   - `DB_PORT` = 5432
   - `DB_NAME` = neondb
   - `DB_USER` = your-neon-user
   - `DB_PASSWORD` = your-neon-password

Then update `start.sh` to skip the local postgres setup when `DB_HOST`
is not `127.0.0.1`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails with "permission denied" | Check start.sh has Unix line endings (LF not CRLF) |
| App loads but API returns 502 | Backend didn't start — check Logs for Node.js errors |
| White screen | React build failed — check Logs for npm build errors |
| "Cannot connect to database" | PostgreSQL init failed — check Logs for postgres errors |
| Space shows "Building" for >10 min | Click **Factory rebuild** in Space settings |

If you edited files on Windows, run this to fix line endings before uploading:

```bash
# PowerShell
(Get-Content start.sh -Raw).Replace("`r`n","`n") | Set-Content start.sh -NoNewline
```
