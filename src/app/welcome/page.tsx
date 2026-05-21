import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WelcomeScreen } from './WelcomeScreen'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Willkommen in der UPRO AI Lab World',
}

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('welcomed_at, access_tier')
    .eq('id', user.id)
    .single()

  // Wer schon durch den Welcome-Screen ist, skippt ihn beim Re-Visit.
  if (profile?.welcomed_at) {
    redirect('/dashboard')
  }

  const isCommunityMember = profile?.access_tier === 'premium'

  return <WelcomeScreen isCommunityMember={isCommunityMember} />
}
