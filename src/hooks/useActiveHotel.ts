import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface HotelProfile {
  id: string;
  name: string;
  city: string;
  city_name: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  rooms: number;
  base_price: number;
  currency: string;
  avg_occupancy: number;
  organization_id: string;
}

export function useActiveHotel() {
  const { user, currentOrg } = useAuth();
  const [activeHotel, setActiveHotel] = useState<HotelProfile | null>(null);
  const [allHotels, setAllHotels] = useState<HotelProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHotels = useCallback(async () => {
    if (!user || !currentOrg) {
      setActiveHotel(null);
      setAllHotels([]);
      setLoading(false);
      return;
    }

    // Fetch all hotels for the current org
    const { data: hotels, error } = await supabase
      .from("hotels")
      .select("id, name, city, city_name, country_code, latitude, longitude, rooms, base_price, currency, avg_occupancy, organization_id")
      .eq("organization_id", currentOrg.organization_id);

    if (error || !hotels || hotels.length === 0) {
      setActiveHotel(null);
      setAllHotels([]);
      setLoading(false);
      return;
    }

    setAllHotels(hotels);

    // Fetch user_settings to find active hotel
    const { data: settings } = await supabase
      .from("user_settings")
      .select("active_hotel_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const activeId = settings?.active_hotel_id;
    const matched = activeId ? hotels.find(h => h.id === activeId) : null;
    const selected = matched || hotels[0];

    setActiveHotel(selected);

    // Auto-set if no settings exist or hotel changed
    if (!matched && selected) {
      await supabase.rpc("set_active_hotel", { _hotel_id: selected.id });
    }

    setLoading(false);
  }, [user, currentOrg]);

  useEffect(() => {
    fetchHotels();
  }, [fetchHotels]);

  const switchHotel = useCallback(async (hotelId: string) => {
    const hotel = allHotels.find(h => h.id === hotelId);
    if (!hotel) return;
    setActiveHotel(hotel);
    await supabase.rpc("set_active_hotel", { _hotel_id: hotelId });
  }, [allHotels]);

  return { activeHotel, allHotels, loading, switchHotel, refetch: fetchHotels };
}
