import Link from "next/link";

type StatCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  /** Quando presente, o card vira um link (drill-down para a lista). */
  href?: string;
};

export function StatCard({ title, value, hint, href }: StatCardProps) {
  const content = (
    <>
      <p className="text-sm text-slate-600">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50/50"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {content}
    </div>
  );
}
