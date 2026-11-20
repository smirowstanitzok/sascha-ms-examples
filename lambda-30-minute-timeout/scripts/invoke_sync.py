# scripts/invoke_sync.py
import json
import sys

import boto3
from botocore.config import Config

config = Config(
    read_timeout=31 * 60,  # longer than the function timeout
    connect_timeout=5,
    tcp_keepalive=True,
    retries={"total_max_attempts": 1},  # no silent second run
)
client = boto3.client("lambda", config=config)
response = client.invoke(
    FunctionName=sys.argv[1] if len(sys.argv) > 1 else "photo-book-renderer-dev-renderPhotoBook",
    Payload=json.dumps({"Records": [{"messageId": "manual-1", "body": json.dumps({"orderId": "demo-42", "pageCount": 300})}]}),
)
print(response["StatusCode"])
