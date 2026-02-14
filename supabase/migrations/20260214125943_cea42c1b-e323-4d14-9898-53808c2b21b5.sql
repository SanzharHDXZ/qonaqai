
-- Weather cache table
CREATE TABLE public.weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  date date NOT NULL,
  temperature numeric NOT NULL,
  rain_probability numeric NOT NULL DEFAULT 0,
  condition text NOT NULL DEFAULT 'clear',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(city, date)
);

ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read weather cache (shared resource)
CREATE POLICY "Authenticated users can read weather cache"
  ON public.weather_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only service role inserts (edge function), but allow authenticated for upsert from edge fn
CREATE POLICY "Authenticated users can insert weather cache"
  ON public.weather_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update weather cache"
  ON public.weather_cache FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Event cache table
CREATE TABLE public.event_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  event_date date NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  estimated_attendance numeric NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read event cache"
  ON public.event_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert event cache"
  ON public.event_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update event cache"
  ON public.event_cache FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete event cache"
  ON public.event_cache FOR DELETE
  USING (auth.uid() IS NOT NULL);
