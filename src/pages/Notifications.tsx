import { Link } from "react-router-dom";
import { ChevronLeft, Bell, CheckCheck, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveHotel } from "@/hooks/useActiveHotel";
import { useAlerts } from "@/hooks/useAlerts";
import UserMenu from "@/components/UserMenu";
import QonaqLogo from "@/components/QonaqLogo";

const severityConfig = {
  critical: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  warning: { icon: AlertCircle, color: "text-warning", bg: "bg-warning/10" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10" },
};

export default function Notifications() {
  const { activeHotel } = useActiveHotel();
  const { alerts, unreadCount, markAsRead, markAllAsRead, loading } = useAlerts(activeHotel?.id);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <QonaqLogo size="sm" />
            <span className="hidden sm:inline text-sm text-muted-foreground">/ Notifications</span>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2">
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium">No notifications yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Alerts from the pricing engine will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
              const Icon = config.icon;
              return (
                <div key={alert.id} className={`flex gap-3 rounded-xl border p-4 transition-colors ${alert.read_at ? "border-border bg-card opacity-70" : "border-primary/20 bg-card"}`}>
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{alert.title}</span>
                      {!alert.read_at && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{alert.message}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleDateString()}</span>
                      {!alert.read_at && <button onClick={() => markAsRead(alert.id)} className="text-xs text-primary hover:underline">Mark as read</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
