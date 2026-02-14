
-- Competitor rates table for manual competitor pricing input
CREATE TABLE public.competitor_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  date date NOT NULL,
  competitor_name text NOT NULL,
  price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.competitor_rates ENABLE ROW LEVEL SECURITY;

-- Org members can view competitor rates
CREATE POLICY "Org members can view competitor rates"
ON public.competitor_rates FOR SELECT
USING (EXISTS (
  SELECT 1 FROM hotels
  WHERE hotels.id = competitor_rates.hotel_id
  AND is_org_member(auth.uid(), hotels.organization_id)
));

-- Owners/managers can insert
CREATE POLICY "Org owners/managers can insert competitor rates"
ON public.competitor_rates FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM hotels
  WHERE hotels.id = competitor_rates.hotel_id
  AND is_org_member(auth.uid(), hotels.organization_id)
));

-- Owners/managers can update
CREATE POLICY "Org owners/managers can update competitor rates"
ON public.competitor_rates FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM hotels
  WHERE hotels.id = competitor_rates.hotel_id
  AND is_org_member(auth.uid(), hotels.organization_id)
));

-- Owners can delete
CREATE POLICY "Org owners can delete competitor rates"
ON public.competitor_rates FOR DELETE
USING (EXISTS (
  SELECT 1 FROM hotels
  WHERE hotels.id = competitor_rates.hotel_id
  AND has_org_role(auth.uid(), hotels.organization_id, 'owner')
));
