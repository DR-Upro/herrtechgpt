@AGENTS.md

# Projekt-Steckbrief: UPRO AI Lab

## Was ist das?
Doc's privater KI-Workspace und sein Multi-Brand-Backoffice. Geforkt aus
`Startup1993/herrtechgpt` (Florians "Herr Tech GPT"), rebrandet auf UPRO
Capital und seit dem 21. Mai 2026 live unter `https://lab.upro-capital.com`.
Sechs spezialisierte KI-Assistenten (Hooks, Funnels, Automation, Prompting,
Video, Coaching), ein Classroom mit Wistia-Videos plus AssemblyAI-Transkription,
eine Toolbox mit Karussell-Generator, KI-Video-Editor und KI-Video-Creator
sowie ein Admin-Bereich mit User-Management, Monetarisierungs-Switch und
editierbaren E-Mail-Templates.

Aktueller Use-Case ist primär persönlich: Doc nutzt das Lab zur Produktion
von Inhalten und Workflows für seine Brands (EVE, Bella, Donna, Atlas Web
Studio). Multi-User-Öffnung mit Coming-Soon-Wait-List ist aktiv, eine echte
Self-Service-Registrierung müsste vor einem Public-Launch noch ausgebaut
werden.

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Framework | Next.js 16.2.1 (App Router, Turbopack) + React 19 + TypeScript strict |
| Styling | Tailwind CSS v4 mit `@theme inline` in `src/app/globals.css` |
| DB & Auth | Supabase Cloud — Projekt-Ref `mrhqsgccoujtbtqgvder`, Region eu-west-1 |
| AI | Claude via `@ai-sdk/anthropic` + `@ai-sdk/react`, OpenAI für Whisper, Anthropic Sonnet 4.5 für Klassifikation |
| Videos | Wistia (Doc's eigener Account "UPro AI") + AssemblyAI universal-2 für deutsche Transkription |
| E-Mail | Resend mit verifizierter Domain `upro-capital.com`, Supabase Custom SMTP auf Resend gemappt |
| Payments | Stripe — aktuell Test-Mode-Dummy-Keys, Live-Switch steht noch aus |
| Hosting | Vercel (Project `upro-ai-lab` im Team `drichter0177-6265`) |
| Node | v22.18.0 (Vercel-Build läuft mit pnpm@10.x) |

## URLs

| Rolle | URL |
|---|---|
| Live (Custom Domain) | `https://lab.upro-capital.com` |
| Vercel-Fallback | `https://upro-ai-lab.vercel.app` |
| Supabase-Studio | `https://supabase.com/dashboard/project/mrhqsgccoujtbtqgvder` |
| Wistia-Dashboard | `https://drichter0177.wistia.com` |
| GitHub-Repo | `https://github.com/DR-Upro/herrtechgpt` (geforkter Branch `main`) |

Vercel deployt automatisch jeden Push auf `main` direkt nach Production —
ein Staging-Branch existiert aktuell nicht. Plan-Workflow heißt also:
lokal entwickeln, committen, pushen, Vercel deployt live.

## Routen-Struktur

```
/                                   → Coming-Soon-Landing (Email-Capture für Wartelisten)
/login                              → Magic-Link-Login via Supabase Auth
/welcome                            → First-Login-Onboarding-Quiz
/auth/callback                      → Magic-Link-Token-Verify
/dashboard                          → User-Startseite
/dashboard/classroom                → Video-Bibliothek (Wistia)
/dashboard/ai-workspace             → Chat-Landing mit 6 Agenten-Karten
/dashboard/ai-workspace/[convId]    → Chat-Konversation
/dashboard/ki-toolbox               → Tool-Übersicht
/dashboard/ki-toolbox/carousel      → Instagram-Karussell-Generator
/dashboard/ki-toolbox/video-editor  → KI Video Editor (Transkript → Schnittvorschläge)
/dashboard/ki-toolbox/video-creator → SSO-Redirect zu vc.lab.upro-capital.com (Worker fehlt aktuell)
/dashboard/help                     → Hilfe-Chat + Tickets
/dashboard/account                  → Profil, Einstellungen, Dark Mode
/dashboard/path                     → Lernpfad-Anzeige

/admin                              → Admin Dashboard (KPIs)
/admin/users                        → Nutzerverwaltung
/admin/newsletter                   → Coming-Soon-Signups
/admin/groups                       → Gruppen & Rechte
/admin/content/agents               → Assistenten verwalten
/admin/content/knowledge            → Wissensbasis verwalten
/admin/content/videos               → Video-Sync-Status
/admin/monetization/settings        → Master-Switch + Defaults
/admin/tickets                      → Support-Tickets
/admin/emails                       → E-Mail-Templates editieren
```

Wichtig: die Route heißt jetzt `/dashboard/ai-workspace`, nicht mehr
`/dashboard/herr-tech-gpt`. Bei der Rebrand wurden alle Verlinkungen und
der Verzeichnis-Name umgestellt. Wenn du im Code irgendwo noch ein
`herr-tech-gpt` findest, ist das ein vergessener Rest und sollte gefixt
werden.

## Sechs KI-Agenten

Definiert in `src/lib/agents.ts`. Jeder Agent hat einen eigenen System-Prompt,
ein eigenes Emoji, eine eigene Mode (`free-chat` oder `guided`) und ein
optionales `relevant_agents`-Array auf Knowledge-Chunks. Die Agent-Themen
sind bewusst KI-Ausbildung-fokussiert (passt zu Doc's KI-Designer-Rolle),
nicht Trading.

| ID | Name | Thema |
|---|---|---|
| `content-hook` | Reach Machine | Hooks, virale Skripte, Reels/TikTok/Shorts |
| `funnel-monetization` | Sales Engine | Funnels, DM-Automation, Monetarisierung |
| `upro` | Automation Lab | Claude + n8n, Workflows, API-Chains (Default-Agent) |
| `ai-prompt` | AI Power User | Prompting, Claude Skills, KI-Workflows |
| `ai-video-studio` | AI Video Studio | Veo 3, Seedance, Kling, Higgsfield, HeyGen |
| `business-coach` | Scale Coach | Business-Strategie, Positionierung, 90-Tage-Plan |

Plus ein versteckter `help`-Agent für Plattform-Support, erreichbar über
`/dashboard/help`.

## DB-Schema (Supabase)

Die wichtigsten Tabellen aus 47 Migrations in `supabase/migrations/`:

- `profiles` — User-Profil (role, access_tier, learning_path, background, market, target_audience, offer)
- `conversations` + `messages` — Chat-Historie pro User pro Agent
- `saved_content` — gespeicherte KI-Antworten
- `knowledge_base` — Wissens-Chunks für RAG. Schema: `chunk_text`, `chunk_index`, `video_id`, `video_name`, `relevant_agents` (text[]), `source`. Postgres-FTS auf deutsche Sprachstemmung indiziert.
- `pending_transcripts` — AssemblyAI-Queue mit Status (queued, processing, completed, error)
- `agent_configs` — DB-Override für die Agenten-Definitionen, leer = Code-Defaults
- `email_templates` — Override-Texte pro Mail-Template (Subject + JSONB Felder)
- `app_settings` — globale Plattform-Settings (Master-Switches, Community-URL etc.)
- `newsletter_signups` — Coming-Soon-Email-Capture
- `community_members` — Skool-Mitglieder-Tracking (aktuell ungenutzt, Skool-Sync ist aus)
- `feature_permissions` + `tier_upsell_copy` — Permission-Matrix pro Tier
- `plans` + `credit_packs` + `feature_credit_costs` — Monetarisierungs-Konfiguration

Wichtiger Bugfix in Migration 044: die zwei ursprünglichen Admin-Policies
auf der `profiles`-Tabelle ("Admins can view all profiles" und "Admins can
update all profiles") wurden gedroppt, weil sie unendliche Rekursion
verursacht haben. Admin-Wide-Access auf andere Profile läuft jetzt
ausschließlich über den `service_role`-Client (`createAdminClient()`), nicht
über RLS-Policies.

## Design-System

Aus Florians Lila-Tönen (`#B598E2`) wurde UPRO-Gold. Konkret in `globals.css`:

| Token | Light | Dark |
|---|---|---|
| `--ht-primary` | `#C9A04A` | `#E5B97A` |
| `--ht-primary-hover` | `#B08A3A` | `#F0CB95` |
| `--ht-background` | `#F5F0EB` | `#0D0D0D` |
| `--ht-foreground` | `#050505` | `#EBE8E0` |
| `--ht-accent-lab` (neu) | `#2EB6C9` | `#5BD4E6` |
| `--ht-surface` | `#FFFFFF` | `#1A1A1A` |

Die Token-Namen heißen weiterhin `--ht-*` damit die ganzen Tailwind-Klassen
und CSS-Variablen-Referenzen ohne Massen-Refactoring sitzen. Nur die Werte
sind UPRO. Logo ist eine SVG-Wordmark unter `public/logo.svg` plus
`src/app/icon.svg` und `src/app/apple-icon.svg` für Favicon.

## Zugriffstiers

Drei Tiers in `profiles.access_tier` (`basic`, `alumni`, `premium`) plus
eine separate `role`-Spalte (`user` oder `admin`). Admin überschreibt alle
Tier-Restriktionen.

| Tier | Toolbox | AI Workspace | Classroom | Credits |
|---|---|---|---|---|
| basic | ✅ | ❌ | ❌ | nur Test + Pack-Käufe |
| alumni | ✅ | ❌ | ❌ | Restkontingent, kein Auto-Fillup |
| premium | ✅ | ✅ | ✅ | Monatliches Auto-Fillup |
| admin | ✅ | ✅ | ✅ | Bypass |

Credits zählen nur für die Toolbox (Carousel + Video-Creator + Video-Editor).
Der AI Workspace ist credit-frei für Premium und Admin.

Doc's eigener User `dr.upro@icloud.com` (Cloud-DB User-ID
`41e9756c-e19a-4d59-9f8b-58c897d4e04b`) ist auf `role=admin` plus
`access_tier=premium` gesetzt.

## Monetarisierungs-Modi

Master-Switch in `app_settings.subscriptions_enabled`. Aktuell auf `false`
(Community-only-Modus, Default des Forks). Die zwei Modi unterscheiden
sich darin, ob Stripe-Subscriptions aktiv verkauft werden oder ob
Premium-Zugang nur über die Skool-Community kommt. Beide Modi sind im
Code implementiert und können über `/admin/monetization/settings` ohne
Code-Change umgeschaltet werden.

Wenn du Code änderst der Tier- oder Subscription-Logik betrifft, prüf
immer beide Modi: lade `getAppSettings()` aus `@/lib/app-settings`, branche
auf `subscriptionsEnabled`, und verifizier dass NoSubs-Pfade auch ohne
Stripe-Webhook funktionieren.

## E-Mail-System

Drei Schichten. Erstens **Supabase Auth Mails** (Magic Link, Confirmation,
Invite, Password Reset, Email Change) — werden komplett von Supabase
gerendert, Layouts und Subjects sind in der Supabase Auth Config gesetzt,
nicht im App-Code. Aktualisierungen laufen über die Management API mit
einem Personal Access Token. Versand geht über Resend SMTP
(`smtp.resend.com:465`, User `resend`, Sender
`UPRO AI Lab <noreply@upro-capital.com>`).

Zweitens **App-eigene Transactional Mails** (Invites, Ticket-Notifications,
Newsletter-Mails). Architektur in `src/lib/email-templates/registry.ts`
als Single Source of Truth, plus `src/lib/email-template.ts` mit
Hero-Layouts und `renderEmail()` für Simple-Layouts. DB-Tabelle
`email_templates` erlaubt Override pro Feld, leere Felder fallen auf
Code-Defaults zurück. Editierbar über `/admin/emails`.

Wenn du eine neue App-Mail einbaust, MUSS gleichzeitig auch der
Template-Eintrag in der Registry plus der Preview-Case in
`src/app/api/admin/emails/preview/route.ts` ergänzt werden — sonst kann
die Mail nicht über das Admin-UI editiert werden.

Drittens **System-Notifications** über `src/lib/email.ts` mit
`loadTemplate(key)` als Bindeglied zur Registry und zur DB.

## Cron-Jobs (Vercel)

In `vercel.json` konfiguriert, läuft täglich:

- `/api/cron/wistia-sync` (06:00 UTC) — holt neue Wistia-Videos, schickt sie an AssemblyAI, polled fertige Transkripte und schreibt Chunks in `knowledge_base`. Auth über `CRON_SECRET` env-Variable. Manuell triggerbar mit `curl https://lab.upro-capital.com/api/cron/wistia-sync?secret=...`.
- `/api/cron/skool-expiry` (03:00 UTC) — prüft abgelaufene Skool-Mitgliedschaften. Aktuell ohne Wirkung weil Skool-Sync deaktiviert ist.
- `/api/cron/community-credit-grant` (04:00 UTC) — gewährt monatliche Premium-Credits in der Community-only-Welt.

## Aktueller Stand und offene Punkte

Was funktioniert:
- Vercel-Deploy auf Custom Domain mit gültigem SSL
- Supabase Cloud mit 48 Migrationen applied (47 Original plus die RLS-Recursion-Fix-Migration)
- Magic-Link-Login über Resend Custom SMTP mit UPRO-Branding
- Sechs KI-Agenten antworten via Anthropic API
- Karussell-Generator und KI-Video-Editor sind funktional
- Newsletter-Signups landen in der DB
- Knowledge-DB-Pipeline ist code-side komplett (Wistia → AssemblyAI → Chunks → RAG)

Was noch ansteht:
- Knowledge-DB ist in der Cloud noch leer, der erste Cron-Lauf muss laufen oder manuell getriggert werden
- KI-Video-Creator-Slot in der Toolbox zeigt aktuell ins Leere (`vc.lab.upro-capital.com`-Worker existiert nicht) — entweder den Worker auf Hetzner oder Cloudflare Containers deployen oder den Slot durch Docs eigenen `upro-video-cloner` ersetzen
- Stripe ist auf Test-Mode-Dummies — für echten Verkauf müssen Live-Keys rein plus Live-Webhook konfiguriert werden plus Live-Price-IDs in der `plans`-Tabelle geupdated
- Self-Service-Registrierung von der Landing-Page ist nicht prominent verlinkt, nur `/login` direkt funktioniert
- Onboarding-Quiz ist für Solo-Brand-Use-Case gebaut, Doc ist Multi-Brand — siehe Profile-Texte in der DB

## Lokales Dev-Setup

Lokale Entwicklung läuft mit eigener Docker-Supabase. Start-Sequenz:
`npx supabase start` (Docker muss laufen), dann `pnpm install` plus
`pnpm dev`. Lokale Env-Vars in `.env.local` mit Supabase-Local-URL plus
allen API-Keys. Lokales Supabase und Cloud-Supabase teilen sich keinen
State, sind komplett unabhängig.

Wenn der lokale Dev-Server hängt, meistens hilft `pnpm dev` neu starten —
Next.js 16 mit Turbopack lädt Env-Vars nur beim Boot, nicht hot.

## Skool-Sync (deaktiviert)

Florians Original-Setup syncte Skool-Mitglieder über n8n-Webhooks in die
App und gewährte Premium-Zugang. Aktuell ist `SKOOL_SYNC_ENABLED=false`
in der Vercel-Env, der ganze Code-Pfad inkl. n8n-Workflow-Datei unter
`n8n-workflows/skool-sync.json` ist drin aber inaktiv. Wenn du später eine
eigene Skool-Community oder ein anderes Membership-System anbindest,
kannst du diesen Code als Vorlage nehmen.

## Was du ändern darfst und was nicht

Frei änderbar sind die Brand-Strings, Texte, Farben, Routen-Namen,
Pricing-Werte, Email-Template-Inhalte, neue Migrationen, alles im
`src/app/admin/` für administrative UI-Verbesserungen.

Mit Vorsicht änderbar: die `agents.ts` System-Prompts — nur Brand-Strings
ersetzen, nicht die Persönlichkeits- und Ablauf-Logik der Agenten.

Heikel sind: Auth-Routen, das Permission-Matrix-System, die Master-Switch-
Logik zwischen Subs- und Community-Modus, die Cron-Job-Auth.

Bei jeder größeren Code-Änderung gilt: TypeScript strict, `pnpm tsc
--noEmit` durchlaufen lassen, immutable patterns, Files unter 800 Zeilen.
