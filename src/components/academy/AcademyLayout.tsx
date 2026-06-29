import { useEffect, useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AcademySidebar } from './AcademySidebar';
import { AcademyLogo } from './AcademyLogo';
import { useAcademyContext } from '@/contexts/AcademyContext';

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function AcademyLayout({ children, requireAdmin = false }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, student, isAdmin } = useAcademyContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate('/academy/login', { replace: true, state: { from: location.pathname } });
      return;
    }
    if (requireAdmin && !isAdmin) {
      navigate('/academy', { replace: true });
    }
  }, [isAuthenticated, isLoading, student, isAdmin, requireAdmin, navigate, location.pathname]);

  // Mostra loading só na primeira carga (quando student ainda é null). Se já
  // carregou, mantém a UI renderizada mesmo em reloads — evita desmontar
  // dialogs/tabs ao voltar de outra aba do navegador.
  if (!student) {
    if (isLoading || !isAuthenticated) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
  }

  return (
    <div className="flex min-h-screen bg-background relative">
      <div className="hidden md:block">
        <AcademySidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="md:hidden flex h-16 shrink-0 items-center justify-between border-b border-border/40 px-6 bg-background/95 backdrop-blur sticky top-0 z-50">
          <AcademyLogo size="sm" />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-none w-72">
              <AcademySidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background to-primary/5">
          <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
