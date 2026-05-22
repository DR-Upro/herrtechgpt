import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computeEffectiveAccess, VIEW_AS_COOKIE } from '@/lib/access'
import { getFeatureState } from '@/lib/permissions'
import { getAppSettings } from '@/lib/app-settings'
import CommunityRequiredView from '@/components/community-required'
import ViralScoutWorkflow from './ViralScoutWorkflow'

export default async function ViralScoutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, cookieStore, settings] = await Promise.all([
    supabase.from('profiles').select('role, access_tier').eq('id', user.id).single(),
    cookies(),
    getAppSettings(),
  ])
  const access = computeEffectiveAccess(profile, cookieStore.get(VIEW_AS_COOKIE)?.value)

  const toolboxState = await getFeatureState(supabase, access.tier, 'toolbox')
  if (!access.isAdmin && toolboxState === 'community') {
    return (
      <CommunityRequiredView
        featureLabel="Viral Scout"
        communityUrl={settings.communityUrl}
      />
    )
  }

  return <ViralScoutWorkflow />
}
