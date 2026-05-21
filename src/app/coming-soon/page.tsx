import { SignupForm } from './SignupForm'

export const metadata = {
  title: 'UPRO AI Lab World — Bald verfügbar',
  description:
    'Eine komplette KI-Plattform. Gebaut mit Claude. Trag dich ein und sei einer der Ersten, wenn die UPRO AI Lab World öffnet.',
}

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="min-h-screen flex flex-col">
        <header className="px-6 sm:px-10 py-6">
          <img src="/logo.svg" alt="UPRO AI Lab" className="h-7 w-auto" />
        </header>

        <main className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12">
          <div className="w-full max-w-3xl">
            <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-primary mb-6">
              Early Access · Bald live
            </p>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
              Wir haben eine ganze Welt gebaut. <span className="text-primary">Mit Claude.</span>
            </h1>

            <p className="text-base sm:text-lg text-muted leading-relaxed mb-4 max-w-2xl">
              Kein Developer-Team. Kein 6-Monats-Projekt. Kein SaaS-Budget. Nur klare Ideen,
              die richtigen Prompts und Claude als Baumeister — und am Ende stand da
              die <strong className="text-foreground">UPRO AI Lab World</strong>.
            </p>
            <p className="text-base sm:text-lg text-muted leading-relaxed mb-10 max-w-2xl">
              Eine komplette KI-Plattform: Toolbox, 6 spezialisierte Coaches, Classroom.
              Wenn wir öffnen, willst du drin sein — bevor es alle anderen sind.
            </p>

            <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
              <SignupForm />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
              <FeatureCard
                emoji="🎬"
                title="KI Video Creator"
                text="Du tippst. Die KI dreht. Fertiger Video-Content aus Text."
              />
              <FeatureCard
                emoji="🎨"
                title="Karussell-Generator"
                text="Ein Klick, fertiger Instagram-Post in deinen Brand-Farben."
              />
              <FeatureCard
                emoji="🤖"
                title="6 KI-Coaches"
                text="Trainiert auf UPRO AI Labs Inhalten. Für Content, Funnel, Mindset & mehr."
              />
            </div>
          </div>
        </main>

        <footer className="px-6 sm:px-10 py-8 text-center text-xs text-muted">
          © UPRO AI Lab · Powered by Claude
        </footer>
      </div>
    </div>
  )
}

function FeatureCard({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="text-2xl mb-2">{emoji}</div>
      <div className="font-semibold text-foreground mb-1">{title}</div>
      <div className="text-sm text-muted leading-relaxed">{text}</div>
    </div>
  )
}
