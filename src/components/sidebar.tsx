'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { listedAgents as agents } from '@/lib/agents'
import { useTheme } from '@/lib/theme-context'
import { createClient } from '@/lib/supabase/client'
import type { Conversation } from '@/lib/types'
import type { AccessTier, ViewAsMode } from '@/lib/access'
import { VIEW_AS_OPTIONS } from '@/lib/access'
import type { FeatureKey, FeatureState } from '@/lib/permissions'
import { requiresUpgrade } from '@/lib/permissions'
import {
  LayoutDashboard,
  GraduationCap,
  Bot,
  Wrench,
  MessageCircleQuestion,
  Shield,
  ChevronLeft,
  Plus,
  BarChart3,
  Users,
  Lock,
  BookOpen,
  Film,
  Ticket,
  Settings,
  LogOut,
  Sun,
  Moon,
  MoreVertical,
  Clock,
  Search,
  Play,
  Eye,
  ChevronDown,
  Loader2,
  CreditCard,
  Coins,
  Mail,
  SlidersHorizontal,
} from 'lucide-react'
import { resolveToolboxIcon, type ToolboxTool } from '@/lib/toolbox-icons'

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type SidebarMode = 'main' | 'chat' | 'admin' | 'classroom' | 'toolbox' | 'help'

interface SidebarProps {
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
  /** Beeinflusst nur das Profil-Menü-Label ("Mitgliedschaft & Credits" vs "Abrechnung & Abo"). */
  subscriptionsEnabled?: boolean
}

// ═══════════════════════════════════════════════════════════
// CONVERSATION ITEM (Chat-Sidebar)
// ═══════════════════════════════════════════════════════════

function ConversationItem({ conv, isActive }: { conv: Conversation; isActive: boolean }) {
  const agent = agents.find((a) => a.id === conv.agent_id)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [title, setTitle] = useState(conv.title)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  const handleRename = async () => {
    if (!title.trim()) return
    const supabase = createClient()
    await supabase.from('conversations').update({ title: title.trim() }).eq('id', conv.id)
    setIsRenaming(false)
    setMenuOpen(false)
    router.refresh()
  }

  const handleDelete = async () => {
    const supabase = createClient()
    await supabase.from('conversations').delete().eq('id', conv.id)
    setMenuOpen(false)
    router.push('/dashboard/ai-workspace')
    router.refresh()
  }

  const handleToggleArchive = async () => {
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ archived: !conv.archived })
      .eq('id', conv.id)
    setMenuOpen(false)
    // Wenn der gerade aktive Chat archiviert wird, raus auf die Landing.
    if (isActive && !conv.archived) {
      router.push('/dashboard/ai-workspace')
    }
    router.refresh()
  }

  if (isRenaming) {
    return (
      <div className="flex items-center gap-1 px-3 py-2">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename()
            if (e.key === 'Escape') { setIsRenaming(false); setTitle(conv.title) }
          }}
          onBlur={handleRename}
          className="flex-1 text-sm px-2 py-1 border border-border rounded-[var(--radius-sm)] bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    )
  }

  return (
    <div className="group relative flex items-center">
      <Link
        href={`/dashboard/ai-workspace/${conv.id}`}
        className={`flex-1 min-w-0 flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors pr-8 ${
          isActive
            ? 'bg-primary/10 text-foreground font-medium'
            : 'text-muted hover:bg-surface-hover hover:text-foreground'
        }`}
      >
        <span className="text-sm shrink-0">{agent?.emoji ?? '💬'}</span>
        <span className="truncate">{conv.title}</span>
      </Link>

      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => { e.preventDefault(); setMenuOpen(!menuOpen) }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-[var(--radius-sm)] hover:bg-surface-hover text-muted hover:text-foreground transition-all absolute right-1 top-1/2 -translate-y-1/2"
        >
          <MoreVertical size={14} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-dropdown)] py-1 min-w-[160px]">
            <button
              onClick={() => { setIsRenaming(true); setMenuOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-surface-hover transition-colors"
            >
              Umbenennen
            </button>
            <button
              onClick={handleToggleArchive}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-surface-hover transition-colors"
            >
              {conv.archived ? 'Wiederherstellen' : 'Archivieren'}
            </button>
            <button
              onClick={handleDelete}
              className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
            >
              Löschen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// USER MENU (Bottom Dropdown)
// ═══════════════════════════════════════════════════════════

function UserMenu({
  userEmail,
  userName,
  subscriptionsEnabled,
}: {
  userEmail: string
  userName: string
  subscriptionsEnabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : userEmail.slice(0, 2).toUpperCase()

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-[var(--radius-lg)] hover:bg-surface-hover transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
          {initials}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{userName || userEmail}</p>
          <p className="text-xs text-muted truncate">{userEmail}</p>
        </div>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-surface border border-border rounded-[var(--radius-xl)] shadow-[var(--shadow-dropdown)] overflow-hidden">
          <div className="py-1">
            <Link
              href="/dashboard/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
            >
              <Settings size={15} className="text-muted" />
              Einstellungen
            </Link>
            <Link
              href="/dashboard/account/billing"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
            >
              <CreditCard size={15} className="text-muted" />
              {subscriptionsEnabled ? 'Abrechnung & Abo' : 'Mitgliedschaft & Credits'}
            </Link>
          </div>
          <div className="border-t border-border py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
            >
              <LogOut size={15} />
              Abmelden
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// NAV ITEM COMPONENT
// ═══════════════════════════════════════════════════════════

function NavItem({
  href,
  icon: Icon,
  label,
  isActive,
  locked,
  comingSoon,
  onClick,
  description,
  badge,
}: {
  href?: string
  icon: React.ElementType
  label: string
  isActive?: boolean
  /** Sperrt den Eintrag (Lock-Icon, eventuell href = Upgrade-Page). */
  locked?: boolean
  /** "Coming Soon"-Sperre — nicht klickbar, zeigt "Bald verfügbar"-Badge. */
  comingSoon?: boolean
  onClick?: () => void
  description?: string
  badge?: number
}) {
  const isDisabled = locked || comingSoon
  const baseClass = `flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-lg)] text-sm transition-all w-full text-left ${
    isActive
      ? 'bg-primary/12 text-primary font-medium'
      : 'text-muted hover:bg-surface-hover hover:text-foreground'
  } ${isDisabled ? 'opacity-60' : ''} ${comingSoon ? 'cursor-not-allowed' : ''}`

  const content = (
    <>
      <Icon size={18} className={isActive ? 'text-primary' : 'text-muted-light'} />
      <div className="flex-1 min-w-0">
        <span className="truncate block">{label}</span>
        {description && (
          <span className="text-xs text-muted truncate block mt-0.5">{description}</span>
        )}
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold shrink-0">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {comingSoon ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 shrink-0">
          Soon
        </span>
      ) : locked ? (
        <Lock size={14} className="text-muted shrink-0" />
      ) : null}
    </>
  )

  // Coming Soon: NICHT klickbar — als button ohne Handler rendern
  if (comingSoon) {
    return (
      <button
        type="button"
        disabled
        className={baseClass}
        title="Bald verfügbar"
      >
        {content}
      </button>
    )
  }

  // If locked with an href (upgrade link), render as Link
  if (locked && href) {
    return <Link href={href} className={baseClass}>{content}</Link>
  }

  // If onClick is provided and not locked, render as button
  if (onClick && !locked) {
    return <button type="button" className={baseClass} onClick={onClick}>{content}</button>
  }

  // Default: render as Link
  return (
    <Link href={href ?? '#'} className={baseClass}>
      {content}
    </Link>
  )
}

// ═══════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wider px-3 mb-2 mt-5 first:mt-0">
      {label}
    </h3>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN SIDEBAR
// ═══════════════════════════════════════════════════════════

function MainSidebar({
  isAdmin,
  realIsAdmin,
  states,
  newTicketCount,
  helpUnreadCount,
  pathname,
  onDrillDown,
}: {
  isAdmin?: boolean
  realIsAdmin?: boolean
  states?: Record<FeatureKey, FeatureState>
  newTicketCount?: number
  helpUnreadCount?: number
  pathname: string
  onDrillDown: (mode: SidebarMode) => void
}) {
  // Sidebar-Lock-Logik (NEU): unterscheidet drei Zust\u00e4nde.
  //   - 'upgrade'     \u2192 User kann reinklicken zur Upgrade-/Community-Page
  //   - 'coming_soon' \u2192 Eintrag NICHT klickbar (Soon-Badge statt Lock)
  //   - null          \u2192 frei
  // Admin sieht alles frei (kein Lock).
  type NavLock = 'upgrade' | 'coming_soon' | null
  const getNavLock = (feature: FeatureKey): NavLock => {
    if (isAdmin) return null
    const state = states?.[feature]
    if (!state) return null
    if (state === 'coming_soon') return 'coming_soon'
    if (requiresUpgrade(state)) return 'upgrade'
    return null
  }

  const classroomLock = getNavLock('classroom')
  const chatLock = getNavLock('chat')
  const toolboxLock = getNavLock('toolbox')

  // Backwards-compat-Helper f\u00fcr die NavItem-Calls weiter unten.
  const classroomLocked = classroomLock === 'upgrade'
  const chatLocked = chatLock === 'upgrade'
  const toolboxLocked = toolboxLock === 'upgrade'
  const classroomComingSoon = classroomLock === 'coming_soon'
  const chatComingSoon = chatLock === 'coming_soon'
  const toolboxComingSoon = toolboxLock === 'coming_soon'

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <SectionHeader label="Navigation" />

      <div className="space-y-1">
        <NavItem
          href="/dashboard"
          icon={LayoutDashboard}
          label="Dashboard"
          isActive={pathname === '/dashboard'}
        />
        <NavItem
          icon={GraduationCap}
          label="Classroom"
          isActive={pathname.startsWith('/dashboard/classroom')}
          locked={classroomLocked}
          comingSoon={classroomComingSoon}
          onClick={() => (classroomLocked || classroomComingSoon) ? undefined : onDrillDown('classroom')}
          href={classroomLocked ? '/dashboard/upgrade?feature=classroom' : undefined}
        />
        <NavItem
          icon={Bot}
          label="UPRO AI Lab"
          isActive={pathname.startsWith('/dashboard/ai-workspace')}
          locked={chatLocked}
          comingSoon={chatComingSoon}
          onClick={() => (chatLocked || chatComingSoon) ? undefined : onDrillDown('chat')}
          href={chatLocked ? '/dashboard/upgrade?feature=chat' : undefined}
        />
        <NavItem
          icon={Wrench}
          label="KI Toolbox"
          isActive={pathname.startsWith('/dashboard/ki-toolbox')}
          locked={toolboxLocked}
          comingSoon={toolboxComingSoon}
          onClick={() => (toolboxLocked || toolboxComingSoon) ? undefined : onDrillDown('toolbox')}
          href={toolboxLocked ? '/dashboard/upgrade?feature=toolbox' : undefined}
        />
        <NavItem
          icon={MessageCircleQuestion}
          label="Hilfe & Kontakt"
          isActive={pathname.startsWith('/dashboard/help')}
          onClick={() => onDrillDown('help')}
          badge={helpUnreadCount}
        />
      </div>

      {realIsAdmin && (
        <>
          <SectionHeader label="Administration" />
          <div className="space-y-1">
            <NavItem
              icon={Shield}
              label="Admin-Bereich"
              isActive={pathname.startsWith('/admin')}
              onClick={() => onDrillDown('admin')}
              badge={newTicketCount}
            />
          </div>
        </>
      )}
    </nav>
  )
}

// ═══════════════════════════════════════════════════════════
// VIEW-AS SWITCHER (Admin only)
// ═══════════════════════════════════════════════════════════

const VIEW_AS_LABELS: Record<ViewAsMode, { label: string; hint: string; dot: string }> = {
  admin:   { label: 'Admin-Modus',      hint: 'Voller Zugriff',              dot: 'bg-primary' },
  premium: { label: 'Community',        hint: 'Als Premium-User',            dot: 'bg-green-500' },
  alumni:  { label: 'Alumni',           hint: 'Ehemaliges Mitglied',         dot: 'bg-amber-500' },
  basic:   { label: 'Basic',            hint: 'Free-User, alles gesperrt',   dot: 'bg-muted' },
}

function ViewAsSwitcher({ current }: { current: ViewAsMode }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<ViewAsMode | null>(null)
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const select = async (tier: ViewAsMode) => {
    if (tier === current) { setOpen(false); return }
    setLoading(tier)
    await fetch('/api/admin/view-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    })
    setLoading(null)
    setOpen(false)
    router.refresh()
  }

  const currentMeta = VIEW_AS_LABELS[current]
  const isImpersonating = current !== 'admin'

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] text-sm w-full text-left transition-all border ${
          isImpersonating
            ? 'bg-primary/5 border-primary/30 text-foreground hover:bg-primary/10'
            : 'border-transparent text-muted hover:bg-surface-hover hover:text-foreground'
        }`}
      >
        <Eye size={15} className={isImpersonating ? 'text-primary shrink-0' : 'text-muted shrink-0'} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold leading-none mb-0.5">
            Ansicht als
          </div>
          <div className="text-xs font-medium truncate flex items-center gap-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${currentMeta.dot}`} />
            {currentMeta.label}
          </div>
        </div>
        <ChevronDown size={13} className={`text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-surface border border-border rounded-[var(--radius-xl)] shadow-[var(--shadow-dropdown)] overflow-hidden py-1">
          {VIEW_AS_OPTIONS.map((opt) => {
            const meta = VIEW_AS_LABELS[opt]
            const isActive = opt === current
            return (
              <button
                key={opt}
                type="button"
                onClick={() => select(opt)}
                disabled={loading !== null}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                  isActive ? 'bg-primary/10 text-foreground' : 'text-foreground hover:bg-surface-hover'
                } disabled:opacity-50`}
              >
                <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-xs">{meta.label}</div>
                  <div className="text-[10px] text-muted truncate">{meta.hint}</div>
                </div>
                {loading === opt && <span className="text-xs text-muted">…</span>}
                {isActive && loading === null && <span className="text-xs text-primary">●</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// CHAT SIDEBAR (Drill-Down Modus 2)
// ═══════════════════════════════════════════════════════════

function ChatSidebar({
  conversations,
  archivedConversations = [],
  pathname,
  onBack,
  isAdmin,
  onDrillDown,
}: {
  conversations: Conversation[]
  archivedConversations?: Conversation[]
  pathname: string
  onBack: () => void
  isAdmin?: boolean
  onDrillDown: (mode: SidebarMode) => void
}) {
  const router = useRouter()
  const [startingAgent, setStartingAgent] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const startAgentChat = async (agentId: string) => {
    if (startingAgent) return
    setStartingAgent(agentId)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: conv } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          agent_id: agentId,
          title: 'Neue Unterhaltung',
        })
        .select('id')
        .single()

      if (conv) {
        router.push(`/dashboard/ai-workspace/${conv.id}`)
      }
    } catch (e) {
      console.error('Chat start error:', e)
    } finally {
      setStartingAgent(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-3 text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors border-b border-border"
      >
        <ChevronLeft size={16} />
        <span>Zurück zur Übersicht</span>
      </button>

      {/* New Chat */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/dashboard/ai-workspace"
          className="btn-primary w-full justify-center"
        >
          <Plus size={16} />
          Neuer Chat
        </Link>
      </div>

      {/* Agents */}
      <div className="px-3 py-2">
        <SectionHeader label="Agenten" />
        <div className="space-y-1">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => startAgentChat(agent.id)}
              disabled={!!startingAgent}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors text-left disabled:opacity-60 ${
                'text-muted hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <span className="text-base shrink-0">{agent.emoji}</span>
              <span className="truncate">{agent.name}</span>
              {startingAgent === agent.id && (
                <Loader2 size={12} className="ml-auto animate-spin shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Chats */}
      {conversations.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <SectionHeader label="Letzte Chats" />
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={pathname.includes(conv.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Archiv — kollabiert, expandiert nur on click */}
      {archivedConversations.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <button
            onClick={() => setArchiveOpen(!archiveOpen)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs uppercase tracking-wider text-muted hover:text-foreground transition-colors rounded-[var(--radius-md)] hover:bg-surface-hover"
          >
            <span className="inline-flex items-center gap-1.5">
              <ChevronDown
                size={12}
                className={`transition-transform ${archiveOpen ? '' : '-rotate-90'}`}
              />
              Archiv ({archivedConversations.length})
            </span>
          </button>
          {archiveOpen && (
            <div className="space-y-0.5 mt-1">
              {archivedConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  isActive={pathname.includes(conv.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin Quick-Link */}
      {isAdmin && (
        <div className="px-3 py-2 border-t border-border mt-auto">
          <NavItem
            icon={Shield}
            label="Admin-Bereich"
            isActive={false}
            onClick={() => onDrillDown('admin')}
          />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// HELP SIDEBAR (Drill-Down: Hilfe & Kontakt)
// ═══════════════════════════════════════════════════════════

function HelpSidebar({
  helpConversations,
  onBack,
  onNewChat,
}: {
  helpConversations: Conversation[]
  pathname: string
  onBack: () => void
  onNewChat: () => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const update = () => {
      setActiveId(new URLSearchParams(window.location.search).get('chat'))
    }
    update()
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const current = new URLSearchParams(window.location.search).get('chat')
      if (current !== activeId) setActiveId(current)
    }, 200)
    return () => clearInterval(interval)
  }, [activeId])

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-3 text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors border-b border-border"
      >
        <ChevronLeft size={16} />
        <span>Zurück zur Übersicht</span>
      </button>

      {/* Neuer Chat — oben prominent */}
      <div className="px-3 pt-4 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="btn-primary w-full justify-center"
        >
          <Plus size={16} />
          Neue Anfrage
        </button>
      </div>

      {helpConversations.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <SectionHeader label="Letzte Anfragen" />
          <div className="space-y-0.5">
            {helpConversations.map((conv) => (
              <HelpConversationItem
                key={conv.id}
                conv={conv}
                isActive={activeId === conv.id}
              />
            ))}
          </div>
        </div>
      )}

      {helpConversations.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-muted leading-relaxed">
            Deine Anfragen erscheinen hier, sobald du den ersten Chat startest.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Eine einzelne Anfrage mit Rename + Delete ─────────────────────────────

function HelpConversationItem({
  conv,
  isActive,
}: {
  conv: Conversation
  isActive: boolean
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [title, setTitle] = useState(conv.title ?? 'Anfrage')
  const [loading, setLoading] = useState<'rename' | 'delete' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  useEffect(() => {
    setTitle(conv.title ?? 'Anfrage')
  }, [conv.title])

  const handleRename = async () => {
    const trimmed = title.trim()
    if (!trimmed || trimmed === conv.title) {
      setIsRenaming(false)
      return
    }
    setLoading('rename')
    const supabase = createClient()
    await supabase.from('conversations').update({ title: trimmed }).eq('id', conv.id)
    setLoading(null)
    setIsRenaming(false)
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm('Diese Anfrage wirklich löschen?')) return
    setLoading('delete')
    const supabase = createClient()
    await supabase.from('conversations').delete().eq('id', conv.id)
    setLoading(null)
    setMenuOpen(false)
    const activeId = new URLSearchParams(window.location.search).get('chat')
    if (activeId === conv.id) router.push('/dashboard/help')
    router.refresh()
  }

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-base shrink-0">💬</span>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename()
            if (e.key === 'Escape') { setIsRenaming(false); setTitle(conv.title ?? 'Anfrage') }
          }}
          onBlur={handleRename}
          className="flex-1 text-sm px-2 py-1 border border-primary/40 rounded-[var(--radius-sm)] bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    )
  }

  const hasUnread = !!conv.user_has_unread

  return (
    <div className={`group relative flex items-center rounded-[var(--radius-md)] transition-colors ${
      isActive ? 'bg-primary/10' : 'hover:bg-surface-hover'
    }`}>
      <Link
        href={`/dashboard/help?chat=${conv.id}`}
        className={`flex-1 min-w-0 flex items-center gap-3 px-3 py-2 text-sm pr-8 ${
          isActive ? 'text-foreground font-medium' : hasUnread ? 'text-foreground font-medium' : 'text-muted group-hover:text-foreground'
        }`}
      >
        <span className="text-base shrink-0 relative">
          💬
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-surface" />
          )}
        </span>
        <span className="truncate flex-1 min-w-0">{conv.title ?? 'Anfrage'}</span>
      </Link>

      <div ref={menuRef}>
        <HelpItemMenuButton
          open={menuOpen}
          setOpen={setMenuOpen}
          onRename={() => { setIsRenaming(true); setMenuOpen(false) }}
          onDelete={handleDelete}
          loading={loading}
        />
      </div>
    </div>
  )
}

// Menu-Button + Portal-Dropdown das nicht von overflow-hidden abgeschnitten wird.
// Dropdown \u00f6ffnet nach unten, klappt nach oben wenn nicht genug Platz.
function HelpItemMenuButton({
  open,
  setOpen,
  onRename,
  onDelete,
  loading,
}: {
  open: boolean
  setOpen: (b: boolean) => void
  onRename: () => void
  onDelete: () => void
  loading: 'rename' | 'delete' | null
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number; openUp: boolean } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const update = () => {
      if (!btnRef.current) return
      const rect = btnRef.current.getBoundingClientRect()
      const menuHeight = 88 // gr\u00f6\u00dfer als eigentliche H\u00f6he, f\u00fcr Sicherheit
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < menuHeight + 16
      setPos({
        top: openUp ? rect.top - 6 : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        openUp,
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-all absolute right-1 top-1/2 -translate-y-1/2"
        aria-label="Optionen"
      >
        <MoreVertical size={14} />
      </button>

      {mounted && open && pos && createPortal(
        <div
          className="fixed z-[100] bg-surface border border-border rounded-[var(--radius-lg)] shadow-[var(--shadow-dropdown)] py-1 min-w-[150px]"
          style={{
            top: pos.openUp ? undefined : pos.top,
            bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
            right: pos.right,
          }}
        >
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRename() }}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-surface-hover transition-colors"
          >
            Umbenennen
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete() }}
            disabled={loading !== null}
            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
          >
            {loading === 'delete' ? 'Lösche…' : 'Löschen'}
          </button>
        </div>,
        document.body
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// ADMIN SIDEBAR (Drill-Down Modus 3)
// ═══════════════════════════════════════════════════════════

function AdminSidebar({
  pathname,
  onBack,
  newTicketCount,
}: {
  pathname: string
  onBack: () => void
  newTicketCount?: number
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-3 text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors border-b border-border w-full"
      >
        <ChevronLeft size={16} />
        <span>Zurück zur Übersicht</span>
      </button>

      <nav className="px-3 py-4">
        <SectionHeader label="Übersicht" />
        <div className="space-y-1">
          <NavItem
            href="/admin"
            icon={BarChart3}
            label="Dashboard & KPIs"
            description="Statistiken, Wachstum, Aktivität"
            isActive={pathname === '/admin' || pathname === '/admin/dashboard'}
          />
        </div>

        <SectionHeader label="Nutzer" />
        <div className="space-y-1">
          <NavItem
            href="/admin/users"
            icon={Users}
            label="Nutzerverwaltung"
            description="Alle User, Suche, CSV-Import"
            isActive={pathname.startsWith('/admin/users')}
          />
          <NavItem
            href="/admin/groups"
            icon={Lock}
            label="Gruppen & Rechte"
            description="Matrix + Upsell-Texte"
            isActive={pathname.startsWith('/admin/groups')}
          />
          <NavItem
            href="/admin/newsletter"
            icon={Mail}
            label="Newsletter"
            description="Coming-Soon-Signups + Einladungen"
            isActive={pathname.startsWith('/admin/newsletter')}
          />
          <NavItem
            href="/admin/community"
            icon={Users}
            label="Club-Mitglieder"
            description="Skool-Sync + Einladungen"
            isActive={pathname.startsWith('/admin/community')}
          />
        </div>

        <SectionHeader label="Inhalte" />
        <div className="space-y-1">
          <NavItem
            href="/admin/content/modules"
            icon={BookOpen}
            label="Classroom-Module"
            description="Lern-Module + Video-Zuordnung"
            isActive={pathname.startsWith('/admin/content/modules')}
          />
          <NavItem
            href="/admin/content/agents"
            icon={Bot}
            label="Assistenten verwalten"
            description="Agenten, System-Prompts"
            isActive={pathname.startsWith('/admin/content/agents')}
          />
          <NavItem
            href="/admin/content/knowledge"
            icon={BookOpen}
            label="Wissensbasis"
            description="Video-Chunks, Zuordnung"
            isActive={pathname.startsWith('/admin/content/knowledge')}
          />
          <NavItem
            href="/admin/content/tools"
            icon={Wrench}
            label="Tech-Stack"
            description="Tools pro Assistent"
            isActive={pathname.startsWith('/admin/content/tools')}
          />
          <NavItem
            href="/admin/content/toolbox"
            icon={Wrench}
            label="KI Toolbox"
            description="Reihenfolge + Coming-Soon"
            isActive={pathname.startsWith('/admin/content/toolbox')}
          />
          <NavItem
            href="/admin/content/videos"
            icon={Film}
            label="Video-Sync"
            description="Wistia-Status, Transkriptionen"
            isActive={pathname.startsWith('/admin/content/videos')}
          />
        </div>

        <SectionHeader label="Monetarisierung" />
        <div className="space-y-1">
          <NavItem
            href="/admin/monetization/settings"
            icon={SlidersHorizontal}
            label="Modus & Defaults"
            description="Abo an/aus, Fallback-Credits"
            isActive={pathname.startsWith('/admin/monetization/settings')}
          />
          <NavItem
            href="/admin/monetization/plans"
            icon={CreditCard}
            label="Abo-Pläne"
            description="S/M/L Preise, Credits, Ablefy"
            isActive={pathname.startsWith('/admin/monetization/plans')}
          />
          <NavItem
            href="/admin/monetization/credits"
            icon={Coins}
            label="Credits"
            description="Kosten pro Aktion, Top-ups"
            isActive={pathname.startsWith('/admin/monetization/credits')}
          />
        </div>

        <SectionHeader label="Kommunikation" />
        <div className="space-y-1">
          <NavItem
            href="/admin/emails"
            icon={Mail}
            label="E-Mail-Templates"
            description="Texte aller System-Mails anpassen"
            isActive={pathname.startsWith('/admin/emails')}
          />
        </div>

        <SectionHeader label="Support" />
        <div className="space-y-1">
          <NavItem
            href="/admin/tickets"
            icon={Ticket}
            label="Support-Tickets"
            description="Anfragen, Verlauf, Antworten"
            isActive={pathname.startsWith('/admin/tickets')}
            badge={newTicketCount}
          />
        </div>
      </nav>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// CLASSROOM SIDEBAR (Drill-Down Modus 4) — loads real modules from DB
// ═══════════════════════════════════════════════════════════

interface ModuleNavItem {
  id: string
  title: string
  slug: string
  emoji: string
}

function ClassroomSidebar({
  pathname,
  onBack,
  isAdmin,
  onDrillDown,
}: {
  pathname: string
  onBack: () => void
  isAdmin?: boolean
  onDrillDown: (mode: SidebarMode) => void
}) {
  const [modules, setModules] = useState<ModuleNavItem[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('course_modules')
      .select('id, title, slug, emoji')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setModules(data as ModuleNavItem[])
      })
  }, [])

  return (
    <div className="flex-1 overflow-y-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-3 text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors border-b border-border w-full text-left"
      >
        <ChevronLeft size={16} />
        <span>Zurück zur Übersicht</span>
      </button>

      <nav className="px-3 py-4">
        <SectionHeader label="Classroom" />
        <div className="space-y-1">
          <NavItem
            href="/dashboard/classroom"
            icon={Search}
            label="Alle Module"
            isActive={pathname === '/dashboard/classroom'}
          />
        </div>

        {modules.length > 0 && (
          <>
            <SectionHeader label="Module" />
            <div className="space-y-1">
              {modules.map((m) => (
                <Link
                  key={m.id}
                  href={`/dashboard/classroom/${m.slug}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors ${
                    pathname === `/dashboard/classroom/${m.slug}`
                      ? 'bg-primary/10 text-foreground font-medium'
                      : 'text-muted hover:bg-surface-hover hover:text-foreground'
                  }`}
                >
                  <span className="text-base shrink-0">{m.emoji}</span>
                  <span className="truncate">{m.title}</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Admin Quick-Link */}
        {isAdmin && (
          <>
            <SectionHeader label="Admin" />
            <div className="space-y-1">
              <NavItem icon={Shield} label="Admin-Bereich" isActive={false} onClick={() => onDrillDown('admin')} />
            </div>
          </>
        )}
      </nav>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// TOOLBOX SIDEBAR (Drill-Down Modus 5)
// ═══════════════════════════════════════════════════════════

function ToolboxNavItem({
  tool,
  isActive,
  bypassComingSoon,
}: {
  tool: ToolboxTool
  isActive: boolean
  /** Echte Admins (nicht im Testmodus) ignorieren Coming-Soon-Locks. */
  bypassComingSoon?: boolean
}) {
  const Icon = resolveToolboxIcon(tool.icon_name)
  const showComingSoon = tool.coming_soon && !bypassComingSoon
  const disabled = showComingSoon || !tool.href

  const content = (
    <>
      <Icon size={18} className={isActive ? 'text-primary' : 'text-muted-light'} />
      <div className="flex-1 min-w-0">
        <span className="truncate block">{tool.title}</span>
        {showComingSoon ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider mt-0.5 text-amber-600 dark:text-amber-400">
            <Clock size={9} /> Coming Soon
          </span>
        ) : tool.subtitle ? (
          <span className="text-xs text-muted truncate block mt-0.5">{tool.subtitle}</span>
        ) : null}
      </div>
    </>
  )

  const baseClass = `flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-lg)] text-sm transition-all w-full text-left ${
    isActive
      ? 'bg-primary/12 text-primary font-medium'
      : 'text-muted hover:bg-surface-hover hover:text-foreground'
  } ${disabled ? 'opacity-60 cursor-not-allowed hover:bg-transparent hover:text-muted' : ''}`

  if (disabled) {
    return (
      <div className={baseClass} aria-disabled="true">
        {content}
      </div>
    )
  }

  return (
    <Link href={tool.href!} className={baseClass}>
      {content}
    </Link>
  )
}

function ToolboxSidebar({
  pathname,
  onBack,
  isAdmin,
  bypassComingSoon,
  onDrillDown,
}: {
  pathname: string
  onBack: () => void
  isAdmin?: boolean
  /** Echte Admins (nicht im Testmodus) sehen Coming-Soon-Tools als klickbar. */
  bypassComingSoon?: boolean
  onDrillDown: (mode: SidebarMode) => void
}) {
  const [tools, setTools] = useState<ToolboxTool[]>([])

  // Tools werden bei jedem Pathname-Wechsel neu geladen — sonst sieht der
  // User nach Admin-Edit (z.B. Coming-Soon-Toggle) den alten Status weiter,
  // bis er einen Hard-Reload macht. pathname als Dependency sorgt dafür
  // dass beim Navigieren zwischen Admin und Toolbox die Liste frisch ist.
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('toolbox_tools')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setTools(data as ToolboxTool[])
      })
  }, [pathname])

  return (
    <div className="flex-1 overflow-y-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-3 text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors border-b border-border w-full text-left"
      >
        <ChevronLeft size={16} />
        <span>Zurück zur Übersicht</span>
      </button>

      <nav className="px-3 py-4">
        <SectionHeader label="Verfügbare Tools" />
        <div className="space-y-1">
          {tools.map((tool) => (
            <ToolboxNavItem
              key={tool.id}
              tool={tool}
              isActive={!!tool.href && pathname.startsWith(tool.href)}
              bypassComingSoon={bypassComingSoon}
            />
          ))}
        </div>

        <SectionHeader label="Übersicht" />
        <div className="space-y-1">
          <NavItem
            href="/dashboard/ki-toolbox"
            icon={Wrench}
            label="Alle Tools anzeigen"
            isActive={pathname === '/dashboard/ki-toolbox'}
          />
        </div>

        {/* Admin Quick-Link */}
        {isAdmin && (
          <>
            <SectionHeader label="Admin" />
            <div className="space-y-1">
              <NavItem icon={Shield} label="Admin-Bereich" isActive={false} onClick={() => onDrillDown('admin')} />
            </div>
          </>
        )}
      </nav>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN SIDEBAR EXPORT
// ═══════════════════════════════════════════════════════════

export function Sidebar({ conversations, archivedConversations = [], userEmail, userName, isAdmin, realIsAdmin, accessTier, viewAs, states, newTicketCount, helpUnreadCount, subscriptionsEnabled = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  // Determine sidebar mode from URL
  const autoMode = useMemo<SidebarMode>(() => {
    if (pathname.startsWith('/admin')) return 'admin'
    if (pathname.startsWith('/dashboard/ai-workspace')) return 'chat'
    if (pathname.startsWith('/dashboard/classroom')) return 'classroom'
    if (pathname.startsWith('/dashboard/ki-toolbox')) return 'toolbox'
    if (pathname.startsWith('/dashboard/help')) return 'help'
    return 'main'
  }, [pathname])

  const [mode, setMode] = useState<SidebarMode>(autoMode)

  // Sync mode with URL changes
  useEffect(() => {
    setMode(autoMode)
  }, [autoMode])

  const handleDrillDown = (newMode: SidebarMode) => {
    setMode(newMode)
    if (newMode === 'chat') router.push('/dashboard/ai-workspace')
    if (newMode === 'admin') router.push('/admin')
    if (newMode === 'classroom') router.push('/dashboard/classroom')
    if (newMode === 'toolbox') router.push('/dashboard/ki-toolbox')
    if (newMode === 'help') router.push('/dashboard/help')
  }

  const handleNewHelpChat = async () => {
    // Neuen Help-Chat anlegen via API, dann dorthin navigieren
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, agent_id: 'help', title: 'Neue Anfrage' })
      .select('id')
      .single()
    if (newConv?.id) {
      router.push(`/dashboard/help?chat=${newConv.id}`)
      router.refresh()
    }
  }

  const handleBack = () => {
    setMode('main')
    router.push('/dashboard')
  }

  return (
    <aside className="w-72 bg-surface border-r border-border flex flex-col h-full shrink-0 shadow-[var(--shadow-sidebar)]">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 flex items-center">
        <Link href="/dashboard" className="block">
          <img
            src="/logo.svg"
            alt="UPRO AI Lab"
            className="h-6 w-auto object-contain"
          />
        </Link>
      </div>

      {/* Content — animated slide between modes */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className="absolute inset-0 overflow-y-auto transition-transform duration-200 ease-in-out"
          style={{
            transform: mode === 'main' ? 'translateX(0)' : 'translateX(-100%)',
            visibility: mode === 'main' ? 'visible' : 'hidden',
            pointerEvents: mode === 'main' ? 'auto' : 'none',
          }}
        >
          <MainSidebar
            isAdmin={isAdmin}
            realIsAdmin={realIsAdmin}
            states={states}
            newTicketCount={newTicketCount}
            helpUnreadCount={helpUnreadCount}
            pathname={pathname}
            onDrillDown={handleDrillDown}
          />
        </div>

        <div
          className="absolute inset-0 overflow-y-auto transition-transform duration-200 ease-in-out"
          style={{
            transform: mode === 'chat' ? 'translateX(0)' : 'translateX(100%)',
            visibility: mode === 'chat' ? 'visible' : 'hidden',
            pointerEvents: mode === 'chat' ? 'auto' : 'none',
          }}
        >
          <ChatSidebar
            conversations={conversations}
            archivedConversations={archivedConversations}
            pathname={pathname}
            onBack={handleBack}
            isAdmin={realIsAdmin}
            onDrillDown={handleDrillDown}
          />
        </div>

        <div
          className="absolute inset-0 overflow-y-auto transition-transform duration-200 ease-in-out"
          style={{
            transform: mode === 'admin' ? 'translateX(0)' : 'translateX(100%)',
            visibility: mode === 'admin' ? 'visible' : 'hidden',
            pointerEvents: mode === 'admin' ? 'auto' : 'none',
          }}
        >
          <AdminSidebar pathname={pathname} onBack={handleBack} newTicketCount={newTicketCount} />
        </div>

        <div
          className="absolute inset-0 overflow-y-auto transition-transform duration-200 ease-in-out"
          style={{
            transform: mode === 'classroom' ? 'translateX(0)' : 'translateX(100%)',
            visibility: mode === 'classroom' ? 'visible' : 'hidden',
            pointerEvents: mode === 'classroom' ? 'auto' : 'none',
          }}
        >
          <ClassroomSidebar pathname={pathname} onBack={handleBack} isAdmin={realIsAdmin} onDrillDown={handleDrillDown} />
        </div>

        <div
          className="absolute inset-0 overflow-y-auto transition-transform duration-200 ease-in-out"
          style={{
            transform: mode === 'toolbox' ? 'translateX(0)' : 'translateX(100%)',
            visibility: mode === 'toolbox' ? 'visible' : 'hidden',
            pointerEvents: mode === 'toolbox' ? 'auto' : 'none',
          }}
        >
          <ToolboxSidebar pathname={pathname} onBack={handleBack} isAdmin={realIsAdmin} bypassComingSoon={isAdmin} onDrillDown={handleDrillDown} />
        </div>

        <div
          className="absolute inset-0 overflow-y-auto transition-transform duration-200 ease-in-out"
          style={{
            transform: mode === 'help' ? 'translateX(0)' : 'translateX(100%)',
            visibility: mode === 'help' ? 'visible' : 'hidden',
            pointerEvents: mode === 'help' ? 'auto' : 'none',
          }}
        >
          <HelpSidebar
            helpConversations={conversations.filter((c) => c.agent_id === 'help')}
            pathname={pathname}
            onBack={handleBack}
            onNewChat={handleNewHelpChat}
          />
        </div>
      </div>

      {/* View-As Switcher — persistent f\u00fcr Admins (immer sichtbar) */}
      {realIsAdmin && (
        <div className="border-t border-border px-3 py-2">
          <ViewAsSwitcher current={viewAs ?? 'admin'} />
        </div>
      )}

      {/* Bottom — Theme Toggle + User Menu */}
      <div className="border-t border-border px-3 pb-2 pt-1">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* User menu */}
        <UserMenu
          userEmail={userEmail ?? ''}
          userName={userName ?? ''}
          subscriptionsEnabled={subscriptionsEnabled}
        />
      </div>
    </aside>
  )
}
