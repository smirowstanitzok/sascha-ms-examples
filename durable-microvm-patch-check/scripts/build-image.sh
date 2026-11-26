#!/usr/bin/env bash
# scripts/build-image.sh – builds the MicroVM image from microvm/app.ts
set -euo pipefail

STACK=PatchCheck
REGION=${AWS_REGION:-us-east-1}
NAME=patch-check

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
BUCKET=$(output ArtifactBucket)
BUILD_ROLE=$(output BuildRoleArn)
IMAGE_ARN=$(output ImageArn)

# 1. Bundle the worker and zip it with the Dockerfile
rm -rf .image-build && mkdir -p .image-build
npx esbuild microvm/app.ts --bundle --platform=node --target=node22 --format=esm \
  --outfile=.image-build/app.mjs \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"
cp microvm/Dockerfile .image-build/
(cd .image-build && zip -q image.zip app.mjs Dockerfile)

# 2. Upload and create the image
aws s3 cp .image-build/image.zip "s3://$BUCKET/microvm/image.zip" --region "$REGION"
aws lambda-microvms create-microvm-image --region "$REGION" --cli-input-json "$(cat <<JSON
{
  "name": "$NAME",
  "codeArtifact": { "uri": "s3://$BUCKET/microvm/image.zip" },
  "baseImageArn": "arn:aws:lambda:$REGION:aws:microvm-image:al2023-1",
  "buildRoleArn": "$BUILD_ROLE",
  "egressNetworkConnectors": ["arn:aws:lambda:$REGION:aws:network-connector:aws-network-connector:INTERNET_EGRESS"],
  "hooks": {
    "port": 8080,
    "microvmHooks": {
      "run": "ENABLED", "runTimeoutInSeconds": 10,
      "resume": "ENABLED", "resumeTimeoutInSeconds": 10,
      "suspend": "ENABLED", "suspendTimeoutInSeconds": 10,
      "terminate": "ENABLED", "terminateTimeoutInSeconds": 10
    },
    "microvmImageHooks": { "ready": "ENABLED", "readyTimeoutInSeconds": 60 }
  }
}
JSON
)"

# 3. Wait until the image is ready
while true; do
  STATUS=$(aws lambda-microvms get-microvm-image --image-identifier "$IMAGE_ARN" \
    --region "$REGION" --query state --output text)
  echo "Image state: $STATUS"
  case "$STATUS" in
    CREATED|UPDATED) break ;;
    *FAILED*) echo "Build failed, logs: /aws/lambda-microvms/$NAME"; exit 1 ;;
  esac
  sleep 15
done
