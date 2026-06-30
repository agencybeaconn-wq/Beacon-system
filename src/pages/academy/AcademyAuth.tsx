import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAcademyContext } from '@/contexts/AcademyContext';
import { toast } from 'sonner';
import { AcademyLogo } from '@/components/academy/AcademyLogo';

export default function AcademyAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, student, isLoading, refresh } = useAcademyContext();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [submitting, setSubmitting] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Signup
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const noAccess = searchParams.get('no-access') === '1';

  const postLoginRedirect = () => {
    let pending: string | null = null;
    try { pending = sessionStorage.getItem('pending_invite_token'); } catch {}
    if (pending) {
      return `/academy/convite/${pending}`;
    }
    return '/academy';
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated && student) {
      navigate(postLoginRedirect(), { replace: true });
    }
  }, [isAuthenticated, student, isLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Bem-vindo');
    await refresh();
    navigate(postLoginRedirect(), { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName, phone, academy: true },
      },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Conta criada! Verifique seu e-mail se necessário.');
    setTab('login');
    setLoginEmail(email);
  };

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      <aside className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-black">
        <img
          src="/academy/hero-login.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center select-none"
          draggable={false}
        />
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.12),transparent_55%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.06),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none [background-image:linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-primary/15 blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-20 w-[32rem] h-[32rem] rounded-full bg-primary/8 blur-[160px] pointer-events-none" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>\")",
          }}
        />

        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="space-y-4 text-center lg:text-left flex flex-col items-center lg:items-start">
            <AcademyLogo size="lg" />
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.1]">
                Aprenda na prática.<br />
                <span className="text-primary">Construa o que importa.</span>
              </h1>
              <p className="text-muted-foreground text-sm font-light leading-relaxed">
                Educação prática em IA e desenvolvimento — conteúdo direto ao ponto, sem enrolação.
              </p>
            </div>
          </div>

          {noAccess && (
            <Alert className="mb-5 rounded-2xl border-yellow-500/40 bg-yellow-500/5">
              <AlertDescription className="text-sm">
                Sua conta ainda não foi liberada para o acesso. Fale com o suporte.
              </AlertDescription>
            </Alert>
          )}

          <Card className="p-7 sm:p-8 rounded-3xl border border-border/40 bg-card/70 backdrop-blur-xl shadow-2xl shadow-primary/5">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="grid grid-cols-2 mb-7 rounded-full p-1.5 h-12">
                <TabsTrigger value="login" className="rounded-full font-semibold tracking-tight h-full">Entrar</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-full font-semibold tracking-tight h-full">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">E-mail</Label>
                    <Input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Senha</Label>
                    <Input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required className="h-11 rounded-xl" />
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-xl font-semibold tracking-tight" disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
                  </Button>
                  <Link
                    to="/academy/esqueci-senha"
                    className="block text-center text-xs font-semibold tracking-tight text-muted-foreground hover:text-primary transition-colors pt-1"
                  >
                    Esqueci minha senha
                  </Link>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nome completo</Label>
                    <Input value={fullName} onChange={e => setFullName(e.target.value)} required className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">E-mail</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">WhatsApp</Label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+55 11 99999-9999" className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Senha</Label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-11 rounded-xl" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Após o cadastro, os cursos adquiridos serão liberados automaticamente.
                  </p>
                  <Button type="submit" className="w-full h-11 rounded-xl font-semibold tracking-tight" disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar conta'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </main>
    </div>
  );
}
