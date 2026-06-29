import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { PermissionGuard } from "../PermissionGuard";
import { PortalSidebar } from "./PortalSidebar";
import { PortalLogo } from "./PortalLogo";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Loader2, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PortalLayout({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { abacRole, isLoading } = usePermissions();

    // Guard: Only clients can access portal directly via this layout's normal checks (Admins might impersonate but let's stick to abacRole for now)
    useEffect(() => {
        if (!isLoading && abacRole !== 'CLIENTE' && abacRole !== 'ADMIN') {
            console.log('[PortalLayout] Non-client/admin detected, redirecting to home...');
            navigate('/', { replace: true });
        }
    }, [abacRole, isLoading, navigate]);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Show loading while determining permissions
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // If not client (shouldn't happen due to effect, but safety)
    if (abacRole !== 'CLIENTE' && abacRole !== 'ADMIN') {
        return null;
    }

    return (
        <PermissionGuard action="read" resource="solicitacoes">
            <div className="flex min-h-screen bg-background relative">
                {/* Desktop Sidebar */}
                <div className="hidden md:block">
                    <PortalSidebar />
                </div>

                {/* Mobile Header and Menu */}
                <div className="flex-1 flex flex-col min-w-0 h-screen">
                    <header className="md:hidden flex h-16 shrink-0 items-center justify-between border-b border-border/10 px-6 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
                        <PortalLogo size="sm" />

                        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="md:hidden">
                                    <Menu className="h-6 w-6" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 border-none w-72">
                                <PortalSidebar onNavigate={() => setIsMobileMenuOpen(false)} />
                            </SheetContent>
                        </Sheet>
                    </header>

                    <main className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background to-primary/5">
                        {location.pathname === '/portal/biblioteca' ? (
                            /* Biblioteca: full edge-to-edge, sem padding */
                            <>{children}</>
                        ) : (
                            <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8 w-full">
                                {children}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </PermissionGuard>
    );
}

