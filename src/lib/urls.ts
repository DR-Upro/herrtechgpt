// Alle ausgehenden E-Mails (Einladungen, Ticket-Benachrichtigungen, Branding-Links)
// zeigen immer auf die Live-Domain — unabhängig davon, von welcher Umgebung aus sie
// versendet werden. So landen User und Admins nie versehentlich auf Staging/Preview.
// TODO: Vor Live-Deploy auf finale Domain umstellen (z.B. lab.upro-capital.com).
export const PRODUCTION_URL = 'https://lab.upro-capital.com'

/**
 * Gibt die Basis-URL der aktuellen Umgebung zurück (für Checkout-Redirects
 * nach Stripe, Customer-Portal-Returns etc.). Reihenfolge:
 *   1. Host-Header aus dem eingehenden Request — ideal, weil es immer der
 *      Domain entspricht, auf der der User gerade ist (staging.lab.upro-capital.com /
 *      lab.upro-capital.com / Preview-URL). Verhindert Cross-Domain-Redirects
 *      nach Stripe-Checkout.
 *   2. NEXT_PUBLIC_APP_URL (explizit pro Environment gesetzt)
 *   3. VERCEL_URL (interne Vercel-Deployment-URL — kein Custom-Domain)
 *   4. PRODUCTION_URL als Fallback
 *
 * Immer mit `req` aus der API-Route aufrufen wenn möglich.
 */
export function getAppUrl(req?: Request): string {
  if (req) {
    const host = req.headers.get('host')
    const proto = req.headers.get('x-forwarded-proto') ?? 'https'
    if (host) return `${proto}://${host}`
  }

  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const vercel = process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`

  return PRODUCTION_URL
}
