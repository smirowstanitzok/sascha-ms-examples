#!/usr/bin/env bash
# scripts/build_layer.sh – builds the dependencies as a Lambda layer
set -euo pipefail

PYTHON_VERSION="${PYTHON_VERSION:-3.14}"
PLATFORM="${PLATFORM:-aarch64-manylinux_2_28}"   # x86_64-manylinux_2_28 for x86_64
TARGET="build/layer/python"

rm -rf build/layer
mkdir -p "$TARGET"

# 1. Export only the runtime dependencies from uv.lock
uv export --frozen --no-dev --no-emit-project -o build/requirements.txt

# 2. Install matching Linux wheels for the Lambda platform
uv pip install \
  --requirement build/requirements.txt \
  --target "$TARGET" \
  --python-platform "$PLATFORM" \
  --python-version "$PYTHON_VERSION" \
  --only-binary :all: \
  --require-hashes \
  --no-installer-metadata \
  --compile-bytecode

echo "Layer ready: $(du -sh build/layer | cut -f1) in build/layer"
