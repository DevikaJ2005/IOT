export function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: 'green' | 'red' | 'neutral' | 'blue' }) {
  const accentStyle = {
    green: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300',
    red: 'from-red-500/20 to-red-500/5 text-red-300',
    neutral: 'from-slate-500/20 to-slate-500/5 text-slate-200',
    blue: 'from-sky-500/20 to-sky-500/5 text-sky-300',
  }[accent || 'neutral']

  return (
    <div className="stat-card rounded-3xl p-5">
      <div className={`inline-flex rounded-full bg-gradient-to-r px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${accentStyle}`}>
        {label}
      </div>
      <div className="mt-4 text-3xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-2 text-sm text-slate-400">{hint}</div> : null}
    </div>
  )
}
