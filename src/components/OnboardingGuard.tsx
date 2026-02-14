import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveHotel } from "@/hooks/useActiveHotel";

/** Redirects authenticated users with no org to /onboarding */
export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, memberships, currentOrg } = useAuth();
  const { allHotels, loading: hotelsLoading } = useActiveHotel();

  if (loading || hotelsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // No memberships at all → needs onboarding
  if (memberships.length === 0) return <Navigate to="/onboarding" replace />;

  // Has org but currentOrg not yet resolved → still loading, don't redirect
  if (!currentOrg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Has org + currentOrg set but no hotels for THIS org → needs onboarding
  if (allHotels.length === 0) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
