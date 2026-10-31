"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/customers", label: "Customers" },
  { href: "/segments", label: "Segments" },
  { href: "/scores", label: "Scores" },
  { href: "/ask", label: "Ask AudienceIQ" },
  { href: "/activations", label: "Activations" },
  { href: "/operations", label: "Data Operations" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [freshness, setFreshness] = useState("Synchronizing product store…");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const bootRes = await fetch("/api/bootstrap");
        const bootJson = (await bootRes.json()) as { ok: boolean; error?: string };
        if (!bootJson.ok) throw new Error(bootJson.error ?? "Bootstrap failed");
        const freshRes = await fetch("/api/freshness");
        const freshJson = (await freshRes.json()) as {
          sync?: { dataset: string; freshnessLabel: string }[];
        };
        const customer = freshJson.sync?.find((item) => item.dataset === "customer_360");
        if (!cancelled) {
          setFreshness(customer?.freshnessLabel ?? "Product store ready");
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to start demo data");
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="grain relative hidden w-[248px] shrink-0 flex-col bg-[#10161f] text-[#e8e4d9] md:flex">
        <div className="flex items-center gap-3 px-5 pb-6 pt-6">
          <Image
            src="/brand/audienceiq-mark.png"
            alt="AudienceIQ"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-white">AudienceIQ</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-teal-300/80">Intelligence</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-[13.5px] transition ${
                  active
                    ? "bg-white/10 text-white shadow-[inset_2px_0_0_#2dd4bf]"
                    : "text-[#c5c0b4] hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-5 text-[11px] leading-5 text-[#9b9588]">
          <p className="text-[#d6d0c2]">Demo workspace</p>
          <p>All customer records are synthetically generated. No real PII.</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-[#e4dfd4] bg-[#fffcf6]/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="md:hidden">
            <p className="text-sm font-semibold">AudienceIQ</p>
          </div>
          <p className="hidden text-[13px] text-[#6b6458] md:block">
            AI-powered customer intelligence & dynamic audiences
          </p>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#e4dfd4] bg-white px-3 py-1 text-[11px] text-[#3f6f4e]">
              {freshness}
            </span>
            <span className="hidden rounded-full bg-[#10161f] px-3 py-1 text-[11px] text-[#e8e4d9] sm:inline">
              DEMO_MODE
            </span>
          </div>
        </header>
        <div className="flex gap-2 overflow-x-auto border-b border-[#e4dfd4] px-3 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full border border-[#e4dfd4] bg-white px-3 py-1 text-xs"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {error ? (
            <div className="panel p-6 text-sm text-rose-700">
              Could not prepare demo data: {error}
            </div>
          ) : !ready ? (
            <div className="panel p-8">
              <p className="kicker">Product store</p>
              <h1 className="mt-2 text-2xl font-semibold">Preparing synthetic customer 360…</h1>
              <p className="mt-2 max-w-xl text-sm text-[#6b6458]">
                First load generates several thousand governed customer records, scores, segments and
                pipeline history in PostgreSQL. Subsequent visits reuse the synchronized product store.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
