
-- 1) Idempotent enum creation
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('owner', 'manager', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Create organization_members FIRST (before org RLS policies reference it)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 3) Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Add FK from organization_members to organizations
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 4) Profiles table (1:1 with auth.users)
DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- 5) Profile auto-creation trigger with ON CONFLICT and COALESCE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6) Helper functions (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role org_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id AND role = _role
  );
$$;

-- 7) Organizations RLS (now safe — organization_members exists)
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Owners can update their organizations"
  ON public.organizations FOR UPDATE
  USING (public.has_org_role(auth.uid(), id, 'owner'));

CREATE POLICY "Owners can delete their organizations"
  ON public.organizations FOR DELETE
  USING (public.has_org_role(auth.uid(), id, 'owner'));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 8) Organization members RLS
CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Owners can add members"
  ON public.organization_members FOR INSERT
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'owner'));

CREATE POLICY "Owners can update members"
  ON public.organization_members FOR UPDATE
  USING (public.has_org_role(auth.uid(), organization_id, 'owner'));

CREATE POLICY "Owners can remove members"
  ON public.organization_members FOR DELETE
  USING (public.has_org_role(auth.uid(), organization_id, 'owner'));

-- 9) Add organization_id to hotels
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Safe NOT NULL (only if no nulls exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hotels WHERE organization_id IS NULL) THEN
    ALTER TABLE public.hotels ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

-- 10) Replace hotels RLS with org-scoped policies
DROP POLICY IF EXISTS "Users can view their own hotels" ON public.hotels;
DROP POLICY IF EXISTS "Users can create their own hotels" ON public.hotels;
DROP POLICY IF EXISTS "Users can update their own hotels" ON public.hotels;
DROP POLICY IF EXISTS "Users can delete their own hotels" ON public.hotels;

CREATE POLICY "Org members can view hotels"
  ON public.hotels FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org owners can create hotels"
  ON public.hotels FOR INSERT
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'owner'));

CREATE POLICY "Org owners can update hotels"
  ON public.hotels FOR UPDATE
  USING (public.has_org_role(auth.uid(), organization_id, 'owner'));

CREATE POLICY "Org owners can delete hotels"
  ON public.hotels FOR DELETE
  USING (public.has_org_role(auth.uid(), organization_id, 'owner'));

-- 11) Replace historical_data RLS with org-scoped policies
DROP POLICY IF EXISTS "Users can view their hotel historical data" ON public.historical_data;
DROP POLICY IF EXISTS "Users can insert their hotel historical data" ON public.historical_data;
DROP POLICY IF EXISTS "Users can delete their hotel historical data" ON public.historical_data;

CREATE POLICY "Org members can view historical data"
  ON public.historical_data FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.hotels
    WHERE hotels.id = historical_data.hotel_id
      AND public.is_org_member(auth.uid(), hotels.organization_id)
  ));

CREATE POLICY "Org owners can insert historical data"
  ON public.historical_data FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.hotels
    WHERE hotels.id = historical_data.hotel_id
      AND public.has_org_role(auth.uid(), hotels.organization_id, 'owner')
  ));

CREATE POLICY "Org owners can update historical data"
  ON public.historical_data FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.hotels
    WHERE hotels.id = historical_data.hotel_id
      AND public.has_org_role(auth.uid(), hotels.organization_id, 'owner')
  ));

CREATE POLICY "Org owners can delete historical data"
  ON public.historical_data FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.hotels
    WHERE hotels.id = historical_data.hotel_id
      AND public.has_org_role(auth.uid(), hotels.organization_id, 'owner')
  ));

-- 12) Security definer functions for onboarding
CREATE OR REPLACE FUNCTION public.create_org_and_owner(_org_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _org_id UUID;
BEGIN
  INSERT INTO public.organizations(name) VALUES (_org_name)
  RETURNING id INTO _org_id;

  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (_org_id, auth.uid(), 'owner');

  RETURN _org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_hotel_for_org(
  _org_id UUID,
  _name TEXT,
  _city TEXT DEFAULT 'Barcelona',
  _rooms INT DEFAULT 85,
  _base_price NUMERIC DEFAULT 120.00
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _hotel_id UUID;
BEGIN
  IF NOT public.has_org_role(auth.uid(), _org_id, 'owner') THEN
    RAISE EXCEPTION 'Only org owners can create hotels';
  END IF;

  INSERT INTO public.hotels(organization_id, name, city, rooms, base_price)
  VALUES (_org_id, _name, _city, _rooms, _base_price)
  RETURNING id INTO _hotel_id;

  RETURN _hotel_id;
END;
$$;

-- 13) Updated_at trigger for organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
