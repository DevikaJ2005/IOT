import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Live Monitor', href: '/monitor' },
  { label: 'Employees', href: '/employees' },
  { label: 'Access Logs', href: '/logs' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Settings', href: '/settings' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="panel flex h-full w-full flex-col rounded-3xl p-5">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-lg font-bold text-white shadow-soft">
          I
        </div>
        <div>
          <div className="text-lg font-semibold">IoT Face Security</div>
          <div className="text-xs text-slate-400">Smart Access Control</div>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                active ? 'bg-slate-800 text-white shadow-soft' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-slate-800 pt-4">
        <div className="rounded-2xl bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">System Status</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="status-dot bg-emerald-400" />
            <span>System Ready</span>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</div>
          <div className="mt-2 font-medium">Security Admin</div>
        </div>
      </div>
    </aside>
  )
}
