#!/usr/bin/env bash
# Self-signed cert for LAN testing over HTTPS (Web Bluetooth needs a secure context).
set -euo pipefail
cd "$(dirname "$0")/.."
ip=$(hostname -I | awk '{print $1}')
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout certs/key.pem -out certs/cert.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1${ip:+,IP:$ip}" 2>/dev/null
echo "Wrote certs/key.pem and certs/cert.pem (localhost, 127.0.0.1, ${ip:-no LAN IP found})"
echo
echo "Run the server with:"
echo "  cd server && uv run uvicorn zombie_bus_server.app:app --host 0.0.0.0 --port 8443 \\"
echo "    --ssl-keyfile ../certs/key.pem --ssl-certfile ../certs/cert.pem"
echo
echo "Then browse to https://${ip:-localhost}:8443 and accept the certificate warning on each device."
