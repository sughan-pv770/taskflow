# ─────────────────────────────────────────────────────────────────
# Taskflow — All-in-one Dockerfile for Hugging Face Spaces
#
# HF Spaces rules this file must satisfy:
#   - Expose exactly port 7860
#   - Run as non-root user (we use "user" uid 1000)
#   - Single container (no docker-compose)
#
# Architecture inside this container:
#   PostgreSQL 16  →  internal port 5432
#   Node/Express   →  internal port 5000
#   Nginx          →  port 7860  (serves React SPA + proxies /api to Express)
#
# Process manager: supervisord keeps all three services alive.
# ─────────────────────────────────────────────────────────────────

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV PORT=5000
ENV DB_HOST=127.0.0.1
ENV DB_PORT=5432
ENV DB_NAME=taskflow
ENV DB_USER=taskflow_user
ENV DB_PASSWORD=taskflow_hf_secret
ENV JWT_SECRET=taskflow_huggingface_jwt_secret_change_for_production_use
ENV JWT_EXPIRES_IN=7d
ENV FRONTEND_URL=http://localhost:7860

# ── System packages ────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    curl wget gnupg2 lsb-release ca-certificates \
    nginx supervisor \
    postgresql-14 postgresql-client-14 \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js 20 ─────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Working directories ────────────────────────────────────────────
WORKDIR /app
RUN mkdir -p /app/backend /app/frontend /var/log/supervisor \
             /run/postgresql /var/lib/postgresql/data

# ── Backend ────────────────────────────────────────────────────────
COPY backend/package*.json /app/backend/
RUN cd /app/backend && npm ci --only=production

COPY backend/ /app/backend/

# ── Frontend — build React app ─────────────────────────────────────
COPY frontend/package*.json /app/frontend/
RUN cd /app/frontend && npm ci

COPY frontend/ /app/frontend/
# Point the API at the same origin so nginx can proxy it
RUN echo "REACT_APP_API_URL=/api" > /app/frontend/.env.production
RUN cd /app/frontend && npm run build

# ── Nginx config ───────────────────────────────────────────────────
RUN rm -f /etc/nginx/sites-enabled/default
COPY hf.nginx.conf /etc/nginx/sites-enabled/taskflow.conf

# ── Supervisord config ─────────────────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/taskflow.conf

# ── Startup script ─────────────────────────────────────────────────
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# ── HF Spaces: must run as non-root with uid 1000 ──────────────────
RUN useradd -m -u 1000 hfuser \
    && chown -R hfuser:hfuser /app \
    && chown -R hfuser:hfuser /var/log/nginx \
    && chown -R hfuser:hfuser /var/lib/nginx \
    && chown -R hfuser:hfuser /run \
    && chown -R postgres:postgres /var/lib/postgresql \
    && chown -R postgres:postgres /run/postgresql \
    && chmod 777 /var/log/supervisor \
    && chmod 777 /tmp

# Nginx needs to write to these as non-root
RUN chown -R hfuser:hfuser /var/log/nginx /var/lib/nginx /run/nginx* 2>/dev/null || true \
    && touch /run/nginx.pid && chown hfuser:hfuser /run/nginx.pid 2>/dev/null || true

USER hfuser

EXPOSE 7860

CMD ["/app/start.sh"]
