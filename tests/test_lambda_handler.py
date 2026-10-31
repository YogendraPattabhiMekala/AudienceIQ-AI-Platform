import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.lambda_handler import handler


def test_health():
    result = handler({"rawPath": "/health", "requestContext": {"http": {"method": "GET"}}})
    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["ok"] is True


def test_validate_rejects_sql():
    result = handler(
        {
            "rawPath": "/semantic/validate",
            "requestContext": {"http": {"method": "POST"}},
            "body": json.dumps({"filters": [{"field": "hacked", "operator": "eq", "value": 1}]}),
        }
    )
    assert result["statusCode"] == 400


def test_validate_accepts_governed_plan():
    result = handler(
        {
            "rawPath": "/semantic/validate",
            "requestContext": {"http": {"method": "POST"}},
            "body": json.dumps(
                {
                    "filters": [{"field": "lifetime_value", "operator": "gt", "value": 1000}],
                    "limit": 10,
                }
            ),
        }
    )
    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["plan"]["limit"] == 10
