"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, StatusPill } from "@/components/ui";
import { formatNumber, formatRelative } from "@/lib/format";

type Run = {
  id: string;
  workflowId: string;
  trigger: string;
  status: string;
  currentStage: string;
  rowsProcessed: number;
  rowsFailed: number;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  error: string | null;
  stages: { name: string; status: string; detail?: string }[];
};

type Sync = {
  dataset: string;
  label: string;
  synchronizedAt: string;
  sourceUpdatedAt: string;
  pipelineRunId: string;
  rowCount: number;
  status: string;
  freshnessLabel: string;
};

export default function OperationsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [sync, setSync] = useState<Sync[]>([]);
  const [asks, setAsks] = useState<{ question: string; planner: string; createdAt: string; resultCount: number }[]>([]);
  const [meta, setMeta] = useState({ dataSource: "", adapter: "", zeroNote: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/operations", { signal });
    const json = (await res.json()) as {
      ok: boolean;
      error?: string;
      runs: Run[];
      sync: Sync[];
      asks: { question: string; planner: string; createdAt: string; resultCount: number }[];
      dataSource: string;
      adapter: string;
      zeroNote: string;
    };
    if (!json.ok) throw new Error(json.error ?? "Failed");
    if (signal?.aborted) return;
    setRuns(json.runs);
    setSync(json.sync);
    setAsks(json.asks);
    setMeta({ dataSource: json.dataSource, adapter: json.adapter, zeroNote: json.zeroNote });
  }, []);

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

  async function runPipeline() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/operations/run", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Pipeline failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setBusy(false);
    }
  }

  const latest = runs[0];

  return (
    <div>
      <PageHeader
        kicker="Engineering"
        title="Data operations"
        description="Warehouse extract → validation → features → scores → semantic model → PostgreSQL product sync → segment recompute."
        actions={
          <button
            type="button"
            onClick={() => void runPipeline()}
            disabled={busy}
            className="rounded-full bg-[#10161f] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Running workflow…" : "Run sync workflow"}
          </button>
        }
      />

      {error ? <div className="mb-4 panel p-4 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-5 lg:col-span-2">
          <p className="kicker">Latest pipeline run</p>
          {latest ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">{latest.id}</h2>
                <StatusPill status={latest.status} />
                <span className="text-xs text-[#6b6458]">{latest.workflowId}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div>
                  <dt className="text-xs text-[#6b6458]">Started</dt>
                  <dd>{formatRelative(latest.startedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#6b6458]">Duration</dt>
                  <dd className="num">{latest.durationMs ? `${Math.round(latest.durationMs / 1000)}s` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#6b6458]">Rows processed</dt>
                  <dd className="num">{formatNumber(latest.rowsProcessed)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#6b6458]">Failed rows</dt>
                  <dd className="num">{formatNumber(latest.rowsFailed)}</dd>
                </div>
              </dl>
              <ol className="mt-5 space-y-2">
                {latest.stages.map((stage) => (
                  <li key={stage.name} className="flex items-start justify-between gap-3 rounded-lg bg-[#f6f2e9] px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{stage.name.replace(/_/g, " ")}</p>
                      <p className="text-xs text-[#6b6458]">{stage.detail}</p>
                    </div>
                    <StatusPill status={stage.status} />
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-3 text-sm text-[#6b6458]">No pipeline runs yet.</p>
          )}
        </section>
        <section className="panel p-5">
          <p className="kicker">Sync freshness</p>
          <h2 className="mt-1 text-lg font-semibold">Product datasets</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {sync.map((item) => (
              <li key={item.dataset}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.label}</span>
                  <StatusPill status={item.status} />
                </div>
                <p className="text-xs text-[#6b6458]">{item.freshnessLabel}</p>
                <p className="text-[11px] text-[#9b9588]">
                  {formatNumber(item.rowCount)} rows · {item.pipelineRunId}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel mt-4 p-5">
        <p className="kicker">Architecture in this environment</p>
        <h2 className="mt-1 text-lg font-semibold">Warehouse vs product data</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b6458]">
          Adapter: <span className="font-mono text-ink">{meta.adapter}</span>. {meta.dataSource}. Temporal
          coordinates this workflow in production; demo mode runs the same activities in-process with retries and
          idempotent upserts.
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b6458]">{meta.zeroNote}</p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="panel overflow-x-auto p-0">
          <div className="px-5 pt-5">
            <p className="kicker">History</p>
            <h2 className="mt-1 text-lg font-semibold">Pipeline runs</h2>
          </div>
          <table className="mt-3 min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-[#6b6458]">
              <tr>
                <th className="px-5 py-2">Run</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Rows</th>
                <th className="px-5 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-[#f0ebe1]">
                  <td className="px-5 py-2 font-mono text-xs">{run.id}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={run.status} />
                  </td>
                  <td className="num px-3 py-2">{formatNumber(run.rowsProcessed)}</td>
                  <td className="px-5 py-2 text-xs">{formatRelative(run.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel p-5">
          <p className="kicker">Ask logs</p>
          <h2 className="mt-1 text-lg font-semibold">Recent governed questions</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {asks.map((ask) => (
              <li key={ask.createdAt + ask.question}>
                <p>{ask.question}</p>
                <p className="text-xs text-[#6b6458]">
                  {ask.planner} · {ask.resultCount} rows · {formatRelative(ask.createdAt)}
                </p>
              </li>
            ))}
            {!asks.length ? <p className="text-sm text-[#6b6458]">No agent questions yet.</p> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
