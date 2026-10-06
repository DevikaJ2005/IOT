'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { apiFetch } from '@/lib/api'

type StepId = 'details' | 'camera' | 'face' | 'encoding' | 'save' | 'completed'
type EnrollmentStatus =
  | 'IDLE'
  | 'CAMERA_INITIALIZING'
  | 'CAMERA_READY'
  | 'CAMERA_ERROR'
  | 'FACE_CHECKING'
  | 'FACE_CHECK_ERROR'
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'FACE_DETECTED'
  | 'ENCODING'
  | 'ENCODING_SUCCESS'
  | 'ENCODING_ERROR'
  | 'SAVING'
  | 'SAVE_SUCCESS'
  | 'SAVE_ERROR'

const statusMessages: Record<EnrollmentStatus, string> = {
  IDLE: 'Enter employee details to begin.',
  CAMERA_INITIALIZING: 'Starting camera...',
  CAMERA_READY: 'Camera ready. Position one face in front of the camera.',
  CAMERA_ERROR: 'Camera could not be started.',
  FACE_CHECKING: 'Checking for a face...',
  FACE_CHECK_ERROR: 'Unable to check for a face. Please try again.',
  NO_FACE: 'No face detected.',
  MULTIPLE_FACES: 'Multiple faces detected. Only one face is allowed.',
  FACE_DETECTED: 'Face detected. Ready to generate encoding.',
  ENCODING: 'Generating face encoding...',
  ENCODING_SUCCESS: 'Face encoding generated successfully.',
  ENCODING_ERROR: 'Unable to generate face encoding.',
  SAVING: 'Saving employee...',
  SAVE_SUCCESS: 'Employee enrolled successfully.',
  SAVE_ERROR: 'Unable to save employee. Please try again.',
}

const steps: { id: StepId; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'camera', label: 'Camera' },
  { id: 'face', label: 'Face Detection' },
  { id: 'encoding', label: 'Encoding' },
  { id: 'save', label: 'Save' },
  { id: 'completed', label: 'Completed' },
]

function isValidEmployeeName(value: string) {
  const normalized = value.trim().normalize('NFC')
  return normalized.length >= 2 && /^[\p{L}\p{M}][\p{L}\p{M} .'-\u2019]*$/u.test(normalized)
}

function isValidEncoding(value: number[] | null): value is number[] {
  return Array.isArray(value) && value.length === 128 && value.every(Number.isFinite)
}

export default function EnrollPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [name, setName] = useState('')
  const [step, setStep] = useState<StepId>('details')
  const [status, setStatus] = useState<EnrollmentStatus>('IDLE')
  const [errorMessage, setErrorMessage] = useState('')
  const [failedStep, setFailedStep] = useState<StepId | null>(null)
  const [cameraRequested, setCameraRequested] = useState(false)
  const [cameraAttempt, setCameraAttempt] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [faceCount, setFaceCount] = useState<number | null>(null)
  const [encoding, setEncoding] = useState<number[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveConfirmation, setSaveConfirmation] = useState(false)
  const [detailsAttempted, setDetailsAttempted] = useState(false)

  const normalizedName = name.trim().normalize('NFC')
  const nameValid = isValidEmployeeName(name)
  const encodingValid = isValidEncoding(encoding)

  useEffect(() => {
    const auth = localStorage.getItem('iot-security-auth')
    if (!auth) {
      router.replace('/login')
    }
  }, [router])

  useEffect(() => {
    if (!cameraRequested) return
    let disposed = false
    let animationFrame = 0
    let stream: MediaStream | null = null

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (!video) throw new Error('not-ready')
        video.srcObject = stream
        await video.play()

        await new Promise<void>((resolve, reject) => {
          const deadline = Date.now() + 10000
          const checkVideo = () => {
            if (disposed) {
              reject(new Error('disposed'))
            } else if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
              resolve()
            } else if (Date.now() >= deadline) {
              reject(new Error('not-ready'))
            } else {
              animationFrame = window.requestAnimationFrame(checkVideo)
            }
          }
          checkVideo()
        })

        if (disposed) return
        stream.getVideoTracks().forEach((track) => {
          track.addEventListener('ended', () => {
            if (disposed) return
            setCameraReady(false)
            setStatus('CAMERA_ERROR')
            setFailedStep('camera')
            setErrorMessage('Camera is not ready. Please allow camera access.')
          }, { once: true })
        })
        setCameraReady(true)
        setStatus('CAMERA_READY')
        setErrorMessage('')
        setFailedStep(null)
      } catch (error) {
        if (disposed) return
        stream?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setCameraReady(false)
        setStatus('CAMERA_ERROR')
        setFailedStep('camera')
        const errorName = error instanceof DOMException ? error.name : ''
        if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
          setErrorMessage('Camera permission was denied. Please allow camera access in your browser.')
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          setErrorMessage('No camera was detected.')
        } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
          setErrorMessage('The camera is currently being used by another application.')
        } else if (error instanceof Error && error.message === 'not-ready') {
          setErrorMessage('Camera is not ready. Please allow camera access.')
        } else {
          setErrorMessage('Unable to start the camera. Please try again.')
        }
      }
    }

    startCamera()
    return () => {
      disposed = true
      if (animationFrame) window.cancelAnimationFrame(animationFrame)
      stream?.getTracks().forEach((track) => track.stop())
      if (streamRef.current === stream) streamRef.current = null
      if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null
    }
  }, [cameraRequested, cameraAttempt])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  function cameraIsReady() {
    const video = videoRef.current
    const hasActiveTrack = streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live')
    return Boolean(cameraReady && hasActiveTrack && video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0)
  }

  function captureFrame() {
    const video = videoRef.current
    if (!cameraIsReady() || !video) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', 0.9)
    } catch {
      return null
    }
  }

  function beginCamera() {
    if (!nameValid) {
      setDetailsAttempted(true)
      setErrorMessage('Please enter a valid employee name.')
      return
    }
    setErrorMessage('')
    setStatus('CAMERA_INITIALIZING')
    setStep('camera')
    setCameraRequested(true)
  }

  function retryCamera() {
    setCameraReady(false)
    setStatus('CAMERA_INITIALIZING')
    setErrorMessage('')
    setFailedStep(null)
    setCameraAttempt((attempt) => attempt + 1)
  }

  function showCameraForRecheck() {
    setFaceCount(null)
    setEncoding(null)
    setStep('camera')
    if (!cameraIsReady()) {
      setCameraReady(false)
      setStatus('CAMERA_ERROR')
      setFailedStep('camera')
      setErrorMessage('Camera is not ready. Please allow camera access.')
      return
    }
    setStatus('CAMERA_READY')
    setErrorMessage('')
    setFailedStep(null)
  }

  async function handleFaceCheck() {
    if (!nameValid || busy) return
    if (!cameraIsReady()) {
      setCameraReady(false)
      setStep('camera')
      setStatus('CAMERA_ERROR')
      setFailedStep('camera')
      setErrorMessage('Camera is not ready. Please allow camera access.')
      return
    }

    const image = captureFrame()
    if (!image) {
      setStep('camera')
      setStatus('CAMERA_ERROR')
      setFailedStep('camera')
      setErrorMessage('Camera is not ready. Please allow camera access.')
      return
    }

    setStep('face')
    setBusy(true)
    setErrorMessage('')
    setFailedStep(null)
    setStatus('FACE_CHECKING')
    setFaceCount(null)
    setEncoding(null)

    try {
      const result = await apiFetch<{ face_count: number }>('/api/employees/enroll/detect', {
        method: 'POST',
        body: JSON.stringify({ image }),
      })
      setFaceCount(result.face_count)
      if (result.face_count === 0) {
        setStatus('NO_FACE')
        setFailedStep('face')
      } else if (result.face_count > 1) {
        setStatus('MULTIPLE_FACES')
        setFailedStep('face')
      } else if (result.face_count === 1) {
        setStatus('FACE_DETECTED')
      } else {
        setStatus('FACE_CHECK_ERROR')
        setFailedStep('face')
      }
    } catch {
      setStatus('FACE_CHECK_ERROR')
      setFailedStep('face')
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerateEncoding() {
    if (!nameValid || busy || faceCount !== 1) return
    if (!cameraIsReady()) {
      setCameraReady(false)
      setStep('camera')
      setStatus('CAMERA_ERROR')
      setFailedStep('camera')
      setErrorMessage('Camera is not ready. Please allow camera access.')
      return
    }

    const image = captureFrame()
    if (!image) {
      setStep('camera')
      setStatus('CAMERA_ERROR')
      setFailedStep('camera')
      setErrorMessage('Camera is not ready. Please allow camera access.')
      return
    }

    setBusy(true)
    setEncoding(null)
    setErrorMessage('')
    setFailedStep(null)
    const request = apiFetch<{ success: boolean; face_count: number; encoding?: number[] }>('/api/employees/enroll/encode', {
      method: 'POST',
      body: JSON.stringify({ image }),
    })
    setStep('encoding')
    setStatus('ENCODING')

    try {
      const result = await request
      if (result.face_count !== 1) {
        setFaceCount(result.face_count)
        setEncoding(null)
        setStep('face')
        setFailedStep('face')
        setStatus(result.face_count > 1 ? 'MULTIPLE_FACES' : 'NO_FACE')
        return
      }
      if (!result.success || !isValidEncoding(result.encoding ?? null)) {
        setStatus('ENCODING_ERROR')
        setFailedStep('encoding')
        return
      }
      setEncoding(result.encoding)
      setStatus('ENCODING_SUCCESS')
      setStep('save')
    } catch {
      setStatus('ENCODING_ERROR')
      setFailedStep('encoding')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEmployee() {
    if (!nameValid || !cameraIsReady() || faceCount !== 1 || !encodingValid || busy || saved) return

    setBusy(true)
    setStatus('SAVING')
    setErrorMessage('')
    setFailedStep(null)
    try {
      const result = await apiFetch<{ success: boolean }>('/api/employees/enroll', {
        method: 'POST',
        body: JSON.stringify({ name: normalizedName, encoding }),
      })
      if (!result.success) throw new Error('Save was not confirmed.')
      setSaved(true)
      setSaveConfirmation(true)
      setStep('completed')
      setStatus('SAVE_SUCCESS')
    } catch (error) {
      setStatus('SAVE_ERROR')
      setFailedStep('save')
      setErrorMessage(error instanceof Error ? error.message : '')
    } finally {
      setBusy(false)
    }
  }

  const completedSteps: Record<StepId, boolean> = {
    details: nameValid,
    camera: cameraReady,
    face: faceCount === 1,
    encoding: encodingValid,
    save: saved,
    completed: saved,
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar />

        <main className="space-y-5">
          <Header title="Employee Enrollment" subtitle="Add a verified employee face profile" />

          <section className="panel rounded-[30px] p-5">
            <div className="mb-6 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {steps.map(({ id, label }) => {
                const active = step === id
                const complete = completedSteps[id]
                const failed = failedStep === id
                return (
                  <div key={id} aria-current={active ? 'step' : undefined} className={`rounded-xl border px-3 py-3 text-center text-xs uppercase tracking-[0.12em] ${failed ? 'border-red-500/60 bg-red-500/10 text-red-200' : complete ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : active ? 'border-sky-500 bg-sky-500/10 text-sky-200' : 'border-slate-800 bg-slate-900 text-slate-500'} ${active ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950' : ''}`}>
                    <span className="mr-1.5">{failed ? '!' : complete ? '✓' : ''}</span>{label}
                  </div>
                )
              })}
            </div>

            <div role="status" aria-live="polite" className={`mb-5 rounded-xl border p-4 text-sm ${failedStep ? 'border-red-500/40 bg-red-500/10 text-red-200' : status === 'SAVE_SUCCESS' || status === 'ENCODING_SUCCESS' || status === 'FACE_DETECTED' || status === 'CAMERA_READY' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-slate-800 bg-slate-950 text-slate-300'}`}>
              <div className="text-xs uppercase tracking-[0.18em] opacity-70">Enrollment Status</div>
              <div className="mt-1">{statusMessages[status]}</div>
              {errorMessage ? <div className="mt-1">{errorMessage}</div> : null}
              {saveConfirmation ? <div className="mt-1">Employee saved successfully.</div> : null}
            </div>

            {step === 'details' ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="employee-name" className="mb-2 block text-sm text-slate-300">Employee name</label>
                  <input id="employee-name" value={name} onChange={(event) => setName(event.target.value)} onBlur={() => setDetailsAttempted(true)} aria-invalid={detailsAttempted && !nameValid} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500" placeholder="Enter employee name" />
                  {detailsAttempted && !nameValid ? <p className="mt-2 text-sm text-red-300">Please enter a valid employee name.</p> : null}
                </div>
                <button onClick={beginCamera} className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500">Start Camera</button>
              </div>
            ) : null}

            {cameraRequested ? (
              <div className="mb-5 rounded-xl border border-slate-800 bg-black p-2">
                <video ref={videoRef} autoPlay playsInline muted className="h-[min(55vh,420px)] w-full rounded-lg object-cover" />
              </div>
            ) : null}

            {step === 'camera' ? (
              <div className="space-y-4">
                {!cameraReady && status !== 'CAMERA_INITIALIZING' ? <button onClick={retryCamera} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">Try Camera Again</button> : null}
                {cameraReady ? <button disabled={!nameValid || !cameraIsReady() || busy} onClick={handleFaceCheck} className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50">Check Face</button> : null}
              </div>
            ) : null}

            {step === 'face' ? (
              <div className="space-y-4">
                {faceCount === 1 ? (
                  <button disabled={!nameValid || !cameraIsReady() || busy || faceCount !== 1} onClick={handleGenerateEncoding} className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50">Generate Encoding</button>
                ) : status !== 'FACE_CHECKING' ? (
                  <button disabled={!nameValid || !cameraIsReady() || busy} onClick={showCameraForRecheck} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Check Face Again</button>
                ) : null}
              </div>
            ) : null}

            {step === 'encoding' ? (
              <div className="space-y-4">
                {status === 'ENCODING_ERROR' ? <button disabled={!nameValid || !cameraIsReady() || busy} onClick={showCameraForRecheck} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Check Face Again</button> : null}
              </div>
            ) : null}

            {step === 'save' ? (
              <div className="space-y-4">
                <button disabled={!nameValid || !cameraIsReady() || faceCount !== 1 || !encodingValid || busy || saved} onClick={handleSaveEmployee} className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50">Save Employee</button>
              </div>
            ) : null}

            {step === 'completed' ? (
              <div className="space-y-4">
                <button onClick={() => router.push('/employees')} className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500">Return to Employees</button>
              </div>
            ) : null}

            {!cameraRequested && step !== 'details' ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-400">Camera preview is unavailable until the camera is started.</div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  )
}
