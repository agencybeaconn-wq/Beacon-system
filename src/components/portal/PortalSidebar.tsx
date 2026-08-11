// Heroicons: desenho arredondado, espírito SF Symbols
import {
    PlusCircleIcon,
    Squares2X2Icon,
    DocumentTextIcon,
    ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import { Link, useLocation } from "react-router-dom";
import { type ElementType } from "react";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/contexts/DashboardContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { PortalLogo } from "./PortalLogo";
import { AccountDetailsPopover } from "@/components/sidebar/AccountDetailsPopover";

interface MenuItem {
    title: string;
    icon: ElementType;
    path: string;
    children?: MenuItem[];
}

export function PortalSidebar({ onNavigate }: { onNavigate?: () => void }) {
    const location = useLocation();
    const { clientData } = useDashboard();
    const { linkedClientName } = usePermissions();

    const companyName = linkedClientName || clientData?.name || "Minha Loja";

    // MENU FOR CLIENTS (External - Restricted)
    // Apenas as 3 seções essenciais: Briefing, Nova Solicitação e Quadro de Demandas
    const clientMenuItems: MenuItem[] = [
        {
            title: "Briefing",
            icon: DocumentTextIcon,
            path: "/portal/briefing",
        },
        {
            title: "Nova Solicitação",
            icon: PlusCircleIcon,
            path: "/portal/new-demand",
        },
        {
            title: "Quadro de Demandas",
            icon: Squares2X2Icon,
            path: "/portal/tasks",
        },
        {
            title: "Entregas",
            icon: ArchiveBoxIcon,
            path: "/portal/entregas",
        },
    ];

    return (
        <div className="mat-chrome-panel w-full md:w-64 h-full md:m-3 md:h-[calc(100%-24px)] overflow-hidden flex flex-col pt-6 animate-in fade-in duration-300 motion-reduce:animate-none">
            <div className="px-6 mb-5">
                <PortalLogo size="md" />
            </div>

            {clientData && (
                <div className="px-3 mb-3">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/40 flex items-center gap-3">
                        {clientData.logo_url ? (
                            <img src={clientData.logo_url} alt={companyName} className="w-10 h-10 rounded-md object-contain bg-black/20" />
                        ) : (
                            <div className="w-10 h-10 rounded-md bg-primary/20 flex items-center justify-center text-primary font-bold">
                                {companyName.charAt(0)}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-0.5">Empresa</p>
                            <p className="text-sm font-bold truncate tracking-tight">{companyName}</p>
                        </div>
                    </div>
                </div>
            )}

            <nav className="flex-1 px-4 space-y-1 pt-2 border-t border-border/40">
                {clientMenuItems.map((item) => {
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => onNavigate?.()}
                            className={cn(
                                "flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold transition-all group",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                            {item.title}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-3 border-t border-border/40 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <AccountDetailsPopover />
                </div>
            </div>
        </div>
    );
}
