#!/usr/bin/env bash
# scripts/find-functions.sh
# Lists all functions (including published versions) in this account and region that use the runtime.
set -euo pipefail

REGION="${AWS_REGION:-eu-central-1}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
RUNTIME_ARN="arn:aws:lambda:${REGION}:${ACCOUNT}:runtime/radwerk-node24"

aws lambda list-functions --function-version ALL --region "$REGION" \
  --query "Functions[?RuntimeConfig.RuntimeArn=='${RUNTIME_ARN}'].[FunctionName,Version,RuntimeConfig.RuntimeAlias]" \
  --output table
