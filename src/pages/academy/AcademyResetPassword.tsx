import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AcademyLogo } from '@/components/academy/AcademyLogo';
import { toast } from 'sonner';

export default function AcademyResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Processa o hash de recovery ao montar
  useEffect(() => {
    (async () => {
      try {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const type = params.get('type');
          if ((type === 'recovery' || type === 'magiclink') && access_token && refresh_token) {
            const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
            if (setErr) { setError('Link expirado ou inválido. Peça um novo.'); return; }
            // limpa o hash pra não vazar tokens nas URLs subsequentes
            window.history.replaceState(null, '', window.location.pathname);
            setSessionReady(true);
            return;
          }
        }
        // Se já tem sessão ativa (ex: navegação interna), libera também
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { setSessionReady(true); return; }
        setError('Link inválido. Use o link recebido por e-mail.');
      } catch {
        setError('Não foi possível validar o link.');
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('A senha precisa ter pelo menos 6 caracteres'); return; }
    if (password !== confirm) { toast.error('As senhas não coincidem'); return; }
    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updErr) { toast.error(updErr.message); return; }
    toast.success('Senha redefinida. Você já está dentro.');
    navigate('/academy', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4 relative">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <AcademyLogo size="lg" className="mb-4" />
          <p className="text-muted-foreground text-sm font-light tracking-tight">
            Defina sua nova senha
          </p>
        </div>

        <Card className="p-6 rounded-2xl border-border/40 shadow-xl shadow-primary/5">
          {error ? (
            <Alert className="border-destructive/50 bg-destructive/5">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <AlertDescription className="text-sm font-light">
                {error} <br />
                <a href="/academy/esqueci-senha" className="font-bold tracking-tight text-primary hover:underline mt-2 inline-block">
                  Pedir novo link
                </a>
              </AlertDescription>
            </Alert>
          ) : !sessionReady ? (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h2 className="text-xl font-extrabold tracking-[-0.02em] mb-1">Nova senha</h2>
                <p className="text-xs text-muted-foreground font-light">Mínimo de 6 caracteres.</p>
              </div>
              <div>
                <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Nova senha</Label>
                <div className="relative mt-1">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="rounded-xl pl-9"
                  />
                </div>
              </div>
              <div>
                <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">Confirmar senha</Label>
                <div className="relative mt-1">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="rounded-xl pl-9"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full rounded-xl font-bold tracking-tight" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redefinir senha'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
