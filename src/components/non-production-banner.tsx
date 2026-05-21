'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

const PRODUCTION_HOST = 'lab.upro-capital.com'

export function NonProductionBanner() {
  const [host, setHost] = useState<string | null>(null)

  useEffect(() => {
    setHost(window.location.hostname)
  }, [])

  if (!host || host === PRODUCTION_HOST) return null

  const label =
    host === 'staging.lab.upro-capital.com' ? 'STAGING'
    : host === 'localhost' || host === '127.0.0.1' ? 'LOCAL DEV'
    : 'PREVIEW'

  return (
    <div className="w-full bg-amber-500 text-black px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium border-b border-amber-600">
      <AlertTriangle size={16} />
      <span>
        Du bist auf <strong>{label}</strong> ({host}). Änderungen wirken auf die
        <strong> Live-Datenbank</strong>. Einladungs-Links zeigen immer auf{' '}
        <strong>lab.upro-capital.com</strong>.
      </span>
    </div>
  )
}
