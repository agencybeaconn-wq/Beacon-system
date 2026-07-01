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
    const { abacRole, isClient, linkedClientId, isPendingIdentity, isLoading } = usePermissions();

    // Guard: o portal é do CLIENTE. Fica quem é cliente real (isClient) OU admin impersonando
    // um cliente selecionado (abacRole ADMIN + linkedClientId setado). Um agency admin/operator
    // SEM cliente vinculado (ex.: admin recém-convidado) é devolvido ao dashboard — senão fica
    // preso aqui e o briefing roda sem client_id ("Verificando briefing..." eterno).
    // Só decide/expulsa com a identidade RESOLVIDA: nunca durante loading nem na janela de
    // token-race pós-login (isPendingIdentity), pra não chutar cliente real que ainda resolve.
    const canAccessPortal = isClient || (abacRole === 'ADMIN' && !!linkedClientId);

    useEffect(() => {
        if (!isLoading && !isPendingIdentity && !canAccessPortal) {
            console.log('[PortalLayout] Sem identidade de cliente no portal, voltando ao dashboard...');
            navigate('/', { replace: true });
        }
    }, [canAccessPortal, isLoading, isPendingIdentity, navigate]);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Show loading while determining permissions (inclui a janela de token-race pós-login:
    // enquanto a identidade não resolve, spinner — não decide portal-sim/não com dado transitório).
    if (isLoading || isPendingIdentity) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Rede de segurança: identidade já resolvida e sem acesso de cliente → não renderiza
    // (o effect acima redireciona pro dashboard). Evita piscar o portal pra quem não é cliente.
    if (!canAccessPortal) {
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

