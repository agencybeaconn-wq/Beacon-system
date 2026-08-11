import { ChevronRight } from "lucide-react";
// Ícones do menu: Heroicons (desenho arredondado, espírito SF Symbols)
import {
    Squares2X2Icon,
    ClipboardDocumentListIcon,
    ClipboardDocumentCheckIcon,
    FlagIcon,
    BriefcaseIcon,
    ArrowTrendingUpIcon,
    UserGroupIcon,
    ArrowPathIcon,
    LinkIcon as LinkIconHero,
    AdjustmentsHorizontalIcon,
    WrenchScrewdriverIcon,
    ShoppingCartIcon,
    SparklesIcon,
    ChartBarIcon,
    CalendarDaysIcon,
    AcademicCapIcon,
    PlayIcon,
    Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { Link, useLocation } from "react-router-dom";
import { useState, type ElementType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { AccountDetailsPopover } from "@/components/sidebar/AccountDetailsPopover";

import leverLogo from "@/assets/lever-logo.png";

interface MenuItem {
    title: string;
    icon: ElementType;
    path: string;
    children?: MenuItem[];
    adminOnly?: boolean;
}

import { AdAccountSelector } from "@/components/AdAccountSelector";

export function AgencySidebar({ onNavigate }: { onNavigate?: () => void }) {
    const location = useLocation();
    const { signOut } = useAuth();
    const { clientData } = useDashboard();
    const { isAdmin } = usePermissions();
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
        "Ferramentas": true // Open by default or keep it closed? I will default to false, or true if child is active
    });

    // MENU FOR EMPLOYEES (Agency Tools - ABAC Enforced)
    const menuItems: MenuItem[] = [
        {
            title: "Visão Geral",
            icon: Squares2X2Icon,
            path: "/agency/dashboard",
        },
        {
            title: "Demandas",
            icon: ClipboardDocumentListIcon,
            path: "/agency/general-board",
            children: [
                { title: "Fixo (MRR)", icon: ArrowPathIcon, path: "/agency/general-board?type=fixo" },
                { title: "Avulso", icon: BriefcaseIcon, path: "/agency/general-board?type=avulso" },
            ],
        },
        {
            title: "Prioridades",
            icon: FlagIcon,
            path: "/agency/prioridades",
        },
        {
            title: "Prazos de Entrega",
            icon: BriefcaseIcon,
            path: "/agency/active-projects",
        },
        {
            title: "Solicitações",
            icon: ClipboardDocumentCheckIcon,
            path: "/agency/solicitacoes",
        },
        {
            title: "Comercial",
            icon: ArrowTrendingUpIcon,
            path: "/agency/comercial",
        },
        {
            title: "Clientes",
            icon: UserGroupIcon,
            path: "/agency/clients",
            children: [
                { title: "Onboarding", icon: ClipboardDocumentCheckIcon, path: "/agency/client-onboarding" },
                { title: "Briefing", icon: ClipboardDocumentListIcon, path: "/agency/client-briefing" },
                { title: "Documentos", icon: BriefcaseIcon, path: "/agency/documentos" },
                { title: "Preços", icon: ChartBarIcon, path: "/agency/precos" },
                { title: "Conexões", icon: LinkIconHero, path: "/agency/connections" },
                { title: "Configurações", icon: Cog6ToothIcon, path: "/agency/client-config" },
            ]
        },
        {
            title: "Ferramentas",
            icon: WrenchScrewdriverIcon,
            path: "",
            children: [
                {
                    title: "Shopify Manager",
                    icon: ShoppingCartIcon,
                    path: "/agency/shopify-manager",
                },
                {
                    title: "Estúdio IA",
                    icon: SparklesIcon,
                    path: "/agency/estudio-ia",
                },
                {
                    title: "Claude Skills",
                    icon: SparklesIcon,
                    path: "/agency/skills",
                }
            ]
        },
        {
            title: "Google Calendar",
            icon: CalendarDaysIcon,
            path: "/agency/google-calendar",
        },
        {
            title: "Treinamentos",
            icon: AcademicCapIcon,
            path: "",
            children: [
                {
                    title: "Biblioteca",
                    icon: PlayIcon,
                    path: "/agency/treinamentos",
                },
                {
                    title: "Gerenciar",
                    icon: Cog6ToothIcon,
                    path: "/agency/treinamentos/gerenciar",
                }
            ]
        },
        {
            title: "Briefing",
            icon: ClipboardDocumentCheckIcon,
            path: "",
            children: [
                {
                    title: "Formulário",
                    icon: ClipboardDocumentListIcon,
                    path: "/agency/briefing/formulario",
                },
                {
                    title: "Arquivos",
                    icon: BriefcaseIcon,
                    path: "/agency/briefing/arquivos",
                }
            ]
        },
        {
            title: "Monitoramento",
            icon: ChartBarIcon,
            path: "/agency/logs",
            adminOnly: true,
        },
        {
            title: "Configurações",
            icon: Cog6ToothIcon,
            path: "/agency/settings",
            adminOnly: true,
        },
    ];

    return (
        // Transparente: o vidro vive no painel flutuante do AgencyLayout —
        // material sobre material colapsa a legibilidade.
        <div className="w-full md:w-64 h-full bg-transparent flex flex-col">
            <div className="flex flex-col border-b border-border/40 transition-all duration-200 h-16 justify-center px-5 shrink-0 mb-6">
                <Link to="/agency/dashboard" className="hover:opacity-80 transition-opacity">
                    <div className="flex items-center gap-2">
                        <img src={leverLogo} alt="NODE" className="h-4 w-auto" />
                        <span className="font-bold text-lg text-foreground tracking-tight">System</span>
                    </div>
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {menuItems.filter(item => !item.adminOnly || isAdmin).map((item) => {
                    const isActive = location.pathname === item.path;
                    const hasChildren = item.children && item.children.length > 0;

                    if (hasChildren) {
                        const matchChild = (childPath: string) => {
                            if (childPath.includes('?')) {
                                const [p, q] = childPath.split('?');
                                return location.pathname === p && location.search === `?${q}`;
                            }
                            return location.pathname === childPath;
                        };
                        const isAnyChildActive = item.children?.some(c => matchChild(c.path));
                        const isParentActive = !!item.path && location.pathname === item.path;
                        const isOpen = openMenus[item.title] || isAnyChildActive;
                        const hasOwnPath = !!item.path;

                        return (
                            <div key={item.title} className="flex flex-col">
                                <div
                                    className={cn(
                                        "flex items-center mx-2 rounded-[10px] overflow-hidden transition-colors duration-200 ease-out border-none group",
                                        (isParentActive || isAnyChildActive)
                                            ? "text-primary"
                                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70"
                                    )}
                                >
                                    {hasOwnPath ? (
                                        <Link
                                            to={item.path}
                                            onClick={() => onNavigate?.()}
                                            className={cn(
                                                "flex items-center gap-3 flex-1 px-4 py-1.5",
                                                isParentActive && "bg-primary/10 font-bold"
                                            )}
                                        >
                                            <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", (isParentActive || isAnyChildActive) ? "text-primary" : "text-muted-foreground group-hover:text-primary")} strokeWidth={1.5} />
                                            <span className={cn("text-left text-base tracking-tight truncate", (isParentActive || isAnyChildActive) && "text-primary font-bold")}>{item.title}</span>
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={() => setOpenMenus(prev => ({ ...prev, [item.title]: !prev[item.title] }))}
                                            className="flex items-center gap-3 flex-1 px-4 py-1.5"
                                        >
                                            <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", isAnyChildActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} strokeWidth={1.5} />
                                            <span className={cn("text-left text-base tracking-tight truncate", isAnyChildActive && "text-primary font-bold")}>{item.title}</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenus(prev => ({ ...prev, [item.title]: !prev[item.title] }));
                                        }}
                                        className="px-2 py-1.5 mr-1 hover:text-primary"
                                        aria-label={`Alternar submenu ${item.title}`}
                                    >
                                        <ChevronRight className={cn("w-4 h-4 transition-transform", isOpen && "rotate-90", (isParentActive || isAnyChildActive) ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                                    </button>
                                </div>

                                {isOpen && (
                                    <div className="flex flex-col space-y-1 mt-1 pb-2">
                                        {item.children?.map(child => {
                                            const isChildActive = matchChild(child.path);
                                            return (
                                                <Link
                                                    key={child.path}
                                                    to={child.path}
                                                    onClick={() => onNavigate?.()}
                                                    className={cn(
                                                        "flex items-center gap-2.5 py-1.5 transition-colors duration-200 ease-out font-medium text-[13px] mx-2 rounded-[10px] pl-9 pr-4",
                                                        isChildActive
                                                            ? "text-primary bg-primary/10 font-semibold"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70"
                                                    )}
                                                >
                                                    <child.icon className={cn("h-[14px] w-[14px] shrink-0 transition-colors", isChildActive ? "text-primary" : "text-muted-foreground")} />
                                                    {child.title}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => onNavigate?.()}
                            className={cn(
                                "flex items-center transition-colors duration-200 ease-out mx-2 px-3 py-1.5 rounded-[10px] border-none group",
                                isActive
                                    ? "text-primary font-semibold bg-primary/10"
                                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/70"
                            )}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} strokeWidth={1.5} />
                                <span className="text-left text-base tracking-tight truncate">{item.title}</span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-border/50 flex flex-col gap-3">
                <div className="flex items-center justify-between w-full">
                    <AccountDetailsPopover />
                </div>
            </div>
        </div>
    );
}
