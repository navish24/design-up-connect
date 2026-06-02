'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Download } from 'lucide-react'
import QRCode from 'qrcode'

const W = 800
const H = 840
const QR_S = 370
const QR_X = (W - QR_S) / 2
const QR_Y = 282
const BENEFITS_LEFT = 142

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawCard(ctx: CanvasRenderingContext2D, name: string, qrImg: HTMLImageElement) {
  const green = '#407060'
  const greenMid = '#5A8878'

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = green
  ctx.fillRect(0, 0, W, 5)

  ctx.fillStyle = '#F2F6F4'
  ctx.fillRect(0, 5, W, 143)

  ctx.fillStyle = green
  ctx.font = 'bold 30px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('DESIGNUP CONNECT', W / 2, 60)

  ctx.fillStyle = '#9494A8'
  ctx.font = '13px Arial, sans-serif'
  ctx.fillText('Your digital connection to this brand', W / 2, 88)

  ctx.fillStyle = '#DFDFE8'
  ctx.fillRect(60, 116, W - 120, 1)
  ctx.fillStyle = green
  ctx.fillRect(W / 2 - 32, 114, 64, 3)

  ctx.fillStyle = '#18181E'
  ctx.font = 'bold 46px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText(name.toUpperCase(), W / 2, 208)

  const pillW = 168, pillH = 34, pillX = W / 2 - pillW / 2, pillY = 222
  ctx.fillStyle = green
  roundRect(ctx, pillX, pillY, pillW, pillH, 17)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 14px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Scan to Save', W / 2, pillY + 23)

  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, QR_X - 20, QR_Y - 20, QR_S + 40, QR_S + 40, 16)
  ctx.fill()
  ctx.strokeStyle = '#DFDFE8'
  ctx.lineWidth = 2
  roundRect(ctx, QR_X - 20, QR_Y - 20, QR_S + 40, QR_S + 40, 16)
  ctx.stroke()
  ctx.drawImage(qrImg, QR_X, QR_Y, QR_S, QR_S)

  const cx = QR_X - 20, cy = QR_Y - 20, cs = QR_S + 40, cm = 22
  ctx.strokeStyle = green
  ctx.lineWidth = 2.5
  ;[
    [cx, cy, cx + cm, cy, cx, cy + cm],
    [cx + cs, cy, cx + cs - cm, cy, cx + cs, cy + cm],
    [cx, cy + cs, cx + cm, cy + cs, cx, cy + cs - cm],
    [cx + cs, cy + cs, cx + cs - cm, cy + cs, cx + cs, cy + cs - cm],
  ].forEach(([x1, y1, x2, y2, x3, y3]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
    ctx.moveTo(x1, y1); ctx.lineTo(x3, y3); ctx.stroke()
  })

  const bY = QR_Y + QR_S + 42
  ctx.textAlign = 'left'
  ctx.font = '14px Arial, sans-serif'
  ctx.fillStyle = '#3C3C50'
  ;[
    `✓  Save ${name}'s contact — no business card needed`,
    '✓  Browse their full catalogue and collection',
    '✓  Reach out and reconnect whenever you\'re ready',
  ].forEach((line, i) => ctx.fillText(line, BENEFITS_LEFT, bY + i * 26))

  ctx.fillStyle = '#ADADC0'
  ctx.font = '11px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Opens in your browser · Log in once · Brand saved to your account', W / 2, bY + 90)

  ctx.fillStyle = green
  ctx.fillRect(0, H - 5, W, 5)
  ctx.fillStyle = greenMid
  ctx.font = '11px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('designup.in', W / 2, H - 16)
}

async function renderCard(canvas: HTMLCanvasElement, brandName: string, qrDataUrl: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = W
  canvas.height = H
  const qrImg = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.src = qrDataUrl
  })
  drawCard(ctx, brandName, qrImg)
}

export default function BrandQRPage() {
  const supabase = createClient()
  const [brand, setBrand] = useState<{ id: string; name: string; qr_token: string } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    const { data: member } = await supabase
      .from('brand_members').select('brand_id').eq('user_id', user!.id).single()
    if (!member) return
    const { data } = await supabase
      .from('brands').select('id, name, qr_token').eq('id', member.brand_id).single()
    if (data) setBrand(data)
  }

  useEffect(() => {
    if (!brand) return
    QRCode.toDataURL(`booth:${brand.id}`, {
      width: 420, margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    }).then(setQrDataUrl)
  }, [brand])

  useEffect(() => {
    if (!brand || !qrDataUrl || !canvasRef.current) return
    renderCard(canvasRef.current, brand.name, qrDataUrl)
  }, [brand, qrDataUrl])

  async function download() {
    if (!brand || !qrDataUrl) return
    setDownloading(true)
    const hiCanvas = document.createElement('canvas')
    hiCanvas.width = W * 2
    hiCanvas.height = H * 2
    const hiCtx = hiCanvas.getContext('2d')!
    hiCtx.scale(2, 2)
    const qrImg = await new Promise<HTMLImageElement>((resolve) => {
      const img = new Image(); img.onload = () => resolve(img); img.src = qrDataUrl
    })
    drawCard(hiCtx, brand.name, qrImg)
    const link = document.createElement('a')
    link.download = `${brand.name.replace(/\s+/g, '-')}-QR.png`
    link.href = hiCanvas.toDataURL('image/png')
    link.click()
    setDownloading(false)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[var(--text)]">Brand QR</h1>
        <p className="text-sm text-[var(--text3)] mt-0.5">
          Print-ready card for your exhibition booth
        </p>
      </div>

      {brand && qrDataUrl ? (
        <>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-6">
            <canvas ref={canvasRef} style={{ width: '100%', display: 'block', borderRadius: '8px' }} />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={download}
              disabled={downloading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-60"
            >
              <Download size={15} />
              {downloading ? 'Preparing…' : 'Download Card'}
            </button>
            <p className="text-xs text-[var(--text3)]">
              Exports at 1600×1680px — suitable for A4/A5 print
            </p>
          </div>

          <div className="mt-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-5 py-4 text-xs text-[var(--text3)] leading-relaxed">
            <strong className="text-[var(--text2)]">Print tip:</strong> Print at A5 (148×210mm)
            at 300 DPI on matte paper for best results.
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-sm text-[var(--text3)]">Loading…</div>
      )}
    </div>
  )
}
