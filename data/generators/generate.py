"""Deterministic synthetic first-party marketing data generator.

All records are fake. Emails use the example.com domain. A fixed seed
keeps local demos reproducible. The product application seeds PostgreSQL
with equivalent SQL (see src/lib/seed.ts); this module is the portable
generator used by tests and offline warehouse extracts.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass


FIRST = [
    "Avery", "Jordan", "Riley", "Quinn", "Cameron", "Hayden", "Rowan", "Skyler",
    "Parker", "Reese", "Finley", "Sage", "Drew", "Kendall", "Morgan", "Casey",
    "Taylor", "Jamie", "Elliot", "Harper", "Logan", "Nolan", "Peyton", "Reagan",
    "Sydney", "Emerson", "Marley", "Dakota", "Charlie", "Frankie",
]
LAST = [
    "Nguyen", "Patel", "Brooks", "Ramirez", "Cole", "Shah", "Bennett", "Diaz",
    "Hughes", "Klein", "Mahoney", "Iyer", "Walsh", "Petrov", "Okonkwo", "Berg",
    "Sato", "Rossi", "Dubois", "Nielsen", "Costa", "Alvarez", "Khan", "Okafor",
    "Silva", "Novak", "Brandt", "Farah", "Cohen", "Larsen",
]
CITIES = [
    ("Austin", "TX"), ("Denver", "CO"), ("Seattle", "WA"), ("Chicago", "IL"),
    ("Boston", "MA"), ("Atlanta", "GA"), ("Miami", "FL"), ("Portland", "OR"),
    ("Nashville", "TN"), ("Phoenix", "AZ"),
]
CHANNELS = ["Paid Search", "Organic Search", "Email", "Referral", "Paid Social", "Affiliate", "Direct", "Partnership"]
CATEGORIES = ["Electronics", "Apparel", "Home", "Beauty", "Sports", "Outdoor", "Grocery"]


@dataclass
class Customer:
    customer_id: str
    first_name: str
    last_name: str
    email: str
    lifetime_value: float
    churn_score: float
    days_since_last_purchase: int
    campaign_engagement_score: float
    favorite_category: str
    acquisition_channel: str
    total_orders: int
    total_revenue: float


def rng(seed: int, i: int) -> int:
    digest = hashlib.sha256(f"{seed}:{i}".encode()).hexdigest()
    return int(digest[:8], 16)


def generate_customers(n: int = 3200, seed: int = 42) -> list[Customer]:
    customers: list[Customer] = []
    for i in range(1, n + 1):
        r = rng(seed, i)
        first = FIRST[(i * 13) % len(FIRST)]
        last = LAST[(i * 17) % len(LAST)]
        demo = i <= 240
        ltv = 80 + (r % 4200) + (1400 if demo else 0)
        recency = 8 + (i % 70) if demo else 20 + (i * 11) % 360
        churn = 0.71 + (i % 26) * 0.01 if demo else min(0.97, 0.12 + (r % 86) * 0.01)
        engagement = 0.04 + (i % 18) * 0.01 if demo else min(0.95, 0.12 + (r % 80) * 0.01)
        customers.append(
            Customer(
                customer_id=f"CUS-{i:06d}",
                first_name=first,
                last_name=last,
                email=f"{first}.{last}.{i}@example.com".lower(),
                lifetime_value=round(ltv, 2),
                churn_score=round(churn, 3),
                days_since_last_purchase=recency,
                campaign_engagement_score=round(engagement, 3),
                favorite_category=CATEGORIES[(i * 3) % len(CATEGORIES)],
                acquisition_channel=CHANNELS[(i * 5) % len(CHANNELS)],
                total_orders=1 + (i * 7) % 36,
                total_revenue=round(ltv, 2),
            )
        )
    return customers


if __name__ == "__main__":
    rows = [asdict(item) for item in generate_customers()]
    print(json.dumps({"count": len(rows), "sample": rows[0]}, indent=2))
