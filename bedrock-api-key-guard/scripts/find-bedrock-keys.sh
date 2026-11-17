#!/usr/bin/env bash
# scripts/find-bedrock-keys.sh
# Lists all long-term Bedrock API keys in the current account.
set -euo pipefail

printf '%-32s %-26s %-9s %s\n' "USER" "KEY ID" "STATUS" "EXPIRES"
for user in $(aws iam list-users --query 'Users[].UserName' --output text); do
  aws iam list-service-specific-credentials \
    --user-name "$user" \
    --service-name bedrock.amazonaws.com \
    --query 'ServiceSpecificCredentials[].[UserName,ServiceSpecificCredentialId,Status,ExpirationDate]' \
    --output text |
  while read -r name id status expires; do
    printf '%-32s %-26s %-9s %s\n' "$name" "$id" "$status" "${expires:-never}"
  done
done
