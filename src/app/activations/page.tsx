"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, StatusPill } from "@/components/ui";
import { formatNumber, formatRelative } from "@/lib/format";

type Activation = {
  id: string;
  segmentId: string;
  segmentName: string;
  destination: string;
  status: string;
  customerCount: number;
  segmentVersion: number;
  message: string;
  createdAt: string;
  completedAt: string | null;
};

export default function ActivationsPage() {
  const [rows, setRows] = useState<Activation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/activations")
      .then(async (res) => {
        const json = (await res.json()) as { ok: boolean; error?: string; rows: Activation[] };
        if (!json.ok) throw new Error(json.error ?? "Failed");
        setRows(json.rows);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div>
      <PageHeader
        kicker="Operations"
        title="Activations"
        description="Analytical audiences becoming operational. Destinations are simulated — no paid media credentials are stored or called."
      />
      {error ? <div className="panel p-4 text-sm text-rose-700">{error}</div> : null}
      <div className="panel overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#e4dfd4] text-xs uppercase tracking-wider text-[#6b6458]">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-3 py-3">Segment</th>
              <th className="px-3 py-3">Destination</th>
              <th className="px-3 py-3">Customers</th>
              <th className="px-3 py-3">Version</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#f0ebe1]">
                <td className="px-4 py-3 text-xs">{formatRelative(row.createdAt)}</td>
                <td className="px-3 py-3">
                  <Link href={`/segments/${row.segmentId}`} className="hover:text-[#0f766e]">
                    {row.segmentName}
                  </Link>
                  <p className="text-[11px] text-[#6b6458]">{row.message}</p>
                </td>
                <td className="px-3 py-3 capitalize">{row.destination.replace(/_/g, " ")}</td>
                <td className="num px-3 py-3">{formatNumber(row.customerCount)}</td>
                <td className="num px-3 py-3">v{row.segmentVersion}</td>
                <td className="px-3 py-3">
                  <StatusPill status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
