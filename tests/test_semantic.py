import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import pytest

from app.semantic import QueryValidationError, load_catalog, plan_to_sql, validate_plan


def test_catalog_loads():
    catalog = load_catalog()
    assert catalog["name"] == "semantic_customer_marketing"
    assert "lifetime_value" in {item["name"] for item in catalog["metrics"]}
    assert "churn_score" in {item["name"] for item in catalog["metrics"]}


def test_valid_high_value_churn_plan():
    plan = validate_plan(
        {
            "intent": "list_customers",
            "filters": [
                {"field": "lifetime_value", "operator": "gt", "value": 1000},
                {"field": "churn_score", "operator": "gt", "value": 0.7},
                {"field": "days_since_last_purchase", "operator": "lte", "value": 90},
                {"field": "campaign_engagement_score", "operator": "lt", "value": 0.25},
            ],
            "limit": 100,
        }
    )
    sql = plan_to_sql(plan)
    assert "lifetime_value" in sql
    assert "DROP" not in sql
    assert "$1" in sql


def test_rejects_unknown_field():
    with pytest.raises(QueryValidationError, match="Unauthorized filter field"):
        validate_plan({"filters": [{"field": "ssn", "operator": "eq", "value": "1"}]})


def test_rejects_injection_payload():
    with pytest.raises(QueryValidationError):
        validate_plan(
            {
                "filters": [
                    {
                        "field": "email",
                        "operator": "eq",
                        "value": "'; DROP TABLE customers; --",
                    }
                ]
            }
        )


def test_rejects_unauthorized_operator():
    with pytest.raises(QueryValidationError, match="Operator"):
        validate_plan({"filters": [{"field": "lifetime_value", "operator": "like", "value": "1"}]})


def test_caps_limit():
    plan = validate_plan({"limit": 99999})
    assert plan["limit"] == 500
