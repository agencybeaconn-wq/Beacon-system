import { LayoutDashboard, Users, Briefcase, ClipboardCheck, ClipboardList, Link as LinkIcon, Wrench, LucideIcon, Sparkles, Activity, ChevronRight, Calendar, GraduationCap, Play, Settings2, ShoppingCart, TrendingUp, Repeat } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { AccountDetailsPopover } from "@/components/sidebar/AccountDetailsPopover";

import leverLogo from "@/assets/lever-logo.png";

interface MenuItem {
    title: string;
    icon: LucideIcon;
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
            icon: LayoutDashboard,
            path: "/agency/dashboard",
        },
        {
            title: "Demandas",
            icon: ClipboardList,
            path: "/agency/general-board",
            children: [
                { title: "Fixo (MRR)", icon: Repeat, path: "/agency/general-board?type=fixo" },
                { title: "Avulso", icon: Briefcase, path: "/agency/general-board?type=avulso" },
            ],
        },
        {
            title: "Prazos de Entrega",
            icon: Briefcase,
            path: "/agency/active-projects",
        },
        {
            title: "Solicitações",
            icon: ClipboardCheck,
            path: "/agency/solicitacoes",
        },
        {
            title: "Comercial",
            icon: TrendingUp,
            path: "/agency/comercial",
        },
        {
            title: "Clientes",
            icon: Users,
            path: "/agency/clients",
            children: [
                { title: "Onboarding", icon: ClipboardCheck, path: "/agency/client-onboarding" },
                { title: "Briefing", icon: ClipboardList, path: "/agency/client-briefing" },
                { title: "Documentos", icon: Briefcase, path: "/agency/documentos" },
                { title: "Preços", icon: Activity, path: "/agency/precos" },
                { title: "Conexões", icon: LinkIcon, path: "/agency/connections" },
                { title: "Configurações", icon: Settings2, path: "/agency/client-config" },
            ]
        },
        {
            title: "Ferramentas",
            icon: Wrench,
            path: "",
            children: [
                {
                    title: "Shopify Manager",
                    icon: ShoppingCart,
                    path: "/agency/shopify-manager",
                },
                {
                    title: "Estúdio IA",
                    icon: Sparkles,
                    path: "/agency/estudio-ia",
                },
                {
                    title: "Claude Skills",
                    icon: Sparkles,
                    path: "/agency/skills",
                }
            ]
        },
        {
            title: "Google Calendar",
            icon: Calendar,
            path: "/agency/google-calendar",
        },
        {
            title: "Treinamentos",
            icon: GraduationCap,
            path: "",
            children: [
                {
                    title: "Biblioteca",
                    icon: Play,
                    path: "/agency/treinamentos",
                },
                {
                    title: "Gerenciar",
                    icon: Settings2,
                    path: "/agency/treinamentos/gerenciar",
                }
            ]
        },
        {
            title: "Briefing",
            icon: ClipboardCheck,
            path: "",
            children: [
                {
                    title: "Formulário",
                    icon: ClipboardList,
                    path: "/agency/briefing/formulario",
                },
                {
                    title: "Arquivos",
                    icon: Briefcase,
                    path: "/agency/briefing/arquivos",
                }
            ]
        },
        {
            title: "Monitoramento",
            icon: Activity,
            path: "/agency/logs",
            adminOnly: true,
        },
        {
            title: "Configurações",
            icon: Settings2,
            path: "/agency/settings",
            adminOnly: true,
        },
    ];

    return (
        <div className="w-full md:w-64 h-full border-r border-border bg-background flex flex-col">
            <div className="flex flex-col border-b border-border/40 transition-all duration-200 h-16 justify-center px-5 shrink-0 mb-6">
                <Link to="/agency/dashboard" className="hover:opacity-80 transition-opacity">
                    <div className="flex items-center gap-2">
                        <img src={leverLogo} alt="Beacon" className="h-7 w-auto" />
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
                                        "flex items-center w-full transition-all duration-300 ease-out rounded-none border-none group",
                                        (isParentActive || isAnyChildActive)
                                            ? "text-primary"
                                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
                                                        "flex items-center gap-2.5 py-1.5 transition-all duration-300 ease-out font-medium w-full text-[13px] pl-11 pr-4 rounded-none",
                                                        isChildActive
                                                            ? "text-primary bg-primary/10 font-bold border-r-2 border-primary"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
                                "flex items-center w-full transition-all duration-300 ease-out px-4 py-1.5 rounded-none border-none group",
                                isActive
                                    ? "text-primary font-bold bg-primary/10 shadow-sm relative"
                                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary animate-in slide-in-from-left-1 duration-300" />
                            )}
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
                <div className="flex items-center justify-between w-full px-2">
                    <span className="text-xs text-muted-foreground font-medium tracking-wide">Tema</span>
                    <ThemeToggleButton />
                </div>
            </div>
        </div>
    );
}
