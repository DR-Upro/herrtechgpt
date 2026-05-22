// Supabase-backed Cache fuer Profile + Niche.
// Ersetzt Jacobs lokales better-sqlite3 — gleiche API-Semantik, nur async.
// Tabelle `viral_scout_cache` aus Migration 045 mit cache_key/payload/expires_at.

import { createAdminClient } from '@/lib/supabase/admin'
import type { SourceProfile, NicheProfile, Platform } from '../types'

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24h

function profileKey(platform: Platform, handle: string): string {
  return `profile:${platform}:${handle.toLowerCase()}`
}

function nicheKey(platform: Platform, handle: string): string {
  return `niche:${platform}:${handle.toLowerCase()}`
}

async function readCache<T>(key: string): Promise<T | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('viral_scout_cache')
    .select('payload, expires_at')
    .eq('cache_key', key)
    .maybeSingle()

  if (error || !data) return null
  if (Date.parse(data.expires_at) < Date.now()) return null
  return data.payload as T
}

async function writeCache(key: string, payload: unknown, ttlMs: number): Promise<void> {
  const supabase = createAdminClient()
  const expires = new Date(Date.now() + ttlMs).toISOString()
  await supabase
    .from('viral_scout_cache')
    .upsert({ cache_key: key, payload, expires_at: expires }, { onConflict: 'cache_key' })
}

export async function getCachedProfile(
  platform: Platform,
  handle: string,
  _ttlMs: number = DEFAULT_TTL_MS,
): Promise<SourceProfile | null> {
  return readCache<SourceProfile>(profileKey(platform, handle))
}

export async function putProfile(
  platform: Platform,
  handle: string,
  profile: SourceProfile,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  await writeCache(profileKey(platform, handle), profile, ttlMs)
}

export async function getCachedNiche(
  platform: Platform,
  handle: string,
  _ttlMs: number = DEFAULT_TTL_MS,
): Promise<NicheProfile | null> {
  return readCache<NicheProfile>(nicheKey(platform, handle))
}

export async function putNiche(
  platform: Platform,
  handle: string,
  niche: NicheProfile,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  await writeCache(nicheKey(platform, handle), niche, ttlMs)
}
