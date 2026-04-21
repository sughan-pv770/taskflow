# ─────────────────────────────────────────────────────────────────
# Taskflow — Robust Multi-Service Dockerfile for HF Spaces
# ─────────────────────────────────────────────────────────────────

FROM ubuntu:22.04

# Environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PORT=5000 \
    DB_HOST=127.0.0.1 \
    DB_PORT=5432 \
    DB_NAME=taskflow \
    DB_USER=taskflow_user \
    DB_PASSWORD=taskflow_hf_secret \
    JWT_SECRET=taskflow_huggingface_jwt_secret_change_for_production_use \
    JWT_EXPIRES_IN=7d \
    FRONTEND_URL=http://localhost:7860

# 1. Install System Dependencies
RUN apt-get update && apt-get install -y \
    curl wget gnupg2 lsb-release ca-certificates \
    nginx supervisor \
    postgresql-14 postgresql-client-14 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Setup User and Directories
# HF Spaces uses UID 1000
RUN useradd -m -u 1000 hfuser && \
    mkdir -p /app/backend /app/frontend /var/log/supervisor /var/run/supervisor \
    /run/postgresql /var/lib/postgresql/data /var/log/nginx /var/lib/nginx /run/nginx \
    && chown -R hfuser:hfuser /app /var/log/supervisor /var/run/supervisor /run/postgresql \
    /var/lib/postgresql /var/log/nginx /var/lib/nginx /run/nginx

WORKDIR /app

# 3. Backend Implementation
COPY --chown=hfuser:hfuser backend/package*.json /app/backend/
RUN cd /app/backend && npm ci --only=production

COPY --chown=hfuser:hfuser backend/ /app/backend/

# 4. Frontend Implementation
COPY --chown=hfuser:hfuser frontend/package*.json /app/frontend/
RUN cd /app/frontend && npm ci

COPY --chown=hfuser:hfuser frontend/ /app/frontend/
RUN echo "REACT_APP_API_URL=/api" > /app/frontend/.env.production
RUN cd /app/frontend && npm run build

# 5. Configurations
RUN rm -f /etc/nginx/sites-enabled/default
COPY --chown=hfuser:hfuser hf.nginx.conf /etc/nginx/sites-enabled/taskflow.conf
COPY --chown=hfuser:hfuser supervisord.conf /etc/supervisor/conf.d/taskflow.conf
COPY --chown=hfuser:hfuser start.sh /app/start.sh

RUN chmod +x /app/start.sh && \
    touch /run/nginx.pid && chown hfuser:hfuser /run/nginx.pid

# 6. Final Permissions Check
RUN chmod -R 777 /var/run /run /tmp /var/log/supervisor /var/lib/postgresql

USER hfuser
EXPOSE 7860
CMD ["/app/start.sh"]
