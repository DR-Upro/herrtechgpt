-- -----------------------------------------------------------------------------
-- Geplanter Plan-Wechsel (Downgrade zum Periodenende)
-- -----------------------------------------------------------------------------
-- Upgrade läuft sofort via stripe.subscriptions.update (Proration).
-- Downgrade wird über Stripe Subscription Schedules am current_period_end
-- eingelöst — bis dahin merken wir uns den Zielplan hier, damit die UI einen
-- Banner "Ab TT.MM. wechselst du zu Plan X" zeigen kann.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_plan_id text REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS scheduled_price_id text,
  ADD COLUMN IF NOT EXISTS scheduled_billing_cycle text,
  ADD COLUMN IF NOT EXISTS scheduled_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_schedule_id text;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_scheduled_billing_cycle_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_scheduled_billing_cycle_check
    CHECK (scheduled_billing_cycle IS NULL OR scheduled_billing_cycle IN ('monthly', 'yearly'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_scheduled_change_at
  ON public.subscriptions(scheduled_change_at)
  WHERE scheduled_change_at IS NOT NULL;
