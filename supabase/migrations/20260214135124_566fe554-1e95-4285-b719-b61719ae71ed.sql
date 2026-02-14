
-- Add lat/lon to hotels table for coordinate-based event queries
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS latitude numeric DEFAULT NULL;
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS longitude numeric DEFAULT NULL;
