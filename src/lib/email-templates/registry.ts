// Registry aller editierbaren E-Mail-Templates.
//
// Pro Template:
//   - key:       eindeutiger Identifier (Spalte in email_templates)
//   - label:     Anzeige im Admin-Menü
//   - group:     Gruppierung in der Übersicht
//   - trigger:   wann/wo die Mail verschickt wird (Info im Admin)
//   - variables: Liste der `{var}`-Platzhalter, die zur Render-Zeit ersetzt werden
//   - fields:    editierbare Felder (Reihenfolge bestimmt UI)
//   - defaults:  Default-Werte (Code-Fallback)
//
// Felder können `{firstName}`, `{loginLink}`, ... enthalten — die werden
// beim Rendern via `applyVariables()` ersetzt.

export type FieldKind = 'text' | 'textarea' | 'rich'

export interface TemplateField {
  key: string
  label: string
  kind: FieldKind
  hint?: string
}

export interface TemplateVariable {
  key: string
  description: string
}

export interface TemplateGroup {
  key: string
  label: string
}

export interface TemplateDefinition {
  key: string
  label: string
  group: string
  trigger: string
  preview: {
    // Beispielwerte für Variablen für Live-Preview
    [key: string]: string | number
  }
  variables: TemplateVariable[]
  fields: TemplateField[]
  defaults: {
    subject: string
    data: Record<string, string>
  }
}

export const TEMPLATE_GROUPS: TemplateGroup[] = [
  { key: 'invites', label: 'Einladungen' },
  { key: 'system', label: 'System-Benachrichtigungen' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Defaults (1:1 aus dem bisher hardcoded src/lib/email-template.ts gezogen)
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATES: TemplateDefinition[] = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    key: 'admin_invite',
    label: 'Admin-Einladung',
    group: 'invites',
    trigger:
      'Admin lädt User manuell ein — über /admin/users (einzeln, "Einladung senden") oder beim CSV-Import. Auch nach erfolgreichem Skool-Claim als zweite Mail mit Magic-Login-Link.',
    preview: { firstName: 'Maria', loginLink: 'https://lab.upro-capital.com/auth/callback?...' },
    variables: [
      { key: '{firstName}', description: 'Vorname (optional, "Hey {firstName}!" sonst "Hey!")' },
      { key: '{loginLink}', description: 'Magic-Login-Link mit Token (1× nutzbar)' },
    ],
    fields: [
      { key: 'subject', label: 'Betreff', kind: 'text' },
      { key: 'eyebrow', label: 'Kicker (kleine Headline oben)', kind: 'text' },
      { key: 'headline_top', label: 'Hauptüberschrift — Zeile 1', kind: 'text' },
      { key: 'headline_bottom', label: 'Hauptüberschrift — Zeile 2 (lila)', kind: 'text' },
      { key: 'greeting', label: 'Begrüßung (mit {firstName} möglich)', kind: 'text' },
      { key: 'intro_paragraph', label: 'Intro-Absatz', kind: 'textarea' },
      { key: 'features_intro', label: 'Einleitung über Feature-Liste', kind: 'text' },
      { key: 'cta_label', label: 'Button-Text', kind: 'text' },
      { key: 'cta_caption', label: 'Hinweis unter Button', kind: 'text' },
      { key: 'signature', label: 'Signatur', kind: 'text' },
      { key: 'ps_text', label: 'P.S.-Zeile', kind: 'textarea' },
      { key: 'footer_note', label: 'Hinweis am Ende (Link-Fallback)', kind: 'textarea' },
    ],
    defaults: {
      subject: 'Einladung in die UPRO AI Lab World',
      data: {
        eyebrow: 'Willkommen an Bord',
        headline_top: 'Deine Einladung in die',
        headline_bottom: 'UPRO AI Lab World.',
        greeting: 'Hey {firstName}!',
        intro_paragraph:
          'Schön, dass du da bist. Du bist eingeladen in die <strong>UPRO AI Lab World</strong> — deine KI-Plattform für Content, Business &amp; Wachstum.',
        features_intro: 'Was dich erwartet:',
        cta_label: 'Jetzt einloggen',
        cta_caption: 'Ein Klick, und du bist drin. Kein Passwort, kein Formular.',
        signature: 'Dein Flo',
        ps_text:
          'P.S.: Fragen oder Feedback? Schreib einfach im Hilfe-Chat in der Plattform — wir sind für dich da.',
        footer_note:
          'Falls der Button nicht funktioniert, kopiere diesen Link: {loginLink} — Der Link ist zeitlich begrenzt gültig und kann nur einmal verwendet werden.',
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    key: 'newsletter_invite',
    label: 'Newsletter-Launch',
    group: 'invites',
    trigger:
      'Bulk-Versand an Coming-Soon Newsletter-Signups via /admin/newsletter. Anders als Admin-Invite: persönlicherer Ton ("Du warst zuerst da"), Redirect auf /welcome statt /dashboard.',
    preview: { loginLink: 'https://lab.upro-capital.com/auth/callback?...' },
    variables: [
      { key: '{loginLink}', description: 'Magic-Login-Link mit Token (1× nutzbar)' },
    ],
    fields: [
      { key: 'subject', label: 'Betreff', kind: 'text' },
      { key: 'preheader', label: 'Preheader (Vorschau im Mail-Client)', kind: 'text' },
      { key: 'eyebrow', label: 'Kicker (kleine Headline oben)', kind: 'text' },
      { key: 'headline_top', label: 'Hauptüberschrift — Zeile 1', kind: 'text' },
      { key: 'headline_bottom', label: 'Hauptüberschrift — Zeile 2 (lila)', kind: 'text' },
      { key: 'greeting', label: 'Begrüßung', kind: 'text' },
      { key: 'intro_paragraph', label: 'Haupt-Absatz', kind: 'textarea' },
      { key: 'features_intro', label: 'Einleitung über Feature-Liste', kind: 'text' },
      { key: 'cta_label', label: 'Button-Text', kind: 'text' },
      { key: 'cta_caption', label: 'Hinweis unter Button', kind: 'text' },
      { key: 'signature', label: 'Signatur', kind: 'text' },
      { key: 'ps_text', label: 'P.S.-Zeile', kind: 'textarea' },
      { key: 'footer_note', label: 'Hinweis am Ende (Link-Fallback)', kind: 'textarea' },
    ],
    defaults: {
      subject: '🚀 Die UPRO AI Lab World ist offen für dich.',
      data: {
        preheader: 'Die UPRO AI Lab World ist offen für dich. Ein Klick und du bist drin.',
        eyebrow: 'Es ist soweit',
        headline_top: 'Du warst zuerst da.',
        headline_bottom: 'Jetzt bist du drin.',
        greeting: 'Hey!',
        intro_paragraph:
          'Du hast dich eingetragen, als wir noch nicht einmal live waren. Jetzt ist es soweit: Die <strong>UPRO AI Lab World</strong> ist offen — und du bist einer der Ersten, die reindürfen.',
        features_intro: 'Was dich drinnen erwartet:',
        cta_label: 'Jetzt in die UPRO AI Lab World',
        cta_caption: 'Ein Klick, und du bist drin. Kein Passwort, kein Formular.',
        signature: 'Dein Flo',
        ps_text:
          'P.S.: Wenn du wissen willst, wie wir das mit Claude gebaut haben — genau das zeigen wir dir im KI Marketing Club. 🚀',
        footer_note:
          'Falls der Button nicht funktioniert, kopiere diesen Link: {loginLink} — Der Link ist zeitlich begrenzt gültig und kann nur einmal verwendet werden.',
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    key: 'skool_active',
    label: 'Skool — aktives Mitglied',
    group: 'invites',
    trigger:
      'Bulk-Einladung an aktive KI Marketing Club Mitglieder via /admin/community. Nach Klick auf den Link wird der Account aktiviert und der User automatisch eingeloggt (Magic-Login integriert). Token 30 Tage gültig.',
    preview: {
      firstName: 'Maria',
      claimLink: 'https://lab.upro-capital.com/invite/skool/abcd1234',
      creditsPerMonth: 200,
    },
    variables: [
      { key: '{firstName}', description: 'Vorname (optional)' },
      { key: '{claimLink}', description: 'Skool-Claim-Link (Token 30 Tage gültig)' },
      { key: '{creditsPerMonth}', description: 'Credits pro Monat aus Plan S (Fallback: 200)' },
    ],
    fields: [
      { key: 'subject', label: 'Betreff', kind: 'text' },
      { key: 'preheader', label: 'Preheader', kind: 'text' },
      { key: 'eyebrow', label: 'Kicker', kind: 'text' },
      { key: 'headline_top', label: 'Hauptüberschrift — Zeile 1', kind: 'text' },
      { key: 'headline_bottom', label: 'Hauptüberschrift — Zeile 2 (lila)', kind: 'text' },
      { key: 'greeting', label: 'Begrüßung', kind: 'text' },
      { key: 'intro_paragraph', label: 'Intro-Absatz 1', kind: 'textarea' },
      { key: 'intro_paragraph_2', label: 'Intro-Absatz 2', kind: 'textarea' },
      { key: 'cta_label', label: 'Button-Text', kind: 'text' },
      { key: 'cta_caption', label: 'Hinweis unter Button', kind: 'text' },
      { key: 'info_box', label: 'Info-Box (kursiv, unter CTA)', kind: 'textarea' },
      { key: 'footer_note', label: 'Hinweis am Ende', kind: 'textarea' },
    ],
    defaults: {
      subject: 'Dein Zugang zur UPRO AI Lab World — KI Marketing Club',
      data: {
        preheader: 'Dein Zugang zur UPRO AI Lab World als KI Marketing Club Mitglied',
        eyebrow: 'Exklusiv für Club-Mitglieder',
        headline_top: 'Die UPRO AI Lab World',
        headline_bottom: 'wartet auf dich.',
        greeting: 'Hey {firstName}!',
        intro_paragraph:
          'Als Mitglied im <strong>KI Marketing Club</strong> hast du ab sofort kostenlosen Zugriff auf die <strong>UPRO AI Lab World</strong> — deine KI-Plattform mit Classroom, Chat-Agenten und der kompletten Toolbox (inkl. {creditsPerMonth} Credits/Monat).',
        intro_paragraph_2:
          'Der Zugang ist für dich <strong>gratis</strong>, solange du im Club bist.',
        cta_label: 'Jetzt Zugang aktivieren',
        cta_caption: 'Einmal klicken, Account erstellen, fertig.',
        info_box:
          'Gut zu wissen: Wenn du den Club später verlässt, bleibt dir dein Classroom-Zugang als Alumni lebenslang erhalten.',
        footer_note:
          'Falls der Button nicht funktioniert, kopiere diesen Link: {claimLink} — Der Link ist 30 Tage gültig.',
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    key: 'skool_alumni',
    label: 'Skool — Alumni',
    group: 'invites',
    trigger:
      'Einladung für Ex-Club-Mitglieder via /admin/community (Status "alumni"). Nur lebenslanger Classroom-Zugang, kein Plan S. Nach Klick auf den Link wird der Account aktiviert und der User automatisch eingeloggt (Magic-Login integriert). Token 30 Tage gültig.',
    preview: {
      firstName: 'Maria',
      claimLink: 'https://lab.upro-capital.com/invite/skool/abcd1234',
    },
    variables: [
      { key: '{firstName}', description: 'Vorname (optional)' },
      { key: '{claimLink}', description: 'Skool-Claim-Link (Token 30 Tage gültig)' },
    ],
    fields: [
      { key: 'subject', label: 'Betreff', kind: 'text' },
      { key: 'preheader', label: 'Preheader', kind: 'text' },
      { key: 'eyebrow', label: 'Kicker', kind: 'text' },
      { key: 'headline_top', label: 'Hauptüberschrift — Zeile 1', kind: 'text' },
      { key: 'headline_bottom', label: 'Hauptüberschrift — Zeile 2 (lila)', kind: 'text' },
      { key: 'greeting', label: 'Begrüßung', kind: 'text' },
      { key: 'intro_paragraph', label: 'Intro-Absatz 1', kind: 'textarea' },
      { key: 'intro_paragraph_2', label: 'Intro-Absatz 2', kind: 'textarea' },
      { key: 'cta_label', label: 'Button-Text', kind: 'text' },
      { key: 'cta_caption', label: 'Hinweis unter Button', kind: 'text' },
      { key: 'info_box', label: 'Info-Box (kursiv, unter CTA)', kind: 'textarea' },
      { key: 'footer_note', label: 'Hinweis am Ende', kind: 'textarea' },
    ],
    defaults: {
      subject: 'Dein Alumni-Zugang zur UPRO AI Lab World — Classroom lebenslang',
      data: {
        preheader: 'Dein lebenslanger Classroom-Zugang als Alumni des KI Marketing Club',
        eyebrow: 'Für Alumni des KI Marketing Club',
        headline_top: 'Dein Wissen,',
        headline_bottom: 'für immer.',
        greeting: 'Hey {firstName}!',
        intro_paragraph:
          'Du warst Mitglied im <strong>KI Marketing Club</strong>. Auch wenn dein aktiver Zugang abgelaufen ist — die Inhalte, mit denen du gelernt hast, bleiben dir <strong>lebenslang erhalten</strong>.',
        intro_paragraph_2:
          'In der <strong>UPRO AI Lab World</strong> findest du als Alumni weiterhin freien Zugriff auf den kompletten <strong>Classroom</strong>: alle Lern-Module, alle Videos, jederzeit verfügbar.',
        cta_label: 'Classroom-Zugang aktivieren',
        cta_caption: 'Einmal klicken, Account erstellen, fertig.',
        info_box:
          'Wenn du wieder wöchentliche Live-Calls, Austausch und Feedback in der Community sowie vollen Zugriff auf KI-Coaches und Toolbox haben willst, kannst du jederzeit dem KI Marketing Club erneut beitreten — und holst dir damit auch deinen Vollzugang zur UPRO AI Lab World zurück.',
        footer_note:
          'Falls der Button nicht funktioniert, kopiere diesen Link: {claimLink} — Der Link ist 30 Tage gültig.',
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    key: 'community_downgrade',
    label: 'Community-Downgrade',
    group: 'system',
    trigger:
      'Wird automatisch versendet, wenn ein User von premium → alumni/basic herabgestuft wird (z.B. Skool-Cancel oder Refund). Downgrade ist sofort wirksam — Zugriff auf Toolbox + Chat endet unmittelbar, Classroom bleibt als Alumni lebenslang erhalten.',
    preview: {},
    variables: [],
    fields: [
      { key: 'subject', label: 'Betreff', kind: 'text' },
      { key: 'heading', label: 'Hauptüberschrift', kind: 'text' },
      { key: 'intro', label: 'Intro-Text (HTML erlaubt)', kind: 'textarea' },
      { key: 'cta_label', label: 'Button-Text', kind: 'text' },
      { key: 'footer_note', label: 'Hinweis am Ende', kind: 'textarea' },
    ],
    defaults: {
      subject: 'Deine Community-Mitgliedschaft ist beendet',
      data: {
        heading: 'Deine Community-Mitgliedschaft ist beendet',
        intro:
          'Hey,<br><br>dein Zugang zum KI Marketing Club wurde beendet — der Zugriff auf UPRO AI Lab und die KI Toolbox endet damit sofort.<br><br>Dein <strong>Classroom-Zugang bleibt dir als Alumni lebenslang erhalten</strong>. Du kannst jederzeit zu den regulären Preisen neu abschließen, wenn du wieder vollen Zugriff willst.',
        cta_label: 'Neuen Plan wählen',
        footer_note: 'Keine Sorge — du verlierst keine Daten. Wir freuen uns, wenn du wiederkommst.',
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    key: 'admin_new_ticket',
    label: 'Neues Support-Ticket (an Admins)',
    group: 'system',
    trigger:
      'Geht an alle Admins, sobald ein User im Hilfe-Chat den Human-Mode aktiviert. Empfänger: alle Profile mit role="admin".',
    preview: { userEmail: 'maria@example.com' },
    variables: [
      { key: '{userEmail}', description: 'E-Mail des Users, der das Ticket geöffnet hat' },
    ],
    fields: [
      { key: 'subject', label: 'Betreff (mit {userEmail})', kind: 'text' },
      { key: 'heading', label: 'Hauptüberschrift', kind: 'text' },
      { key: 'intro', label: 'Intro-Text (HTML erlaubt, mit {userEmail})', kind: 'textarea' },
      { key: 'cta_label', label: 'Button-Text', kind: 'text' },
    ],
    defaults: {
      subject: 'Neues Support-Ticket von {userEmail}',
      data: {
        heading: 'Neues Support-Ticket',
        intro:
          '<p style="margin:0;"><strong>{userEmail}</strong> hat den Support-Chat aktiviert und wartet auf eine Antwort.</p>',
        cta_label: 'Ticket öffnen',
      },
    },
  },
]

export function getTemplate(key: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.key === key)
}

// Variablen `{key}` → value ersetzen. Werte werden NICHT escaped —
// das HTML der Templates ist bewusst editierbar (User darf <strong>, <br> etc.).
// Variablen-Werte selbst (loginLink, firstName) werden vor Übergabe escaped.
export function applyVariables(text: string, vars: Record<string, string | number | null | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    const v = vars[name]
    if (v === undefined || v === null) return ''
    return String(v)
  })
}
