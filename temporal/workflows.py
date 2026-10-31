"""Temporal workflow for warehouse → product synchronization.

Production: Temporal Cloud / self-hosted cluster.
Demo: Next.js /api/operations/run executes the same stages in-process.

This file is intentionally import-safe without the temporalio SDK so
reviewers can read the workflow contract without extra dependencies.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

try:
    from temporalio import activity, workflow
    from temporalio.common import RetryPolicy
except ImportError:  # pragma: no cover - local demo fallback
    activity = None
    workflow = None
    RetryPolicy = None


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


def run_activity(stage: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Idempotent activity body used by Temporal and the local fallback."""
    return {
        "stage": stage,
        "status": "completed",
        "idempotencyKey": f"{payload.get('runId')}:{stage}",
        "rows": payload.get("rows", 0),
    }


if activity is not None:

    @activity.defn
    async def pipeline_stage(stage: str, payload: dict[str, Any]) -> dict[str, Any]:
        return run_activity(stage, payload)


if workflow is not None:

    @workflow.defn
    class ProductSyncWorkflow:
        @workflow.run
        async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
            results = []
            policy = RetryPolicy(
                maximum_attempts=3,
                initial_interval=timedelta(seconds=1),
                backoff_coefficient=2.0,
            )
            for stage in STAGES:
                result = await workflow.execute_activity(
                    pipeline_stage,
                    args=[stage, payload],
                    start_to_close_timeout=timedelta(minutes=10),
                    retry_policy=policy,
                )
                results.append(result)
            return {"ok": True, "stages": results, "runId": payload.get("runId")}


def run_local_fallback(payload: dict[str, Any]) -> dict[str, Any]:
    """Used when Temporal is not running. Same activity contract, sequential."""
    results = [run_activity(stage, payload) for stage in STAGES]
    return {"ok": True, "orchestrator": "in-process", "stages": results, "runId": payload.get("runId")}
