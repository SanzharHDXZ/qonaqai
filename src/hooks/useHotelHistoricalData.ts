import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HistoricalRecord } from "@/pricing-engine";

export function useHotelHistoricalData(hotelId: string | undefined) {
  const [data, setData] = useState<HistoricalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hotelId) {
      setData([]);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from("historical_data")
        .select("date, rooms_available, rooms_sold, average_daily_rate, cancellations")
        .eq("hotel_id", hotelId)
        .order("date", { ascending: true });

      if (error || !rows) {
        setData([]);
      } else {
        setData(rows.map(r => ({
          date: r.date,
          rooms_available: r.rooms_available,
          rooms_sold: r.rooms_sold,
          average_daily_rate: Number(r.average_daily_rate),
          cancellations: r.cancellations ?? 0,
        })));
      }
      setLoading(false);
    };

    fetch();
  }, [hotelId]);

  return { historicalData: data, loading };
}
