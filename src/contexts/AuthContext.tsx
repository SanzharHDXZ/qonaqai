import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface OrgMembership {
  organization_id: string;
  organization_name: string;
  role: "owner" | "manager" | "viewer";
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  memberships: OrgMembership[];
  currentOrg: OrgMembership | null;
  setCurrentOrg: (org: OrgMembership) => void;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshMemberships: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [currentOrg, setCurrentOrg] = useState<OrgMembership | null>(null);

  const fetchMemberships = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", userId);

    if (error || !data) {
      setMemberships([]);
      setCurrentOrg(null);
      return;
    }

    const mapped: OrgMembership[] = data.map((m: any) => ({
      organization_id: m.organization_id,
      organization_name: m.organizations?.name ?? "Unknown",
      role: m.role,
    }));

    setMemberships(mapped);

    // Try to restore the user's previously active org from user_settings
    if (mapped.length > 0) {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("active_organization_id")
        .eq("user_id", userId)
        .maybeSingle();

      const savedOrgId = settings?.active_organization_id;
      const savedOrg = savedOrgId ? mapped.find(m => m.organization_id === savedOrgId) : null;
      setCurrentOrg(savedOrg || mapped[0]);
    }
  }, []);

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchMemberships(session.user.id), 0);
        } else {
          setMemberships([]);
          setCurrentOrg(null);
        }
        setLoading(false);
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchMemberships(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchMemberships]);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMemberships([]);
    setCurrentOrg(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const refreshMemberships = async () => {
    if (user) await fetchMemberships(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user, session, loading, memberships, currentOrg, setCurrentOrg,
        signUp, signIn, signOut, resetPassword, refreshMemberships,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
