
-- Remove client-side write policies on weather_cache (edge function uses service role key, bypasses RLS)
DROP POLICY IF EXISTS "Authenticated users can insert weather cache" ON public.weather_cache;
DROP POLICY IF EXISTS "Authenticated users can update weather cache" ON public.weather_cache;

-- Remove client-side write policies on event_cache (same pattern)
DROP POLICY IF EXISTS "Authenticated users can insert event cache" ON public.event_cache;
DROP POLICY IF EXISTS "Authenticated users can update event cache" ON public.event_cache;
DROP POLICY IF EXISTS "Authenticated users can delete event cache" ON public.event_cache;
