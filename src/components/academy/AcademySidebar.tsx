import { Home, Library, LayoutDashboard, BookOpen, Video, Users, MessageSquare } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAcademyContext } from '@/contexts/AcademyContext';
import { AcademyLogo } from './AcademyLogo';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';
import { AccountDetailsPopover } from '@/components/sidebar/AccountDetailsPopover';

interface MenuItem { title: string; icon: any; path: string; adminOnly?: boolean; }

export function AcademySidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { isAdmin } = useAcademyContext();

  const items: MenuItem[] = [
    { title: 'Início', icon: Home, path: '/academy' },
    { title: 'Meus Cursos', icon: Library, path: '/academy/meus-cursos' },
  ];

  const adminItems: MenuItem[] = [
    { title: 'Visão Geral', icon: LayoutDashboard, path: '/academy/admin' },
    { title: 'Módulos', icon: BookOpen, path: '/academy/admin/modulos' },
    { title: 'Aulas', icon: Video, path: '/academy/admin/aulas' },
    { title: 'Alunos', icon: Users, path: '/academy/admin/alunos' },
    { title: 'Moderação', icon: MessageSquare, path: '/academy/admin/moderacao' },
  ];

  return (
    <div className="w-full md:w-64 h-full border-r border-border/40 bg-card flex flex-col pt-6">
      <div className="px-6 mb-6">
        <AcademyLogo size="md" />
      </div>

      <nav className="flex-1 px-4 pt-2 border-t border-border/40 overflow-y-auto">
        <div className="space-y-1">
          {items.map((item) => {
            const isActive =
              (item.path === '/academy' && location.pathname === '/academy') ||
              (item.path !== '/academy' && (location.pathname === item.path || location.pathname.startsWith(item.path + '/')));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => onNavigate?.()}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold tracking-tight transition-all group mt-1',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className={cn('w-[18px] h-[18px]', isActive ? '' : 'group-hover:text-primary')} />
                {item.title}
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <div className="mt-6 pt-4 border-t border-border/40">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground px-4 mb-2">
              Administração
            </p>
            <div className="space-y-1">
              {adminItems.map((item) => {
                // Exact match pra "Visão Geral" (senão outras seções matchariam)
                const isActive = item.path === '/academy/admin'
                  ? location.pathname === '/academy/admin'
                  : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => onNavigate?.()}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold tracking-tight transition-all group',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className={cn('w-[18px] h-[18px]', isActive ? '' : 'group-hover:text-primary')} />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer: perfil + theme toggle lado a lado */}
      <div className="p-3 border-t border-border/40 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <AccountDetailsPopover />
        </div>
        <div className="p-1 bg-muted/30 rounded-lg flex-shrink-0">
          <ThemeToggleButton />
        </div>
      </div>
    </div>
  );
}
