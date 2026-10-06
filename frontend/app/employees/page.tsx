'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { apiFetch } from '@/lib/api'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    const auth = localStorage.getItem('iot-security-auth')
    if (!auth) {
      window.location.href = '/login'
      return
    }

    loadEmployees()
  }, [])

  async function loadEmployees() {
    try {
      const data = await apiFetch<any[]>('/api/employees')
      setEmployees(data)
    } catch {
      setEmployees([])
    }
  }

  const filtered = employees.filter((employee) => employee.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar />

        <main className="space-y-5">
          <Header title="Employees" subtitle="Face registration and access profiles" />

          <section className="panel rounded-[30px] p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none md:max-w-xs"
                placeholder="Search employees"
              />
              <Link href="/employees/enroll" className="rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-soft">
                Add Employee
              </Link>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead className="bg-slate-900/80 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Employee ID</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Face Registered</th>
                    <th className="px-4 py-3 font-medium">Created Date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((employee) => (
                    <tr key={employee.id} className="border-t border-slate-800">
                      <td className="px-4 py-3">#{employee.id}</td>
                      <td className="px-4 py-3">{employee.name}</td>
                      <td className="px-4 py-3 text-emerald-300">Ready</td>
                      <td className="px-4 py-3">{new Date(employee.created_at || Date.now()).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-emerald-300">Active</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
