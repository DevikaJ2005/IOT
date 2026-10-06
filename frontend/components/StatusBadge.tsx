export function StatusBadge({ status }: { status: string }) {
  const toneMap: Record<string, string> = {
    AUTHORIZED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    UNKNOWN: 'bg-red-500/15 text-red-300 border-red-500/30',
    'NO FACE': 'bg-slate-500/15 text-slate-200 border-slate-500/30',
    PROCESSING: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    DEFAULT: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  }

  const className = toneMap[status] || toneMap.DEFAULT

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${className}`}>
      {status}
    </span>
  )
}
