import { AuthForm } from '@/components/auth-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="bg-surface p-8 rounded-2xl shadow-sm border border-border w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="UPRO AI Lab" className="h-8 w-auto mx-auto" />
          <h1 className="text-foreground font-semibold mt-3">Anmelden oder registrieren</h1>
          <p className="text-xs text-muted mt-1">
            Eine Mail, ein Klick — egal ob neu oder alter Hase.
          </p>
        </div>

        <div className="flex justify-center">
          <AuthForm />
        </div>
      </div>
    </div>
  )
}
