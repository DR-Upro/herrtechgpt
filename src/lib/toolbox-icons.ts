import {
  Palette,
  Film,
  Video,
  Wrench,
  Wand2,
  Image as ImageIcon,
  FileText,
  Mic,
  Bot,
  Sparkles,
  Music,
  Scissors,
  Brush,
  Camera,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'

export const TOOLBOX_ICONS: Record<string, LucideIcon> = {
  Palette,
  Film,
  Video,
  Wrench,
  Wand2,
  Image: ImageIcon,
  FileText,
  Mic,
  Bot,
  Sparkles,
  Music,
  Scissors,
  Brush,
  Camera,
  MessageSquare,
}

export const TOOLBOX_ICON_NAMES = Object.keys(TOOLBOX_ICONS)

export function resolveToolboxIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Wrench
  return TOOLBOX_ICONS[name] ?? Wrench
}

export const TOOLBOX_ICON_BG_PRESETS: { value: string; label: string }[] = [
  { value: 'bg-gradient-to-br from-primary to-primary-hover', label: 'Gold (Primary)' },
  { value: 'bg-gradient-to-br from-pink-500 to-rose-600', label: 'Pink' },
  { value: 'bg-gradient-to-br from-blue-500 to-indigo-600', label: 'Blau' },
  { value: 'bg-gradient-to-br from-emerald-500 to-teal-600', label: 'Grün' },
  { value: 'bg-gradient-to-br from-amber-500 to-orange-600', label: 'Orange' },
  { value: 'bg-gradient-to-br from-slate-600 to-slate-800', label: 'Grau' },
]

export interface ToolboxTool {
  id: string
  title: string
  subtitle: string | null
  description: string
  href: string | null
  icon_name: string
  icon_bg: string
  sort_order: number
  coming_soon: boolean
  published: boolean
}
