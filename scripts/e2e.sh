#!/usr/bin/env bash
# Builds the client, starts a sped-up server on a spare port and runs the headless ride test.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd "$(dirname "$0")/.."
PORT="${E2E_PORT:-8199}"
TMP="$(mktemp -d)"
DB="$TMP/e2e.db"
# Build into a scratch folder: rebuilding client/dist would break the pages of a live server on this machine.
(cd client && npx tsc --noEmit && npx vite build --outDir "$TMP/dist" --emptyOutDir >/dev/null)
(cd server && ZB_CLIENT_DIST="$TMP/dist" ZB_TIME_SCALE=20 ZB_DB="$DB" uv run uvicorn zombie_bus_server.app:app --port "$PORT" --log-level warning) &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 40); do curl -sf "localhost:$PORT/api/health" >/dev/null && break; sleep 0.5; done
(cd client && E2E_URL="http://localhost:$PORT" node e2e/ride.cjs)
