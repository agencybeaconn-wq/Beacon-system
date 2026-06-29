import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Menu, Bell, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AdAccountSelector } from "@/components/AdAccountSelector";
import { NotificationBell } from "@/components/NotificationBell";
import { GamificationProgressBar } from "@/components/GamificationProgressBar";
import { useLocation, Navigate } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { BackButton } from "@/components/ui/BackButton";

// Inner component to access sidebar context (useSidebar must be inside SidebarProvider)
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [reauthRequired, setReauthRequired] = useState(false);

  const { isAdmin, isClient, isLoading: permissionsLoading, abacRole, isPendingIdentity } = usePermissions();

  // SECURITY GUARD: Show spinner only during actual loading
  if (permissionsLoading) {
    return (
      <SidebarInset className="w-full max-w-[100vw] overflow-x-hidden m-0 box-border bg-background">
        <div className="h-screen flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </SidebarInset>
    );
  }

  // If not admin and not client (unlinked user), show access denied
  if (!isAdmin && !isClient && isPendingIdentity) {
    return (
      <SidebarInset className="w-full max-w-[100vw] overflow-x-hidden m-0 box-border bg-muted/20">
        <div className="h-screen flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md bg-card rounded-xl border border-border/50 shadow-xl p-8 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">

            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <PanelLeft className="w-8 h-8 text-primary" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Acesso ao Portal</h1>
              <p className="text-muted-foreground text-sm">
                Estamos finalizando a identificação da sua conta. Clique abaixo para acessar.
              </p>
            </div>

            <Button
              className="w-full h-11 font-bold text-base shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
              onClick={() => window.location.href = '/portal'}
            >
              Acessar meu Portal <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </SidebarInset>
    );
  }

  // If client, redirect to portal (shouldn't happen as PortalLayout should catch them)
  if (isClient && !isAdmin) {
    return <Navigate to="/portal" replace />;
  }

  useEffect(() => {
    const checkConnections = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check for any connection requiring reauth in any workspace user belongs to
        // For simplicity, checking all connections for the user's workspaces would be ideal
        // But here we might just check the current workspace context if available, or just all connections linked to workspaces user owns
        // Let's assume we check ALL connections accessible to the user

        // 1. Get workspaces user is part of (using team_members which has actual data)
        const { data: members } = await (supabase as any)
          .from('team_members')
          .select('workspace_id')
          .ilike('email', user.email || '');
        if (!members?.length) return;

        const workspaceIds = members.map(m => m.workspace_id).filter(Boolean);

        // Skip if no workspace IDs (avoids 400 error with empty .in() array)
        if (workspaceIds.length === 0) return;

        const { count, error: connError } = await supabase
          .from('fb_connections')
          .select('id', { count: 'exact', head: true })
          .in('workspace_id', workspaceIds)
          .eq('status', 'reauth_required');

        if (connError) {
          console.warn('[DashboardLayout] fb_connections query error:', connError);
          return;
        }

        if (count && count > 0) {
          setReauthRequired(true);
        }
      } catch (err) {
        console.error("Failed to check connection health", err);
      }
    };

    checkConnections();
  }, [location.pathname]); // Re-check on navigation

  // Pages where the full header should be hidden (only mobile sidebar trigger shown)
  const hideFullHeader = ['/clients', '/connections', '/team', '/settings'].includes(location.pathname);

  return (
    <SidebarInset className="w-full max-w-[100vw] overflow-x-hidden m-0 box-border bg-transparent">

      {/* Re-Auth Alert Banner - Global */}
      {reauthRequired && (
        <div className="bg-destructive/10 border-b border-destructive/20 w-full px-4 py-2 flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            {t("layout.reauth_banner", "Attention: One or more Facebook connections have expired.")}
          </p>
          <Link to="/connections" className="text-sm font-bold text-destructive hover:underline flex items-center gap-0.5 ml-2">
            {t("layout.reconnect_now", "Reconnect now")} <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/40 px-4 w-full bg-background/60 backdrop-blur-[30px] saturate-[200%] sticky top-0 z-50 transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none">
        <div className="flex items-center gap-4 flex-1">
          <SidebarTrigger className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>

          <div className="w-full max-w-sm shrink-0">
            <AdAccountSelector />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell />
        </div>
      </header>
      <main className="w-full flex-1 overflow-x-hidden p-0 m-0 relative">
        <div className="flex-1 w-full h-full max-w-full m-0">
          {children}
        </div>
      </main>
    </SidebarInset>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
