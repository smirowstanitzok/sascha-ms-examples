#!/usr/bin/env bash
# scripts/build-layer.sh
# Installs the layer dependencies into layers/pdf/nodejs/node_modules.
set -euo pipefail
cd "$(dirname "$0")/../layers/pdf/nodejs"
rm -rf node_modules
npm install --omit=dev --no-audit --no-fund
du -sh node_modules
