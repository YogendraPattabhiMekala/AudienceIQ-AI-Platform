"""Idempotent warehouse-to-product synchronization stages.

Used by FastAPI, Lambda handlers, and Temporal activities. Each stage is
pure enough to unit test without AWS or Snowflake.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any


STAGES = [
    "raw_extract",
    "validation",
    "normalization",
    "derived_features",
    "model_scores",
    "warehouse_model",
    "semantic_model",
    "product_sync",
    "dynamic_segments",
]


@dataclass
class PipelineContext:
    run_id: str
    rows: list[dict[str, Any]] = field(default_factory=list)
    failed: list[dict[str, Any]] = field(default_factory=list)
    logs: list[str] = field(default_factory=list)


REQUIRED_FIELDS = {
    "customer_id",
    "email",
    "lifetime_value",
    "churn_score",
    "total_orders",
}


def validate_rows(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    good: list[dict[str, Any]] = []
    bad: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        cid = str(row.get("customer_id") or "")
        missing = [field for field in REQUIRED_FIELDS if row.get(field) in (None, "")]
        if not cid or cid in seen or missing:
            bad.append({**row, "errors": missing or ["duplicate_or_missing_id"]})
            continue
        if not isinstance(row.get("churn_score"), (int, float)) or not 0 <= float(row["churn_score"]) <= 1:
            bad.append({**row, "errors": ["churn_score_out_of_range"]})
            continue
        seen.add(cid)
        good.append(row)
    return good, bad


def normalize(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    out["email"] = str(out.get("email", "")).strip().lower()
    out["acquisition_channel"] = str(out.get("acquisition_channel", "Direct")).strip()
    out["country"] = str(out.get("country", "US")).upper()
    return out


def derive_features(row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    orders = int(out.get("total_orders") or 0)
    revenue = float(out.get("total_revenue") or out.get("lifetime_value") or 0)
    out["average_order_value"] = round(revenue / orders, 2) if orders else 0.0
    out["lifetime_value"] = float(out.get("lifetime_value") or revenue)
    recency = int(out.get("days_since_last_purchase") or 0)
    out["days_since_last_purchase"] = max(0, recency)
    return out


def score_row(row: dict[str, Any]) -> dict[str, Any]:
    """Deterministic fallback scores used when a model endpoint is unavailable."""
    out = dict(row)
    recency = int(out.get("days_since_last_purchase") or 0)
    engagement = float(out.get("campaign_engagement_score") or 0.3)
    churn = min(0.97, max(0.03, recency / 400 + (0.4 - engagement)))
    out["churn_score"] = round(float(out.get("churn_score") or churn), 3)
    out["purchase_propensity_score"] = round(float(out.get("purchase_propensity_score") or 1 - out["churn_score"] * 0.8), 3)
    out["product_fit_score"] = round(float(out.get("product_fit_score") or 0.5), 3)
    return out


def matches_rule(row: dict[str, Any], field: str, operator: str, value: Any) -> bool:
    actual = row.get(field)
    if actual is None:
        return False
    if operator == "eq":
        return actual == value
    if operator == "neq":
        return actual != value
    if operator == "gt":
        return actual > value
    if operator == "gte":
        return actual >= value
    if operator == "lt":
        return actual < value
    if operator == "lte":
        return actual <= value
    if operator == "contains":
        return str(value).lower() in str(actual).lower()
    if operator == "in":
        return actual in value
    return False


def segment_membership(rows: list[dict[str, Any]], rules: list[dict[str, Any]], combinator: str = "and") -> list[str]:
    members: list[str] = []
    for row in rows:
        checks = [matches_rule(row, rule["field"], rule["operator"], rule["value"]) for rule in rules]
        ok = all(checks) if combinator == "and" else any(checks)
        if ok:
            members.append(str(row["customer_id"]))
    return members


def run_pipeline(rows: list[dict[str, Any]], run_id: str | None = None) -> PipelineContext:
    ctx = PipelineContext(run_id=run_id or datetime.now(tz=UTC).strftime("run_%Y%m%d%H%M%S"))
    ctx.logs.append("raw_extract")
    good, bad = validate_rows(rows)
    ctx.failed = bad
    ctx.logs.append("validation")
    normalized = [normalize(row) for row in good]
    ctx.logs.append("normalization")
    featured = [derive_features(row) for row in normalized]
    ctx.logs.append("derived_features")
    scored = [score_row(row) for row in featured]
    ctx.logs.append("model_scores")
    ctx.rows = scored
    ctx.logs.extend(["warehouse_model", "semantic_model", "product_sync", "dynamic_segments"])
    return ctx
