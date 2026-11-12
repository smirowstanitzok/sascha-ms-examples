#!/usr/bin/env bash
# scripts/wait-for-emulator.sh – waits up to 30 seconds for the health route
PORT="${1:-9297}"
CA="$HOME/.aws/emulator/$PORT/ca.pem"
for i in $(seq 30); do
  if [ -f "$CA" ] && curl -sf --cacert "$CA" "https://127.0.0.1:$PORT/__admin/health" > /dev/null; then
    echo "Emulator is ready on port $PORT"
    exit 0
  fi
  sleep 1
done
echo "Emulator did not respond on port $PORT" >&2
exit 1
