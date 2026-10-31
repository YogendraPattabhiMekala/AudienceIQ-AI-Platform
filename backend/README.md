# AudienceIQ warehouse service

Python 3.12 FastAPI service used for:

- semantic plan validation (`POST /semantic/validate`)
- warehouse adapter execution (`POST /semantic/execute`)
- pipeline transforms (`POST /pipelines/run`)
- AWS Lambda packaging (`app.lambda_handler.handler`)

Demo reviewers can ignore this process. The Next.js product app already executes governed queries against PostgreSQL.

```bash
pip install -r requirements.txt
PYTHONPATH=. python -m app.main
```

Set `WAREHOUSE_ADAPTER=snowflake` only when Snowflake credentials are present. The adapter will not fake a connection.
