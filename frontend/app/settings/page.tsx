'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { apiFetch } from '@/lib/api'

export default function SettingsPage() {
  const [message, setMessage] = useState('')
  const esp32Ip = process.env.NEXT_PUBLIC_ESP32_IP || '192.168.0.6'
  const esp32Port = process.env.NEXT_PUBLIC_ESP32_PORT || '80'

  useEffect(() => {
    const auth = localStorage.getItem('iot-security-auth')
    if (!auth) {
      window.location.href = '/login'
      return
    }
  }, [])

  async function pingEsp32() {
    try {
      const result = await apiFetch<{ success: boolean; message: string }>('/api/esp32/ping', { method: 'POST' })
      setMessage(result.message)
    } catch {
      setMessage('ESP32 is currently offline.')
    }
  }

  async function resetBuzzer() {
    try {
      const result = await apiFetch<{ success: boolean; message: string }>('/api/esp32/reset', { method: 'POST' })
      setMessage(result.message)
    } catch {
      setMessage('Unable to reset the alarm.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar />

        <main className="space-y-5">
          <Header title="Settings" subtitle="System configuration and hardware controls" />

          <section className="panel rounded-[30px] p-5">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="text-xl font-semibold text-white">System</div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-slate-300">
                  <div>ESP32 IP: {esp32Ip}</div>
                  <div className="mt-2">ESP32 Port: {esp32Port}</div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="text-xl font-semibold text-white">Face Recognition</div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-slate-300">
                  <div>Face Match Tolerance: 0.6</div>
                  <div className="mt-2">Camera Index: 0</div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={pingEsp32} className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white">Test ESP32</button>
              <button onClick={resetBuzzer} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Reset Buzzer</button>
              <button className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Test Camera</button>
            </div>

            {message ? <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
          </section>
        </main>
      </div>
    </div>
  )
}
