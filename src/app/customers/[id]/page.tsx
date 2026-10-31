"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MetricCard, PageHeader, ScoreBar, StatusPill } from "@/components/ui";
import { formatCurrency, formatDate, formatPercent, initials } from "@/lib/format";

type Profile = {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    age: number;
    city: string;
    state: string;
    country: string;
    signupDate: string;
    acquisitionChannel: string;
    customerStatus: string;
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    lifetimeValue: number;
    lastPurchaseDate: string;
    daysSinceLastPurchase: number;
    favoriteCategory: string;
    churnScore: number;
    purchasePropensityScore: number;
    productFitScore: number;
    campaignEngagementScore: number;
    emailOpenRate: number;
    emailClickRate: number;
    lastCampaignEngagement: string;
    preferredChannel: string;
    synchronizedAt: string;
    pipelineRunId: string;
  };
  orders: { id: string; orderDate: string; amount: number; category: string; status: string }[];
  events: { id: string; campaignName: string; channel: string; eventType: string; eventAt: string }[];
  segments: { id: string; name: string; memberCount: number }[];
};

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/customers/${params.id}`)
      .then(async (res) => {
        const json = (await res.json()) as Profile & { ok: boolean; error?: string };
        if (!json.ok) throw new Error(json.error ?? "Not found");
        setData(json);
      })
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  if (error) return <div className="panel p-6 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className="panel p-6 text-sm text-[#6b6458]">Loading profile…</div>;
  const c = data.customer;

  return (
    <div>
      <PageHeader
        kicker="Profile"
        title={`${c.firstName} ${c.lastName}`}
        description={`${c.email} · ${c.city}, ${c.state} ${c.country} · synthetic record`}
        actions={
          <Link href="/customers" className="text-sm text-[#0f766e]">
            Back to explorer
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#10161f] text-sm text-[#e8e4d9]">
          {initials(c.firstName, c.lastName)}
        </div>
        <div>
          <StatusPill status={c.customerStatus} />
          <p className="mt-1 text-xs text-[#6b6458]">
            Acquired via {c.acquisitionChannel} · signup {formatDate(c.signupDate)} · {c.age} yrs
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <MetricCard label="Lifetime value" value={formatCurrency(c.lifetimeValue)} />
        <MetricCard label="Orders" value={String(c.totalOrders)} hint={`AOV ${formatCurrency(c.averageOrderValue)}`} />
        <MetricCard label="Churn risk" value={c.churnScore.toFixed(2)} tone={c.churnScore > 0.7 ? "warn" : "default"} />
        <MetricCard label="Propensity" value={c.purchasePropensityScore.toFixed(2)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <p className="kicker">Commerce</p>
          <h2 className="mt-1 text-lg font-semibold">Purchase behavior</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-[#6b6458]">Total revenue</dt>
              <dd className="num">{formatCurrency(c.totalRevenue)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#6b6458]">Favorite category</dt>
              <dd>{c.favoriteCategory}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#6b6458]">Last purchase</dt>
              <dd>{formatDate(c.lastPurchaseDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#6b6458]">Days since last purchase</dt>
              <dd className="num">{c.daysSinceLastPurchase}</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-2 text-sm">
            {data.orders.map((order) => (
              <li key={order.id} className="flex justify-between border-t border-[#f0ebe1] pt-2">
                <span>
                  {order.category} · {order.status}
                </span>
                <span className="num">
                  {formatCurrency(order.amount)} · {formatDate(order.orderDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-5">
          <p className="kicker">Marketing engagement</p>
          <h2 className="mt-1 text-lg font-semibold">Campaign activity</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-[#6b6458]">Open rate</dt>
              <dd>{formatPercent(c.emailOpenRate, 1)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#6b6458]">Click rate</dt>
              <dd>{formatPercent(c.emailClickRate, 1)}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#6b6458]">Preferred channel</dt>
              <dd>{c.preferredChannel}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#6b6458]">Last campaign engagement</dt>
              <dd>{formatDate(c.lastCampaignEngagement)}</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-2 text-sm">
            {data.events.map((event) => (
              <li key={event.id} className="flex justify-between border-t border-[#f0ebe1] pt-2">
                <span>
                  {event.campaignName} · {event.eventType}
                </span>
                <span className="text-xs text-[#6b6458]">
                  {event.channel} · {formatDate(event.eventAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <p className="kicker">Intelligence scores</p>
          <h2 className="mt-1 text-lg font-semibold">Model outputs</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Churn risk</span>
              <ScoreBar value={c.churnScore} warn />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Purchase propensity</span>
              <ScoreBar value={c.purchasePropensityScore} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Product fit</span>
              <ScoreBar value={c.productFitScore} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Campaign engagement</span>
              <ScoreBar value={c.campaignEngagementScore} />
            </div>
          </div>
        </section>
        <section className="panel p-5">
          <p className="kicker">Segment memberships</p>
          <h2 className="mt-1 text-lg font-semibold">Active dynamic segments</h2>
          {data.segments.length ? (
            <ul className="mt-4 space-y-2">
              {data.segments.map((segment) => (
                <li key={segment.id}>
                  <Link href={`/segments/${segment.id}`} className="text-sm font-medium hover:text-[#0f766e]">
                    {segment.name}
                  </Link>
                  <p className="text-xs text-[#6b6458]">{segment.memberCount} members</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[#6b6458]">Not currently a member of a dynamic segment.</p>
          )}
          <p className="mt-6 text-[11px] text-[#6b6458]">
            Snapshot from pipeline {c.pipelineRunId}. Product store synchronized {formatDate(c.synchronizedAt)}.
          </p>
        </section>
      </div>
    </div>
  );
}
