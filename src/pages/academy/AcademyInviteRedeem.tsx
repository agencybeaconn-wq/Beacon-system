import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, LogIn } from 'lucide-react';
import { AcademyLayout } from '@/components/academy/AcademyLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAcademyContext } from '@/contexts/AcademyContext';
import { useAcademyInvites } from '@/hooks/useAcademyInvites';
import { toast } from 'sonner';

export default function AcademyInviteRedeem() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, refresh } = useAcademyContext();
  const { redeem } = useAcademyInvites();
  const [status, setStatus] = useState<'checking' | 'needs-auth' | 'processing' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState<string>('');
  const [moduleInfo, setModuleInfo] = useState<{ slug: string; title: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setStatus('error');
      setMessage('Link de convite inválido');
      return;
    }
    if (!isAuthenticated) {
      // Guarda o token pra redirecionar após login
      try { sessionStorage.setItem('pending_invite_token', token); } catch {}
      setStatus('needs-auth');
      return;
    }
    (async () => {
      setStatus('processing');
      const result = await redeem(token);
      if (result.success && result.module_slug) {
        setModuleInfo({ slug: result.module_slug, title: result.module_title || '' });
        setStatus('success');
        await refresh();
        try { sessionStorage.removeItem('pending_invite_token'); } catch {}
        setTimeout(() => navigate(`/academy/curso/${result.module_slug}`, { replace: true }), 1800);
      } else {
        setStatus('error');
        setMessage(result.error || 'Não foi possível processar o convite');
      }
    })();
  }, [token, isAuthenticated, authLoading, redeem, refresh, navigate]);

  const goLogin = () => {
    navigate('/academy/login');
  };

  return (
    <AcademyLayout>
      <div className="max-w-md mx-auto py-12">
        <Card className="p-8 rounded-2xl border-border/40 text-center">
          {status === 'checking' || status === 'processing' ? (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
              <h2 className="text-xl font-extrabold tracking-tight mb-2">Processando convite...</h2>
              <p className="text-sm text-muted-foreground font-light">Só um instante.</p>
            </>
          ) : status === 'needs-auth' ? (
            <>
              <LogIn className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-xl font-extrabold tracking-tight mb-2">Você foi convidado</h2>
              <p className="text-sm text-muted-foreground font-light mb-6">
                Faça login ou crie sua conta pra acessar o conteúdo. Seu acesso será ativado automaticamente.
              </p>
              <Button onClick={goLogin} className="rounded-xl font-bold tracking-tight w-full">
                Entrar / Criar conta
              </Button>
            </>
          ) : status === 'success' && moduleInfo ? (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h2 className="text-xl font-extrabold tracking-tight mb-2">Acesso liberado!</h2>
              <p className="text-sm text-muted-foreground font-light mb-6">
                Você agora tem acesso a <strong>{moduleInfo.title}</strong>. Redirecionando...
              </p>
              <Button onClick={() => navigate(`/academy/curso/${moduleInfo.slug}`)} className="rounded-xl font-bold tracking-tight w-full">
                Acessar agora
              </Button>
            </>
          ) : (
            <>
              <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-xl font-extrabold tracking-tight mb-2">Não foi possível</h2>
              <p className="text-sm text-muted-foreground font-light mb-6">{message}</p>
              <Button variant="outline" onClick={() => navigate('/academy')} className="rounded-xl font-bold tracking-tight w-full">
                Voltar pro Academy
              </Button>
            </>
          )}
        </Card>
      </div>
    </AcademyLayout>
  );
}
