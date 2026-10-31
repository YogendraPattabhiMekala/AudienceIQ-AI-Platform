"""Warehouse adapter boundary.

Production: Snowflake (Cortex + semantic views).
Demo: PostgreSQL (or DuckDB) exposing the same repository interface.

This module does not pretend to open a Snowflake session when credentials
are missing. Callers must choose an adapter explicitly.
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Any


class WarehouseAdapter(ABC):
    name: str

    @abstractmethod
    def is_available(self) -> bool: ...

    @abstractmethod
    def execute_semantic(self, plan: dict[str, Any]) -> dict[str, Any]: ...

    @abstractmethod
    def fetch_customer_360(self, limit: int = 100) -> list[dict[str, Any]]: ...


class PostgresWarehouseAdapter(WarehouseAdapter):
    name = "postgres"

    def __init__(self, dsn: str | None = None) -> None:
        self.dsn = dsn or os.environ.get("DATABASE_URL", "")

    def is_available(self) -> bool:
        return bool(self.dsn)

    def execute_semantic(self, plan: dict[str, Any]) -> dict[str, Any]:
        from .semantic import plan_to_sql, validate_plan

        valid = validate_plan(plan)
        return {
            "adapter": self.name,
            "sql": plan_to_sql(valid),
            "plan": valid,
            "note": "Demo adapter. The Next.js product API executes this plan with Drizzle against PostgreSQL.",
        }

    def fetch_customer_360(self, limit: int = 100) -> list[dict[str, Any]]:
        return []


class SnowflakeWarehouseAdapter(WarehouseAdapter):
    name = "snowflake"

    def __init__(self) -> None:
        self.account = os.environ.get("SNOWFLAKE_ACCOUNT")
        self.user = os.environ.get("SNOWFLAKE_USER")
        self.password = os.environ.get("SNOWFLAKE_PASSWORD")
        self.warehouse = os.environ.get("SNOWFLAKE_WAREHOUSE")
        self.database = os.environ.get("SNOWFLAKE_DATABASE", "AUDIENCEIQ")
        self.schema = os.environ.get("SNOWFLAKE_SCHEMA", "SEMANTIC")

    def is_available(self) -> bool:
        return all([self.account, self.user, self.password, self.warehouse])

    def _connect(self) -> Any:
        if not self.is_available():
            raise RuntimeError(
                "Snowflake adapter is not configured. Set SNOWFLAKE_ACCOUNT/USER/PASSWORD/WAREHOUSE "
                "or use WAREHOUSE_ADAPTER=postgres for demo mode."
            )
        try:
            import snowflake.connector  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "snowflake-connector-python is not installed. Add it in production images only."
            ) from exc
        return snowflake.connector.connect(
            account=self.account,
            user=self.user,
            password=self.password,
            warehouse=self.warehouse,
            database=self.database,
            schema=self.schema,
        )

    def execute_semantic(self, plan: dict[str, Any]) -> dict[str, Any]:
        from .semantic import plan_to_sql, validate_plan

        valid = validate_plan(plan)
        sql = plan_to_sql(valid)
        with self._connect() as conn:
            cur = conn.cursor()
            try:
                cur.execute(sql.replace("$1", "%s"))
                rows = cur.fetchmany(valid["limit"])
            finally:
                cur.close()
        return {"adapter": self.name, "sql": sql, "plan": valid, "rows": rows}

    def fetch_customer_360(self, limit: int = 100) -> list[dict[str, Any]]:
        with self._connect() as conn:
            cur = conn.cursor()
            try:
                cur.execute(
                    "select * from ANALYTICS.CUSTOMER_360 qualify row_number() over (order by lifetime_value desc) <= %s",
                    (limit,),
                )
                cols = [item[0] for item in cur.description]
                return [dict(zip(cols, row, strict=False)) for row in cur.fetchall()]
            finally:
                cur.close()


def get_adapter() -> WarehouseAdapter:
    choice = os.environ.get("WAREHOUSE_ADAPTER", "postgres").lower()
    if choice == "snowflake":
        return SnowflakeWarehouseAdapter()
    return PostgresWarehouseAdapter()
