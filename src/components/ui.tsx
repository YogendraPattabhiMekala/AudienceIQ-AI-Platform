import { formatNumber } from "@/lib/format";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="kicker">{kicker}</p>
        <h1 className="mt-1 text-[1.85rem] font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-[#6b6458]">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "good";
}) {
  const color = tone === "warn" ? "text-[#9a3b3b]" : tone === "good" ? "text-[#0f766e]" : "text-ink";
  return (
    <div className="panel p-4">
      <p className="kicker">{label}</p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#6b6458]">{hint}</p> : null}
    </div>
  );
}

export function BarChart({
  data,
  height = 160,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const max = Math.max(...data.map((item) => Number(item.value) || 0), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t-md bg-[#0f766e]"
            style={{ height: `${Math.max(6, (Number(item.value) / max) * (height - 36))}px` }}
            title={`${item.label}: ${formatNumber(Number(item.value), 2)}`}
          />
          <span className="w-full truncate text-center text-[10px] text-[#6b6458]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Histogram({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="flex h-44 items-end gap-px">
      {data.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="flex-1 rounded-t-sm bg-[#1b2430]"
          style={{ height: `${Math.max(4, (item.value / max) * 100)}%`, opacity: 0.45 + (item.value / max) * 0.55 }}
          title={`${item.label}: ${item.value}`}
        />
      ))}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "completed" || status === "healthy" || status === "active"
      ? "bg-emerald-50 text-emerald-800"
      : status === "failed"
        ? "bg-rose-50 text-rose-800"
        : status === "running" || status === "queued"
          ? "bg-amber-50 text-amber-800"
          : "bg-stone-100 text-stone-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${tone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ScoreBar({ value, warn }: { value: number; warn?: boolean }) {
  const pct = Math.max(0, Math.min(100, value <= 1 ? value * 100 : value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#ece7dc]">
        <div className={`h-full ${warn && pct >= 70 ? "bg-[#c45c5c]" : "bg-[#0f766e]"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="num text-xs">{value <= 1 ? value.toFixed(2) : Math.round(value)}</span>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-[#6b6458]">{body}</p>
    </div>
  );
}
