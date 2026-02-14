
-- user_settings: tracks active org/hotel per user
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  active_hotel_id uuid REFERENCES public.hotels(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE USING (user_id = auth.uid());

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- alerts table: persisted notifications
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view alerts" ON public.alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hotels
      WHERE hotels.id = alerts.hotel_id
      AND public.is_org_member(auth.uid(), hotels.organization_id)
    )
  );

CREATE POLICY "Org owners/managers can insert alerts" ON public.alerts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hotels
      WHERE hotels.id = alerts.hotel_id
      AND public.is_org_member(auth.uid(), hotels.organization_id)
    )
  );

CREATE POLICY "Org members can update alerts" ON public.alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.hotels
      WHERE hotels.id = alerts.hotel_id
      AND public.is_org_member(auth.uid(), hotels.organization_id)
    )
  );

CREATE POLICY "Org owners can delete alerts" ON public.alerts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.hotels
      WHERE hotels.id = alerts.hotel_id
      AND public.has_org_role(auth.uid(), hotels.organization_id, 'owner')
    )
  );

-- Function to upsert user settings (set active hotel)
CREATE OR REPLACE FUNCTION public.set_active_hotel(_hotel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
BEGIN
  -- Verify user is member of the hotel's org
  SELECT organization_id INTO _org_id FROM public.hotels WHERE id = _hotel_id;
  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'Hotel not found';
  END IF;
  IF NOT public.is_org_member(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not a member of this hotel organization';
  END IF;

  INSERT INTO public.user_settings (user_id, active_organization_id, active_hotel_id)
  VALUES (auth.uid(), _org_id, _hotel_id)
  ON CONFLICT (user_id) DO UPDATE
  SET active_organization_id = _org_id, active_hotel_id = _hotel_id, updated_at = now();
END;
$$;
