import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCommunityMemberByToken } from '@/lib/skool-sync'
import { ClaimButton } from './ClaimButton'

export const dynamic = 'force-dynamic'

export default async function SkoolClaimPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()
  const member = await getCommunityMemberByToken(admin, token)

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="bg-surface p-8 rounded-2xl shadow-sm border border-border w-full max-w-md text-center">
          <img src="/logo.svg" alt="UPRO AI Lab" className="h-8 w-auto mx-auto mb-6" />
          <h1 className="text-xl font-bold text-foreground mb-3">
            Einladung ungültig oder abgelaufen
          </h1>
          <p className="text-sm text-muted mb-6">
            Dieser Einladungs-Link ist nicht mehr gültig. Frag bei uns nach —
            wir schicken dir gerne einen neuen.
          </p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition"
          >
            Zur Anmeldung
          </Link>
        </div>
      </div>
    )
  }

  const expiryLabel = member.skool_access_expires_at
    ? new Date(member.skool_access_expires_at).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null
  const alreadyClaimed = !!member.claimed_at

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="bg-surface p-8 rounded-2xl shadow-sm border border-border w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo.svg" alt="UPRO AI Lab" className="h-8 w-auto mx-auto mb-4" />
          <div className="text-xs uppercase tracking-wider text-primary font-semibold">
            KI Marketing Club
          </div>
          <h1 className="text-xl font-bold text-foreground mt-2">
            {alreadyClaimed
              ? 'Willkommen zurück'
              : 'Dein Zugang zur UPRO AI Lab World'}
          </h1>
        </div>

        <div className="bg-surface-secondary rounded-lg p-4 mb-5 border border-border">
          <div className="text-xs text-muted mb-1">E-Mail</div>
          <div className="text-sm text-foreground font-medium">{member.email}</div>
          {member.name && (
            <>
              <div className="text-xs text-muted mt-3 mb-1">Name</div>
              <div className="text-sm text-foreground">{member.name}</div>
            </>
          )}
          {expiryLabel && (
            <>
              <div className="text-xs text-muted mt-3 mb-1">Voller Zugang bis</div>
              <div className="text-sm text-foreground">{expiryLabel}</div>
              <div className="text-xs text-muted mt-1 italic">
                Classroom bleibt danach lebenslang erhalten (Alumni-Status).
              </div>
            </>
          )}
        </div>

        {alreadyClaimed ? (
          <p className="text-sm text-muted text-center mb-4">
            Dein Account ist bereits aktiviert. Du kannst dich direkt einloggen.
          </p>
        ) : (
          <p className="text-sm text-muted text-center mb-4">
            Mit einem Klick aktivieren wir deinen Zugang und schicken dir einen
            Login-Link an <strong>{member.email}</strong>.
          </p>
        )}

        <ClaimButton token={token} alreadyClaimed={alreadyClaimed} email={member.email} />

        <p className="text-xs text-muted text-center mt-4">
          Solange du Mitglied im KI Marketing Club bist, ist der Zugang kostenlos.
        </p>
      </div>
    </div>
  )
}
