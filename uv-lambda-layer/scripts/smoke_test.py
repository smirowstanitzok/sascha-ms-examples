# scripts/smoke_test.py – calls the handler using only the layer contents
import json
import sys

sys.path[:0] = ["build/layer/python", "."]

from bakery.handler import handler  # noqa: E402

event = {"body": json.dumps({"item": "pretzel", "quantity": 10})}
print(handler(event, None))
