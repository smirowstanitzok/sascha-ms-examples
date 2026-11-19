#!/usr/bin/env bash
# scripts/promote.sh
# Moves an alias to the version that the previous stage already uses.
# Usage: ./scripts/promote.sh dev test   or   ./scripts/promote.sh test prod
set -euo pipefail

FROM_ALIAS="${1:?Source alias, e.g. dev}"
TO_ALIAS="${2:?Target alias, e.g. test}"
REGION="${AWS_REGION:-eu-central-1}"
RUNTIME="radwerk-node24"

VERSION="$(aws lambda-core get-runtime-alias \
  --runtime-name "$RUNTIME" \
  --name "$FROM_ALIAS" \
  --query RuntimeVersion --output text \
  --region "$REGION")"

CURRENT="$(aws lambda-core get-runtime-alias \
  --runtime-name "$RUNTIME" \
  --name "$TO_ALIAS" \
  --query RuntimeVersion --output text \
  --region "$REGION")"

if [ "$VERSION" = "$CURRENT" ]; then
  echo "Alias ${TO_ALIAS} already points to ${VERSION}. Nothing to do."
  exit 0
fi

echo "Promoting ${TO_ALIAS}: ${CURRENT} -> ${VERSION}"
echo "Rollback, if needed: aws lambda-core update-runtime-alias --runtime-name ${RUNTIME} --name ${TO_ALIAS} --runtime-version ${CURRENT} --region ${REGION}"

aws lambda-core update-runtime-alias \
  --runtime-name "$RUNTIME" \
  --name "$TO_ALIAS" \
  --runtime-version "$VERSION" \
  --region "$REGION"
