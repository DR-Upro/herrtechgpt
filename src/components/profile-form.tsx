'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AIGenerateButton } from './ai-generate-button'
import type { Profile } from '@/lib/types'

interface ProfileFormProps {
  profile: Profile
}

const fields = [
  {
    key: 'background' as const,
    label: 'Über mich',
    hint: 'Wer bist du? Dein Hintergrund, deine Erfahrung, deine Geschichte',
    placeholder:
      'z.B. "Online-Unternehmer seit 4 Jahren, Schwerpunkt auf KI-Tools und Automatisierung. Früher Softwareentwickler, heute Creator und Coach für die UPRO-Capital-Community."',
    icon: '👤',
  },
  {
    key: 'market' as const,
    label: 'Mein Business & Nische',
    hint: 'In welcher Nische bist du aktiv? Was ist dein Geschäftsmodell?',
    placeholder:
      'z.B. "Online-Kurse und Coaching rund um KI & Produktivität. Hauptplattformen: Instagram und YouTube. Monatlich 5–10 neue Kunden über organischen Content."',
    icon: '🚀',
  },
  {
    key: 'target_audience' as const,
    label: 'Meine Zielgruppe',
    hint: 'Wer ist deine Wunschzielgruppe?',
    placeholder:
      'z.B. "Ambitionierte Unternehmer und Angestellte, 25–45 Jahre, die KI nutzen wollen, um Zeit zu sparen und ihr Business zu skalieren. Technikaffin, aber kein Developer."',
    icon: '🎯',
  },
  {
    key: 'offer' as const,
    label: 'Meine Angebote',
    hint: 'Was verkaufst du? Welche Produkte oder Dienstleistungen?',
    placeholder:
      'z.B. "KI-Masterkurs (997€), monatliche Membership-Community (49€/Monat), 1:1 Strategie-Calls (350€/h). Zusätzlich Affiliate-Einnahmen über empfohlene Tools."',
    icon: '💼',
  },
]

export function ProfileForm({ profile }: ProfileFormProps) {
  const [form, setForm] = useState({
    background: profile.background,
    market: profile.market,
    target_audience: profile.target_audience,
    offer: profile.offer,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [documents, setDocuments] = useState<{ name: string; size: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({
        background: form.background,
        market: form.market,
        target_audience: form.target_audience,
        offer: form.offer,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newDocs = Array.from(files).map((f) => ({
      name: f.name,
      size: f.size < 1024 * 1024
        ? `${(f.size / 1024).toFixed(0)} KB`
        : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
    }))
    setDocuments((prev) => [...prev, ...newDocs])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-8">
      {/* Info banner */}
      <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 flex gap-3">
        <span className="text-xl shrink-0">💡</span>
        <div>
          <p className="text-sm font-medium text-foreground">
            Je mehr wir über dich wissen, desto besser werden die Ergebnisse.
          </p>
          <p className="text-xs text-muted mt-1">
            Diese Informationen werden automatisch an alle Assistenten weitergegeben, damit die Antworten perfekt auf dich zugeschnitten sind.
          </p>
        </div>
      </div>

      {/* Profile fields */}
      {fields.map((field) => (
        <div key={field.key} className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{field.icon}</span>
              <label className="text-sm font-semibold text-foreground">
                {field.label}
              </label>
            </div>
            <AIGenerateButton
              field={field.key}
              currentProfile={{
                background: form.background,
                market: form.market,
                target_audience: form.target_audience,
                offer: form.offer,
              }}
              onGenerated={(text) => updateField(field.key, text)}
            />
          </div>
          <p className="text-xs text-muted mb-3 ml-8">{field.hint}</p>
          <textarea
            value={form[field.key]}
            onChange={(e) => updateField(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm resize-none bg-surface-secondary/50"
          />
        </div>
      ))}

      {/* Document Upload */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">📄</span>
          <label className="text-sm font-semibold text-foreground">
            Wissensdokumente
          </label>
        </div>
        <p className="text-xs text-muted mb-4 ml-8">
          Lade Dokumente hoch, die als zusätzliche Wissensbasis dienen (z.B. Leitfäden, SOPs, Angebote, Texte über dich).
        </p>

        {/* Uploaded files */}
        {documents.length > 0 && (
          <div className="space-y-2 mb-4">
            {documents.map((doc, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5 bg-surface-secondary rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="text-sm text-foreground">{doc.name}</span>
                  <span className="text-xs text-muted">{doc.size}</span>
                </div>
                <button
                  onClick={() => setDocuments((prev) => prev.filter((_, j) => j !== i))}
                  className="text-muted hover:text-red-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload area */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-border hover:border-primary/40 rounded-lg px-4 py-6 text-center transition-colors group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-muted group-hover:text-primary transition-colors mb-2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-sm text-muted group-hover:text-foreground transition-colors">
            Klicken zum Hochladen
          </p>
          <p className="text-xs text-muted mt-1">
            PDF, Word, Text-Dateien
          </p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
        >
          {saving ? 'Speichern...' : 'Änderungen speichern'}
        </button>
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Gespeichert!
          </span>
        )}
      </div>
    </div>
  )
}
