import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import leverLogo from "@/assets/lever-logo.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/app");
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Acesso é só por convite: quem entra aqui já tem conta criada pela agência.
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      toast({ title: "Login realizado!" });
      navigate("/app");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao autenticar",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background">
      {/* Centered Form */}
      <div className="flex flex-col justify-center items-center w-full p-4 sm:p-8 lg:p-12 xl:p-24 relative z-10">
        <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Logo + Branding */}
          <div className="text-left space-y-4 mb-6">
            <div className="flex items-end gap-0">
              <img src={leverLogo} alt="NODE" className="h-12 w-auto" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2 text-left">
              <h2 className="text-2xl font-bold text-foreground">
                Bem-vindo
              </h2>
              <p className="text-muted-foreground font-light">
                Entre para acessar o sistema
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-medium">Email</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none z-20">
                    <Mail className="h-5 w-5 text-foreground/50" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-11 font-light relative z-10 bg-transparent"
                    required
                    disabled={isLoading}
                    data-gramm="false"
                    data-1p-ignore="true"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-medium">Senha</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none z-20">
                    <Lock className="h-5 w-5 text-foreground/50" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 h-11 font-light relative z-10 bg-transparent"
                    required
                    minLength={6}
                    disabled={isLoading}
                    data-gramm="false"
                    data-1p-ignore="true"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 font-bold mt-6" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aguarde...</>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

