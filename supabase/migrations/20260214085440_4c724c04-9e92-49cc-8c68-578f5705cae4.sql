
-- Hotels table for multi-tenant support
CREATE TABLE public.hotels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  rooms INTEGER NOT NULL DEFAULT 85,
  city TEXT NOT NULL DEFAULT 'Barcelona',
  avg_occupancy NUMERIC(5,4) NOT NULL DEFAULT 0.72,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 120.00,
  currency TEXT NOT NULL DEFAULT '€',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hotels"
  ON public.hotels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own hotels"
  ON public.hotels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hotels"
  ON public.hotels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hotels"
  ON public.hotels FOR DELETE
  USING (auth.uid() = user_id);

-- Historical performance data from CSV imports
CREATE TABLE public.historical_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  rooms_available INTEGER NOT NULL,
  rooms_sold INTEGER NOT NULL,
  average_daily_rate NUMERIC(10,2) NOT NULL,
  cancellations INTEGER DEFAULT 0,
  occupancy_rate NUMERIC(5,4) GENERATED ALWAYS AS (
    CASE WHEN rooms_available > 0 THEN rooms_sold::NUMERIC / rooms_available ELSE 0 END
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(hotel_id, date)
);

ALTER TABLE public.historical_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their hotel historical data"
  ON public.historical_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hotels
      WHERE hotels.id = historical_data.hotel_id
      AND hotels.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their hotel historical data"
  ON public.historical_data FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hotels
      WHERE hotels.id = historical_data.hotel_id
      AND hotels.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their hotel historical data"
  ON public.historical_data FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.hotels
      WHERE hotels.id = historical_data.hotel_id
      AND hotels.user_id = auth.uid()
    )
  );

-- Trigger for updated_at on hotels
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_hotels_updated_at
  BEFORE UPDATE ON public.hotels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
