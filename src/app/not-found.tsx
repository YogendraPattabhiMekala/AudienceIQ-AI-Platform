import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel p-8">
      <p className="kicker">404</p>
      <h1 className="mt-2 text-2xl font-semibold">That view is not in this workspace</h1>
      <p className="mt-2 text-sm text-[#6b6458]">The customer, segment or page does not exist in the demo store.</p>
      <Link href="/" className="mt-4 inline-block text-sm text-[#0f766e]">
        Back to overview
      </Link>
    </div>
  );
}
