'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { apiFetch } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await apiFetch<{ success: boolean; token: string; user: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })

      if (result.success) {
        localStorage.setItem('iot-security-auth', JSON.stringify({ token: result.token, user: result.user, remember }))
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please check credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900/80 shadow-soft lg:grid-cols-[1.2fr_0.8fr]">
        <section className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.20),transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.18),transparent_22%)]" />
          <div className="relative">
            <div className="mb-12 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-xl font-bold text-white">I</div>
              <div>
                <div className="text-2xl font-semibold text-white">IoT Face Security</div>
                <div className="text-sm text-slate-300">Smart Face Recognition &amp; IoT Access Control</div>
              </div>
            </div>
            <div className="max-w-md">
              <div className="text-xs uppercase tracking-[0.4em] text-sky-300">Secure Access</div>
              <h1 className="mt-4 text-4xl font-semibold text-white">Trusted identity security for modern spaces.</h1>
              <p className="mt-4 text-slate-300">
                Protect entrances with real-time face recognition, live monitoring, and automated hardware responses.
              </p>
            </div>
          </div>

          <div className="relative mt-12 rounded-[28px] border border-slate-700 bg-slate-950/50 p-6">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-xs uppercase tracking-[0.3em]">Security status</span>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.3em] text-emerald-300">Live</span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-2xl bg-slate-900 px-4 py-5">
                <div className="text-xl font-semibold text-white">24/7</div>
                <div className="mt-2 text-slate-400">Monitoring</div>
              </div>
              <div className="rounded-2xl bg-slate-900 px-4 py-5">
                <div className="text-xl font-semibold text-white">99.2%</div>
                <div className="mt-2 text-slate-400">Accuracy</div>
              </div>
              <div className="rounded-2xl bg-slate-900 px-4 py-5">
                <div className="text-xl font-semibold text-white">0.6s</div>
                <div className="mt-2 text-slate-400">Response</div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-slate-950/60 p-8">
          <div className="w-full max-w-md rounded-[28px] border border-slate-800 bg-slate-900 p-7 shadow-soft">
            <div className="mb-6">
              <div className="text-xs uppercase tracking-[0.38em] text-slate-400">Sign in</div>
              <h2 className="mt-3 text-3xl font-semibold text-white">Welcome back</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Username / Email</label>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-sky-500"
                  placeholder="admin"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">Password</label>
                <div className="flex items-center rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 focus-within:border-sky-500">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                    placeholder="Password"
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="ml-2 text-xs uppercase tracking-[0.2em] text-slate-300">
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-300">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={remember} onChange={() => setRemember((value) => !value)} className="h-4 w-4 accent-sky-500" />
                  Remember me
                </label>
                <Link href="#" className="text-sky-300 hover:text-sky-200">Need help?</Link>
              </div>

              {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? 'Signing in...' : 'Login'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
