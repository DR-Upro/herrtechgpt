export interface Profile {
  id: string
  background: string
  market: string
  target_audience: string
  offer: string
  platforms: string[]
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
}

export interface AgentConfig {
  id: string
  agent_id: string
  name: string
  description: string
  emoji: string
  system_prompt: string
  is_active: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  agent_id: string
  title: string
  created_at: string
  updated_at: string
  user_has_unread?: boolean
  archived?: boolean
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type CoreToolTier = 'primary' | 'secondary' | 'fallback'

export type CoreToolCategory =
  | 'ki-chat'
  | 'automation'
  | 'video'
  | 'video-edit'
  | 'video-avatar'
  | 'image'
  | 'coding'
  | 'knowledge'
  | 'design'
  | 'other'

export interface CoreTool {
  id: string
  name: string
  category: CoreToolCategory
  tier: CoreToolTier
  what_for: string
  why_we_use_it: string | null
  alternatives_handled: string[]
  relevant_agents: string[]
  url: string | null
  icon: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// ─── Monetization ────────────────────────────────────────────────────────────

export type PlanTier = 'S' | 'M' | 'L'
export type PriceBand = 'basic' | 'community'
export type BillingCycle = 'monthly' | 'yearly'

export interface Plan {
  id: string
  tier: PlanTier
  name: string
  description: string | null
  price_basic_cents: number
  price_community_cents: number
  price_yearly_basic_cents: number | null
  price_yearly_community_cents: number | null
  credits_per_month: number
  stripe_product_id: string | null
  stripe_price_basic_monthly: string | null
  stripe_price_community_monthly: string | null
  stripe_price_basic_yearly: string | null
  stripe_price_community_yearly: string | null
  features: string[]
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface CreditPack {
  id: string
  name: string
  credits: number
  price_basic_cents: number
  price_community_cents: number
  stripe_product_id: string | null
  stripe_price_basic: string | null
  stripe_price_community: string | null
  expiry_months: number
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface FeatureCreditCost {
  feature: string
  label: string
  credits_per_unit: number
  unit: string
  category: string | null
  description: string | null
  active: boolean
  updated_at: string
}
