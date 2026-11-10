# tests/test_handler.py
import json

from bakery.handler import handler


def order(body: dict) -> dict:
    return handler({"body": json.dumps(body)}, None)


def test_price_for_three_pretzels():
    response = order({"item": "pretzel", "quantity": 3})
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["price_eur"] == "2.40"


def test_discount_from_ten_pieces():
    response = order({"item": "roll", "quantity": 12})
    # 12 x 0.45 = 5.40 minus 10 percent = 4.86
    assert json.loads(response["body"])["price_eur"] == "4.86"


def test_unknown_item_returns_400():
    response = order({"item": "croissant", "quantity": 1})
    assert response["statusCode"] == 400
