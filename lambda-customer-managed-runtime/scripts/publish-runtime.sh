#!/usr/bin/env bash
# scripts/publish-runtime.sh
# Builds the runtime image, publishes a new runtime version and moves the "dev" alias.
# Usage: ./scripts/publish-runtime.sh 2026-11-19.1
set -euo pipefail

VERSION="${1:?Please pass a version name, e.g. 2026-11-19.1}"
REGION="${AWS_REGION:-eu-central-1}"
RUNTIME="radwerk-node24"
REPO="radwerk-node24"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE="${REGISTRY}/${REPO}:${VERSION}"

echo "Logging in to ECR ..."
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

echo "Building and pushing ${IMAGE} (x86_64 + arm64) ..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "$IMAGE" \
  --push runtime/

echo "Creating runtime version ${VERSION} ..."
aws lambda-core create-runtime-version \
  --runtime-name "$RUNTIME" \
  --name "$VERSION" \
  --image-uri "$IMAGE" \
  --release-notes "Runtime build ${VERSION}" \
  --region "$REGION"

echo "Pointing alias dev to ${VERSION} ..."
aws lambda-core update-runtime-alias \
  --runtime-name "$RUNTIME" \
  --name dev \
  --runtime-version "$VERSION" \
  --region "$REGION"

aws lambda-core get-runtime-alias \
  --runtime-name "$RUNTIME" \
  --name dev \
  --query "[State,RuntimeVersion]" \
  --region "$REGION"
