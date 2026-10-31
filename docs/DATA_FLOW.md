# Data flow

All customer information in this repository is **synthetically generated**. No real PII is used.

## Warehouse path (production)

```
Source extracts (commerce, ESP, web events)
        │
        ▼
   RAW.CUSTOMERS / RAW.ORDERS / RAW.CAMPAIGN_EVENTS
        │  validation, dedup, types, null handling
        ▼
   STG_CUSTOMERS / STG_ORDERS / STG_CAMPAIGN_EVENTS
        │  derived features, recency, AOV
        ▼
   ANALYTICS.CUSTOMER_360
   ANALYTICS.CUSTOMER_SCORES
   ANALYTICS.CUSTOMER_ENGAGEMENT
        │  governed definitions
        ▼
   SEMANTIC.CUSTOMER_MARKETING
        │  Temporal ProductSyncWorkflow
        ▼
   PostgreSQL product store (Drizzle models)
        │
        ├── Customer Explorer / Profiles / Scores  (interactive, no warehouse)
        ├── Dynamic segments + activations
        └── Ask AudienceIQ (governed plans against product store;
            heavy aggregations may be routed to Snowflake in production)
```

## Demo path (this repository)

`DEMO_MODE=true` and `WAREHOUSE_ADAPTER=postgres`.

`src/lib/seed.ts` materializes RAW-equivalent facts, the 360 grain, scores, pipeline history and seed segments into PostgreSQL using deterministic `generate_series` SQL (seed 42 equivalent). The Python generator `data/generators/generate.py` produces the same identities for offline use.

The Next.js product APIs never open a Snowflake session.

## AI query path

```
Marketer question
    │
    ▼
Ask AudienceIQ API  (/api/ask)
    │
    ├─► if OPENAI_API_KEY: LLM emits JSON plan (no SQL tool)
    └─► else: deterministic planner (src/lib/nl-planner.ts)
    │
    ▼
validateSemanticQuery  (allow-list, operators, limits)
    │
    ▼
executeSemanticQuery   (Drizzle predicates on customers)
    │
    ▼
Results + chart metadata + explanation
    │
    ▼
"How this was calculated"
    interpreted question
    dimensions / metrics / filters
    business definitions from data/semantic/catalog.json
    parameterized SQL preview
    data source + freshness + execution time
```

The Python service exposes the same validator at `POST /semantic/validate` so Lambda and local FastAPI share governance with the product app via the JSON catalog.

## Freshness fields

Every synchronized dataset has:

- `source_updated_at`
- `synchronized_at`
- `pipeline_run_id`

Displayed in Overview, Customer Explorer, Scores, and Data Operations.

## Activations

`POST /api/segments/:id/activate` writes an activation job with destination, customer count, status, timestamp and segment version. Destinations (`paid_media`, `email`, `crm`) are simulated. No advertising APIs are called.
