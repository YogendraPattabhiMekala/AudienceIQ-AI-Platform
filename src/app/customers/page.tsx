"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, ScoreBar, StatusPill } from "@/components/ui";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { SemanticFilter } from "@/lib/types";

type CustomerRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  state: string;
  acquisitionChannel: string;
  customerStatus: string;
  favoriteCategory: string;
  lifetimeValue: number;
  churnScore: number;
  purchasePropensityScore: number;
  campaignEngagementScore: number;
  daysSinceLastPurchase: number;
  age: number;
  totalOrders: number;
  segmentMemberships: string[];
};

const ALL_COLUMNS = [
  { key: "customer", label: "Customer" },
  { key: "location", label: "Location" },
  { key: "status", label: "Status" },
  { key: "channel", label: "Channel" },
  { key: "category", label: "Category" },
  { key: "ltv", label: "LTV" },
  { key: "churn", label: "Churn" },
  { key: "propensity", label: "Propensity" },
  { key: "engagement", label: "Engagement" },
  { key: "recency", label: "Recency" },
] as const;

const PRESETS: { label: string; filters: SemanticFilter[] }[] = [
  {
    label: "Churn > 0.70",
    filters: [{ field: "churn_score", operator: "gt", value: 0.7 }],
  },
  {
    label: "LTV > $1,000",
    filters: [{ field: "lifetime_value", operator: "gt", value: 1000 }],
  },
  {
    label: "Demo slice",
    filters: [
      { field: "churn_score", operator: "gt", value: 0.7 },
      { field: "lifetime_value", operator: "gt", value: 1000 },
    ],
  },
  {
    label: "Electronics",
    filters: [{ field: "favorite_category", operator: "eq", value: "Electronics" }],
  },
];

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("lifetimeValue");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<SemanticFilter[]>([]);
  const [draftField, setDraftField] = useState("state");
  const [draftOp, setDraftOp] = useState<"eq" | "gt" | "lt" | "gte" | "lte">("eq");
  const [draftValue, setDraftValue] = useState("NY");
  const [columns, setColumns] = useState<string[]>(ALL_COLUMNS.map((item) => item.key));
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [freshness, setFreshness] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      search,
      sort,
      dir,
      page: String(page),
      pageSize: "25",
      filters: JSON.stringify(filters),
    });
    return `/api/customers?${params.toString()}`;
  }, [search, sort, dir, page, filters]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(query, { signal });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        rows: CustomerRow[];
        total: number;
        pages: number;
        freshness?: { freshnessLabel: string };
      };
      if (!json.ok) throw new Error(json.error ?? "Failed to load customers");
      if (signal?.aborted) return;
      setRows(json.rows);
      setTotal(json.total);
      setPages(json.pages);
      setFreshness(json.freshness?.freshnessLabel ?? "");
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    // Fetch starts in a microtask, rather than synchronously updating state in an effect.
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  function toggleSort(next: string) {
    if (sort === next) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(next);
      setDir("desc");
    }
    setPage(1);
  }

  const visible = (key: string) => columns.includes(key);

  return (
    <div>
      <PageHeader
        kicker="Explorer"
        title="Customers"
        description="Sort, filter and page the synchronized customer 360. This path never issues a live warehouse query."
        actions={<p className="text-xs text-[#6b6458]">{freshness || "Last synchronized: —"}</p>}
      />

      <div className="panel p-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, id, city…"
            className="min-w-[220px] flex-1 rounded-lg border border-[#e4dfd4] bg-white px-3 py-2 text-sm outline-none focus:border-[#0f766e]"
          />
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[#e4dfd4] bg-white px-3 py-2 text-sm"
          >
            <option value="lifetimeValue">Sort: LTV</option>
            <option value="churnScore">Sort: Churn</option>
            <option value="daysSinceLastPurchase">Sort: Recency</option>
            <option value="purchasePropensityScore">Sort: Propensity</option>
            <option value="totalOrders">Sort: Orders</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setFilters(preset.filters);
                setPage(1);
              }}
              className="rounded-full border border-[#e4dfd4] bg-white px-3 py-1 text-xs hover:border-[#0f766e]"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setFilters([]);
              setPage(1);
            }}
            className="rounded-full px-3 py-1 text-xs text-[#6b6458]"
          >
            Clear filters
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-[#6b6458]">
            Field
            <select
              value={draftField}
              onChange={(event) => setDraftField(event.target.value)}
              className="mt-1 block rounded-lg border border-[#e4dfd4] bg-white px-2 py-1.5 text-sm"
            >
              <option value="state">state</option>
              <option value="favorite_category">favorite_category</option>
              <option value="lifetime_value">lifetime_value</option>
              <option value="churn_score">churn_score</option>
              <option value="days_since_last_purchase">days_since_last_purchase</option>
              <option value="acquisition_channel">acquisition_channel</option>
              <option value="customer_status">customer_status</option>
            </select>
          </label>
          <label className="text-xs text-[#6b6458]">
            Op
            <select
              value={draftOp}
              onChange={(event) => setDraftOp(event.target.value as typeof draftOp)}
              className="mt-1 block rounded-lg border border-[#e4dfd4] bg-white px-2 py-1.5 text-sm"
            >
              <option value="eq">eq</option>
              <option value="gt">gt</option>
              <option value="gte">gte</option>
              <option value="lt">lt</option>
              <option value="lte">lte</option>
            </select>
          </label>
          <label className="text-xs text-[#6b6458]">
            Value
            <input
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
              className="mt-1 block rounded-lg border border-[#e4dfd4] bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-[#10161f] px-3 py-1.5 text-xs text-white"
            onClick={() => {
              const numeric = Number(draftValue);
              const value = Number.isFinite(numeric) && draftOp !== "eq" ? numeric : Number.isFinite(numeric) && ["lifetime_value", "churn_score", "days_since_last_purchase"].includes(draftField) ? numeric : draftValue;
              setFilters((current) => [...current, { field: draftField, operator: draftOp, value }]);
              setPage(1);
            }}
          >
            Add filter
          </button>
        </div>

        {filters.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {filters.map((filter, index) => (
              <span key={`${filter.field}-${index}`} className="rounded-full bg-[#ece7dc] px-3 py-1 text-xs">
                {filter.field} {filter.operator} {String(filter.value)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#6b6458]">
          Columns:
          {ALL_COLUMNS.map((column) => (
            <label key={column.key} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={visible(column.key)}
                onChange={() =>
                  setColumns((current) =>
                    current.includes(column.key)
                      ? current.filter((item) => item !== column.key)
                      : [...current, column.key],
                  )
                }
              />
              {column.label}
            </label>
          ))}
        </div>
      </div>

      <div className="panel mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#e4dfd4] text-xs uppercase tracking-wider text-[#6b6458]">
            <tr>
              {visible("customer") ? <th className="px-4 py-3">Customer</th> : null}
              {visible("location") ? <th className="px-3 py-3">Location</th> : null}
              {visible("status") ? <th className="px-3 py-3">Status</th> : null}
              {visible("channel") ? <th className="px-3 py-3">Channel</th> : null}
              {visible("category") ? <th className="px-3 py-3">Category</th> : null}
              {visible("ltv") ? (
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort("lifetimeValue")}>
                    LTV
                  </button>
                </th>
              ) : null}
              {visible("churn") ? (
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort("churnScore")}>
                    Churn
                  </button>
                </th>
              ) : null}
              {visible("propensity") ? <th className="px-3 py-3">Propensity</th> : null}
              {visible("engagement") ? <th className="px-3 py-3">Engagement</th> : null}
              {visible("recency") ? <th className="px-3 py-3">Days since purchase</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-sm text-[#6b6458]" colSpan={10}>
                  Loading synchronized customers…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-4 py-6 text-sm text-rose-700" colSpan={10}>
                  {error}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-[#f0ebe1] hover:bg-[#faf7f0]">
                  {visible("customer") ? (
                    <td className="px-4 py-3">
                      <Link href={`/customers/${row.id}`} className="font-medium hover:text-[#0f766e]">
                        {row.firstName} {row.lastName}
                      </Link>
                      <p className="text-xs text-[#6b6458]">{row.email}</p>
                    </td>
                  ) : null}
                  {visible("location") ? (
                    <td className="px-3 py-3 text-xs">
                      {row.city}, {row.state}
                    </td>
                  ) : null}
                  {visible("status") ? (
                    <td className="px-3 py-3">
                      <StatusPill status={row.customerStatus} />
                    </td>
                  ) : null}
                  {visible("channel") ? <td className="px-3 py-3 text-xs">{row.acquisitionChannel}</td> : null}
                  {visible("category") ? <td className="px-3 py-3 text-xs">{row.favoriteCategory}</td> : null}
                  {visible("ltv") ? <td className="num px-3 py-3">{formatCurrency(row.lifetimeValue)}</td> : null}
                  {visible("churn") ? (
                    <td className="px-3 py-3">
                      <ScoreBar value={row.churnScore} warn />
                    </td>
                  ) : null}
                  {visible("propensity") ? (
                    <td className="px-3 py-3">
                      <ScoreBar value={row.purchasePropensityScore} />
                    </td>
                  ) : null}
                  {visible("engagement") ? (
                    <td className="px-3 py-3">
                      <ScoreBar value={row.campaignEngagementScore} />
                    </td>
                  ) : null}
                  {visible("recency") ? (
                    <td className="num px-3 py-3">{row.daysSinceLastPurchase}d</td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 text-xs text-[#6b6458]">
          <p>
            {formatNumber(total)} customers · page {page} of {pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-md border border-[#e4dfd4] px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-md border border-[#e4dfd4] px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
