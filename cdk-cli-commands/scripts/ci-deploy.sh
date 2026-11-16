#!/usr/bin/env bash
# scripts/ci-deploy.sh – deployment step for a pipeline
set -euo pipefail

# 1. Use the same CLI version as the project (from package.json)
npx cdk --version

# 2. Synthesize without printing templates; errors stop here
npx cdk synth --quiet

# 3. Check for drift: did anyone change something by hand in the console?
npx cdk drift --fail

# 4. Deploy without prompts, save outputs as JSON for later steps
npx cdk deploy --all \
  --require-approval never \
  --concurrency 2 \
  --outputs-file cdk-outputs.json

echo "Deployment finished, outputs in cdk-outputs.json"
