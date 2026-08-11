/**
 * Casca do app autenticado.
 *
 * Reúne os provedores de estado que só o sistema usa. Vive num módulo próprio e é
 * carregado sob demanda (lazy) porque, antes disso, ele envolvia TAMBÉM as páginas
 * públicas: quem abria a home baixava e montava a árvore inteira do SaaS — Auth,
 * Permissões, Dashboard, Tarefas, Chat — sem usar nada dela. Era o que fazia o
 * pacote de entrada ter 1,4MB e o LCP passar de 3s.
 *
 * As três páginas públicas não chamam nenhum hook destes contextos (verificado),
 * então elas renderizam fora daqui e este pedaço só chega quando alguém entra no
 * sistema de verdade.
 *
 * A ORDEM de aninhamento é a mesma de antes — não mexer sem entender a
 * dependência entre eles (Permissões lê Auth, Tarefas lê Dashboard, etc.).
 */
import { Outlet } from 'react-router-dom';
import { PostHogProvider } from './contexts/PostHogProvider';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AccountTypeProvider } from './contexts/AccountTypeContext';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { TasksProvider } from './contexts/TasksContext';
import { ChatProvider } from './contexts/ChatContext';
import { AccountWizardContainer } from './components/AccountWizardContainer';

export default function AppShell() {
    return (
        <PostHogProvider>
        <AccountTypeProvider>
            <AuthProvider>
                <DashboardProvider>
                    <PermissionsProvider>
                        <TasksProvider>
                            <ChatProvider>
                                <Toaster />
                                <Sonner />
                                <AccountWizardContainer />
                                <Outlet />
                            </ChatProvider>
                        </TasksProvider>
                    </PermissionsProvider>
                </DashboardProvider>
            </AuthProvider>
        </AccountTypeProvider>
        </PostHogProvider>
    );
}
