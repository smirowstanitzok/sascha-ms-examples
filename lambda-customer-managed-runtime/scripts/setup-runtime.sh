#!/usr/bin/env bash
# scripts/setup-runtime.sh
# One-time setup: ECR repository, repository policy, runtime and the first version with three aliases.
# Usage: ./scripts/setup-runtime.sh 2026-11-19.1   (the image must already be pushed with this tag)
set -euo pipefail

VERSION="${1:?Please pass the first version name}"
REGION="${AWS_REGION:-eu-central-1}"
RUNTIME="radwerk-node24"
REPO="radwerk-node24"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"

aws ecr create-repository --repository-name "$REPO" \
  --image-tag-mutability IMMUTABLE --region "$REGION" >/dev/null || true

# Fill in account and region, then allow Lambda to read the images
sed -e "s/ACCOUNT_ID/${ACCOUNT}/g" -e "s/REGION/${REGION}/g" policies/ecr-policy.json > /tmp/ecr-policy.json
aws ecr set-repository-policy --repository-name "$REPO" \
  --policy-text file:///tmp/ecr-policy.json --region "$REGION" >/dev/null

aws lambda-core create-runtime \
  --name "$RUNTIME" \
  --description "Node.js 24 with radwerk logger and defaults" \
  --license-info "Node.js: MIT. radwerk logger: MIT." \
  --region "$REGION"

aws lambda-core create-runtime-version \
  --runtime-name "$RUNTIME" \
  --name "$VERSION" \
  --image-uri "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${REPO}:${VERSION}" \
  --region "$REGION"

for ALIAS in dev test prod; do
  aws lambda-core create-runtime-alias \
    --runtime-name "$RUNTIME" \
    --name "$ALIAS" \
    --runtime-version "$VERSION" \
    --region "$REGION"
  aws lambda-core wait runtime-alias-active \
    --runtime-name "$RUNTIME" --name "$ALIAS" --region "$REGION"
done
echo "Runtime ${RUNTIME} is ready."
