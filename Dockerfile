# Stage 1: build the client. Keeps /app/client and /app/content side by side
# because the client imports ../content via a Vite glob.
FROM node:24-slim AS client
RUN corepack enable
WORKDIR /app/client
COPY client/package.json client/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY client/ ./
COPY content/ /app/content/
RUN pnpm build

# Stage 2: Python server plus the built client.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
COPY server/ /app/server/
COPY content/ /app/content/
COPY --from=client /app/client/dist /app/client/dist
WORKDIR /app/server
RUN uv sync --no-dev --frozen
RUN mkdir -p /data
ENV ZB_DB=/data/zombie_bus.db PATH="/app/server/.venv/bin:$PATH"
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn zombie_bus_server.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
