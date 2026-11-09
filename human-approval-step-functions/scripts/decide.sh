#!/usr/bin/env bash
# scripts/decide.sh – send a signed decision to the function URL
# Usage: ./scripts/decide.sh <approval ID> approved|rejected "comment"
set -euo pipefail

: "${DECIDE_URL:?Please set DECIDE_URL to the function URL}"
REGION="${AWS_REGION:-eu-central-1}"

# Gets the credentials of your current session (AWS CLI v2)
eval "$(aws configure export-credentials --format env)"

BODY=$(jq -n --arg id "$1" --arg d "$2" --arg c "${3:-}" \
  '{approvalId: $id, decision: $d, comment: $c}')

TOKEN_HEADER=()
if [ -n "${AWS_SESSION_TOKEN:-}" ]; then
  TOKEN_HEADER=(-H "x-amz-security-token: ${AWS_SESSION_TOKEN}")
fi

curl --fail-with-body -sS "$DECIDE_URL" \
  --aws-sigv4 "aws:amz:${REGION}:lambda" \
  --user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" \
  "${TOKEN_HEADER[@]}" \
  -H 'content-type: application/json' \
  -d "$BODY"
echo
