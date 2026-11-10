# bakery/handler.py
import json
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

UNIT_PRICE = {"roll": Decimal("0.45"), "pretzel": Decimal("0.80")}


class PreOrder(BaseModel):
    item: Literal["roll", "pretzel"]
    quantity: int = Field(ge=1, le=200)


def calculate_price(order: PreOrder) -> Decimal:
    """From 10 pieces there is a 10 percent discount on the whole order."""
    total = UNIT_PRICE[order.item] * order.quantity
    if order.quantity >= 10:
        total *= Decimal("0.9")
    return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def handler(event, context):
    try:
        order = PreOrder.model_validate_json(event.get("body") or "{}")
    except ValidationError as error:
        return {
            "statusCode": 400,
            "headers": {"content-type": "application/json"},
            "body": json.dumps({"errors": error.errors(include_url=False)}, default=str),
        }
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({
            "item": order.item,
            "quantity": order.quantity,
            "price_eur": str(calculate_price(order)),
        }),
    }
