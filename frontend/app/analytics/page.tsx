'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { StatCard } from '@/components/StatCard'
import { apiFetch } from '@/lib/api'

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>({ authorized_vs_unknown: {}, hourly_access: {}, daily_activity: {}, unknown_trend: {}, buzzer_activations: 0 })

  useEffect(() => {
    const auth = localStorage.getItem('iot-security-auth')
    if (!auth) {
      window.location.href = '/login'
      return
    }

    loadAnalytics()
  }, [])

  async function loadAnalytics() {
    try {
      const data = await apiFetch<any>('/api/analytics')
      setAnalytics(data)
    } catch {
      setAnalytics({ authorized_vs_unknown: { AUTHORIZED: 0, UNKNOWN: 0 }, hourly_access: {}, daily_activity: {}, unknown_trend: {}, buzzer_activations: 0 })
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar />

        <main className="space-y-5">
          <Header title="Analytics" subtitle="Security performance and access trends" />

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Authorized" value={String(analytics.authorized_vs_unknown?.AUTHORIZED || 0)} hint="Approved events" accent="green" />
            <StatCard label="Unknown" value={String(analytics.authorized_vs_unknown?.UNKNOWN || 0)} hint="Security alerts" accent="red" />
            <StatCard label="Buzzer Activations" value={String(analytics.buzzer_activations || 0)} hint="Alarm responses" accent="neutral" />
          </div>

          <section className="panel rounded-[30px] p-5">
            <div className="text-xl font-semibold text-white">Activity overview</div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((slot) => {
                const hour = `${slot}:00`
                const value = analytics.hourly_access?.[`${slot.toString().padStart(2, '0')}:00`] || 0
                return (
                  <div key={slot} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                      <span>{hour}</span>
                      <span>{value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600" style={{ width: `${Math.min((value / 12) * 100, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
