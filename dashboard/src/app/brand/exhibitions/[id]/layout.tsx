import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const TABS = [
  { label: 'Visitors', href: 'visitors' },
  { label: 'Representatives', href: 'representatives' },
  { label: 'Questionnaire', href: 'questionnaire' },
]

export default async function ExhibitionDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: eb } = await supabase
    .from('exhibition_brands')
    .select('exhibitions(name, city, start_date, end_date)')
    .eq('id', id)
    .single()

  const ex = eb?.exhibitions as unknown as Record<string, string> | null

  return (
    <div>
      {/* Exhibition header */}
      <div className="px-8 pt-8 max-w-5xl mx-auto">
        <Link href="/brand" className="text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors mb-3 block">
          ← Back to Dashboard
        </Link>
        {ex ? (
          <div className="mb-4">
            <h1 className="text-xl font-bold text-[var(--text)]">{ex.name}</h1>
            <p className="text-sm text-[var(--text3)] mt-0.5">
              {ex.city} ·{' '}
              {new Date(ex.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              {' – '}
              {new Date(ex.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        ) : (
          <h1 className="text-xl font-bold text-[var(--text)] mb-4">Exhibition</h1>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-[var(--border)]">
          {TABS.map(tab => (
            <Link
              key={tab.href}
              href={`/brand/exhibitions/${id}/${tab.href}`}
              className="px-4 py-2.5 text-sm font-medium text-[var(--text3)] hover:text-[var(--text)] transition-colors border-b-2 border-transparent hover:border-[var(--border)] -mb-px"
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {children}
    </div>
  )
}
