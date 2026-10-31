
"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart, PageHeader, ScoreBar } from "@/components/ui";
import { EXAMPLE_QUESTIONS } from "@/lib/nl-planner";
import { formatCurrency } from "@/lib/format";
import type { QueryExplanation } from "@/lib/types";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);

type AskResponse = {
  ok: boolean;
  error?: string;
  question: string;
  summary: string;
  percent: number | null;
  plan: {
    intent: string;
    filters: {
      field: string;
      operator: string;
      value: unknown;
    }[];
    groupBy: string[];
  };
  explanation: QueryExplanation;
  rows: Record<string, unknown>[];
  rowCount: number;
  chart: {
    type: string;
    title: string;
    data: {
      label: string;
      value: number;
    }[];
  };
};

export default function AskPage() {
  const [question, setQuestion] = useState(EXAMPLE_QUESTIONS[8]);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);

  async function ask(nextQuestion = question) {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: nextQuestion,
        }),
      });

      const json = (await res.json()) as AskResponse;

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Ask failed");
      }

      setResult(json);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask failed");
    } finally {
      setBusy(false);
    }
  }

  const isMetricQuery = result?.plan.intent === "metric";

  const isCustomerCountQuery =
    isMetricQuery &&
    result?.explanation.selectedMetrics.includes("customer_count");

  return (
    <div>
      <PageHeader
        kicker="Agent"
        title="Ask AudienceIQ"
        description="Natural-language questions are compiled into a governed semantic plan. The model never executes arbitrary SQL."
      />

      <div className="panel p-5">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-[#e4dfd4] bg-white px-3 py-3 text-sm outline-none focus:border-[#0f766e]"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className="max-w-full truncate rounded-full border border-[#e4dfd4] bg-[#fffcf6] px-3 py-1 text-left text-[11px] hover:border-[#0f766e]"
              onClick={() => {
                setQuestion(item);
                void ask(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void ask()}
          disabled={busy}
          className="mt-4 rounded-full bg-[#10161f] px-5 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Planning & executing…" : "Run governed query"}
        </button>

        {error ? (
          <p className="mt-3 text-sm text-rose-700">{error}</p>
        ) : null}
      </div>

      {result ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-5">
          <section className="panel p-5 xl:col-span-3">
            <p className="kicker">Answer</p>

            <h2 className="mt-1 text-lg font-semibold">
              {result.summary}
            </h2>

            {result.percent !== null ? (
              <p className="mt-2 font-mono text-3xl">
                {(result.percent * 100).toFixed(1)}%
              </p>
            ) : null}

            {!isMetricQuery && result.chart?.data?.length ? (
              <div className="mt-4">
                <p className="mb-2 text-xs text-[#6b6458]">
                  {result.chart.title}
                </p>
                <BarChart data={result.chart.data} />
              </div>
            ) : null}

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-[#6b6458]">
                  <tr>
                    <th className="py-2">Result</th>

                    <th className="py-2">
                      {isCustomerCountQuery
                        ? "Customer count"
                        : "LTV / metric"}
                    </th>

                    <th className="py-2">Churn</th>
                  </tr>
                </thead>

                <tbody>
                  {result.rows.slice(0, 25).map((row, index) => {
                    const id = String(
                      row.id ?? row.customer_id ?? index
                    );

                    const isCountRow =
                      isCustomerCountQuery &&
                      row.customer_count !== undefined;

                    const name = isCountRow
                      ? "Matching customers"
                      : row.firstName || row.first_name
                        ? `${row.firstName ?? row.first_name} ${
                            row.lastName ?? row.last_name ?? ""
                          }`.trim()
                        : String(
                            row.acquisition_channel ??
                              row.state ??
                              row.customer_status ??
                              row.label ??
                              id
                          );

                    const rawMetric = isCountRow
                      ? row.customer_count
                      : row.lifetimeValue ??
                        row.lifetime_value ??
                        row.customer_count;

                    const metric =
                      rawMetric == null
                        ? NaN
                        : Number(rawMetric);

                    const metricDisplay = Number.isFinite(metric)
                      ? isCountRow
                        ? formatNumber(metric)
                        : formatCurrency(metric)
                      : "—";

                    const rawChurn =
                      row.churnScore ?? row.churn_score;

                    const churn =
                      rawChurn == null
                        ? NaN
                        : Number(rawChurn);

                    return (
                      <tr
                        key={id}
                        className="border-t border-[#f0ebe1]"
                      >
                        <td className="py-2">
                          {!isCountRow && row.id ? (
                            <Link
                              href={`/customers/${String(row.id)}`}
                              className="hover:text-[#0f766e]"
                            >
                              {name}
                            </Link>
                          ) : (
                            name
                          )}
                        </td>

                        <td className="num py-2">
                          {metricDisplay}
                        </td>

                        <td className="py-2">
                          {Number.isFinite(churn) ? (
                            <ScoreBar value={churn} warn />
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-[#6b6458]">
              {result.rowCount} governed rows returned.
            </p>
          </section>

          <section className="panel p-5 xl:col-span-2">
            <button
              type="button"
              className="flex w-full items-center justify-between"
              onClick={() => setOpen(!open)}
            >
              <div>
                <p className="kicker">Transparency</p>
                <h2 className="mt-1 text-lg font-semibold">
                  How this was calculated
                </h2>
              </div>

              <span className="text-xs text-[#6b6458]">
                {open ? "Hide" : "Show"}
              </span>
            </button>

            {open ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-[#6b6458]">
                    Interpreted question
                  </dt>
                  <dd>
                    {result.explanation.interpretedQuestion}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-[#6b6458]">
                    Dimensions
                  </dt>
                  <dd className="font-mono text-xs">
                    {result.explanation.selectedDimensions.join(", ") ||
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-[#6b6458]">
                    Metrics
                  </dt>
                  <dd className="font-mono text-xs">
                    {result.explanation.selectedMetrics.join(", ") ||
                      "—"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-[#6b6458]">
                    Filters
                  </dt>

                  <dd className="space-y-1">
                    {result.explanation.appliedFilters.map(
                      (filter, index) => (
                        <p
                          key={index}
                          className="font-mono text-xs"
                        >
                          {filter.field} {filter.operator}{" "}
                          {String(filter.value)}
                        </p>
                      )
                    )}

                    {!result.explanation.appliedFilters.length
                      ? "None"
                      : null}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-[#6b6458]">
                    Business definitions
                  </dt>

                  <dd className="space-y-2">
                    {result.explanation.businessDefinitions.map(
                      (item) => (
                        <p
                          key={item.id}
                          className="text-xs leading-5"
                        >
                          <span className="font-medium">
                            {item.name}.
                          </span>{" "}
                          {item.definition}
                        </p>
                      )
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-[#6b6458]">
                    Query representation
                  </dt>

                  <dd className="rounded-lg bg-[#f6f2e9] p-2 font-mono text-[11px] leading-5">
                    {result.explanation.queryRepresentation}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-[#6b6458]">
                    Generated SQL (explanation only, parameterized)
                  </dt>

                  <dd className="rounded-lg bg-[#10161f] p-2 font-mono text-[11px] leading-5 text-[#d7fbe7]">
                    {result.explanation.generatedQuery}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-[#6b6458]">
                    Data source
                  </dt>
                  <dd className="text-xs">
                    {result.explanation.dataSource}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-[#6b6458]">
                    Freshness
                  </dt>
                  <dd className="text-xs">
                    {result.explanation.dataFreshness}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-[#6b6458]">
                    Execution time
                  </dt>

                  <dd className="num text-xs">
                    {result.explanation.executionTimeMs} ms · planner{" "}
                    {result.explanation.planner}
                  </dd>
                </div>

                {result.explanation.warnings.map((warning) => (
                  <p
                    key={warning}
                    className="text-xs text-amber-800"
                  >
                    {warning}
                  </p>
                ))}
              </dl>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
