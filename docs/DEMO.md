# AudienceIQ — Two-Minute Walkthrough Script

A concise demonstration script for hiring managers and engineers. Speak conversationally as the engineer who designed and built the system. All customer records are synthetically generated.

---

### 1. Problem and AudienceIQ Overview (0:00 – 0:15)
> "In data engineering and marketing, teams often have rich Customer 360 models living inside cloud warehouses like Snowflake. But accessing that data is slow: marketers have to write SQL or file tickets, while running interactive UI queries directly against the warehouse wastes credits and leads to high latency. AudienceIQ solves this by introducing a synchronized product-serving layer in PostgreSQL, paired with a strictly governed semantic AI agent."

### 2. Customer Explorer (0:15 – 0:35)
> "On the Overview, we see high-level KPIs and dataset freshness chips showing our product store was synchronized recently. Moving to the **Customer Explorer**, we can search, sort, and filter across thousands of synthetic records sub-second. For example, let's filter for customers with `churn_score > 0.70` and `lifetime_value > $1,000`. Notice how instantaneous this is—because it queries the PostgreSQL product store with indexed predicates, completely shielding Snowflake from interactive UI chatter."

### 3. Scores / Customer Intelligence (0:35 – 0:55)
> "Clicking into any customer profile shows their unified commerce history, campaign engagement, and precomputed intelligence scores. On the **Scores** page, we don't just show single numbers—we examine population-level distributions. We can toggle between Churn, LTV, Propensity, and Product Fit, viewing histograms, percentiles, risk bands, and acquisition channel breakdowns to understand customer health across the entire base."

### 4. Dynamic Segment Creation (0:55 – 1:15)
> "Next, let's look at **Dynamic Segments**. Instead of storing brittle raw SQL, segments are represented as structured JSON rules with boolean AND/OR combinators. Here in the **High Value Churn Risk** segment, membership is dynamically evaluated against the product store. When underlying scores change, memberships are automatically updated. Marketers can also simulate one-click activation exports to Email ESPs, Paid Media, or CRM destinations."

### 5. Ask AudienceIQ + Governed Query (1:15 – 1:40)
> "Now let's ask a natural-language question in **Ask AudienceIQ**:
> *'Show high-value customers with churn risk above 70% who purchased during the last 90 days but have not engaged with a campaign during the last 30 days.'*
> Instead of giving an LLM free rein to write arbitrary SQL, the agent acts as a semantic query planner. It compiles the question into a structured plan, validates every field and operator against our governed catalog, and executes safely through our query tool."

### 6. "How This Was Calculated" (1:40 – 1:50)
> "When the results return, we provide complete explainability in the expandable **'How this was calculated'** drawer. Here the marketer and engineer can inspect the interpreted intent, the exact approved dimensions and metrics used, the applied filters, the business definitions referenced, the parameterized SQL compilation, and execution timing—proving this is transparent, auditable intelligence rather than an opaque chatbot."

### 7. Architecture / Data Freshness / Closing (1:50 – 2:00)
> "On the **Data Operations** page, we have complete observability into our data synchronization pipelines, row counts, and freshness timestamps. Under the hood, Next.js 16 and PostgreSQL serve the product, Python 3.12 handles warehouse pipelines and Lambda execution, Snowflake acts as the analytical warehouse, and Temporal coordinates multi-stage workflows. That's AudienceIQ: production-grade data engineering, responsive product serving, and governed AI analytics working together as a cohesive customer intelligence platform."
