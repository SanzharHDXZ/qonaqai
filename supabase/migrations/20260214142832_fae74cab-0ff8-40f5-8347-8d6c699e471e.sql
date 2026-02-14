
-- Clean up duplicate hotels: keep only the OLDEST hotel per organization
DELETE FROM hotels
WHERE id NOT IN (
  SELECT DISTINCT ON (organization_id) id
  FROM hotels
  ORDER BY organization_id, created_at ASC
);

-- Add unique constraint: one hotel per org (MVP single-hotel mode)
ALTER TABLE public.hotels
ADD CONSTRAINT hotels_organization_id_unique UNIQUE (organization_id);

-- Update the create_hotel_for_org function to be idempotent:
-- if org already has a hotel, return existing hotel id instead of failing
CREATE OR REPLACE FUNCTION public.create_hotel_for_org(
  _org_id uuid,
  _name text,
  _city text DEFAULT 'Barcelona'::text,
  _rooms integer DEFAULT 85,
  _base_price numeric DEFAULT 120.00
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _hotel_id UUID;
BEGIN
  IF NOT public.has_org_role(auth.uid(), _org_id, 'owner') THEN
    RAISE EXCEPTION 'Only org owners can create hotels';
  END IF;

  -- Check if org already has a hotel (MVP: single hotel per org)
  SELECT id INTO _hotel_id FROM public.hotels WHERE organization_id = _org_id LIMIT 1;
  IF _hotel_id IS NOT NULL THEN
    RETURN _hotel_id;
  END IF;

  INSERT INTO public.hotels(organization_id, name, city, rooms, base_price)
  VALUES (_org_id, _name, _city, _rooms, _base_price)
  RETURNING id INTO _hotel_id;

  RETURN _hotel_id;
END;
$function$;
