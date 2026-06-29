import { useDashboard } from "@/contexts/DashboardContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, LayoutGrid, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
    const { workspaces, workspaceId, setWorkspaceId } = useDashboard();
    const { isAdmin } = usePermissions();

    if (workspaces.length <= 1) return null;

    const activeWorkspace = workspaces.find((w) => w.id === workspaceId);

    return (
        <div className="px-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "w-full justify-start gap-2 px-2 h-8 hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all",
                            collapsed && "justify-center px-0"
                        )}
                    >
                        <LayoutGrid className="h-4 w-4 text-primary" />
                        {!collapsed && (
                            <>
                                <span className="flex-1 text-left truncate text-xs font-semibold">
                                    {activeWorkspace?.name || "Workspace"}
                                </span>
                                <ChevronRight className="h-3 w-3 opacity-50" />
                            </>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="right" className="w-56">
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-2 px-3">
                        Seus Workspaces
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {workspaces.map((ws) => (
                        <DropdownMenuItem
                            key={ws.id}
                            onClick={() => setWorkspaceId(ws.id)}
                            className={cn(
                                "flex items-center gap-2 cursor-pointer py-2 px-3",
                                ws.id === workspaceId && "bg-primary/5 font-medium"
                            )}
                        >
                            <div className={cn(
                                "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold",
                                ws.id === workspaceId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                                {ws.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="flex-1 truncate">{ws.name}</span>
                            {ws.role === 'owner' && (
                                <Shield className="h-3 w-3 text-amber-500" />
                            )}
                            {ws.id === workspaceId && (
                                <Check className="h-4 w-4 text-primary" />
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
