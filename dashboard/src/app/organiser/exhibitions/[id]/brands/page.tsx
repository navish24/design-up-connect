'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { BrandStatusBadge } from '@/components/ui/Badge'
import { Upload, Plus, Search, RefreshCw, X } from 'lucide-react'
import Papa from 'papaparse'

interface ExhibitionBrand {
  id: string
  brand_id: string
  status: string
  booth_number: string | null
  brands: { name: string; category: string; contact_email: string }
}

interface CSVRow { brand_name: string; email: string; category?: string; booth_number?: string }

export default function BrandsPage() {
  const { id: exhibitionId } = useParams<{ id: string }>()
  const supabase = createClient()

  const [brands, setBrands] = useState<ExhibitionBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [csvPreview, setCsvPreview] = useState<CSVRow[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ brand_name: '', email: '', category: '', booth_number: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
  }, [exhibitionId])

  async function load() {
    const { data } = await supabase
      .from('exhibition_brands')
      .select('*, brands(name, category, contact_email)')
      .eq('exhibition_id', exhibitionId)
    setBrands((data as ExhibitionBrand[]) ?? [])
    setLoading(false)
  }

  function onCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = []
        const rows = results.data.map((row, i) => {
          if (!row.brand_name) errors.push(`Row ${i + 2}: brand_name is required`)
          if (!row.email) errors.push(`Row ${i + 2}: email is required`)
          return row
        })
        // Check duplicates
        const emails = rows.map(r => r.email?.toLowerCase())
        const dupes = emails.filter((e, i) => emails.indexOf(e) !== i)
        if (dupes.length > 0) errors.push(`Duplicate emails: ${[...new Set(dupes)].join(', ')}`)
        setCsvErrors(errors)
        setCsvPreview(rows)
      },
    })
  }

  async function importCSV() {
    if (csvErrors.length > 0 || csvPreview.length === 0) return
    setImporting(true)
    for (const row of csvPreview) {
      // Upsert brand by email
      const { data: brand } = await supabase
        .from('brands')
        .upsert({ name: row.brand_name, contact_email: row.email, category: row.category ?? null }, { onConflict: 'contact_email' })
        .select('id').single()
      if (!brand) continue
      await supabase.from('exhibition_brands').upsert({
        exhibition_id: exhibitionId,
        brand_id: brand.id,
        booth_number: row.booth_number ?? null,
        status: 'invited',
      }, { onConflict: 'exhibition_id,brand_id' })
    }
    setCsvPreview([])
    setCsvErrors([])
    if (fileRef.current) fileRef.current.value = ''
    await load()
    setImporting(false)
  }

  async function resendInvite(brandId: string) {
    // Trigger edge function to resend invitation email
    await supabase.functions.invoke('send-brand-invitation', { body: { exhibition_id: exhibitionId, brand_id: brandId } })
  }

  async function addManual() {
    if (!manualForm.brand_name || !manualForm.email) return
    const { data: brand } = await supabase
      .from('brands')
      .upsert({ name: manualForm.brand_name, contact_email: manualForm.email, category: manualForm.category || null }, { onConflict: 'contact_email' })
      .select('id').single()
    if (!brand) return
    await supabase.from('exhibition_brands').upsert({
      exhibition_id: exhibitionId, brand_id: brand.id,
      booth_number: manualForm.booth_number || null, status: 'invited',
    }, { onConflict: 'exhibition_id,brand_id' })
    setShowManual(false)
    setManualForm({ brand_name: '', email: '', category: '', booth_number: '' })
    await load()
  }

  const filtered = brands.filter(eb =>
    !search || eb.brands?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Brands</h1>
          <p className="text-sm text-[var(--text3)] mt-0.5">{brands.length} brands in this exhibition</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Import CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onCSVUpload} />
          </label>
          <Button size="sm" onClick={() => setShowManual(true)}>
            <Plus size={14} /> Add Brand
          </Button>
        </div>
      </div>

      {/* CSV preview */}
      {csvPreview.length > 0 && (
        <div className="mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-[var(--text)]">{csvPreview.length} brands ready to import</h3>
            <button onClick={() => { setCsvPreview([]); setCsvErrors([]); if (fileRef.current) fileRef.current.value = '' }} className="text-[var(--text3)]"><X size={16} /></button>
          </div>
          {csvErrors.length > 0 && (
            <div className="bg-[var(--red-dim)] border border-[var(--red)] rounded-xl px-4 py-3 mb-3">
              {csvErrors.map((e, i) => <p key={i} className="text-xs text-[var(--red)]">{e}</p>)}
            </div>
          )}
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto mb-4">
            {csvPreview.map((row, i) => (
              <div key={i} className="flex gap-3 text-xs p-2 rounded-lg bg-[var(--surface2)]">
                <span className="text-[var(--text)]">{row.brand_name}</span>
                <span className="text-[var(--text3)]">{row.email}</span>
                {row.booth_number && <span className="text-[var(--accent)]">Booth {row.booth_number}</span>}
              </div>
            ))}
          </div>
          <Button size="sm" loading={importing} disabled={csvErrors.length > 0} onClick={importCSV}>
            Import & Send Invitations
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search brands..." style={{ paddingLeft: '32px' }} />
      </div>

      {/* Brand list */}
      {loading ? (
        <p className="text-sm text-[var(--text3)] text-center py-12">Loading...</p>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--text3)]">No brands yet. Import a CSV or add one manually.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Brand', 'Category', 'Booth', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text3)] px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(eb => (
                  <tr key={eb.id} className="hover:bg-[var(--surface2)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-[var(--text)]">{eb.brands?.name}</div>
                      <div className="text-xs text-[var(--text3)]">{eb.brands?.contact_email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text2)]">{eb.brands?.category ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text2)]">{eb.booth_number ?? '—'}</td>
                    <td className="px-4 py-3"><BrandStatusBadge status={eb.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {['invited', 'awaiting_setup'].includes(eb.status) && (
                        <button
                          onClick={() => resendInvite(eb.brand_id)}
                          className="flex items-center gap-1 text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors ml-auto"
                        >
                          <RefreshCw size={11} /> Resend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Manual add modal */}
      {showManual && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[var(--text)]">Add Brand</h2>
              <button onClick={() => setShowManual(false)} className="text-[var(--text3)]"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { field: 'brand_name', label: 'Brand Name', placeholder: 'e.g. Lumina Lighting' },
                { field: 'email', label: 'Contact Email', placeholder: 'info@brand.com' },
                { field: 'category', label: 'Category (optional)', placeholder: 'e.g. Lighting' },
                { field: 'booth_number', label: 'Booth Number (optional)', placeholder: 'e.g. B12' },
              ].map(f => (
                <div key={f.field} className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text3)]">{f.label}</label>
                  <input value={manualForm[f.field as keyof typeof manualForm]} onChange={e => setManualForm(m => ({ ...m, [f.field]: e.target.value }))} placeholder={f.placeholder} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setShowManual(false)}>Cancel</Button>
              <Button size="sm" onClick={addManual} disabled={!manualForm.brand_name || !manualForm.email}>Add & Invite</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
