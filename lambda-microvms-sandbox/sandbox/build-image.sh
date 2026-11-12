#!/usr/bin/env bash
# sandbox/build-image.sh
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
BUCKET="${ARTIFACT_BUCKET:?Please set ARTIFACT_BUCKET}"
ROLE_ARN="${BUILD_ROLE_ARN:?Please set BUILD_ROLE_ARN}"

zip -j runner.zip Dockerfile execute.ts server.ts
aws s3 cp runner.zip "s3://${BUCKET}/codegarden/runner.zip"

aws lambda-microvms create-microvm-image \
  --region "$REGION" \
  --name codegarden-runner \
  --code-artifact "uri=s3://${BUCKET}/codegarden/runner.zip" \
  --base-image-arn "arn:aws:lambda:${REGION}:aws:microvm-image:al2023-1" \
  --build-role-arn "$ROLE_ARN" \
  --hooks file://hooks.json
