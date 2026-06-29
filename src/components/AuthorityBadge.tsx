import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { useUserAuthority } from "@/hooks/useUserAuthority";
import { AuthorityHoverCard } from "./AuthorityHoverCard";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export function AuthorityBadge({ useMockData = false }: { useMockData?: boolean }) {
  const { authority, isLoading } = useUserAuthority(useMockData);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (!authority) {
    return null;
  }

  const { tier } = authority;

  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <Link to="/career" className="inline-block">
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer transition-all hover:scale-105 px-3 py-1.5 border-2 font-semibold",
              tier.color,
              tier.id === "whale_commander" && "animate-pulse"
            )}
          >
            <span className="text-base mr-1.5">{tier.icon}</span>
            <span className="text-xs hidden sm:inline">{tier.displayName}</span>
          </Badge>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0" align="end">
        <AuthorityHoverCard authority={authority} />
      </HoverCardContent>
    </HoverCard>
  );
}

