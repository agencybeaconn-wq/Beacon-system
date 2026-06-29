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
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = "/";
    };

    public render() {
        if (this.state.hasError) {
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
