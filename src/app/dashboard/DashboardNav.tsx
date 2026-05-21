'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function DashboardNav({ isPremium }: { isPremium: boolean }) {
  const pathname = usePathname()
  const isVideos = pathname === '/dashboard' || pathname.startsWith('/dashboard/video')

  return (
    <nav className="flex items-center gap-1">
      <NavLink href="/dashboard" active={isVideos}>
        🎬 Lernvideos
      </NavLink>
      {isPremium ? (
        <NavLink href="/dashboard/ai-workspace" active={false} highlight>
          🤖 KI-Workspace
        </NavLink>
      ) : (
        <NavLink href="/dashboard/upgrade" active={false} locked>
          🔒 KI-Workspace
        </NavLink>
      )}
    </nav>
  )
}

function NavLink({
  href,
  active,
  highlight,
  locked,
  children,
}: {
  href: string
  active: boolean
  highlight?: boolean
  locked?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-surface-secondary text-foreground shadow-sm'
          : highlight
            ? 'text-primary hover:bg-primary/5'
            : locked
              ? 'text-muted/60 hover:text-muted'
              : 'text-muted hover:text-foreground hover:bg-surface-secondary'
      }`}
    >
      {children}
    </Link>
  )
}
