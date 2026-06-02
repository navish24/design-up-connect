'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ScanLine, Users, ArrowLeft, Keyboard, Camera, Check, X, Search } from 'lucide-react'

interface ScanResult {
  ok: boolean
  name: string
  profession?: string
  company?: string
  message?: string
}

type Mode = 'scan' | 'manual'

export default function GateScanPage() {
  const { exhibitionId } = useParams<{ exhibitionId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const videoRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<unknown>(null)
  const [mode, setMode] = useState<Mode>('scan')
  const [entryCount, setEntryCount] = useState(0)
  const [exhibition, setExhibition] = useState<{ name: string } | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanActive, setScanActive] = useState(false)

  // Manual mode state
  const [phone, setPhone] = useState('')
  const [manualResults, setManualResults] = useState<{ id: string; name: string; profession: string; company: string; phone: string }[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    loadExhibition()
    loadEntryCount()
  }, [exhibitionId])

  async function loadExhibition() {
    const { data } = await supabase.from('exhibitions').select('name').eq('id', exhibitionId).single()
    setExhibition(data)
  }

  async function loadEntryCount() {
    const { count } = await supabase
      .from('gate_entries')
      .select('*', { count: 'exact', head: true })
      .eq('exhibition_id', exhibitionId)
    setEntryCount(count ?? 0)
  }

  // Start html5-qrcode scanner
  const startScanner = useCallback(async () => {
    if (!videoRef.current || scanActive) return
    // Dynamic import to avoid SSR issues
    const { Html5Qrcode } = await import('html5-qrcode')
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner
    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => handleScan(decodedText),
        () => {} // ignore parse errors
      )
      setScanActive(true)
    } catch {
      // Camera permission denied or no camera
    }
  }, [scanActive])

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return
    const scanner = scannerRef.current as { stop: () => Promise<void>; clear: () => void }
    try {
      await scanner.stop()
      scanner.clear()
    } catch {}
    scannerRef.current = null
    setScanActive(false)
  }, [])

  useEffect(() => {
    if (mode === 'scan') {
      startScanner()
    } else {
      stopScanner()
    }
    return () => { stopScanner() }
  }, [mode])

  async function handleScan(token: string) {
    // Pause scanner while processing
    await stopScanner()

    // Look up visitor by qr_token
    const { data: visitor } = await supabase
      .from('visitors')
      .select('id, name, profession, company, phone')
      .eq('qr_token', token)
      .single()

    if (!visitor) {
      setScanResult({ ok: false, name: '', message: "QR code not recognised. Please check the visitor's pass." })
      return
    }

    await recordEntry(visitor.id, visitor.name, visitor.profession, visitor.company)
  }

  async function recordEntry(visitorId: string, name: string, profession?: string, company?: string) {
    // Check for duplicate entry in last 60 seconds (debounce re-scans)
    const since = new Date(Date.now() - 60_000).toISOString()
    const { data: recent } = await supabase
      .from('gate_entries')
      .select('id')
      .eq('exhibition_id', exhibitionId)
      .eq('visitor_id', visitorId)
      .gte('created_at', since)
      .limit(1)

    if (recent && recent.length > 0) {
      setScanResult({ ok: false, name, profession, company, message: 'Already scanned in the last minute.' })
      return
    }

    await supabase.from('gate_entries').insert({
      exhibition_id: exhibitionId,
      visitor_id: visitorId,
    })

    setEntryCount(c => c + 1)
    setScanResult({ ok: true, name, profession, company })
  }

  function dismissResult() {
    setScanResult(null)
    if (mode === 'scan') startScanner()
  }

  async function searchByPhone(value: string) {
    setPhone(value)
    if (value.length < 6) { setManualResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('visitors')
      .select('id, name, profession, company, phone')
      .ilike('phone', `%${value}%`)
      .limit(5)
    setManualResults(data ?? [])
    setSearching(false)
  }

  async function manualCheckIn(visitor: { id: string; name: string; profession: string; company: string }) {
    setManualResults([])
    setPhone('')
    await recordEntry(visitor.id, visitor.name, visitor.profession, visitor.company)
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-black text-white select-none">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-safe-top pt-4 pb-3 bg-black/80 backdrop-blur-md z-20">
        <button onClick={() => router.push('/gate')} className="p-2 -ml-2 text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <div className="text-xs text-gray-400 truncate max-w-[180px]">{exhibition?.name}</div>
        </div>
        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
          <Users size={13} className="text-[var(--accent)]" />
          <span className="text-sm font-bold tabular-nums">{entryCount}</span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mx-4 mb-2 bg-white/5 rounded-xl p-1 z-10">
        {(['scan', 'manual'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
              mode === m ? 'bg-[var(--accent)] text-black' : 'text-gray-400 hover:text-white',
            ].join(' ')}
          >
            {m === 'scan' ? <><Camera size={14} /> Scan QR</> : <><Keyboard size={14} /> Manual</>}
          </button>
        ))}
      </div>

      {/* Scanner view */}
      {mode === 'scan' && (
        <div className="flex-1 relative flex flex-col items-center justify-center">
          {/* Camera feed rendered here by html5-qrcode */}
          <div
            id="qr-reader"
            ref={videoRef}
            className="w-full h-full absolute inset-0 [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
            style={{ background: '#000' }}
          />

          {/* Overlay with cutout */}
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute inset-0 bg-black/50" />
            {/* Scanning frame */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60">
              <div className="absolute inset-0 bg-transparent mix-blend-destination-out" />
              {/* Corner brackets */}
              {[
                'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
                'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
                'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
                'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-[var(--accent)] ${cls}`} />
              ))}
              {/* Scan line animation */}
              <div className="absolute left-2 right-2 h-0.5 bg-[var(--accent)] opacity-80 animate-scan-line" />
            </div>
          </div>

          {/* Hint text */}
          <p className="absolute bottom-8 left-0 right-0 text-center text-xs text-gray-400 z-10">
            Point camera at visitor's QR pass
          </p>

          {!scanActive && !scanResult && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/80">
              <ScanLine size={40} className="text-gray-500 mb-3" />
              <p className="text-gray-400 text-sm">Starting camera…</p>
            </div>
          )}
        </div>
      )}

      {/* Manual search view */}
      {mode === 'manual' && (
        <div className="flex-1 flex flex-col p-4 gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              autoFocus
              type="tel"
              value={phone}
              onChange={e => searchByPhone(e.target.value)}
              placeholder="Search by phone number"
              className="w-full bg-white/10 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          {searching && <p className="text-gray-500 text-sm text-center">Searching…</p>}
          {manualResults.length > 0 && (
            <div className="flex flex-col gap-2">
              {manualResults.map(v => (
                <button
                  key={v.id}
                  onClick={() => manualCheckIn(v)}
                  className="w-full text-left p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between hover:border-[var(--accent)] transition-colors"
                >
                  <div>
                    <div className="font-semibold text-white text-sm">{v.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {[v.profession, v.company].filter(Boolean).join(' · ')} · {v.phone}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--accent)] font-medium">Check in →</div>
                </button>
              ))}
            </div>
          )}
          {phone.length >= 6 && !searching && manualResults.length === 0 && (
            <p className="text-gray-500 text-sm text-center">No visitors found</p>
          )}
        </div>
      )}

      {/* Result overlay */}
      {scanResult && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/90">
          <div className={[
            'w-full max-w-sm rounded-3xl p-8 flex flex-col items-center text-center gap-4',
            scanResult.ok ? 'bg-green-950 border border-green-700' : 'bg-red-950 border border-red-700',
          ].join(' ')}>
            <div className={[
              'w-16 h-16 rounded-full flex items-center justify-center',
              scanResult.ok ? 'bg-green-500' : 'bg-red-500',
            ].join(' ')}>
              {scanResult.ok ? <Check size={32} strokeWidth={3} /> : <X size={32} strokeWidth={3} />}
            </div>

            <div>
              {scanResult.ok ? (
                <>
                  <div className="text-2xl font-bold text-white">{scanResult.name}</div>
                  {(scanResult.profession || scanResult.company) && (
                    <div className="text-sm text-gray-300 mt-1">
                      {[scanResult.profession, scanResult.company].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="mt-2 text-green-400 font-semibold text-sm">Entry Recorded ✓</div>
                </>
              ) : (
                <>
                  {scanResult.name && <div className="text-xl font-bold text-white mb-1">{scanResult.name}</div>}
                  <div className="text-red-300 text-sm">{scanResult.message ?? 'Entry not allowed'}</div>
                </>
              )}
            </div>

            <button
              onClick={dismissResult}
              className="mt-2 w-full py-3 rounded-xl font-semibold text-sm bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              {mode === 'scan' ? 'Scan Next' : 'Done'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
