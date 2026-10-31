import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "temporal"))

from workflows import STAGES, run_local_fallback


def test_local_fallback_runs_all_stages():
    result = run_local_fallback({"runId": "run_test", "rows": 3200})
    assert result["ok"] is True
    assert result["orchestrator"] == "in-process"
    assert [item["stage"] for item in result["stages"]] == STAGES
    assert result["stages"][0]["idempotencyKey"] == "run_test:raw_extract"
