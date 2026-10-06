'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import type { ESP32CommandStatus } from '@/components/CameraPanel'
import { apiFetch } from '@/lib/api'

type RecognitionFrameResponse = {
  status: string
  identity: string
  confidence: number
  esp32: ESP32CommandStatus
}

async function waitForVideoReady(video: HTMLVideoElement, isActive: () => boolean) {
  await new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + 10000
    let animationFrame = 0

    const check = () => {
      if (!isActive()) {
        reject(new Error('Camera startup cancelled.'))
      } else if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        resolve()
      } else if (Date.now() >= deadline) {
        reject(new Error('Camera is not ready. Please allow camera access.'))
      } else {
        animationFrame = window.requestAnimationFrame(check)
      }
    }

    check()
    void animationFrame
  })
}

function cameraErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === 'Camera is not ready. Please allow camera access.') return error.message
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission was denied. Please allow camera access in your browser.'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No camera was detected.'
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'The camera is currently being used by another application.'
  return 'Unable to start the camera. Please try again.'
}

export default function DashboardPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stats, setStats] = useState({ total_employees: 0, today_authorized: 0, today_unknown: 0, today_total_events: 0, message: '' })
  const [status, setStatus] = useState('PROCESSING')
  const [cameraStatus, setCameraStatus] = useState('STARTING')
  const [cameraError, setCameraError] = useState('')
  const [esp32, setEsp32] = useState<ESP32CommandStatus | null>(null)
  const [alarm, setAlarm] = useState('PENDING')
  const [identity, setIdentity] = useState('Awaiting face detection')
  const [confidence, setConfidence] = useState(0)
  const [time, setTime] = useState('--:--:--')

  useEffect(() => {
    const auth = localStorage.getItem('iot-security-auth')
    if (!auth) {
      router.replace('/login')
      return
    }

    let active = true
    let stream: MediaStream | null = null
    let frameTimer: number | null = null
    let frameInFlight = false

    void fetchStats()
    void fetchEsp32()

    async function fetchEsp32() {
      try {
        const result = await apiFetch<ESP32CommandStatus>('/api/esp32/status')
        if (active) setEsp32(result)
      } catch {
        if (active) setEsp32({ connected: false, command: null, commandDelivered: false, error: 'Ping failed.' })
      }
    }

    async function processFrame() {
      const video = videoRef.current
      const hasLiveTrack = stream?.getVideoTracks().some((track) => track.readyState === 'live')
      if (frameInFlight || !hasLiveTrack || !video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const image = canvas.toDataURL('image/jpeg', 0.75)
      frameInFlight = true

      try {
        const result = await apiFetch<RecognitionFrameResponse>('/api/recognition/frame', {
          method: 'POST',
          body: JSON.stringify({ image, timestamp: new Date().toISOString() }),
        })
        if (!active) return

        const unknownPerson = result.status === 'UNKNOWN' || (result.status === 'AUTHORIZED' && (!result.identity || result.identity === 'Unknown Person'))
        const currentStatus = unknownPerson ? 'UNKNOWN' : result.status || 'PROCESSING'
        const requestedAlarm = currentStatus === 'UNKNOWN' ? 'ON' : currentStatus === 'AUTHORIZED' || currentStatus === 'NO_FACE' ? 'OFF' : 'PENDING'
        const commandConfirmed = result.esp32.connected && result.esp32.commandDelivered && result.esp32.command === currentStatus
        setStatus(currentStatus)
        setIdentity(currentStatus === 'NO_FACE' ? 'No face detected' : result.identity || 'Unknown Person')
        setConfidence(result.confidence || 0)
        setAlarm(requestedAlarm === 'PENDING' ? 'PENDING' : commandConfirmed ? requestedAlarm : 'COMMAND FAILED')
        setEsp32(result.esp32)
      } catch {
        if (active) {
          setStatus('ERROR')
          setIdentity('Recognition unavailable')
          setAlarm('PENDING')
        }
      } finally {
        frameInFlight = false
      }
    }

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Webcam access is unavailable.')
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' }, audio: false })
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const video = videoRef.current
        if (!video) throw new Error('Camera video element is unavailable.')
        video.srcObject = stream
        await video.play()
        await waitForVideoReady(video, () => active)
        if (!active) return

        setCameraStatus('READY')
        setCameraError('')
        frameTimer = window.setInterval(() => void processFrame(), 1000)
      } catch (error) {
        if (!active) return
        setCameraStatus('ERROR')
        setCameraError(cameraErrorMessage(error))
        setStatus('CAMERA ERROR')
      }
    }

    void startCamera()
    const updateClock = () => setTime(new Date().toLocaleTimeString())
    updateClock()
    const clockTimer = window.setInterval(updateClock, 1000)
    return () => {
      active = false
      window.clearInterval(clockTimer)
      if (frameTimer !== null) window.clearInterval(frameTimer)
      stream?.getTracks().forEach((track) => track.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [router])

  async function fetchStats() {
    try {
      const result = await apiFetch<{ total_employees: number; today_authorized: number; today_unknown: number; today_total_events: number; message: string }>('/api/logs?limit=100&summary=true')
      setStats({
        total_employees: result.total_employees ?? 0,
        today_authorized: result.today_authorized ?? 0,
        today_unknown: result.today_unknown ?? 0,
        today_total_events: result.today_total_events ?? 0,
        message: result.message || '',
      })
    } catch {
      setStats({ total_employees: 0, today_authorized: 0, today_unknown: 0, today_total_events: 0, message: 'No access events recorded today.' })
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar />

        <main className="space-y-5">
          <Header title="Dashboard" subtitle="System overview and live access events" />

          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Employees" value={String(stats.total_employees)} hint="Registered on the system" accent="blue" />
            <StatCard label="Today's Authorized" value={String(stats.today_authorized)} hint="Approved entries" accent="green" />
            <StatCard label="Today's Unknown" value={String(stats.today_unknown)} hint="Access challenges" accent="red" />
            <StatCard label="Today's Total Events" value={String(stats.today_total_events)} hint="All recorded activity" accent="neutral" />
          </div>

          <section className="panel rounded-[30px] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Live Security Monitor</div>
                <h2 className="mt-2 text-3xl font-semibold text-white">{status}</h2>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={status === 'NO_FACE' ? 'NO FACE' : status} />
                <div className={`rounded-full border px-3 py-1 text-sm ${esp32?.connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
                  {esp32 ? (esp32.connected ? 'ESP32 CONNECTED' : 'ESP32 DISCONNECTED') : 'ESP32 CHECKING'}
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
              <div className="rounded-[26px] border border-slate-800 bg-slate-950 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Camera Feed</div>
                  <div className="text-sm text-slate-300">{time}</div>
                </div>
                <div className="relative h-[280px] overflow-hidden rounded-[24px] border border-slate-800 bg-black">
                  <video ref={videoRef} autoPlay playsInline muted aria-label="Live webcam preview" className={`h-full w-full object-cover ${cameraStatus === 'READY' ? 'block' : 'hidden'}`} />
                  {cameraStatus !== 'READY' ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900 px-6 text-center text-sm text-slate-300">
                      {cameraError || 'Starting camera...'}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[26px] border border-slate-800 bg-slate-950 p-5">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Identity</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{identity}</div>
                </div>
                <div className="rounded-[26px] border border-slate-800 bg-slate-950 p-5">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Status</div>
                  <div className={`mt-3 text-2xl font-semibold ${status === 'AUTHORIZED' ? 'text-emerald-300' : status === 'UNKNOWN' || status === 'ERROR' ? 'text-red-300' : 'text-slate-200'}`}>{status}</div>
                </div>
                <div className="rounded-[26px] border border-slate-800 bg-slate-950 p-5">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Confidence</div>
                  <div className="mt-3 text-2xl font-semibold text-white">{confidence}%</div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel rounded-[30px] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xl font-semibold text-white">Today’s access timeline</div>
              {stats.message ? <span className="text-sm text-slate-400">{stats.message}</span> : null}
            </div>
            <div className="rounded-2xl bg-slate-950/70 p-4 text-slate-400">
              {stats.message || 'Latest security activity is being recorded from the live recognition engine.'}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
