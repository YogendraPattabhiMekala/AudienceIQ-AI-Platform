import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.pipeline import derive_features, run_pipeline, score_row, segment_membership, validate_rows


def test_validation_and_dedup():
    rows = [
        {"customer_id": "a", "email": "A@X.com", "lifetime_value": 10, "churn_score": 0.2, "total_orders": 1},
        {"customer_id": "a", "email": "dup@x.com", "lifetime_value": 10, "churn_score": 0.2, "total_orders": 1},
        {"customer_id": "b", "email": "b@x.com", "lifetime_value": 10, "churn_score": 1.4, "total_orders": 1},
        {"email": "missing@x.com", "lifetime_value": 10, "churn_score": 0.2, "total_orders": 1},
    ]
    good, bad = validate_rows(rows)
    assert len(good) == 1
    assert len(bad) == 3


def test_derived_aov():
    out = derive_features({"total_orders": 4, "total_revenue": 200, "lifetime_value": 200, "days_since_last_purchase": 3})
    assert out["average_order_value"] == 50.0


def test_score_bounds():
    scored = score_row({"days_since_last_purchase": 400, "campaign_engagement_score": 0.1})
    assert 0 < scored["churn_score"] <= 0.97


def test_pipeline_stages_and_idempotent_shape():
    ctx = run_pipeline(
        [
            {
                "customer_id": "CUS-1",
                "email": "Jordan.Lee.1@example.com",
                "lifetime_value": 1800,
                "churn_score": 0.81,
                "total_orders": 6,
                "total_revenue": 1800,
                "days_since_last_purchase": 12,
                "campaign_engagement_score": 0.1,
            }
        ]
    )
    assert ctx.logs[0] == "raw_extract"
    assert ctx.logs[-1] == "dynamic_segments"
    assert ctx.rows[0]["email"] == "jordan.lee.1@example.com"
    assert len(ctx.failed) == 0


def test_segment_and_or():
    rows = [
        {"customer_id": "1", "lifetime_value": 1500, "churn_score": 0.8},
        {"customer_id": "2", "lifetime_value": 200, "churn_score": 0.8},
        {"customer_id": "3", "lifetime_value": 1500, "churn_score": 0.2},
    ]
    rules = [
        {"field": "lifetime_value", "operator": "gt", "value": 1000},
        {"field": "churn_score", "operator": "gt", "value": 0.7},
    ]
    assert segment_membership(rows, rules, "and") == ["1"]
    assert set(segment_membership(rows, rules, "or")) == {"1", "2", "3"}
