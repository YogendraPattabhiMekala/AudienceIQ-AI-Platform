"use client";

import { useEffect, useState } from "react";
import { BarChart, Histogram, MetricCard, PageHeader } from "@/components/ui";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const TABS = [
  { id: "churn_score", label: "Churn" },
  { id: "lifetime_value", label: "LTV" },
  { id: "purchase_propensity_score", label: "Purchase propensity" },
  { id: "product_fit_score", label: "Product fit" },
] as const;

type Dist = {
  metric: string;
  label: string;
  thresholds: { high: number; mid: number };
  stats: { avg: number; median: number; min: number; max: number; p25: number; p75: number; p90: number; n: number };
  bands: { high: number; medium: number; low: number };
  histogram: { label: string; value: number }[];
  byChannel: { label: string; value: number; customers: number }[];
  byStatus: { label: string; value: number; customers: number }[];
};

function fmt(metric: string, value: number) {
  if (metric === "lifetime_value") return formatCurrency(value);
  return value.toFixed(2);
}

export default function ScoresPage() {
  const [metric, setMetric] = useState<(typeof TABS)[number]["id"]>("churn_score");
  const [data, setData] = useState<Dist | null>(null);
  const [freshness, setFreshness] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/scores?metric=${metric}`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          ok: boolean;
          error?: string;
          distribution: Dist;
          sync?: { dataset: string; freshnessLabel: string }[];
        };
        if (!json.ok) throw new Error(json.error ?? "Failed to load score distribution");
        setData(json.distribution);
        setFreshness(json.sync?.find((item) => item.dataset === "customer_scores")?.freshnessLabel ?? "");
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load score distribution");
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [metric]);

  return (
    <div>
      <PageHeader
        kicker="Models"
        title="Score distributions"
        description="Inspect how churn, LTV, propensity and product fit vary across the customer population — not just a single number on a profile."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (metric !== tab.id) {
                setError(null);
                setData(null);
                setLoading(true);
                setMetric(tab.id);
              }
            }}
            className={`rounded-full px-4 py-1.5 text-sm ${
              metric === tab.id ? "bg-[#10161f] text-white" : "border border-[#e4dfd4] bg-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-xs text-[#6b6458]">{freshness}</p>
      {error ? <div className="panel p-4 text-sm text-rose-700">{error}</div> : null}
      {loading || !data ? (
        <div className="panel p-6 text-sm text-[#6b6458]">Computing distribution…</div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <MetricCard label="Average" value={fmt(metric, data.stats.avg)} />
            <MetricCard label="Median" value={fmt(metric, data.stats.median)} />
            <MetricCard label="Min" value={fmt(metric, data.stats.min)} />
            <MetricCard label="Max" value={fmt(metric, data.stats.max)} />
            <MetricCard label="P25" value={fmt(metric, data.stats.p25)} />
            <MetricCard label="P75" value={fmt(metric, data.stats.p75)} />
            <MetricCard label="P90" value={fmt(metric, data.stats.p90)} />
            <MetricCard label="Population" value={formatNumber(data.stats.n)} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <section className="panel p-5 lg:col-span-2">
              <p className="kicker">Histogram</p>
              <h2 className="mt-1 mb-4 text-lg font-semibold">{data.label} across customers</h2>
              <Histogram data={data.histogram} />
            </section>
            <section className="panel p-5">
              <p className="kicker">Bands</p>
              <h2 className="mt-1 text-lg font-semibold">High / medium / low</h2>
              <p className="mt-1 text-xs text-[#6b6458]">
                High ≥ {data.thresholds.high}
                {metric !== "lifetime_value" ? "" : ""} · Medium ≥ {data.thresholds.mid}
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex justify-between">
                  <span>High</span>
                  <span className="num">
                    {formatNumber(data.bands.high)} ({formatPercent(data.bands.high / data.stats.n, 1)})
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Medium</span>
                  <span className="num">
                    {formatNumber(data.bands.medium)} ({formatPercent(data.bands.medium / data.stats.n, 1)})
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Low</span>
                  <span className="num">
                    {formatNumber(data.bands.low)} ({formatPercent(data.bands.low / data.stats.n, 1)})
                  </span>
                </li>
              </ul>
            </section>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="panel p-5">
              <p className="kicker">Segment comparison</p>
              <h2 className="mt-1 mb-4 text-lg font-semibold">Average by acquisition channel</h2>
              <BarChart
                data={data.byChannel.map((row) => ({
                  label: row.label.replace("Paid ", "P.").replace("Organic ", "O."),
                  value: Number(row.value),
                }))}
              />
            </section>
            <section className="panel p-5">
              <p className="kicker">Lifecycle</p>
              <h2 className="mt-1 mb-4 text-lg font-semibold">Average by customer status</h2>
              <BarChart data={data.byStatus.map((row) => ({ label: row.label, value: Number(row.value) }))} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
