'use client'

import { useEffect, useRef, useState } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { CameraPanel, type ESP32CommandStatus } from '@/components/CameraPanel'
import { apiFetch } from '@/lib/api'

export default function MonitorPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState('PROCESSING')
  const [identity, setIdentity] = useState('Awaiting face detection')
  const [confidence, setConfidence] = useState(0)
  const [alarm, setAlarm] = useState('PENDING')
  const [esp32, setEsp32] = useState<ESP32CommandStatus | null>(null)

  useEffect(() => {
    const auth = localStorage.getItem('iot-security-auth')
    if (!auth) {
      window.location.href = '/login'
      return
    }

    let stream: MediaStream | null = null

    async function checkEsp32() {
      try {
        setEsp32(await apiFetch<ESP32CommandStatus>('/api/esp32/status'))
      } catch {
        setEsp32({ connected: false, command: null, commandDelivered: false, error: 'Ping failed.' })
      }
    }

    void checkEsp32()

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

      } catch {
        setStatus('CAMERA ERROR')
        setAlarm('PENDING')
      }
    }

    startCamera()

    let frameInFlight = false
    const interval = window.setInterval(async () => {
      if (frameInFlight || !videoRef.current || !videoRef.current.videoWidth) return

      const canvas = document.createElement('canvas')
      const width = videoRef.current.videoWidth
      const height = videoRef.current.videoHeight
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(videoRef.current, 0, 0, width, height)
      const image = canvas.toDataURL('image/jpeg', 0.75)
      frameInFlight = true

      try {
        const result = await apiFetch<{ status: string; identity: string; confidence: number; esp32: ESP32CommandStatus }>('/api/recognition/frame', {
          method: 'POST',
          body: JSON.stringify({ image, timestamp: new Date().toISOString() }),
        })

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
        setStatus('ERROR')
        setIdentity('Recognition unavailable')
        setAlarm('PENDING')
      } finally {
        frameInFlight = false
      }
    }, 1000)

    return () => {
      window.clearInterval(interval)
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar />

        <main className="space-y-5">
          <Header title="Live Monitor" subtitle="Real-time recognition and access verification" />
          <CameraPanel status={status} identity={identity} confidence={confidence} alarm={alarm} esp32={esp32} videoRef={videoRef} />
        </main>
      </div>
    </div>
  )
}
