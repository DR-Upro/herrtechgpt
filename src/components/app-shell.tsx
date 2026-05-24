'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, X } from 'lucide-react'
import { Sidebar } from './sidebar'
import { CreditBadge } from './credit-badge'
import type { Conversation } from '@/lib/types'
import type { AccessTier, ViewAsMode } from '@/lib/access'
import type { FeatureKey, FeatureState } from '@/lib/permissions'

interface AppShellProps {
  conversations: Conversation[]
  archivedConversations?: Conversation[]
  userEmail?: string
  userName?: string
  isAdmin?: boolean
  realIsAdmin?: boolean
  accessTier?: AccessTier
  viewAs?: ViewAsMode
  states?: Record<FeatureKey, FeatureState>
  newTicketCount?: number
  helpUnreadCount?: number
  /** Master-Switch — beeinflusst Profil-Menü-Label "Abrechnung" vs "Mitgliedschaft". */
  subscriptionsEnabled?: boolean
  children: React.ReactNode
}

export function AppShell({ conversations, archivedConversations, userEmail, userName, isAdmin, realIsAdmin, accessTier, viewAs, states, newTicketCount, helpUnreadCount, subscriptionsEnabled, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)       // mobile overlay
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false) // desktop collapse
  const pathname = usePathname()

  // Close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out
          md:relative md:translate-x-0 md:flex md:shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${sidebarCollapsed ? 'md:w-0 md:overflow-hidden' : 'md:w-72'}
        `}
      >
        <Sidebar
          conversations={conversations}
          archivedConversations={archivedConversations}
          userEmail={userEmail}
          userName={userName}
          isAdmin={isAdmin}
          realIsAdmin={realIsAdmin}
          accessTier={accessTier}
          viewAs={viewAs}
          states={states}
          newTicketCount={newTicketCount}
          helpUnreadCount={helpUnreadCount}
          subscriptionsEnabled={subscriptionsEnabled}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-surface-secondary transition-colors"
            aria-label="Menü öffnen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <img src="/logo.svg" alt="UPRO AI Lab" className="h-5 w-auto" />
        </div>

        {/* Desktop sidebar toggle — fixed tab at sidebar edge */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`hidden md:flex fixed top-16 z-50 items-center justify-center w-5 h-10 bg-surface border border-border rounded-r-lg shadow-sm text-muted hover:text-foreground hover:bg-surface-secondary transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? 'left-0' : 'left-72'
          }`}
          aria-label={sidebarCollapsed ? 'Seitenleiste öffnen' : 'Seitenleiste schließen'}
        >
          {sidebarCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
        </button>

        {/* View-As Banner: Admin testet gerade eine andere Tier-Sicht */}
        {realIsAdmin && viewAs && viewAs !== 'admin' && (
          <ViewAsBanner viewAs={viewAs} />
        )}

        <main className="flex-1 min-h-0 overflow-y-auto relative">
          {/* Header-Buttons — oben rechts */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <CreditBadge />
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground bg-surface/80 hover:bg-surface-secondary border border-border backdrop-blur-sm transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Übersicht
            </Link>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}

const VIEW_AS_BANNER_LABELS: Record<Exclude<ViewAsMode, 'admin'>, { label: string; color: string }> = {
  premium: { label: 'Community (Premium)', color: 'bg-green-500' },
  alumni:  { label: 'Alumni',               color: 'bg-amber-500' },
  basic:   { label: 'Basic (Free)',         color: 'bg-muted' },
}

function ViewAsBanner({ viewAs }: { viewAs: Exclude<ViewAsMode, 'admin'> }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const meta = VIEW_AS_BANNER_LABELS[viewAs]

  const reset = async () => {
    setLoading(true)
    await fetch('/api/admin/view-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'admin' }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="shrink-0 bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-center gap-3 text-xs">
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <Eye size={13} className="text-primary" />
        Testmodus — Ansicht als
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface border border-border">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.color}`} />
          <span className="font-semibold">{meta.label}</span>
        </span>
      </span>
      <button
        onClick={reset}
        disabled={loading}
        className="inline-flex items-center gap-1 text-primary hover:text-primary-hover font-medium transition-colors disabled:opacity-50"
      >
        <X size={12} />
        {loading ? 'Zurücksetze…' : 'Zurück zum Admin-Modus'}
      </button>
    </div>
  )
}
