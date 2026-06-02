import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-[var(--accent)] tracking-widest uppercase">Designup Admin</span>
          <span className="text-xs text-[var(--text3)] bg-[var(--surface2)] border border-[var(--border)] px-2 py-0.5 rounded-full">Internal</span>
        </div>
        <Link href="/brand" className="text-xs text-[var(--text3)] hover:text-[var(--accent)] transition-colors">
          ← Back to Dashboard
        </Link>
      </header>
      <main className="max-w-5xl mx-auto px-8 py-10">
        {children}
      </main>
    </div>
  )
}
