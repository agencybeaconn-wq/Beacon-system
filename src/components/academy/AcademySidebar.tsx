// Heroicons: mesma família dos outros sidebars (desenho SF Symbols)
import {
  HomeIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  BookOpenIcon,
  VideoCameraIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAcademyContext } from '@/contexts/AcademyContext';
import { AcademyLogo } from './AcademyLogo';
import { AccountDetailsPopover } from '@/components/sidebar/AccountDetailsPopover';

interface MenuItem { title: string; icon: any; path: string; adminOnly?: boolean; }

export function AcademySidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { isAdmin } = useAcademyContext();

  const items: MenuItem[] = [
    { title: 'Início', icon: HomeIcon, path: '/academy' },
    { title: 'Meus Cursos', icon: RectangleStackIcon, path: '/academy/meus-cursos' },
  ];

  const adminItems: MenuItem[] = [
    { title: 'Visão Geral', icon: Squares2X2Icon, path: '/academy/admin' },
    { title: 'Módulos', icon: BookOpenIcon, path: '/academy/admin/modulos' },
    { title: 'Aulas', icon: VideoCameraIcon, path: '/academy/admin/aulas' },
    { title: 'Alunos', icon: UserGroupIcon, path: '/academy/admin/alunos' },
    { title: 'Moderação', icon: ChatBubbleLeftRightIcon, path: '/academy/admin/moderacao' },
  ];

  return (
    <div className="w-full md:w-64 h-full bg-transparent flex flex-col pt-6">
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

      {/* Footer: perfil */}
      <div className="p-3 border-t border-border/40 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <AccountDetailsPopover />
        </div>
      </div>
    </div>
  );
}
