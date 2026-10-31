"""Temporal worker entrypoint (production). Demo does not require this process."""

from __future__ import annotations

import asyncio
import os


async def main() -> None:
    try:
        from temporalio.client import Client
        from temporalio.worker import Worker
        from workflows import ProductSyncWorkflow, pipeline_stage
    except ImportError as exc:
        raise SystemExit(
            "temporalio is not installed. Demo mode uses the in-process fallback in the product API."
        ) from exc

    address = os.environ.get("TEMPORAL_ADDRESS", "localhost:7233")
    namespace = os.environ.get("TEMPORAL_NAMESPACE", "default")
    task_queue = os.environ.get("TEMPORAL_TASK_QUEUE", "audienceiq-pipelines")
    client = await Client.connect(address, namespace=namespace)
    worker = Worker(
        client,
        task_queue=task_queue,
        workflows=[ProductSyncWorkflow],
        activities=[pipeline_stage],
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
