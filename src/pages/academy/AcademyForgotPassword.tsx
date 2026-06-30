import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AcademyLogo } from '@/components/academy/AcademyLogo';
import { toast } from 'sonner';

export default function AcademyForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const redirectTo = `${window.location.origin}/academy/redefinir-senha`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4 relative">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <AcademyLogo size="lg" className="mb-4" />
          <p className="text-muted-foreground text-sm font-light tracking-tight">
            Recupere seu acesso à área de membros
          </p>
        </div>

        <Card className="p-6 rounded-2xl border-border/40 shadow-xl shadow-primary/5">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-extrabold tracking-[-0.02em] mb-2">Verifique seu e-mail</h2>
              <p className="text-sm text-muted-foreground font-light leading-relaxed mb-6">
                Enviamos um link de recuperação para <strong className="font-bold text-foreground">{email}</strong>.
                Clique no link pra definir uma nova senha.
              </p>
              <Button asChild variant="outline" className="rounded-xl font-bold tracking-tight w-full">
                <Link to="/academy/login">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao login
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h2 className="text-xl font-extrabold tracking-[-0.02em] mb-1">Esqueci minha senha</h2>
                <p className="text-xs text-muted-foreground font-light">
                  Informe o e-mail cadastrado que enviaremos um link pra redefinir.
                </p>
              </div>
              <div>
                <Label className="font-bold text-xs uppercase tracking-[0.1em] text-muted-foreground">E-mail</Label>
                <div className="relative mt-1">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="rounded-xl pl-9"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full rounded-xl font-bold tracking-tight" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar link de recuperação'}
              </Button>
              <Link
                to="/academy/login"
                className="block text-center text-xs font-bold tracking-tight text-muted-foreground hover:text-primary transition-colors"
              >
                Voltar ao login
              </Link>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
