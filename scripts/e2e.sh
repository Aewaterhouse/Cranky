#!/usr/bin/env bash
# Builds the client, starts a sped-up server on a spare port and runs the headless ride test.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd "$(dirname "$0")/.."
PORT="${E2E_PORT:-8199}"
DB="$(mktemp -d)/e2e.db"
(cd client && pnpm build >/dev/null)
(cd server && ZB_TIME_SCALE=20 ZB_DB="$DB" uv run uvicorn zombie_bus_server.app:app --port "$PORT" --log-level warning) &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 40); do curl -sf "localhost:$PORT/api/health" >/dev/null && break; sleep 0.5; done
(cd client && E2E_URL="http://localhost:$PORT" node e2e/ride.cjs)
