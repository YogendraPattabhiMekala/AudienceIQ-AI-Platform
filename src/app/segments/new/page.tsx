"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/ui";
import type { FilterOperator, SegmentRule } from "@/lib/types";

const FIELDS = [
  "lifetime_value",
  "churn_score",
  "days_since_last_purchase",
  "campaign_engagement_score",
  "purchase_propensity_score",
  "product_fit_score",
  "favorite_category",
  "state",
  "acquisition_channel",
  "customer_status",
  "total_orders",
];

const OPS: FilterOperator[] = ["gt", "gte", "lt", "lte", "eq", "neq"];

export default function NewSegmentPage() {
  const router = useRouter();
  const [name, setName] = useState("High Value Churn Risk");
  const [description, setDescription] = useState(
    "High-LTV customers with elevated churn who purchased recently but are not engaging.",
  );
  const [combinator, setCombinator] = useState<"and" | "or">("and");
  const [rules, setRules] = useState<SegmentRule[]>([
    { field: "lifetime_value", operator: "gt", value: 1000 },
    { field: "churn_score", operator: "gt", value: 0.7 },
    { field: "days_since_last_purchase", operator: "lt", value: 90 },
    { field: "campaign_engagement_score", operator: "lt", value: 0.25 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRule(index: number, patch: Partial<SegmentRule>) {
    setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const parsed = rules.map((rule) => {
        const numeric = Number(rule.value);
        const value =
          typeof rule.value === "string" && rule.value.trim() !== "" && Number.isFinite(numeric) && !["favorite_category", "state", "acquisition_channel", "customer_status"].includes(rule.field)
            ? numeric
            : rule.value;
        return { ...rule, value };
      });
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, combinator, rules: parsed }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; segment?: { id: string } };
      if (!json.ok || !json.segment) throw new Error(json.error ?? "Could not create segment");
      router.push(`/segments/${json.segment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Audiences"
        title="Create dynamic segment"
        description="Rules are validated against the semantic allow-list before membership is computed."
      />
      <div className="panel max-w-3xl p-6">
        <label className="block text-sm">
          Segment name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#e4dfd4] px-3 py-2"
          />
        </label>
        <label className="mt-4 block text-sm">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#e4dfd4] px-3 py-2"
            rows={3}
          />
        </label>
        <label className="mt-4 block text-sm">
          Combinator
          <select
            value={combinator}
            onChange={(event) => setCombinator(event.target.value as "and" | "or")}
            className="mt-1 rounded-lg border border-[#e4dfd4] px-3 py-2"
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </label>

        <div className="mt-6 space-y-3">
          {rules.map((rule, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-4">
              <select
                value={rule.field}
                onChange={(event) => updateRule(index, { field: event.target.value })}
                className="rounded-lg border border-[#e4dfd4] px-2 py-2 text-sm"
              >
                {FIELDS.map((field) => (
                  <option key={field}>{field}</option>
                ))}
              </select>
              <select
                value={rule.operator}
                onChange={(event) => updateRule(index, { operator: event.target.value as FilterOperator })}
                className="rounded-lg border border-[#e4dfd4] px-2 py-2 text-sm"
              >
                {OPS.map((op) => (
                  <option key={op}>{op}</option>
                ))}
              </select>
              <input
                value={String(rule.value)}
                onChange={(event) => updateRule(index, { value: event.target.value })}
                className="rounded-lg border border-[#e4dfd4] px-2 py-2 text-sm"
              />
              <button
                type="button"
                className="text-left text-xs text-rose-700"
                onClick={() => setRules((current) => current.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-4 text-sm text-[#0f766e]"
          onClick={() => setRules((current) => [...current, { field: "lifetime_value", operator: "gt", value: 0 }])}
        >
          Add rule
        </button>
        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-full bg-[#10161f] px-5 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Computing membership…" : "Save and compute"}
          </button>
        </div>
      </div>
    </div>
  );
}
