"""AWS Lambda-compatible handlers.

Business logic lives in semantic.py / pipeline.py / warehouse.py so this
module is a thin adapter over API Gateway events. It is unit-testable
without deploying to AWS.
"""

from __future__ import annotations

import json
from typing import Any

from .pipeline import run_pipeline
from .semantic import QueryValidationError, plan_to_sql, validate_plan
from .warehouse import get_adapter


def _response(status: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", "Cache-Control": "no-store"},
        "body": json.dumps(body),
    }


def _parse(event: dict[str, Any]) -> dict[str, Any]:
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64

        body = base64.b64decode(body).decode("utf-8")
    if isinstance(body, str):
        return json.loads(body or "{}")
    return body


def handler(event: dict[str, Any], _context: Any = None) -> dict[str, Any]:
    path = event.get("rawPath") or event.get("path") or "/"
    method = (event.get("requestContext") or {}).get("http", {}).get("method") or event.get("httpMethod") or "GET"

    if path.endswith("/health") or path == "/":
        adapter = get_adapter()
        return _response(200, {"ok": True, "warehouse": adapter.name, "available": adapter.is_available()})

    try:
        payload = _parse(event) if method != "GET" else {}
    except json.JSONDecodeError:
        return _response(400, {"ok": False, "error": "Invalid JSON"})

    try:
        if path.endswith("/semantic/validate"):
            plan = validate_plan(payload)
            return _response(200, {"ok": True, "plan": plan, "sql": plan_to_sql(plan)})
        if path.endswith("/semantic/execute"):
            result = get_adapter().execute_semantic(payload)
            return _response(200, {"ok": True, **result})
        if path.endswith("/pipelines/run"):
            ctx = run_pipeline(payload.get("rows") or [])
            return _response(
                200,
                {"ok": True, "runId": ctx.run_id, "processed": len(ctx.rows), "failed": len(ctx.failed)},
            )
        return _response(404, {"ok": False, "error": "Not found"})
    except QueryValidationError as exc:
        return _response(400, {"ok": False, "error": str(exc)})
    except Exception as exc:  # noqa: BLE001 — Lambda must always return a safe body
        return _response(500, {"ok": False, "error": "Internal error", "detail": str(exc)})
