import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "./components/DashboardLayout";
import { PortalLayout } from "./components/portal/PortalLayout";
import Overview from "./pages/Overview";
import OverviewClone from "./pages/OverviewClone";
import AdminDashboard from "./dashboard/pages/AdminDashboard";
import AgencyDashboardKpi from "./dashboard/pages/AgencyDashboardKpi";
import PortalDashboardKpi from "./dashboard/pages/PortalDashboardKpi";
import Connections from "./pages/Connections";
import AnalyticsPage from "./pages/AnalyticsPage";
import SettingsPage from "./pages/SettingsPage";
import Financeiro from "./pages/Financeiro";
import FinanceiroAcademy from "./pages/FinanceiroAcademy";
import Comercial from "./pages/Comercial";
import RankingClientes from "./pages/RankingClientes";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";
import TasksPage from "./pages/TasksPage";
import Solicitacoes from "./pages/Solicitacoes";
import Assets from "./pages/Assets";
import Products from "./pages/Products";
import AccountGroups from "./pages/AccountGroups";
import TeamConnections from "./pages/TeamConnections";
import OnboardingWizard from "./pages/OnboardingWizard";
import WhatsApp from "./pages/WhatsApp";
import TrackingDashboard from "./pages/TrackingDashboard";
import PortalVisaoGeral from "./pages/portal/PortalVisaoGeral";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalNewDemand from "./pages/portal/PortalNewDemand";
import PortalTasks from "./pages/portal/PortalTasks";
import PortalGeneralBoard from "./pages/portal/PortalGeneralBoard";
import PortalClients from "./pages/portal/PortalClients";
import PortalClientTasks from "./pages/portal/PortalClientTasks";
import PortalMyTasks from "./pages/portal/PortalMyTasks";
import PortalResources from "./pages/portal/PortalResources";
import PortalBiblioteca from "./pages/portal/PortalBiblioteca";
import AcademyAuth from "./pages/academy/AcademyAuth";
import AulaVibeCodingShopify from "./pages/landing/aula-vibe-coding-shopify/page";
import AcademyHome from "./pages/academy/AcademyHome";
import AcademyModulePage from "./pages/academy/AcademyModule";
import AcademyLessonPage from "./pages/academy/AcademyLesson";
import AcademyAdmin from "./pages/academy/AcademyAdmin";
import AcademyAdminLesson from "./pages/academy/AcademyAdminLesson";
import AcademyPreviewLesson from "./pages/academy/AcademyPreviewLesson";
import AcademyForgotPassword from "./pages/academy/AcademyForgotPassword";
import AcademyResetPassword from "./pages/academy/AcademyResetPassword";
import AcademyInviteRedeem from "./pages/academy/AcademyInviteRedeem";
import AcademyPrivateLesson from "./pages/academy/AcademyPrivateLesson";
import { AcademyProvider } from "./contexts/AcademyContext";
import ClientPortal from "./pages/ClientPortal";
import MetaCallback from "./pages/MetaCallback";
import AcceptInvite from "./pages/AcceptInvite";
import Home from "./pages/Home";
import { LandingRedirect } from "./components/LandingRedirect";
import FinancialDashboard from "./pages/financial/Dashboard";
import FinancialCosts from "./pages/financial/Costs";
import SmartDataViz from "./pages/SmartDataViz";
import TimelinePage from "./pages/TimelinePage";
import ProjetosAtivos from "./pages/ProjetosAtivos";
import ClientConnectionsPage from "./pages/ClientConnectionsPage";
import ClientTimelinePage from "./pages/ClientTimelinePage";
import ClientOnboardingPage from "./pages/ClientOnboardingPage";
import ClientBriefingPage from "./pages/ClientBriefingPage";
import PedidosPage from "./pages/PedidosPage";
import DocumentosPage from "./pages/DocumentosPage";
import ClientConfigPage from "./pages/ClientConfigPage";
import ClientPricingPage from "./pages/ClientPricingPage";
import ShopifyManagerPage from "./pages/ShopifyManagerPage";
import StoreDeploymentPage from "./pages/StoreDeploymentPage";
import EstudioIAPage from "./pages/EstudioIAPage";
import SkillsPage from "./pages/SkillsPage";
import GeneralBoard from "./pages/GeneralBoard";
import Paineis from "./pages/Paineis";
import BulkEditorPage from "./pages/BulkEditorPage";
import GoogleCalendarPage from "./pages/GoogleCalendarPage";
import SystemLogs from "./pages/SystemLogs";
import GoogleDrivePage from "./pages/GoogleDrivePage";
import TrainingLibrary from "./pages/TrainingLibrary";
import TrainingLibraryManager from "./components/training/TrainingLibraryManager";
import BriefingForm from "./pages/BriefingForm";
import BriefingArchive from "./pages/BriefingArchive";
import { DashboardProvider } from "./contexts/DashboardContext";
import { ChatProvider } from "./contexts/ChatContext";
import { AccountTypeProvider } from "./contexts/AccountTypeContext";
import { AccountWizardContainer } from "./components/AccountWizardContainer";

import { AuthProvider } from "./contexts/AuthContext";
import { TasksProvider } from "./contexts/TasksContext";
import { PermissionsProvider } from "./contexts/PermissionsContext";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AbacRoute } from "./components/AbacRoute";
import { PostHogProvider } from "./contexts/PostHogProvider";
import { AgencyLayout } from "./components/agency/AgencyLayout";
import AgencyDashboard from "./pages/agency/AgencyDashboard";
import AgencyGeneralBoard from "./pages/agency/AgencyGeneralBoard";
import AgencyClients from "./pages/agency/AgencyClients";
import AgencyNewDemand from "./pages/agency/AgencyNewDemand";
import AgencySmartData from "./pages/agency/AgencySmartData";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// Deep Link Handler for iOS OAuth AND Web Invite Tokens
const DeepLinkHandler = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Handle Web Invite Tokens (runs on initial load)
    const hash = window.location.hash;
    const pathname = window.location.pathname;

    if (hash && hash.includes('access_token') && hash.includes('type=invite')) {
      // ONLY redirect if we are NOT already on the accept-invite page
      if (!pathname.includes('/auth/accept-invite')) {
        console.log('📧 [InviteHandler] Detected invite token in URL, redirecting to accept-invite page...');
        window.location.href = '/auth/accept-invite' + hash;
        return;
      }
    }

    // Listen for app URL open events (deep links - iOS)
    CapacitorApp.addListener('appUrlOpen', async (event: { url: string }) => {
      console.log('🔗 [DeepLink] URL received:', event.url);

      try {
        const url = new URL(event.url);

        // Check if URL contains OAuth tokens in hash
        if (url.hash && url.hash.includes('access_token')) {
          const params = new URLSearchParams(url.hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const type = params.get('type');

          // If it's an invite, redirect to accept-invite page
          if (type === 'invite') {
            window.location.href = '/auth/accept-invite' + url.hash;
            return;
          }

          if (access_token && refresh_token) {
            console.log('🔑 [DeepLink] Setting session with tokens...');
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token
            });

            if (error) {
              console.error('❌ [DeepLink] Error setting session:', error);
            } else {
              console.log('✅ [DeepLink] Session set successfully!');
              // Redirect to main app after successful auth
              window.location.href = '/';
            }
          }
        }
      } catch (error) {
        console.error('❌ [DeepLink] Error processing URL:', error);
      }
    });

    // Cleanup listener on unmount
    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, []);

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
      <DeepLinkHandler>
        <TooltipProvider>
          <AccountTypeProvider>
            <AuthProvider>
              <DashboardProvider>
                <PermissionsProvider>
                  <TasksProvider>
                    <ChatProvider>
                      <Toaster />
                      <Sonner />
                      <AccountWizardContainer />
                      <BrowserRouter>
                        <PostHogProvider>
                          <ErrorBoundary>
                            <Routes>
                              {/* AULA VIBE CODING — standalone, sem auth (apresentação ao vivo) */}
                              <Route path="/aula/vibe-coding-shopify" element={<AulaVibeCodingShopify />} />

                              {/* LEVER ACADEMY ROUTES (standalone, own auth/context) */}
                              <Route path="/academy/login" element={<AcademyProvider><AcademyAuth /></AcademyProvider>} />
                              <Route path="/academy/esqueci-senha" element={<AcademyForgotPassword />} />
                              <Route path="/academy/redefinir-senha" element={<AcademyResetPassword />} />
                              <Route path="/academy" element={<AcademyProvider><AcademyHome /></AcademyProvider>} />
                              <Route path="/academy/meus-cursos" element={<AcademyProvider><AcademyHome /></AcademyProvider>} />
                              <Route path="/academy/curso/:slug" element={<AcademyProvider><AcademyModulePage /></AcademyProvider>} />
                              <Route path="/academy/curso/:slug/aula/:lessonId" element={<AcademyProvider><AcademyLessonPage /></AcademyProvider>} />
                              <Route path="/academy/admin" element={<AcademyProvider><AcademyAdmin /></AcademyProvider>} />
                              <Route path="/academy/admin/modulos" element={<AcademyProvider><AcademyAdmin /></AcademyProvider>} />
                              <Route path="/academy/admin/aulas" element={<AcademyProvider><AcademyAdmin /></AcademyProvider>} />
                              <Route path="/academy/admin/convites" element={<AcademyProvider><AcademyAdmin /></AcademyProvider>} />
                              <Route path="/academy/admin/alunos" element={<AcademyProvider><AcademyAdmin /></AcademyProvider>} />
                              <Route path="/academy/admin/moderacao" element={<AcademyProvider><AcademyAdmin /></AcademyProvider>} />
                              <Route path="/academy/admin/aula/:lessonId" element={<AcademyProvider><AcademyAdminLesson /></AcademyProvider>} />
                              <Route path="/academy/preview/:slug/:idx" element={<AcademyProvider><AcademyPreviewLesson /></AcademyProvider>} />
                              <Route path="/academy/convite/:token" element={<AcademyProvider><AcademyInviteRedeem /></AcademyProvider>} />
                              <Route path="/academy/minhas-aulas" element={<AcademyProvider><AcademyPrivateLesson /></AcademyProvider>} />
                              <Route path="/academy/minhas-aulas/:lessonId" element={<AcademyProvider><AcademyPrivateLesson /></AcademyProvider>} />

                              {/* PORTAL ROUTES (Client Facing) */}
                              <Route path="/portal" element={<ProtectedRoute><PortalLayout><PortalDashboard /></PortalLayout></ProtectedRoute>} />
                              <Route path="/portal/visao-geral" element={<ProtectedRoute><PortalLayout><PortalDashboardKpi /></PortalLayout></ProtectedRoute>} />
                              <Route path="/portal/new-demand" element={<ProtectedRoute><PortalLayout><PortalNewDemand /></PortalLayout></ProtectedRoute>} />
                              <Route path="/portal/general-board" element={<ProtectedRoute><PortalLayout><PortalGeneralBoard /></PortalLayout></ProtectedRoute>} />
                              <Route path="/portal/clients" element={<ProtectedRoute><PortalLayout><PortalClients /></PortalLayout></ProtectedRoute>} />
                              <Route path="/portal/client-tasks" element={<ProtectedRoute><PortalLayout><PortalClientTasks /></PortalLayout></ProtectedRoute>} />
                              <Route path="/portal/tasks" element={<ProtectedRoute><PortalLayout><PortalTasks /></PortalLayout></ProtectedRoute>} />
                              <Route path="/portal/my-tasks" element={<ProtectedRoute><PortalLayout><PortalMyTasks /></PortalLayout></ProtectedRoute>} />
                              <Route path="/portal/resources" element={<ProtectedRoute><PortalLayout><PortalResources /></PortalLayout></ProtectedRoute>} />
                              <Route path="/portal/biblioteca" element={<ProtectedRoute><PortalLayout><PortalBiblioteca /></PortalLayout></ProtectedRoute>} />
                              <Route path="/portal/briefing" element={<ProtectedRoute><PortalLayout><BriefingForm /></PortalLayout></ProtectedRoute>} />


                              {/* PUBLIC ROUTE - Legacy Share Portal */}
                              <Route path="/shared/portal/:shareToken" element={<ClientPortal />} />
                              <Route path="/auth/meta/callback" element={<ProtectedRoute><MetaCallback /></ProtectedRoute>} />
                              <Route path="/auth/accept-invite" element={<AcceptInvite />} />

                              <Route path="/login" element={<Login />} />
                              <Route
                                path="/onboarding"
                                element={
                                  <ProtectedRoute>
                                    <OnboardingWizard />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/"
                                element={
                                  <ProtectedRoute>
                                    <LandingRedirect />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/home"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <Home />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/dashboard"
                                element={
                                  <ProtectedRoute requiredFeature="dashboard">
                                    <DashboardLayout>
                                      <AdminDashboard />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/overview-old"
                                element={
                                  <ProtectedRoute requiredFeature="dashboard">
                                    <DashboardLayout>
                                      <Overview />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/clients"
                                element={
                                  <ProtectedRoute requiredFeature="clients">
                                    <DashboardLayout>
                                      <TimelinePage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/clients/:id"
                                element={
                                  <ProtectedRoute requiredFeature="clients">
                                    <DashboardLayout>
                                      <ClientDetails />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/tasks"
                                element={
                                  <ProtectedRoute requiredFeature="demands">
                                    <DashboardLayout>
                                      <TasksPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/general-board"
                                element={
                                  <ProtectedRoute requiredFeature="demands">
                                    <DashboardLayout>
                                      <GeneralBoard />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/solicitacoes"
                                element={
                                  <ProtectedRoute requiredFeature="demands">
                                    <DashboardLayout>
                                      <Solicitacoes />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/graficos"
                                element={
                                  <ProtectedRoute requiredFeature="analytics">
                                    <DashboardLayout>
                                      <AnalyticsPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />

                              {/* ------------ NOVO PORTAL DO FUNCIONARIO (ABAC) ------------ */}
                              <Route path="/agency">
                                <Route index element={<Navigate to="/agency/general-board" replace />} />
                                <Route path="dashboard" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><AgencyDashboardKpi /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="general-board" element={
                                  <AbacRoute resource="quadro_geral" action="read">
                                    <AgencyLayout><AgencyGeneralBoard /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="solicitacoes" element={
                                  <AbacRoute resource="solicitacoes" action="read">
                                    <AgencyLayout><Solicitacoes /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="comercial" element={
                                  <AbacRoute resource="crm" action="read">
                                    <AgencyLayout><Comercial /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="timeline" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><TimelinePage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="active-projects" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><ProjetosAtivos /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="connections" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><ClientConnectionsPage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="clients" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><TimelinePage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="clients/:id" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><ClientDetails /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="pedidos" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><PedidosPage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="documentos" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><DocumentosPage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="precos" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><ClientPricingPage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="client-config" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><ClientConfigPage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="client-briefing" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><ClientBriefingPage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="editor-massa" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><BulkEditorPage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="google-calendar" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><GoogleCalendarPage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="logs" element={
                                  <AbacRoute resource="system_logs" action="read">
                                    <AgencyLayout><SystemLogs /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="shopify-manager" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><ShopifyManagerPage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="estudio-ia" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><EstudioIAPage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="skills" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><SkillsPage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="google-drive" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><GoogleDrivePage /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="treinamentos" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><TrainingLibrary /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="treinamentos/gerenciar" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><TrainingLibraryManager /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="briefing/formulario" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><BriefingForm /></AgencyLayout>
                                  </AbacRoute>
                                } />
                                <Route path="briefing/arquivos" element={
                                  <AbacRoute resource="visao_geral" action="read">
                                    <AgencyLayout><BriefingArchive /></AgencyLayout>
                                  </AbacRoute>
                                } />
                              </Route>
                              {/* --------------------------------------------------------- */}
                              <Route
                                path="/financeiro"
                                element={
                                  <ProtectedRoute requiredFeature="financial">
                                    <DashboardLayout>
                                      <Financeiro />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/financeiro-academy"
                                element={
                                  <ProtectedRoute requiredFeature="financial">
                                    <DashboardLayout>
                                      <FinanceiroAcademy />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/paineis"
                                element={
                                  <ProtectedRoute requiredFeature="analytics">
                                    <DashboardLayout>
                                      <Paineis />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/comercial"
                                element={
                                  <ProtectedRoute requiredFeature="crm">
                                    <DashboardLayout>
                                      <Comercial />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/ranking-clientes"
                                element={
                                  <ProtectedRoute requiredFeature="clients">
                                    <DashboardLayout>
                                      <RankingClientes />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/settings"
                                element={
                                  <ProtectedRoute requiredFeature="settings_general">
                                    <DashboardLayout>
                                      <SettingsPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/team"
                                element={
                                  <ProtectedRoute requiredFeature="team">
                                    <DashboardLayout>
                                      <TeamConnections />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/connections"
                                element={
                                  <ProtectedRoute requiredFeature="connections">
                                    <DashboardLayout>
                                      <Connections />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/whatsapp"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <WhatsApp />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/assets"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <Assets />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/account-groups"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <AccountGroups />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/products"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <Products />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/dashboard/rastreamento"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <TrackingDashboard />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/finance/dashboard"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <FinancialDashboard />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/finance/costs"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <FinancialCosts />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/smart-data"
                                element={
                                  <ProtectedRoute>
                                    <SmartDataViz />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/timeline"
                                element={
                                  <ProtectedRoute requiredFeature="demands">
                                    <DashboardLayout>
                                      <TimelinePage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/active-projects"
                                element={
                                  <ProtectedRoute requiredFeature="demands">
                                    <DashboardLayout>
                                      <ProjetosAtivos />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/client-connections"
                                element={
                                  <ProtectedRoute requiredFeature="connections">
                                    <DashboardLayout>
                                      <ClientConnectionsPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/client-onboarding"
                                element={
                                  <ProtectedRoute requiredFeature="clients">
                                    <DashboardLayout>
                                      <ClientOnboardingPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/client-briefing"
                                element={
                                  <ProtectedRoute requiredFeature="clients">
                                    <DashboardLayout>
                                      <ClientBriefingPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/pedidos"
                                element={
                                  <ProtectedRoute requiredFeature="clients">
                                    <DashboardLayout>
                                      <PedidosPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/documentos"
                                element={
                                  <ProtectedRoute requiredFeature="clients">
                                    <DashboardLayout>
                                      <DocumentosPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/client-config"
                                element={
                                  <ProtectedRoute requiredFeature="clients">
                                    <DashboardLayout>
                                      <ClientConfigPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/precos"
                                element={
                                  <ProtectedRoute requiredFeature="clients">
                                    <DashboardLayout>
                                      <ClientPricingPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/editor-massa"
                                element={
                                  <ProtectedRoute requiredFeature="demands">
                                    <DashboardLayout>
                                      <BulkEditorPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/shopify-manager"
                                element={
                                  <ProtectedRoute requiredFeature="demands">
                                    <DashboardLayout>
                                      <ShopifyManagerPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/store-deployment"
                                element={
                                  <ProtectedRoute requiredFeature="demands">
                                    <DashboardLayout>
                                      <StoreDeploymentPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/estudio-ia"
                                element={
                                  <ProtectedRoute requiredFeature="demands">
                                    <DashboardLayout>
                                      <EstudioIAPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/skills"
                                element={
                                  <ProtectedRoute requiredFeature="demands">
                                    <DashboardLayout>
                                      <SkillsPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/google-calendar"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <GoogleCalendarPage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/google-drive"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <GoogleDrivePage />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/treinamentos"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <TrainingLibrary />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/treinamentos/gerenciar"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <TrainingLibraryManager />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/briefing/formulario"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <BriefingForm />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/briefing/arquivos"
                                element={
                                  <ProtectedRoute>
                                    <DashboardLayout>
                                      <BriefingArchive />
                                    </DashboardLayout>
                                  </ProtectedRoute>
                                }
                              />
                              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </ErrorBoundary>
                        </PostHogProvider>
                      </BrowserRouter>
                    </ChatProvider>
                  </TasksProvider>
                </PermissionsProvider>
              </DashboardProvider>
            </AuthProvider>
          </AccountTypeProvider>
        </TooltipProvider>
      </DeepLinkHandler>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
