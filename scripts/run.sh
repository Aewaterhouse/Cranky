#!/usr/bin/env bash
# Build the client and serve everything from the server on :8000. Extra args go to uvicorn.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd "$(dirname "$0")/.."
(cd client && pnpm install --frozen-lockfile && pnpm build)
cd server
uv sync
exec uv run uvicorn zombie_bus_server.app:app --host 0.0.0.0 --port 8000 "$@"
