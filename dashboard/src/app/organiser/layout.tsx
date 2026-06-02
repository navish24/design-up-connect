import { OrganiserSidebar } from '@/components/organiser/OrganiserSidebar'

export default function OrganiserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <OrganiserSidebar />
      <main className="flex-1 ml-56 min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
