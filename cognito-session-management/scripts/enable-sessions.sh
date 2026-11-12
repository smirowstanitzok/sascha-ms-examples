#!/usr/bin/env bash
# scripts/enable-sessions.sh
# Turns on session management and caps app sessions at 5 per person
set -euo pipefail

POOL_ID="$1"
CLIENT_ID="$2"

aws cognito-idp set-user-pool-session-configuration \
  --user-pool-id "$POOL_ID" \
  --user-session-tracking ENABLED \
  --token-session MaxPerUser=5

# Silently reuse the browser sign-in for at most 8 hours (default: 60 minutes)
aws cognito-idp set-user-pool-client-session-configuration \
  --user-pool-id "$POOL_ID" \
  --client-id "$CLIENT_ID" \
  --sso-session MaxValidityMinutes=480

aws cognito-idp get-user-pool-session-configuration --user-pool-id "$POOL_ID"
