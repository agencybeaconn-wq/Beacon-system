import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import leverLogo from "@/assets/lever-logo.png";

const AcceptInvite = () => {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        // Check for hash parameters (Supabase sends tokens in hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const errorDescription = hashParams.get("error_description");
        const type = hashParams.get("type"); // "invite" for invitation links

        if (errorDescription) {
            setError(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
            setIsLoading(false);
            return;
        }

        if (accessToken && refreshToken) {
            // Set the session with the tokens from the magic link
            supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
                .then(({ data, error }) => {
                    if (error) {
                        setError(error.message);
                        setIsLoading(false);
                        return;
                    }

                    if (data.user) {
                        setUserEmail(data.user.email || null);

                        // Check if this is an invite type link - user needs to set password
                        if (type === "invite" || type === "recovery" || type === "magiclink" || type === "signup") {
                            setIsLoading(false);
                        } else {
                            // User is already set up, redirect to home
                            navigate("/");
                        }
                    }
                });
        } else {
            // No tokens, check if user is already logged in
            supabase.auth.getSession().then(({ data }) => {
                if (data.session?.user) {
                    const user = data.session.user;
                    handleActivateMember(user.id, user.email || "").then(() => {
                        navigate("/");
                    });
                } else {
                    setError("Link de convite inválido ou expirado.");
                    setIsLoading(false);
                }
            });
        }
    }, [navigate]);

    const handleActivateMember = async (userId: string, email: string) => {
        if (!email) return;

        try {
            // Update team_members record to set user_id and status to 'active'
            const { error: updateError } = await (supabase as any)
                .from('team_members')
                .update({
                    user_id: userId,
                    status: 'active',
                    joined_at: new Date().toISOString()
                })
                .ilike('email', email.trim());

            if (updateError) {
                console.warn('Could not update team_members status:', updateError);
            } else {
                console.log('Team member status updated to active/verified');
            }
        } catch (err) {
            console.error('Error in handleActivateMember:', err);
        }
    };

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast({
                title: "Erro",
                description: "As senhas não coincidem.",
                variant: "destructive"
            });
            return;
        }

        if (password.length < 6) {
            toast({
                title: "Erro",
                description: "A senha deve ter no mínimo 6 caracteres.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            // Update team_members status to 'active' for this user
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
                await handleActivateMember(userData.user.id, userData.user.email || "");
            }

            toast({
                title: "Senha definida!",
                description: "Sua conta foi ativada com sucesso."
            });

            // Redirect logic based on identity
            if (userData.user.email) {
                const { data: identity } = await (supabase as any).rpc('resolve_client_identity', {
                    user_email: userData.user.email
                });

                if (identity && identity.length > 0) {
                    console.log('AcceptInvite: Redirecting to portal based on identity');
                    navigate("/portal");
                    return;
                }
            }

            navigate("/");
        } catch (err: any) {
            toast({
                title: "Erro",
                description: err.message || "Erro ao definir senha.",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
                <div className="w-full max-w-md text-center space-y-6">
                    <div className="flex items-center justify-center gap-2">
                        <img src={leverLogo} alt="Beacon" className="h-10 w-auto" />
                        <h1 className="text-3xl font-extrabold text-foreground">Digital</h1>
                    </div>
                    <div className="bg-destructive/10 p-6 rounded-lg border border-destructive/30">
                        <p className="text-destructive font-medium">{error}</p>
                    </div>
                    <Button onClick={() => navigate("/login")} variant="outline">
                        Ir para o Login
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md space-y-8">
                {/* Logo */}
                <div className="text-left space-y-4 mb-6">
                    <div className="flex items-center gap-2">
                        <img src={leverLogo} alt="Beacon" className="h-10 w-auto" />
                        <h1 className="text-3xl font-extrabold text-foreground">Digital</h1>
                    </div>
                </div>

                {/* Form */}
                <div className="bg-card p-8 rounded-2xl shadow-lg border border-border space-y-6">
                    <div className="space-y-2 text-left">
                        <div className="flex items-center gap-2 text-green-500 mb-4">
                            <CheckCircle className="h-5 w-5" />
                            <span className="text-sm font-medium">Convite aceito!</span>
                        </div>
                        <h2 className="text-2xl font-bold text-foreground">Crie sua senha</h2>
                        {userEmail && (
                            <p className="text-muted-foreground font-light">
                                Conta: <span className="font-medium">{userEmail}</span>
                            </p>
                        )}
                    </div>

                    <form onSubmit={handleSetPassword} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="password" className="font-medium">Nova Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-11 h-11 font-light"
                                    required
                                    minLength={6}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="font-medium">Confirmar Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-11 h-11 font-light"
                                    required
                                    minLength={6}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-11 font-bold mt-6" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                            ) : (
                                "Definir senha e entrar"
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AcceptInvite;
