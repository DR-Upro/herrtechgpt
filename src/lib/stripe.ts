/**
 * Stripe Server-Client
 *
 * Wird NUR server-seitig verwendet (API-Routes, Webhook-Handler, Server-Actions).
 * Niemals in Client-Components importieren — würde den Secret-Key ins Bundle packen.
 *
 * Env-Vars (in .env.local + Vercel):
 *   STRIPE_SECRET_KEY            sk_test_xxx (Test) / sk_live_xxx (Live)
 *   STRIPE_WEBHOOK_SECRET        whsec_xxx (aus Stripe-Dashboard, Webhook-Endpoint)
 *   STRIPE_PUBLISHABLE_KEY       pk_test_xxx / pk_live_xxx (client-exposed, NEXT_PUBLIC)
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (Client-Alias)
 *
 * Stripe API Version: 2025-10-29 (oder neuer). Siehe Stripe-Dashboard → Developers → API Version.
 */

import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * Lazy-Singleton des Stripe-Clients. Erst instanziieren wenn ein API-Call
 * passiert (verhindert Build-Fehler wenn ENV fehlt und Route nicht läuft).
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY fehlt. In .env.local eintragen (sk_test_xxx für Test-Mode).'
    )
  }

  _stripe = new Stripe(secretKey, {
    // API-Version pinnen (matcht die aktuell verwendete SDK-Version).
    // Beim Upgraden: zuerst im Dashboard prüfen, was sich geändert hat.
    apiVersion: '2026-03-25.dahlia',
    typescript: true,
    appInfo: {
      name: 'UPRO AI Lab World',
      url: 'https://lab.upro-capital.com',
    },
  })

  return _stripe
}

/**
 * Verifiziert eine Stripe-Webhook-Signatur. Wirft bei Manipulation.
 * Aufruf aus /api/webhooks/stripe.
 */
export function verifyWebhook(payload: string | Buffer, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET fehlt.')
  }
  return getStripe().webhooks.constructEvent(payload, signature, secret)
}
