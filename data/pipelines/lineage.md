# Pipeline lineage

```
RAW.CUSTOMERS ─┐
RAW.ORDERS ────┼─► STG_* ─► ANALYTICS.CUSTOMER_360 ─► SEMANTIC.CUSTOMER_MARKETING
RAW.EVENTS ────┘                │
                                ├─► ANALYTICS.CUSTOMER_SCORES
                                ├─► ANALYTICS.CUSTOMER_ENGAGEMENT
                                └─► sync ─► PostgreSQL product store ─► dynamic segments ─► application
```

Each stage records `pipeline_run_id`, `source_updated_at`, and `synchronized_at`.
