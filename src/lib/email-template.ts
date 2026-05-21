// Gemeinsames HTML-Layout für alle ausgehenden UPRO-AI-Lab-Mails.
// Konsistentes Branding: Logo zentriert, Primärfarbe #C9A04A, kleiner Fallback-Link.
//
// Texte werden über die Registry (src/lib/email-templates/registry.ts) und die
// DB-Tabelle email_templates editierbar gehalten. Die HTML-Struktur (Layout,
// Logo, Feature-Liste) bleibt hier hardcoded — nur Texte sind editierbar.

import { PRODUCTION_URL } from './urls'
import { applyVariables } from './email-templates/registry'

// TODO Production: Logo nach R2/Supabase-Storage uploaden und URL hier eintragen.
// Lokal nutzen wir den Pfad auf der eigenen Domain (rendert nur wenn das Mail-
// Client den Host erreichen kann).
const LOGO_URL = `${PRODUCTION_URL}/logo.svg`

export interface EmailCta {
  label: string
  href: string
}

export interface RenderEmailOptions {
  // Hauptüberschrift ("Dein Login-Link", "Neues Support-Ticket", etc.)
  heading: string
  // Einführungstext direkt unter Heading (plain text oder einfaches HTML).
  intro: string
  // Optionaler CTA-Button.
  cta?: EmailCta
  // Optionaler Kleintext nach CTA (z.B. "Link ist 1 Stunde gültig")
  footerNote?: string
  // Preheader (erscheint in Mail-Client-Preview neben Subject)
  preheader?: string
}

export function renderEmail(opts: RenderEmailOptions): string {
  const preheader = opts.preheader ?? opts.intro.replace(/<[^>]+>/g, '').slice(0, 100)
  const siteUrl = PRODUCTION_URL

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(opts.heading)}</title>
  </head>
  <body style="margin:0; padding:0; background:#F5F0EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <span style="display:none; max-height:0; overflow:hidden; color:transparent;">
      ${escapeHtml(preheader)}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F0EB;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <tr>
              <td align="center" style="padding:24px 32px; background:#FDFBF7; border-bottom:1px solid #EEE8E0;">
                <a href="${siteUrl}" style="text-decoration:none;">
                  <img src="${LOGO_URL}" alt="UPRO AI Lab World" height="26" style="display:block; height:26px; width:auto; margin:0 auto;">
                </a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 32px 8px;">
                <h1 style="margin:0 0 12px; font-size:22px; line-height:1.3; color:#050505; font-weight:700; text-align:center;">
                  ${escapeHtml(opts.heading)}
                </h1>
                <div style="font-size:15px; line-height:1.6; color:#444; text-align:center;">
                  ${opts.intro}
                </div>
              </td>
            </tr>
            ${opts.cta ? `
            <tr>
              <td align="center" style="padding:16px 32px 8px;">
                <a href="${opts.cta.href}"
                   style="display:inline-block; background:#C9A04A; color:#FFFFFF; padding:12px 28px;
                          border-radius:10px; text-decoration:none; font-weight:600; font-size:15px;">
                  ${escapeHtml(opts.cta.label)}
                </a>
              </td>
            </tr>` : ''}
            ${opts.footerNote ? `
            <tr>
              <td align="center" style="padding:16px 32px 8px;">
                <div style="font-size:11px; line-height:1.5; color:#999; text-align:center;">
                  ${opts.footerNote}
                </div>
              </td>
            </tr>` : ''}
            <tr>
              <td align="center" style="padding:24px 32px 28px; border-top:1px solid #EEE8E0;">
                <div style="font-size:12px; line-height:1.5; color:#999; text-align:center;">
                  UPRO AI Lab World — Deine KI-Plattform für Content, Business &amp; Wachstum.<br>
                  <a href="${siteUrl}" style="color:#C9A04A; text-decoration:none;">${siteUrl.replace(/^https?:\/\//, '')}</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Header-Zeile (Logo) — wird in allen Hero-Templates gleich verwendet.
function renderHeader(siteUrl: string): string {
  return `
    <tr>
      <td align="center" style="padding:24px 32px; background:#FDFBF7; border-bottom:1px solid #EEE8E0;">
        <a href="${siteUrl}" style="text-decoration:none;">
          <img src="${LOGO_URL}" alt="UPRO AI Lab World" height="26" style="display:block; height:26px; width:auto; margin:0 auto;">
        </a>
      </td>
    </tr>`
}

function renderFooter(siteUrl: string): string {
  return `
    <tr>
      <td align="center" style="padding:16px 32px 24px; border-top:1px solid #EEE8E0;">
        <div style="font-size:12px; line-height:1.5; color:#999; text-align:center;">
          UPRO AI Lab World — Deine KI-Plattform für Content, Business &amp; Wachstum.<br>
          <a href="${siteUrl}" style="color:#C9A04A; text-decoration:none;">${siteUrl.replace(/^https?:\/\//, '')}</a>
        </div>
      </td>
    </tr>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Newsletter-Launch-Mail
// ─────────────────────────────────────────────────────────────────────────────

export interface NewsletterInviteOptions {
  loginLink: string
  content: Record<string, string>
}

export function renderNewsletterInviteEmail(opts: NewsletterInviteOptions): string {
  const siteUrl = PRODUCTION_URL
  const c = opts.content
  const vars = { loginLink: opts.loginLink }
  const preheader = applyVariables(c.preheader ?? '', vars)

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(applyVariables(c.headline_top + ' ' + c.headline_bottom, vars))}</title>
  </head>
  <body style="margin:0; padding:0; background:#F5F0EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <span style="display:none; max-height:0; overflow:hidden; color:transparent;">
      ${escapeHtml(preheader)}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F0EB;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            ${renderHeader(siteUrl)}

            <tr>
              <td align="left" style="padding:36px 36px 8px;">
                <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#C9A04A; font-weight:700; margin-bottom:16px;">
                  ${escapeHtml(applyVariables(c.eyebrow ?? '', vars))}
                </div>
                <h1 style="margin:0 0 16px; font-size:30px; line-height:1.15; color:#050505; font-weight:800; letter-spacing:-0.01em;">
                  ${escapeHtml(applyVariables(c.headline_top ?? '', vars))}<br>
                  <span style="color:#C9A04A;">${escapeHtml(applyVariables(c.headline_bottom ?? '', vars))}</span>
                </h1>
                <p style="margin:0 0 14px; font-size:16px; line-height:1.6; color:#333;">
                  ${applyVariables(c.greeting ?? '', vars)}
                </p>
                <p style="margin:0 0 14px; font-size:16px; line-height:1.6; color:#333;">
                  ${applyVariables(c.intro_paragraph ?? '', vars)}
                </p>
                <p style="margin:0 0 8px; font-size:16px; line-height:1.6; color:#333;">
                  ${applyVariables(c.features_intro ?? '', vars)}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:4px 36px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🎬&nbsp;&nbsp;<strong>KI Video Creator</strong> — du tippst, die KI dreht.</td></tr>
                  <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🎨&nbsp;&nbsp;<strong>Karussell-Generator</strong> — ein Klick, Instagram-Post fertig.</td></tr>
                  <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🤖&nbsp;&nbsp;<strong>6 KI-Coaches</strong> trainiert auf UPRO AI Labs Inhalten.</td></tr>
                  <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🎓&nbsp;&nbsp;<strong>Classroom</strong> mit allen Lern-Modulen.</td></tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:8px 36px 12px;">
                <a href="${opts.loginLink}"
                   style="display:inline-block; background:#C9A04A; color:#FFFFFF; padding:16px 40px;
                          border-radius:12px; text-decoration:none; font-weight:700; font-size:16px;">
                  ${escapeHtml(applyVariables(c.cta_label ?? '', vars))}
                </a>
                <div style="font-size:13px; color:#999; margin-top:12px;">
                  ${escapeHtml(applyVariables(c.cta_caption ?? '', vars))}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 36px 8px;">
                <p style="margin:0 0 12px; font-size:15px; line-height:1.6; color:#333;">
                  ${escapeHtml(applyVariables(c.signature ?? '', vars))}
                </p>
                <p style="margin:0; font-size:13px; line-height:1.55; color:#666; font-style:italic;">
                  ${applyVariables(c.ps_text ?? '', vars)}
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:24px 32px 16px; margin-top:12px; border-top:1px solid #EEE8E0;">
                <div style="font-size:11px; line-height:1.5; color:#999; text-align:center; word-break:break-all;">
                  ${applyVariables(c.footer_note ?? '', vars)}
                </div>
              </td>
            </tr>
            ${renderFooter(siteUrl)}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin-Einladung (Magic Link)
// ─────────────────────────────────────────────────────────────────────────────

export interface InviteEmailOptions {
  loginLink: string
  firstName?: string | null
  content: Record<string, string>
}

export function renderInviteEmail(opts: InviteEmailOptions): string {
  const siteUrl = PRODUCTION_URL
  const c = opts.content
  const vars = {
    loginLink: opts.loginLink,
    firstName: opts.firstName ? escapeHtml(opts.firstName) : '',
  }
  // Wenn kein firstName: "Hey {firstName}!" → "Hey!" (führende Leerzeichen weg)
  const greeting = (c.greeting ?? '').includes('{firstName}') && !opts.firstName
    ? applyVariables(c.greeting ?? '', vars).replace(/\s+!/, '!').replace(/\s+,/, ',')
    : applyVariables(c.greeting ?? '', vars)

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Willkommen in der UPRO AI Lab World</title>
  </head>
  <body style="margin:0; padding:0; background:#F5F0EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <span style="display:none; max-height:0; overflow:hidden; color:transparent;">
      Deine Einladung in die UPRO AI Lab World — ein Klick und du bist drin.
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F0EB;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            ${renderHeader(siteUrl)}

            <tr>
              <td align="left" style="padding:36px 36px 8px;">
                <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#C9A04A; font-weight:700; margin-bottom:16px;">
                  ${escapeHtml(applyVariables(c.eyebrow ?? '', vars))}
                </div>
                <h1 style="margin:0 0 16px; font-size:30px; line-height:1.15; color:#050505; font-weight:800; letter-spacing:-0.01em;">
                  ${escapeHtml(applyVariables(c.headline_top ?? '', vars))}<br>
                  <span style="color:#C9A04A;">${escapeHtml(applyVariables(c.headline_bottom ?? '', vars))}</span>
                </h1>
                <p style="margin:0 0 14px; font-size:16px; line-height:1.6; color:#333;">
                  ${greeting}
                </p>
                <p style="margin:0 0 14px; font-size:16px; line-height:1.6; color:#333;">
                  ${applyVariables(c.intro_paragraph ?? '', vars)}
                </p>
                <p style="margin:0 0 8px; font-size:16px; line-height:1.6; color:#333;">
                  ${applyVariables(c.features_intro ?? '', vars)}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:4px 36px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🎬&nbsp;&nbsp;<strong>KI Video Creator</strong> — du tippst, die KI dreht.</td></tr>
                  <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🎨&nbsp;&nbsp;<strong>Karussell-Generator</strong> — ein Klick, Instagram-Post fertig.</td></tr>
                  <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🤖&nbsp;&nbsp;<strong>6 KI-Coaches</strong> trainiert auf UPRO AI Labs Inhalten.</td></tr>
                  <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🎓&nbsp;&nbsp;<strong>Classroom</strong> mit über 170 h Lernmaterial.</td></tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:8px 36px 12px;">
                <a href="${opts.loginLink}"
                   style="display:inline-block; background:#C9A04A; color:#FFFFFF; padding:16px 40px;
                          border-radius:12px; text-decoration:none; font-weight:700; font-size:16px;">
                  ${escapeHtml(applyVariables(c.cta_label ?? '', vars))}
                </a>
                <div style="font-size:13px; color:#999; margin-top:12px;">
                  ${escapeHtml(applyVariables(c.cta_caption ?? '', vars))}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 36px 8px;">
                <p style="margin:0 0 12px; font-size:15px; line-height:1.6; color:#333;">
                  ${escapeHtml(applyVariables(c.signature ?? '', vars))}
                </p>
                <p style="margin:0; font-size:13px; line-height:1.55; color:#666; font-style:italic;">
                  ${applyVariables(c.ps_text ?? '', vars)}
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:24px 32px 16px; margin-top:12px; border-top:1px solid #EEE8E0;">
                <div style="font-size:11px; line-height:1.5; color:#999; text-align:center; word-break:break-all;">
                  ${applyVariables(c.footer_note ?? '', vars)}
                </div>
              </td>
            </tr>
            ${renderFooter(siteUrl)}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Skool-Mitglieder-Einladung (active + alumni)
// ─────────────────────────────────────────────────────────────────────────────

export interface SkoolInviteOptions {
  claimLink: string
  firstName?: string | null
  creditsPerMonth?: number | null
  mode?: 'active' | 'alumni'
  // Active-Content (für mode='active') ODER Alumni-Content (für mode='alumni')
  content: Record<string, string>
}

export function renderSkoolInviteEmail(opts: SkoolInviteOptions): string {
  const siteUrl = PRODUCTION_URL
  const c = opts.content
  const isAlumni = opts.mode === 'alumni'
  const vars = {
    claimLink: opts.claimLink,
    firstName: opts.firstName ? escapeHtml(opts.firstName) : '',
    creditsPerMonth: opts.creditsPerMonth ?? 200,
  }
  const greeting = (c.greeting ?? '').includes('{firstName}') && !opts.firstName
    ? applyVariables(c.greeting ?? '', vars).replace(/\s+!/, '!').replace(/\s+,/, ',')
    : applyVariables(c.greeting ?? '', vars)
  const preheader = applyVariables(c.preheader ?? '', vars)

  // Feature-Liste: Active hat 3 Features, Alumni hat 2 (mit Lock)
  const features = isAlumni
    ? `
      <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🎓&nbsp;&nbsp;<strong>Classroom</strong> — alle Lern-Module, lebenslang.</td></tr>
      <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#666;">🔒&nbsp;&nbsp;<strong>KI-Coaches &amp; Toolbox</strong> — exklusiv für aktive Club-Mitglieder.</td></tr>`
    : `
      <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🎓&nbsp;&nbsp;<strong>Classroom</strong> — alle Lern-Module, alle Videos.</td></tr>
      <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🤖&nbsp;&nbsp;<strong>6 KI-Coaches</strong>, trainiert auf UPRO AI Labs Inhalten.</td></tr>
      <tr><td style="padding:8px 0; font-size:15px; line-height:1.5; color:#333;">🎨&nbsp;&nbsp;<strong>Toolbox</strong> — Karussells, Video-Editor, Video-Creator.</td></tr>`

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${isAlumni ? 'Dein Alumni-Zugang zur UPRO AI Lab World' : 'Dein Zugang zur UPRO AI Lab World'}</title>
  </head>
  <body style="margin:0; padding:0; background:#F5F0EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <span style="display:none; max-height:0; overflow:hidden; color:transparent;">
      ${escapeHtml(preheader)}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F0EB;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            ${renderHeader(siteUrl)}

            <tr>
              <td align="left" style="padding:36px 36px 8px;">
                <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#C9A04A; font-weight:700; margin-bottom:16px;">
                  ${escapeHtml(applyVariables(c.eyebrow ?? '', vars))}
                </div>
                <h1 style="margin:0 0 16px; font-size:28px; line-height:1.2; color:#050505; font-weight:800; letter-spacing:-0.01em;">
                  ${escapeHtml(applyVariables(c.headline_top ?? '', vars))}<br>
                  <span style="color:#C9A04A;">${escapeHtml(applyVariables(c.headline_bottom ?? '', vars))}</span>
                </h1>
                <p style="margin:0 0 14px; font-size:16px; line-height:1.6; color:#333;">
                  ${greeting}
                </p>
                <p style="margin:0 0 14px; font-size:16px; line-height:1.6; color:#333;">
                  ${applyVariables(c.intro_paragraph ?? '', vars)}
                </p>
                ${c.intro_paragraph_2 ? `
                <p style="margin:0 0 14px; font-size:16px; line-height:1.6; color:#333;">
                  ${applyVariables(c.intro_paragraph_2, vars)}
                </p>` : ''}
              </td>
            </tr>

            <tr>
              <td style="padding:4px 36px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${features}
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:8px 36px 12px;">
                <a href="${opts.claimLink}"
                   style="display:inline-block; background:#C9A04A; color:#FFFFFF; padding:16px 40px;
                          border-radius:12px; text-decoration:none; font-weight:700; font-size:16px;">
                  ${escapeHtml(applyVariables(c.cta_label ?? '', vars))}
                </a>
                <div style="font-size:13px; color:#999; margin-top:12px;">
                  ${escapeHtml(applyVariables(c.cta_caption ?? '', vars))}
                </div>
              </td>
            </tr>

            ${c.info_box ? `
            <tr>
              <td style="padding:20px 36px 8px;">
                <p style="margin:0; font-size:13px; line-height:1.55; color:#666; font-style:italic;">
                  ${applyVariables(c.info_box, vars)}
                </p>
              </td>
            </tr>` : ''}

            <tr>
              <td align="center" style="padding:24px 32px 16px; margin-top:12px; border-top:1px solid #EEE8E0;">
                <div style="font-size:11px; line-height:1.5; color:#999; text-align:center; word-break:break-all;">
                  ${applyVariables(c.footer_note ?? '', vars)}
                </div>
              </td>
            </tr>
            ${renderFooter(siteUrl)}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
