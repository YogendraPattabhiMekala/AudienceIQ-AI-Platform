# AudienceIQ design

This document records the architectural decisions behind AudienceIQ. It is written for engineers reviewing the repository.

## Product application vs surrounding services

The **running product** is a Next.js 16 App Router application with React 19, TypeScript and Tailwind CSS. It owns:

- marketer-facing UI
- product APIs
- the PostgreSQL product store via Drizzle ORM
- governed Ask AudienceIQ execution
- dynamic segment computation
- pipeline status and simulated activations

A **Python 3.12 FastAPI service** owns warehouse-oriented contracts:

- semantic plan validation (shared catalog)
- Snowflake vs PostgreSQL warehouse adapters
- pipeline transformations
- AWS Lambda-compatible handlers

This split is deliberate. Interactive product UX should not inherit warehouse latency, driver complexity, or warehouse cost. Warehouse work belongs on a service that can run as Lambda, a container, or a Temporal worker.

TanStack Start / Vite / Bun / Base UI would be a reasonable SPA shell. They are not the demo runtime because this project is delivered as a single fullstack TypeScript app that reviewers can start without a separate bundler toolchain. The design system is custom Tailwind, not a generic admin kit.

## 1. Why not query Snowflake for every UI interaction?

Customer Explorer is a highly interactive surface: sort, filter, page, search, column selection. Hitting Snowflake (or any cloud warehouse) on each keystroke would mean:

- multi-hundred-millisecond to multi-second latency
- warehouse credit burn proportional to UI chatter
- queueing behind ETL and data-science jobs
- failure modes that take the product down when the warehouse is busy

Marketers need a product, not a SQL client. The warehouse remains the system of record for heavy transformation. The product store is the system of interaction.

## 2. What gets precomputed?

Stored in PostgreSQL as `customers` (customer 360):

- identity and geo
- acquisition and status
- commerce rollups (orders, revenue, AOV, LTV, recency)
- model scores (churn, propensity, product fit, engagement)
- email rates and last campaign engagement
- denormalized segment membership names
- `source_updated_at`, `synchronized_at`, `pipeline_run_id`

Also precomputed:

- segment membership tables and segment statistics
- dashboard aggregates (computed on the product store, still cheap at this grain)
- score histograms

## 3. What remains warehouse-native?

- RAW / STAGING / ANALYTICS model builds
- large historical scans
- training / rescoring jobs
- Cortex or other warehouse-resident AI
- exploratory analyst SQL that is *not* a product path
- backfills

The Snowflake adapter is a real interface. It does not open a fake connection. Without credentials it refuses to run and the demo adapter is used instead.

## 4. How does synchronization work?

```
RAW extract
  → validation / dedup / types
  → normalization
  → derived features
  → model scores
  → ANALYTICS models
  → semantic publication
  → upsert PostgreSQL product tables
  → recompute dynamic segments
```

In demo mode the Next.js route `POST /api/operations/run` executes those stages against PostgreSQL (in-process Temporal fallback). Production would start `ProductSyncWorkflow` on Temporal, with activities calling the Python service / Lambda.

Each dataset row in `sync_state` stores `source_updated_at`, `synchronized_at`, and `pipeline_run_id`.

## 5. How are segments kept fresh?

Segments are stored as structured rules (`field`, `operator`, `value`, combinator AND/OR), never as raw SQL. After every product sync, membership is recomputed from the latest snapshot. Users can also recompute a single segment. Membership writes are idempotent (unique `(segment_id, customer_id)`).

## 6. How does the AI agent safely query data?

Ask AudienceIQ is a planner + tool, not a text-to-SQL chatbot.

1. Interpret the question (deterministic planner, or LLM JSON if `OPENAI_API_KEY` is set).
2. Emit a structured plan: dimensions, metrics, filters, groupBy, sort, limit.
3. Validate against `data/semantic/catalog.json`.
4. Execute through Drizzle using allow-listed column objects.
5. Return rows, chart metadata, and an explanation.

The model has no tool that executes a SQL string.

## 7. How do we prevent arbitrary SQL?

- allow-listed fields and operators
- parameterized Drizzle predicates
- destructive keyword rejection on literals
- max filters, max rows (500), timeout
- rate limiting on `/api/ask`
- SQL shown in "How this was calculated" is an explanation artifact, not a user-supplied statement

Injection payloads such as `'; DROP TABLE customers; --` fail validation.

## 8. How would this architecture scale?

| Layer | 10k customers | millions of customers |
| --- | --- | --- |
| Product store | single Postgres | Postgres primary + read replica, partitioned membership |
| Explorer | full table + btree indexes | cursor pagination, optional search replica |
| Segments | recompute from snapshot | incremental bitsets / inverted indexes, per-segment workers |
| Sync | full upsert | key-based CDC / merge |
| Agent | same governed plan | same plan, warehouse execution for heavy aggregates only |

## 9. What happens when Snowflake is unavailable?

The product UI continues to serve the last synchronized snapshot and shows freshness. New syncs fail visibly on Data Operations. Ask AudienceIQ still runs against PostgreSQL. The Snowflake adapter surfaces a 503; it does not hang on a fake socket.

## 10. How are pipeline retries handled?

Temporal activities use retry policy (3 attempts, exponential backoff) and an idempotency key `runId:stage`. The in-process fallback runs the same stage list. Failed runs persist `status=failed` plus the error string. Secrets are never written to logs.

## 11. How would Zero fit?

[Zero](https://zero.rocicorp.dev) would sit between PostgreSQL and the client as a incremental sync layer: the explorer table would be a live query rather than REST pagination.

It is **not implemented** here. Reasons:

- Zero needs its own replica/sync service and schema conventions
- this demo must run with only local PostgreSQL
- REST + SSR already demonstrates the product-store boundary

Production migration: keep the same `customers` grain, add a Zero schema that mirrors product tables, replace `listCustomers` with a live query, keep warehouse sync writing into Postgres as the upstream.

## 12. What would change for millions of customers?

- stop loading 100 members into the browser without virtualization
- compute histograms with approximate aggregations
- move segment recompute off the request thread entirely (Temporal only)
- shard membership
- consider columnar serving (DuckDB on a replica) for score distributions
- keep the semantic allow-list unchanged — governance does not change with scale

## Failure handling

| Failure | User-facing | Diagnostics |
| --- | --- | --- |
| Warehouse down | Freshness stale, sync failed | pipeline_runs.error |
| LLM down | Deterministic planner still answers | explanation.planner = deterministic |
| Invalid AI query | 400 with reason | ai_query_logs not written |
| Invalid segment field | 400 | none |
| Query timeout | 400 governed timeout | — |
| Database down | 500 generic | server logs, no secrets |

## Security notes

- no credentials in git
- `.env.example` documents names only
- parameterized SQL
- allow-listed agent tools
- activation destinations are simulated
- all customer records are synthetic (`@example.com`)
