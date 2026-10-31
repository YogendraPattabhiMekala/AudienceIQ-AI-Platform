from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data" / "generators"))

from generate import generate_customers


def test_deterministic_and_synthetic():
    a = generate_customers(50, seed=42)
    b = generate_customers(50, seed=42)
    assert [row.email for row in a] == [row.email for row in b]
    assert all(row.email.endswith("@example.com") for row in a)
    assert a[0].customer_id == "CUS-000001"
    demo = [row for row in generate_customers(300, seed=42) if row.lifetime_value > 1000 and row.churn_score > 0.7]
    assert len(demo) > 20
