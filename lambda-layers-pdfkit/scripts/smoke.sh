#!/usr/bin/env bash
# scripts/smoke.sh
# Bundles the function like the Serverless Framework does and runs it outside
# the project folder. NODE_PATH plays the role of /opt/nodejs/node_modules.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
npx esbuild src/receipt.ts --bundle --platform=node --target=node24 --format=cjs --minify \
  --external:pdfkit --external:'@aws-lambda-powertools/*' \
  --outfile="$OUT/receipt.js" --log-level=warning
echo "Bundle size: $(wc -c < "$OUT/receipt.js") bytes"
# First path: our pdf layer. Second path: Powertools from devDependencies,
# standing in for the managed Powertools layer.
NODE_PATH="$PWD/layers/pdf/nodejs/node_modules:$PWD/node_modules" node -e "
require('$OUT/receipt.js')
  .handler({ pathParameters: { rentalId: 'R-1001' } })
  .then((r) => console.log('Status', r.statusCode, '| PDF bytes', Buffer.from(r.body, 'base64').length));
"
