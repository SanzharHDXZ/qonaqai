import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { HotelProfile } from "@/hooks/useActiveHotel";

interface Props {
  activeHotel: HotelProfile | null;
  allHotels: HotelProfile[];
  onSwitch: (hotelId: string) => void;
}

export default function HotelSwitcher({ activeHotel, allHotels, onSwitch }: Props) {
  if (!activeHotel) return null;
  if (allHotels.length <= 1) {
    return (
      <span className="hidden sm:inline text-sm text-muted-foreground">
        / {activeHotel.name} · {activeHotel.city}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          / {activeHotel.name} · {activeHotel.city}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {allHotels.map((h) => (
          <DropdownMenuItem
            key={h.id}
            onClick={() => onSwitch(h.id)}
            className={h.id === activeHotel.id ? "bg-accent" : ""}
          >
            <Building2 className="mr-2 h-3.5 w-3.5" />
            <span className="truncate">{h.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{h.city}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
