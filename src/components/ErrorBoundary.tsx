import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    recarregando: boolean;
}

/**
 * Assinatura de "chunk velho": depois de um deploy, os arquivos JS ganham novo
 * hash no nome. Uma aba que ficou aberta durante o deploy pede um arquivo que já
 * não existe, e o import dinâmico da rota (lazy) falha. NÃO é bug do sistema — é
 * cache desalinhado, e um reload buscando o HTML novo resolve.
 */
const ERRO_DE_CHUNK = /Failed to fetch dynamically imported module|Loading chunk [\w-]+ failed|error loading dynamically imported module|Importing a module script failed|ChunkLoadError/i;

function ehErroDeChunk(err?: unknown): boolean {
    if (!err) return false;
    const e = err as { name?: string; message?: string };
    return e.name === "ChunkLoadError" || ERRO_DE_CHUNK.test(e.message || "");
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        recarregando: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Erro de chunk velho não é falha do sistema: mostra "atualizando" em vez
        // da tela vermelha, porque o reload já vai acontecer no componentDidCatch.
        return { hasError: true, error, recarregando: ehErroDeChunk(error) };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);

        // Chunk velho pós-deploy: recarrega UMA vez (janela de 15s) pra pegar o HTML
        // novo. Bug real persiste após o reload e cai na tela de erro normal — o
        // guarda por tempo impede loop de recarregamento.
        if (ehErroDeChunk(error)) {
            try {
                const CHAVE = "__reloadChunkEm";
                const ultimo = Number(sessionStorage.getItem(CHAVE) || 0);
                if (Date.now() - ultimo > 15000) {
                    sessionStorage.setItem(CHAVE, String(Date.now()));
                    window.location.reload();
                }
            } catch {
                // sessionStorage bloqueado (aba privada/embed): recarrega mesmo assim
                window.location.reload();
            }
        }
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null, recarregando: false });
        window.location.href = "/";
    };

    public render() {
        if (this.state.hasError) {
            // chunk velho: o reload já está a caminho — mostra algo neutro, não a
            // tela de erro. Se por algum motivo o reload não vier, o botão resolve.
            if (this.state.recarregando) {
                return (
                    <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center space-y-4">
                        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">Atualizando o sistema…</p>
                    </div>
                );
            }

            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="p-3 bg-destructive/10 rounded-full">
                        <AlertCircle className="w-10 h-10 text-destructive" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold tracking-tight">Ops! Algo deu errado</h2>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            Ocorreu um erro inesperado ao carregar esta parte do sistema.
                            Nossa equipe técnica já foi notificada (via console).
                        </p>
                    </div>

                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <div className="w-full max-w-2xl mt-4 p-4 bg-muted rounded-lg text-left overflow-auto max-h-[200px]">
                            <p className="font-mono text-xs text-destructive mb-2">{this.state.error.toString()}</p>
                            <pre className="font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">
                                {this.state.error.stack}
                            </pre>
                        </div>
                    )}

                    <Button
                        onClick={this.handleReset}
                        variant="default"
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Recarregar Sistema
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
