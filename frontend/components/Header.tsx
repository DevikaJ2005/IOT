export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950/40 p-5 shadow-soft md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.34em] text-slate-400">IoT Face Security</div>
        <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          SYSTEM ONLINE
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('iot-security-auth')
            window.location.href = '/login'
          }}
          className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
        >
          Logout
        </button>
      </div>
    </header>
  )
}
