-- Drop recursive admin policies on profiles table.
-- These policies cause "infinite recursion detected in policy" errors because
-- they query the profiles table within their own USING/CHECK clause.
-- "Users can view own profile" + "Users can update own profile" are sufficient.
-- Admin-wide access to other profiles is done via service_role (createAdminClient).

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
