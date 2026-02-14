import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** Redirects authenticated users with no org to /onboarding */
export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, memberships } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // User is authenticated but has no org → needs onboarding
  if (memberships.length === 0) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
