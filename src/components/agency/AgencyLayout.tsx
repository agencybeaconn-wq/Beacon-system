import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AgencySidebar } from "./AgencySidebar";
import { usePermissions } from "@/contexts/PermissionsContext";
import { AdAccountSelector } from "@/components/AdAccountSelector";
import leverLogo from "@/assets/lever-logo.png";

export function AgencyLayout({ children }: { children: React.ReactNode }) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { isClient } = usePermissions();

    // SECURITY: If user is a Client, redirect them OUT of here immediately.
    useEffect(() => {
        if (isClient) {
            navigate("/portal");
        }
    }, [isClient, navigate]);

    // Close mobile menu on navigation
    useEffect(() => {
        setIsMobileOpen(false);
    }, [location.pathname]);

    if (isClient) return null; // Prevent flash of content

    return (
        // Fundo transparente: o campo ambiente do body atravessa e da ao vidro
        // o que refratar. A chrome flutua sobre ele (layout Liquid Glass).
        <div className="flex h-screen w-full overflow-hidden bg-transparent selection:bg-primary/30 selection:text-primary">
            {/* Sidebar flutuante: inset da borda, canto de janela, vidro */}
            <div className="hidden md:block h-full w-[272px] flex-shrink-0 z-30 p-3 pr-0">
                <div className="mat-chrome-panel h-full w-64 overflow-hidden">
                    <AgencySidebar />
                </div>
            </div>

            {/* Mobile Header & Sidebar */}
            <div className="mat-chrome scroll-edge md:hidden fixed top-0 left-0 right-0 h-16 z-40 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                    <img src={leverLogo} alt="NODE" className="h-4 w-auto" />
                    <span className="font-semibold text-lg text-foreground tracking-tight">System</span>
                </div>

                <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="w-6 h-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-80 border-r border-border bg-background">
                        <AgencySidebar onNavigate={() => setIsMobileOpen(false)} />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 w-full bg-transparent flex flex-col h-full overflow-hidden pt-16 md:pt-0">

                {/* Topbar flutuante: pill de vidro inset, nao barra colada */}
                <header className="sticky top-0 z-20 shrink-0 px-3 pt-3 md:px-4">
                    <div className="mat-chrome-panel flex min-h-14 items-center justify-between px-4 md:px-6 w-full">
                        <AdAccountSelector />
                    </div>
                </header>

                {/* Page Content Region */}
                <div className="flex-1 w-full p-4 md:p-8 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-500 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                    {children}
                </div>
            </main>
        </div>
    );
}
