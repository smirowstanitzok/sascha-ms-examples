# uv for AWS Lambda: packaging Python dependencies

Example code for the article **uv for AWS Lambda: Packaging Python Dependencies**

- English: https://sascha-ms.de/en/uv-aws-lambda-python-dependencies
- German: https://sascha-ms.de/2026/2577-uv-aws-lambda

A small bakery pre-order API (pydantic validation and price calculation) whose
dependencies are built with uv as Linux wheels for arm64 and deployed as a
Lambda layer with the Serverless Framework – no Docker needed.

## Files

| File | Purpose |
| --- | --- |
| `pyproject.toml` | Project definition (uv); `uv lock` creates `uv.lock` – commit it in your own project |
| `bakery/handler.py` | Lambda handler with pydantic model |
| `tests/test_handler.py` | Unit tests (pytest) |
| `scripts/build_layer.sh` | Builds `build/layer/python` with `uv export` + `uv pip install --python-platform` |
| `scripts/smoke_test.py` | Loads the handler using only the layer contents |
| `serverless.yml` | Serverless Framework v4: layer + function + HTTP API |

## Run

```bash
uv lock                          # creates uv.lock (the build script uses --frozen)
uv run pytest -q                 # 3 passed
./scripts/build_layer.sh         # arm64 layer for python3.14
serverless deploy                # needs AWS credentials
```

Local smoke test on x86_64 Linux:

```bash
PLATFORM=x86_64-manylinux_2_28 ./scripts/build_layer.sh
uv run python scripts/smoke_test.py
```

## Tested with

- uv 0.13.7, Python 3.14.10, pydantic 2.14.3 (pydantic-core 2.50.4), pytest 9
- Serverless Framework v4 configuration (not deployed in CI)
