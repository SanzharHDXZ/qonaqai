import { LogOut, Building2, ChevronDown, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function UserMenu() {
  const { user, currentOrg, memberships, setCurrentOrg, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs max-w-[200px]">
          <User className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate hidden sm:inline">{user?.email}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          {currentOrg && (
            <div className="flex items-center gap-1.5 mt-1">
              <Building2 className="h-3 w-3 text-primary" />
              <span className="text-sm font-medium truncate">{currentOrg.organization_name}</span>
              <span className="text-xs text-muted-foreground capitalize">({currentOrg.role})</span>
            </div>
          )}
        </DropdownMenuLabel>

        {memberships.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Switch Organization</DropdownMenuLabel>
            {memberships.map((m) => (
              <DropdownMenuItem
                key={m.organization_id}
                onClick={() => setCurrentOrg(m)}
                className={m.organization_id === currentOrg?.organization_id ? "bg-accent" : ""}
              >
                <Building2 className="mr-2 h-3.5 w-3.5" />
                <span className="truncate">{m.organization_name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
