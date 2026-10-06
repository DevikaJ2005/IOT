type CameraPanelProps = {
  status: string
  identity: string
  confidence: number
  alarm: string
  esp32: ESP32CommandStatus | null
  videoRef: React.RefObject<HTMLVideoElement>
}

export type ESP32CommandStatus = {
  connected: boolean
  command: string | null
  commandDelivered: boolean
  httpStatus?: number | null
  response?: string | null
  error?: string | null
}

export function CameraPanel({ status, identity, confidence, alarm, esp32, videoRef }: CameraPanelProps) {
  return (
    <div className="panel overflow-hidden rounded-3xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Live Camera</div>
          <div className="mt-2 text-xl font-semibold text-white">{status}</div>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${esp32?.connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
          {esp32 ? (esp32.connected ? 'ESP32 CONNECTED' : 'ESP32 DISCONNECTED') : 'ESP32 CHECKING'}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="h-[420px] w-full object-cover" />
        <div className="video-overlay absolute inset-0" />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-900/80 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Identity</div>
          <div className="mt-2 text-lg font-semibold text-white">{identity || 'Unknown'}</div>
        </div>
        <div className="rounded-2xl bg-slate-900/80 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Confidence</div>
          <div className="mt-2 text-lg font-semibold text-white">{confidence}%</div>
        </div>
        <div className="rounded-2xl bg-slate-900/80 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Buzzer</div>
          <div className={`mt-2 text-lg font-semibold ${alarm === 'ON' ? 'text-emerald-300' : alarm === 'OFF' ? 'text-slate-200' : 'text-red-300'}`}>{alarm}</div>
          <div className="mt-1 text-xs text-slate-400">
            Command: {esp32?.command || 'NONE'} · {esp32?.commandDelivered ? 'DELIVERED' : esp32?.command ? 'FAILED' : 'NOT SENT'}
          </div>
        </div>
      </div>
    </div>
  )
}
