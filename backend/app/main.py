"""FastAPI service for local development and Lambda packaging."""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .pipeline import run_pipeline
from .semantic import QueryValidationError, plan_to_sql, validate_plan
from .warehouse import get_adapter

app = FastAPI(title="AudienceIQ Warehouse Service", version="1.0.0")


class PlanRequest(BaseModel):
    intent: str = "list_customers"
    dimensions: list[str] = Field(default_factory=list)
    metrics: list[str] = Field(default_factory=list)
    filters: list[dict[str, Any]] = Field(default_factory=list)
    groupBy: list[str] = Field(default_factory=list)
    sort: list[dict[str, Any]] = Field(default_factory=list)
    limit: int = 100


class PipelineRequest(BaseModel):
    rows: list[dict[str, Any]]


@app.get("/health")
def health() -> dict[str, Any]:
    adapter = get_adapter()
    return {
        "ok": True,
        "demoMode": os.environ.get("DEMO_MODE", "true") != "false",
        "warehouse": adapter.name,
        "warehouseAvailable": adapter.is_available(),
    }


@app.post("/semantic/validate")
def semantic_validate(plan: PlanRequest) -> dict[str, Any]:
    try:
        valid = validate_plan(plan.model_dump())
        return {"ok": True, "plan": valid, "sql": plan_to_sql(valid)}
    except QueryValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/semantic/execute")
def semantic_execute(plan: PlanRequest) -> dict[str, Any]:
    adapter = get_adapter()
    try:
        return {"ok": True, **adapter.execute_semantic(plan.model_dump())}
    except QueryValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/pipelines/run")
def pipelines_run(body: PipelineRequest) -> dict[str, Any]:
    ctx = run_pipeline(body.rows)
    return {
        "ok": True,
        "runId": ctx.run_id,
        "processed": len(ctx.rows),
        "failed": len(ctx.failed),
        "stages": ctx.logs,
    }


def run() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("BACKEND_PORT", "8080")),
        reload=False,
    )


if __name__ == "__main__":
    run()
