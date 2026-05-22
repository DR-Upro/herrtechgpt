-- Viral Scout als Toolbox-Tool registrieren.
-- Integriert aus Jacob Sc.'s `herr-tech-viral-scout` Repo (Apify + Anthropic).

insert into public.toolbox_tools
  (id, title, subtitle, description, href, icon_name, icon_bg, sort_order, coming_soon, published)
values
  (
    'viral-scout',
    'Viral Scout',
    'Pay-per-Use',
    'Instagram- oder TikTok-Handle rein, Nische wird analysiert, die viralsten Reels/TikToks/Shorts weltweit kommen raus — sortiert nach Match, Viralität, Engagement, inklusive Nachbau-Idee.',
    '/dashboard/ki-toolbox/viral-scout',
    'Radar',
    'bg-gradient-to-br from-accent-lab to-primary',
    15,
    false,
    true
  )
on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  href = excluded.href,
  icon_name = excluded.icon_name,
  icon_bg = excluded.icon_bg,
  sort_order = excluded.sort_order,
  coming_soon = excluded.coming_soon,
  published = excluded.published;
