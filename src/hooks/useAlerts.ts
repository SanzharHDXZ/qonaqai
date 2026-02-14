import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DBAlert {
  id: string;
  hotel_id: string;
  severity: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export function useAlerts(hotelId: string | undefined) {
  const [alerts, setAlerts] = useState<DBAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (!hotelId) {
      setAlerts([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setAlerts(data);
      setUnreadCount(data.filter(a => !a.read_at).length);
    }
    setLoading(false);
  }, [hotelId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const markAsRead = useCallback(async (alertId: string) => {
    await supabase
      .from("alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("id", alertId);
    await fetchAlerts();
  }, [fetchAlerts]);

  const markAllAsRead = useCallback(async () => {
    if (!hotelId) return;
    await supabase
      .from("alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("hotel_id", hotelId)
      .is("read_at", null);
    await fetchAlerts();
  }, [hotelId, fetchAlerts]);

  return { alerts, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchAlerts };
}
