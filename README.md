# AudienceIQ

**AI-Powered Customer Intelligence & Dynamic Audience Platform**

AudienceIQ is a full-stack data product for exploring first-party customer data, building dynamic audience segments, analyzing model scores, and asking governed natural-language questions over customer data.

The system demonstrates how analytical warehouse data can be transformed into a responsive product experience without issuing expensive warehouse queries for every interactive request.

> **Notice:** All customer records in this repository are synthetically generated for demonstration. Names, emails (`@example.com`), purchase histories, and model scores are synthetic and contain no real personally identifiable information (PII).
## Application Preview

AudienceIQ is a full-stack customer intelligence platform featuring interactive analytics, dynamic segmentation, governed natural-language queries, and data synchronization monitoring.

### Executive Dashboard
![AudienceIQ Dashboard](docs/images/dashboard.png)

*Customer intelligence KPIs, churn-risk distribution, revenue analytics, and dataset freshness.*

### Customer Explorer
![Customer Explorer](docs/images/customers.png)

*Search, filter, and explore 3,200 synthetic customer profiles.*

### Dynamic Audience Segmentation
![Dynamic Segments](docs/images/segments.png)

*Manage rule-based audience segments and customer memberships.*

### Ask AudienceIQ — Natural-Language Analytics
![Ask AudienceIQ](docs/images/ask-audienceiq.png)

*Ask business questions in natural language and explore governed analytics results.*

### Data Operations
![Data Operations](docs/images/operations.png)

*Monitor synchronization workflows, pipeline status, and dataset freshness.*

> All customer data is synthetic. Marketing activations are simulated. The application currently runs locally; public deployment is planned for a future iteration.

---

## 1. Overview

Marketing teams frequently have rich customer 360 models residing inside cloud data warehouses such as Snowflake. However, accessing that information typically requires SQL knowledge, dedicated data engineering tickets, or slow BI tools.

AudienceIQ introduces a high-performance **product-facing serving layer** (PostgreSQL via Drizzle ORM) synchronized from the analytical warehouse. By precomputing high-frequency metrics, intelligence scores, and customer attributes:
- Marketers experience sub-50ms filtering, sorting, and segmentation.
- Warehouse query concurrency and credit costs are minimized.
- AI agents operate under strict semantic governance rather than generating unconstrained SQL.
- Data freshness and pipeline lineage remain fully transparent to end users.

---

## 2. Demo Walkthrough

AudienceIQ runs locally out of the box with zero external cloud dependencies. A deterministic synthetic seed generates 3,200 Customer 360 profiles, commerce orders, campaign events, and dynamic segments on first run.

- **Walkthrough Script:** A structured 2-minute demonstration flow is detailed in [docs/DEMO.md](docs/DEMO.md).
- **Core Product Paths:**
  1. **Overview Dashboard (`/`):** Workspace KPIs, acquisition LTV breakdown, and sync freshness indicators.
  2. **Customer Explorer (`/customers`):** Sub-50ms filtering by churn risk (> 0.70), LTV (> $1,000), state, and categories without querying the warehouse.
  3. **Customer Profiles (`/customers/:id`):** Unified commerce history, marketing engagement, and model scores.
  4. **Score Distributions (`/scores`):** Population-level distributions for Churn, LTV, Propensity, and Product Fit.
  5. **Dynamic Segments (`/segments`):** Boolean rule builder (AND/OR) with automated membership recomputation and simulated activations.
  6. **Ask AudienceIQ (`/ask`):** Governed natural-language query compiler with transparent "How this was calculated" provenance.
  7. **Data Operations (`/operations`):** End-to-end sync pipeline status and dataset freshness monitoring.

---

## 3. Application Views

The platform comprises five primary operational surfaces (captures cataloged in `docs/images/`):

1. **Overview Dashboard:** High-level executive KPIs, channel LTV distributions, category revenue rollups, and dataset-level freshness indicators.
2. **Customer Explorer:** High-density, real-time customer data grid supporting multi-attribute filtering (numeric, date, categorical), column customizers, and sub-second pagination served directly from PostgreSQL.
3. **Dynamic Segment Builder:** Structured boolean rule builder (AND/OR combinators) with instant membership recalculation and simulated multi-channel activations (Email ESP, Paid Media, CRM).
4. **Ask AudienceIQ (Governed Semantic AI):** Natural-language analytics interface backed by an allow-listed catalog with full "How this was calculated" query auditability.
5. **Data Operations & Sync Observability:** Pipeline run timeline tracking extraction, validation, feature derivation, score refreshes, and product store sync.

---

## 4. Key Features

- **Interactive Customer Explorer:** Real-time search, sorting, and multi-field filtering over thousands of synthetic customer profiles without hitting the warehouse.
- **Deep Customer Profiles:** Single-pane view combining commerce history, marketing engagement, lifecycle status, intelligence scores, and dynamic segment memberships.
- **Score Distribution Analytics:** Population-level analysis of churn risk, purchase propensity, product fit, and lifetime value with histograms, percentiles, and segment band comparisons.
- **Dynamic Segment Engine:** Flexible structured rules (AND/OR combinators) stored as portable JSON predicates that recompute membership when data changes.
- **Simulated Activation Hub:** Downstream export simulations for Paid Media, Email ESPs, and CRM destinations with audience versioning and audit trails.
- **Ask AudienceIQ (Governed AI):** Marketer-friendly natural-language analytics backed by an allow-listed semantic catalog and strict structured output validation.
- **Explainable AI Provenance:** Every AI response features an expandable **"How this was calculated"** drawer displaying interpreted intent, catalog mappings, applied filters, and execution timing.
- **Data Freshness & Lineage:** Dataset-level timestamp tracking (`source_updated_at`, `synchronized_at`, `pipeline_run_id`) across all product views.

---

## 5. Architecture

AudienceIQ establishes a clear operational boundary between the analytical data warehouse, backend data pipelines, governed AI query agents, and product user experiences:

```
┌────────────────────────────────────────────────────────┐
│                   Marketer Persona                     │
└──────────────────────────┬─────────────────────────────┘
                           │ Interactive UI & NL Questions
                           ▼
┌────────────────────────────────────────────────────────┐
│               Frontend & Product API Layer             │
│            Next.js 16 (App Router) + React 19          │
│            TypeScript + Tailwind CSS Design System     │
└──────────────┬─────────────────────────┬───────────────┘
               │                         │
     Interactive Queries          Ask AudienceIQ
     (Explorer, Segments)       (Semantic Planner)
               │                         │
               ▼                         ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  Product Serving Layer   │  │   Semantic Governance    │
│    PostgreSQL (Docker)   │◄─┤ data/semantic/catalog.json│
│    Drizzle ORM Schema    │  │ Validated Query Engine   │
└──────────────▲───────────┘  └──────────────────────────┘
               │
    Synchronized Snapshot (Sub-50ms UX)
               │
┌──────────────┴─────────────────────────────────────────┐
│          Pipeline & Synchronization Boundary           │
│  Temporal Workflow / Python 3.12 FastAPI / AWS Lambda   │
└──────────────▲─────────────────────────────────────────┘
               │
    Analytical Transformations
               │
┌──────────────┴─────────────────────────────────────────┐
│               Analytical Data Warehouse                │
│       Production: Snowflake (RAW/STG/ANALYTICS)         │
│       Local/Demo: Local PostgreSQL Warehouse Adapter   │
└────────────────────────────────────────────────────────┘
```

---

## 6. Architecture Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Marketer
    participant UI as AudienceIQ UI
    participant Agent as NL Planner (Deterministic / LLM)
    participant Semantic as Governance Engine (catalog.json)
    participant DB as Product Store (PostgreSQL)

    Marketer->>UI: Enters natural-language question
    UI->>Agent: POST /api/ask (question)
    Agent->>Semantic: Generate structured JSON query plan
    Note over Semantic: Validates dimensions, metrics,<br/>operators, limits, and literal safety
    Semantic->>DB: Execute parameterized Drizzle query
    DB-->>Semantic: Result rows & aggregate statistics
    Semantic-->>UI: Data payload + "How this was calculated" metadata
    UI-->>Marketer: Renders answer summary, chart, and audit drawer
```

---

## 7. Tech Stack

### Currently Implemented & Running

| Layer | Technology | Purpose & Responsibility |
|---|---|---|
| **Frontend UI** | Next.js 16 (App Router), React 19, TypeScript | High-performance B2B SaaS interface, server components, and responsive views |
| **Styling** | Tailwind CSS (v4) | Bespoke editorial design system with warm canvas aesthetics and clean data density |
| **Product Database** | PostgreSQL 16, Drizzle ORM | Low-latency product store serving customer profiles, scores, segments, and activations |
| **AI / Semantic Engine**| Governed Query Planner, JSON Catalog | Strict allow-listed dimension/metric mapping, query compiler, parameterization |
| **Warehouse Services** | Python 3.12, FastAPI, Pydantic | Warehouse adapter contracts, transformation stages, and batch processing logic |
| **Serverless Adapter** | AWS Lambda-compatible handler | Python event handler conforming to AWS API Gateway HTTP payload v2 |
| **Infrastructure as Code**| Terraform (AWS) | Declarative Lambda, API Gateway, IAM, CloudWatch, and Secrets Manager definitions |
| **Containerization** | Docker, Docker Compose | Multi-container setup for PostgreSQL, Python backend, and optional Temporal |

### Architectural Clarifications & Honesty

- **Implementation Choice:** The application is delivered as a unified Next.js + PostgreSQL full-stack solution to ensure instant local evaluation without requiring multi-repo orchestration.
- **Alternative Frameworks:** SPA toolchains (such as TanStack Start/Vite/Bun) and client-side sync engines (such as Zero) are detailed in [docs/DESIGN.md](docs/DESIGN.md) as architectural trade-offs; they are not required to run this demo.
- **Warehouse Adapters:** The application features a clean adapter pattern (`PostgresWarehouseAdapter` for demo, `SnowflakeWarehouseAdapter` for production). The Snowflake adapter does not mock or fake connections—it requires real credentials and raises explicit configuration errors when unconfigured.

---

## 8. Governed AI Query Architecture

A central design principle of AudienceIQ is that **LLMs are never permitted to generate or execute arbitrary SQL strings**.

### The Governed Query Lifecycle

1. **Intent Extraction:** The user enters a natural-language prompt (e.g., *"Show high-value customers with churn risk above 70% who purchased during the last 90 days"*).
2. **Structured Plan Generation:** The planner outputs a validated JSON plan conforming to:
   ```json
   {
     "intent": "list_customers",
     "dimensions": ["customer_id", "first_name", "last_name", "lifetime_value"],
     "metrics": ["lifetime_value", "churn_score"],
     "filters": [
       { "field": "lifetime_value", "operator": "gt", "value": 1000 },
       { "field": "churn_score", "operator": "gt", "value": 0.70 },
       { "field": "days_since_last_purchase", "operator": "lte", "value": 90 }
     ],
     "groupBy": [],
     "sort": [{ "field": "lifetime_value", "direction": "desc" }],
     "limit": 100
   }
   ```
3. **Semantic Layer Enforcement (`data/semantic/catalog.json`):**
   - Fields must match allow-listed dimensions or metrics.
   - Operators are restricted to `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `between`, and `contains`.
   - String literals are sanitized against SQL meta-characters and destructive keywords.
   - Query limits are strictly clamped (max 500 rows) with governed execution timeouts.
4. **Deterministic Compilation:** The validated plan is compiled into parameterized Drizzle ORM queries using type-safe column references.
5. **Auditing & Transparency:** Every response returns the executed plan, business definitions used, execution timing, data source, and freshness timestamp.

---

## 9. Data Flow

```
1. Extraction:     RAW.CUSTOMERS, RAW.ORDERS, RAW.CAMPAIGN_EVENTS
       │
2. Transformation: STG_* (deduplication, email normalization, type coercion)
       │
3. Modeling:       ANALYTICS.CUSTOMER_360, CUSTOMER_SCORES, CUSTOMER_ENGAGEMENT
       │
4. Governance:     SEMANTIC.CUSTOMER_MARKETING (governed definitions & thresholds)
       │
5. Sync Pipeline:  Upsert into PostgreSQL Product Store + record sync_state
       │
6. Segmentation:   Recompute dynamic segment memberships & versioning
       │
7. Application:    Sub-second UI queries + Governed "Ask AudienceIQ" execution
```

Full details are documented in [docs/DATA_FLOW.md](docs/DATA_FLOW.md).

---

## 10. Local Setup

### Prerequisites

- Node.js 20+ (Node 22 recommended)
- npm 10+
- PostgreSQL instance (or Docker)
- Python 3.11+ (for running Python backend services and tests)

### Quick Start (Demo Mode)

```bash
# 1. Navigate to the project root
cd audienceiq

# 2. Configure environment
cp .env.example .env
# Edit .env if your PostgreSQL connection differs from postgresql://postgres:postgres@127.0.0.1:5432/app_db

# 3. Install Node.js dependencies with reproducible lockfile
npm ci

# 4. Push database schema to PostgreSQL
npx drizzle-kit push

# 5. Start the product application
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The initial page load automatically triggers the idempotent bootstrap process, generating 3,200 synthetic customers, order histories, marketing events, baseline dynamic segments, and pipeline execution history.

### Optional: Running the Python Warehouse Service

```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Start the FastAPI service
cd backend
PYTHONPATH=. python -m app.main
```

The FastAPI service boots on `http://localhost:8080` with `/health`, `/semantic/validate`, and `/pipelines/run` endpoints.

---

## 11. Demo Mode

AudienceIQ is built to be evaluated immediately without external cloud dependencies:

| Dimension | Demo Mode (`DEMO_MODE=true`) | Production Mode (`DEMO_MODE=false`) |
|---|---|---|
| **Warehouse** | Local PostgreSQL adapter | Snowflake (`RAW`, `STAGING`, `ANALYTICS`) |
| **Product Store** | PostgreSQL 16 (local or Docker) | AWS RDS / Aurora PostgreSQL (multi-AZ) |
| **AI Planner** | Deterministic semantic planner (or OpenAI if key set) | LLM structured output via OpenAI/Cortex |
| **Orchestration** | In-process sequential pipeline fallback | Temporal Cloud / self-hosted cluster |
| **Backend API** | Next.js API Routes + local FastAPI | AWS API Gateway + AWS Lambda (Python 3.12) |
| **Customer Data** | Deterministic synthetic generator (seed 42) | Enterprise first-party extracts |

---

## 12. Testing

The repository includes test suites covering semantic validation, injection mitigation, pipeline stages, Lambda compatibility, and data generation.

### Run Python Test Suite

```bash
pip install -r backend/requirements.txt
pytest tests -q
```

*Coverage includes:*
- Catalog loading and field allow-list enforcement
- SQL injection payload rejection
- Unknown dimension and metric blocking
- Pipeline validation, deduplication, and feature derivation (AOV, recency)
- Dynamic segment AND/OR evaluation
- AWS Lambda API Gateway event handling
- Temporal workflow local fallback execution
- Deterministic synthetic data generator reproducibility

### Run Frontend Verification

```bash
# Typecheck
npm run typecheck

# Lint
npm run lint

# Production Build
npm run build
```

---

## 13. Design Decisions

Key architectural rationales from [docs/DESIGN.md](docs/DESIGN.md):

1. **Why not query Snowflake directly for every UI interaction?** Interactive tables require sub-50ms responses for sorting, filtering, and paging. Querying the warehouse on every keystroke incurs multi-second latency, wastes warehouse credits, and tightly couples UI availability to warehouse batch contention.
2. **Precomputation Boundary:** Customer profile summaries, recency, AOV, LTV, intelligence scores, and segment memberships are materialized in PostgreSQL. Heavy historical rollups, raw extracts, and model re-training remain warehouse-native.
3. **Dynamic Segment Freshness:** Segments are saved as AST-like rules, not raw SQL strings. Membership is refreshed on every synchronization run or triggered manually per segment.
4. **Resilience to Warehouse Outages:** If Snowflake is unreachable, the application continues to serve the last synchronized snapshot from PostgreSQL, with freshness indicators clearly notifying users of pipeline lag.

---

## 14. Repository Structure

```
audienceiq/
├── .github/workflows/       # CI automation (lint, typecheck, build, test)
├── backend/                 # Python 3.12 warehouse & Lambda service
│   ├── app/
│   │   ├── lambda_handler.py # AWS Lambda API Gateway handler
│   │   ├── main.py          # FastAPI application entrypoint
│   │   ├── pipeline.py      # Idempotent data transformation stages
│   │   ├── semantic.py      # Governed semantic plan validator & compiler
│   │   └── warehouse.py     # Warehouse adapter interface (Postgres & Snowflake)
│   └── requirements.txt     # Python backend dependencies
├── data/                    # Data artifacts & semantic contracts
│   ├── generators/          # Deterministic synthetic customer generator
│   ├── models/              # Warehouse SQL views (RAW, STG, ANALYTICS, SEMANTIC)
│   ├── pipelines/           # Lineage and pipeline documentation
│   └── semantic/            # Governed semantic catalog (catalog.json)
├── docs/                    # Technical architecture & demo documentation
│   ├── images/              # Screenshot assets and capture guidelines
│   ├── DATA_FLOW.md         # End-to-end data pipeline & AI query flow
│   ├── DEMO.md              # 2-minute concise demonstration script
│   └── DESIGN.md            # Deep-dive architecture decisions and trade-offs
├── infrastructure/
│   └── terraform/           # Production AWS Lambda & API Gateway IaC
├── public/                  # Static assets & brand identity
├── src/                     # Full-stack product application (Next.js 16)
│   ├── app/                 # Next.js App Router pages and API route handlers
│   ├── components/          # Reusable UI primitives and application shell
│   ├── db/                  # Drizzle ORM schema, migrations, and PostgreSQL connection
│   └── lib/                 # Core domain logic (planner, executor, seed, formatting)
├── temporal/                # Temporal workflow and activity definitions
├── tests/                   # Python integration and unit test suite
├── docker-compose.yml       # Local multi-service environment
├── package.json             # Frontend package metadata and dependencies
├── package-lock.json        # Deterministic dependency lockfile
└── pytest.ini               # Pytest configuration
```

---

## 15. Production Considerations

- **Snowflake Activation:** Set `WAREHOUSE_ADAPTER=snowflake` and configure `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, and `SNOWFLAKE_WAREHOUSE`. The warehouse adapter executes queries against `SEMANTIC.CUSTOMER_MARKETING`.
- **AWS Serverless Packaging:** Apply the Terraform definitions in `infrastructure/terraform/` to provision an AWS HTTP API Gateway integrated with an AWS Lambda function running `backend/app/lambda_handler.handler`.
- **Orchestration:** Deploy `temporal/workflows.py` to a production Temporal cluster (`temporal/worker.py`) to manage pipeline retries, timeouts, and multi-stage synchronization.
- **Client Sync (Zero):** For applications requiring live, peer-to-peer reactive local state, see the Zero integration architecture in [docs/DESIGN.md](docs/DESIGN.md).

---

## 16. Additional Documentation

- [Architecture & Design Decisions](docs/DESIGN.md)
- [Data Flow & AI Query Lifecycle](docs/DATA_FLOW.md)
- [Two-Minute Demonstration Script](docs/DEMO.md)
- [Screenshot Guide & Assets](docs/images/README.md)

---

## License

This project is open-source under the [MIT License](LICENSE).
