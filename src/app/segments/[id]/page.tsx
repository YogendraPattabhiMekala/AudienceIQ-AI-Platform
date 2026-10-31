"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Histogram, MetricCard, PageHeader, ScoreBar, StatusPill } from "@/components/ui";
import { formatCurrency, formatNumber, formatRelative } from "@/lib/format";

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  lifetimeValue: number;
  churnScore: number;
  campaignEngagementScore: number;
  state: string;
  favoriteCategory: string;
  daysSinceLastPurchase: number;
};

type Segment = {
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

export default function SegmentDetailPage() {
  const params = useParams<{ id: string }>();
  const [segment, setSegment] = useState<Segment | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activation, setActivation] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch(`/api/segments/${params.id}`, { signal });
    const json = (await res.json()) as { ok: boolean; error?: string; segment: Segment; members: Member[] };
    if (!json.ok) throw new Error(json.error ?? "Not found");
    if (signal?.aborted) return;
    setSegment(json.segment);
    setMembers(json.members);
  }, [params.id]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void load(controller.signal).catch((err: Error) => {
          if (!controller.signal.aborted) setError(err.message);
        });
      }
    });
    return () => controller.abort();
  }, [load]);

  async function recompute() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/segments/${params.id}/recompute`, { method: "POST" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Recompute failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function activate(destination: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/segments/${params.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; activation?: { message: string } };
      if (!json.ok) throw new Error(json.error ?? "Activation failed");
      setActivation(json.activation?.message ?? "Activated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!segment && !error) return <div className="panel p-6 text-sm text-[#6b6458]">Loading segment…</div>;
  if (!segment) return <div className="panel p-6 text-sm text-rose-700">{error}</div>;

  const histogram = [
    { label: "low LTV", value: members.filter((m) => m.lifetimeValue < 400).length },
    { label: "mid LTV", value: members.filter((m) => m.lifetimeValue >= 400 && m.lifetimeValue < 1000).length },
    { label: "high LTV", value: members.filter((m) => m.lifetimeValue >= 1000).length },
  ];

  return (
    <div>
      <PageHeader
        kicker="Audience"
        title={segment.name}
        description={segment.description}
        actions={
          <button
            type="button"
            onClick={() => void recompute()}
            disabled={busy}
            className="rounded-full border border-[#e4dfd4] bg-white px-4 py-2 text-sm"
          >
            Recompute membership
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-5">
        <MetricCard label="Members" value={formatNumber(segment.memberCount)} />
        <MetricCard label="Avg LTV" value={formatCurrency(segment.averageLtv)} />
        <MetricCard label="Avg churn" value={segment.averageChurn.toFixed(2)} tone="warn" />
        <MetricCard label="Revenue" value={formatCurrency(segment.totalRevenue)} />
        <MetricCard
          label="Last updated"
          value={segment.lastComputedAt ? formatRelative(segment.lastComputedAt) : "—"}
          hint={`v${segment.version}`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="panel p-5 lg:col-span-2">
          <p className="kicker">Definition</p>
          <h2 className="mt-1 text-lg font-semibold">Structured rules ({segment.combinator.toUpperCase()})</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {segment.rules.map((rule, index) => (
              <li key={index} className="rounded-lg bg-[#f6f2e9] px-3 py-2 font-mono text-xs">
                {rule.field} {rule.operator} {String(rule.value)}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-5">
          <p className="kicker">Activation</p>
          <h2 className="mt-1 text-lg font-semibold">Export audience</h2>
          <p className="mt-2 text-xs text-[#6b6458]">
            Simulated destinations only. No advertising credentials are used.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {["paid_media", "email", "crm"].map((destination) => (
              <button
                key={destination}
                type="button"
                disabled={busy}
                onClick={() => void activate(destination)}
                className="rounded-lg border border-[#e4dfd4] px-3 py-2 text-left text-sm capitalize hover:border-[#0f766e]"
              >
                Activate · {destination.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          {activation ? <p className="mt-3 text-xs text-[#0f766e]">{activation}</p> : null}
          {error ? <p className="mt-3 text-xs text-rose-700">{error}</p> : null}
        </section>
      </div>

      <section className="panel mt-4 p-5">
        <p className="kicker">Distribution</p>
        <h2 className="mt-1 mb-4 text-lg font-semibold">Member LTV bands (first 100 loaded)</h2>
        <Histogram data={histogram} />
      </section>

      <div className="panel mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#e4dfd4] text-xs uppercase tracking-wider text-[#6b6458]">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-3 py-3">LTV</th>
              <th className="px-3 py-3">Churn</th>
              <th className="px-3 py-3">Engagement</th>
              <th className="px-3 py-3">Recency</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-[#f0ebe1]">
                <td className="px-4 py-3">
                  <Link href={`/customers/${member.id}`} className="font-medium hover:text-[#0f766e]">
                    {member.firstName} {member.lastName}
                  </Link>
                  <p className="text-xs text-[#6b6458]">
                    {member.email} · {member.state} · {member.favoriteCategory}
                  </p>
                </td>
                <td className="num px-3 py-3">{formatCurrency(member.lifetimeValue)}</td>
                <td className="px-3 py-3">
                  <ScoreBar value={member.churnScore} warn />
                </td>
                <td className="px-3 py-3">
                  <ScoreBar value={member.campaignEngagementScore} />
                </td>
                <td className="num px-3 py-3">{member.daysSinceLastPurchase}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[#6b6458]">
        <StatusPill status="healthy" /> membership served from PostgreSQL product tables.
      </p>
    </div>
  );
}
