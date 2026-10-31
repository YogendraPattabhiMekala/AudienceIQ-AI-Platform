"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart, Histogram, MetricCard, PageHeader, StatusPill } from "@/components/ui";
import { formatCurrency, formatNumber, formatPercent, formatRelative } from "@/lib/format";

type DashboardResponse = {
  ok: boolean;
  activeSegments: number;
  pipeline: { status: string; startedAt: string; id: string } | null;
  sync: { dataset: string; label: string; synchronizedAt: string; freshnessLabel: string }[];
  metrics: {
    totals: {
      totalCustomers: number;
      activeCustomers: number;
      averageLtv: number;
      highChurn: number;
      revenue: number;
      engagement: number;
      avgChurn: number;
    };
    byChannel: { label: string; ltv: number; customers: number }[];
    byStatus: { label: string; customers: number }[];
    byCategory: { label: string; revenue: number }[];
    churnBuckets: { label: string; value: number }[];
  };
};

export default function OverviewPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (res) => {
        const json = (await res.json()) as DashboardResponse & { error?: string };
        if (!json.ok) throw new Error(json.error ?? "Failed to load dashboard");
        setData(json);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <div className="panel p-6 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className="panel p-6 text-sm text-[#6b6458]">Loading workspace metrics…</div>;

  const t = data.metrics.totals;

  return (
    <div>
      <PageHeader
        kicker="Workspace"
        title="Customer intelligence overview"
        description="Precomputed customer 360 served from PostgreSQL. Warehouse-side transformations stay behind the synchronization boundary."
        actions={
          <Link href="/ask" className="rounded-full bg-[#10161f] px-4 py-2 text-sm text-white">
            Ask AudienceIQ
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total customers" value={formatNumber(t.totalCustomers)} hint="Product store snapshot" />
        <MetricCard label="Active customers" value={formatNumber(t.activeCustomers)} hint="Purchase in 90 days" tone="good" />
        <MetricCard label="Average LTV" value={formatCurrency(t.averageLtv)} />
        <MetricCard
          label="High churn risk"
          value={formatNumber(t.highChurn)}
          hint="churn_score > 0.70"
          tone="warn"
        />
        <MetricCard label="Active segments" value={formatNumber(data.activeSegments)} />
        <MetricCard label="Revenue (lifetime)" value={formatCurrency(t.revenue)} />
        <MetricCard label="Campaign engagement" value={formatPercent(t.engagement, 1)} />
        <MetricCard
          label="Latest pipeline"
          value={data.pipeline?.status ?? "—"}
          hint={data.pipeline ? formatRelative(data.pipeline.startedAt) : "No runs"}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <section className="panel p-5 xl:col-span-2">
          <p className="kicker">Acquisition quality</p>
          <h2 className="mt-1 text-lg font-semibold">Average LTV by channel</h2>
          <p className="mb-4 mt-1 text-xs text-[#6b6458]">
            Interactive charts read the synchronized product store, not Snowflake.
          </p>
          <BarChart
            data={data.metrics.byChannel.map((row) => ({
              label: row.label.replace("Paid ", "P. ").replace("Organic ", "Org. "),
              value: Number(row.ltv),
            }))}
          />
        </section>
        <section className="panel p-5">
          <p className="kicker">Data freshness</p>
          <h2 className="mt-1 text-lg font-semibold">Synchronized datasets</h2>
          <ul className="mt-4 space-y-3">
            {data.sync.map((item) => (
              <li key={item.dataset} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-[#6b6458]">{item.freshnessLabel}</p>
                </div>
                <StatusPill status="healthy" />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <p className="kicker">Risk</p>
          <h2 className="mt-1 text-lg font-semibold">Churn score distribution</h2>
          <div className="mt-4">
            <Histogram data={data.metrics.churnBuckets} />
          </div>
        </section>
        <section className="panel p-5">
          <p className="kicker">Commerce</p>
          <h2 className="mt-1 text-lg font-semibold">Revenue by favorite category</h2>
          <ul className="mt-4 space-y-2">
            {data.metrics.byCategory.map((row) => (
              <li key={row.label} className="flex items-center justify-between text-sm">
                <span>{row.label}</span>
                <span className="num">{formatCurrency(Number(row.revenue))}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
