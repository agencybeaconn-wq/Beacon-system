import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AgencySidebar } from "./AgencySidebar";
import { usePermissions } from "@/contexts/PermissionsContext";
import { AdAccountSelector } from "@/components/AdAccountSelector";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Shell do colaborador — agora idêntico ao DashboardLayout admin:
 * SidebarProvider + Sidebar shadcn (recolhe pra ícones, anima, vidro) +
 * SidebarInset com a topbar flutuante (trigger, seletor, tema, sino).
 */
export function AgencyLayout({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();
    const { isClient } = usePermissions();

    // SEGURANÇA: cliente não fica na área de colaborador.
    useEffect(() => {
        if (isClient) navigate("/portal");
    }, [isClient, navigate]);

    if (isClient) return null;

    // defaultOpen=false: nasce recolhida em ícones (igual admin), abre no hover
    return (
        <SidebarProvider defaultOpen={false}>
            <AgencySidebar />
            <SidebarInset className="w-full max-w-[100vw] overflow-x-hidden m-0 box-border bg-transparent">
                {/* Topbar flutuante de vidro — mesma da admin */}
                <header className="sticky top-0 z-50 shrink-0 px-3 pt-3">
                    <div className="mat-chrome-panel flex h-14 items-center justify-between px-4 w-full">
                        <div className="flex items-center gap-4 flex-1">
                            <SidebarTrigger className="shrink-0 md:hidden">
                                <Menu className="h-5 w-5" />
                            </SidebarTrigger>
                            <div className="w-full max-w-sm shrink-0">
                                <AdAccountSelector />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <ThemeToggle />
                            <NotificationBell />
                        </div>
                    </div>
                </header>

                <div className="flex-1 w-full p-4 md:p-8 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-500">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
