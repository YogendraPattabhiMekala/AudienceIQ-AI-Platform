"""Governed semantic query validation.

The LLM never receives a SQL execution tool. It may only emit a structured
plan which is validated against the allow-listed catalog before translation.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

CATALOG_PATH = Path(__file__).resolve().parents[2] / "data" / "semantic" / "catalog.json"

DESTRUCTIVE = re.compile(
    r"\b(drop|delete|truncate|alter|insert|update|grant|revoke|copy|execute|pg_sleep)\b",
    re.I,
)
SQL_META = re.compile(r"(--|/\*|\*/|;|\bunion\b|\bselect\b|\bfrom\b)", re.I)


def load_catalog() -> dict[str, Any]:
    return json.loads(CATALOG_PATH.read_text())


class QueryValidationError(ValueError):
    pass


def _allowed_fields(catalog: dict[str, Any]) -> set[str]:
    names = {item["name"] for item in catalog["dimensions"]}
    names.update(item["name"] for item in catalog["metrics"])
    names.add("customer_count")
    return names


def validate_plan(raw: Any, catalog: dict[str, Any] | None = None) -> dict[str, Any]:
    catalog = catalog or load_catalog()
    if not isinstance(raw, dict):
        raise QueryValidationError("Query plan must be an object")

    allowed = _allowed_fields(catalog)
    operators = set(catalog["operators"])
    intent = raw.get("intent") or "list_customers"
    if intent not in {"list_customers", "aggregate", "distribution", "metric"}:
        raise QueryValidationError(f"Unsupported intent: {intent}")

    def check_fields(values: Any, label: str) -> list[str]:
        values = values or []
        if not isinstance(values, list):
            raise QueryValidationError(f"{label} must be a list")
        names = [str(item) for item in values]
        for name in names:
            if name not in allowed:
                raise QueryValidationError(f"Field is not in the semantic allow-list: {name}")
        return names

    dimensions = check_fields(raw.get("dimensions"), "dimensions")
    metrics = check_fields(raw.get("metrics"), "metrics")
    group_by = check_fields(raw.get("groupBy") or raw.get("group_by"), "groupBy")

    filters_raw = raw.get("filters") or []
    if len(filters_raw) > catalog["limits"]["maxFilters"]:
        raise QueryValidationError("Too many filters")

    filters: list[dict[str, Any]] = []
    for index, item in enumerate(filters_raw):
        if not isinstance(item, dict):
            raise QueryValidationError(f"Filter {index} is invalid")
        field = str(item.get("field") or "")
        operator = str(item.get("operator") or "")
        value = item.get("value")
        if field not in allowed:
            raise QueryValidationError(f"Unauthorized filter field: {field}")
        if operator not in operators:
            raise QueryValidationError(f"Operator not allowed: {operator}")
        if value in (None, ""):
            raise QueryValidationError(f"Filter {field} is missing a value")
        if isinstance(value, str) and (DESTRUCTIVE.search(value) or (SQL_META.search(value) and len(value) > 40)):
            raise QueryValidationError(f"Rejected potentially unsafe value at filters[{index}]")
        filters.append({"field": field, "operator": operator, "value": value})

    limit = raw.get("limit") or catalog["limits"]["defaultRows"]
    try:
        limit = int(limit)
    except (TypeError, ValueError) as exc:
        raise QueryValidationError("limit must be an integer") from exc
    limit = max(1, min(limit, catalog["limits"]["maxRows"]))

    return {
        "intent": intent,
        "dimensions": dimensions,
        "metrics": metrics,
        "filters": filters,
        "groupBy": group_by,
        "sort": raw.get("sort") or [],
        "limit": limit,
    }


def plan_to_sql(plan: dict[str, Any], catalog: dict[str, Any] | None = None) -> str:
    """Human-readable SQL for explanations. Never concatenates user strings as identifiers."""
    catalog = catalog or load_catalog()
    columns = {
        **{item["name"]: item.get("column", item["name"]) for item in catalog["dimensions"]},
        **{item["name"]: item.get("column", item["name"]) for item in catalog["metrics"] if item.get("column")},
    }
    select = "id, first_name, last_name, lifetime_value, churn_score"
    if plan["intent"] in {"aggregate", "metric"}:
        parts = [columns.get(name, name) for name in plan["groupBy"]]
        parts.append("COUNT(*) AS customer_count")
        select = ", ".join(parts) if parts else "COUNT(*) AS customer_count"
    where_parts = []
    for index, filt in enumerate(plan["filters"], start=1):
        col = columns.get(filt["field"])
        if not col:
            raise QueryValidationError(f"Cannot project unauthorized field {filt['field']}")
        where_parts.append(f"{col} {filt['operator']} ${index}")
    where = f" WHERE {' AND '.join(where_parts)}" if where_parts else ""
    return f"SELECT {select} FROM customers{where} LIMIT {plan['limit']}"
