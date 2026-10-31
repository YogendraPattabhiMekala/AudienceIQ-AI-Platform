"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, StatusPill } from "@/components/ui";
import { formatCurrency, formatNumber, formatPercent, formatRelative } from "@/lib/format";

type SegmentRow = {
  id: string;
  name: string;
  description: string;
  combinator: string;
  rules: { field: string; operator: string; value: unknown }[];
  memberCount: number;
  averageLtv: number;
  averageChurn: number;
  totalRevenue: number;
  averageEngagement: number;
  lastComputedAt: string | null;
  version: number;
};

export default function SegmentsPage() {
  const [rows, setRows] = useState<SegmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [freshness, setFreshness] = useState("");

  useEffect(() => {
    fetch("/api/segments")
      .then(async (res) => {
        const json = (await res.json()) as {
          ok: boolean;
          error?: string;
          rows: SegmentRow[];
          sync?: { dataset: string; freshnessLabel: string }[];
        };
        if (!json.ok) throw new Error(json.error ?? "Failed");
        setRows(json.rows);
        setFreshness(json.sync?.find((item) => item.dataset === "customer_segments")?.freshnessLabel ?? "");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div>
      <PageHeader
        kicker="Audiences"
        title="Dynamic segments"
        description="Rule-based audiences stored as structured predicates, not raw SQL. Membership is recomputed when the product snapshot refreshes."
        actions={
          <Link href="/segments/new" className="rounded-full bg-[#10161f] px-4 py-2 text-sm text-white">
            New segment
          </Link>
        }
      />
      <p className="mb-4 text-xs text-[#6b6458]">{freshness}</p>
      {error ? <div className="panel p-4 text-sm text-rose-700">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((segment) => (
          <Link key={segment.id} href={`/segments/${segment.id}`} className="panel block p-5 hover:border-[#0f766e]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{segment.name}</h2>
                <p className="mt-1 text-sm text-[#6b6458]">{segment.description}</p>
              </div>
              <StatusPill status="active" />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-[#6b6458]">Members</dt>
                <dd className="num">{formatNumber(segment.memberCount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#6b6458]">Avg LTV</dt>
                <dd className="num">{formatCurrency(segment.averageLtv)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#6b6458]">Avg churn</dt>
                <dd className="num">{segment.averageChurn.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#6b6458]">Revenue</dt>
                <dd className="num">{formatCurrency(segment.totalRevenue)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-[#6b6458]">
              {segment.combinator.toUpperCase()} · {segment.rules.length} rules · v{segment.version} ·{" "}
              {segment.lastComputedAt ? formatRelative(segment.lastComputedAt) : "never computed"}
            </p>
            <p className="mt-2 text-[11px] text-[#9b9588]">
              Engagement {formatPercent(segment.averageEngagement, 1)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
