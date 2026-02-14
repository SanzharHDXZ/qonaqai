
-- 1) Single-hotel MVP: unique constraint on organization_id
-- First, delete duplicate hotels keeping only the earliest per org
DELETE FROM public.hotels
WHERE id NOT IN (
  SELECT DISTINCT ON (organization_id) id
  FROM public.hotels
  ORDER BY organization_id, created_at ASC
);

ALTER TABLE public.hotels
ADD CONSTRAINT hotels_one_per_org UNIQUE (organization_id);

-- 2) Add structured city columns
ALTER TABLE public.hotels
ADD COLUMN IF NOT EXISTS city_name text,
ADD COLUMN IF NOT EXISTS country_code text;

-- Backfill city_name from existing city column
UPDATE public.hotels SET city_name = city WHERE city_name IS NULL;
