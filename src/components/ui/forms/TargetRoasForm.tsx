import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TargetRoasFormProps {
  accountId?: string; // Opcional, não usado mais (mantido para compatibilidade)
}

export function TargetRoasForm({ accountId }: TargetRoasFormProps) {
  const [targetRoas, setTargetRoas] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Buscar meta atual ao carregar (GLOBAL POR USUÁRIO, não precisa de accountId)
  useEffect(() => {
    const fetchTargetRoas = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Sessão não encontrada");
        }

        // Meta é global por usuário, não precisa de account_id
        const { data, error } = await supabase.functions.invoke('manage-client-goal', {
          body: {
            metric: 'target_roas',
            action: 'GET'
            // account_id não é mais obrigatório (meta global por usuário)
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (error) {
          console.error("[TargetRoasForm] Erro ao buscar meta:", error);
          // Não mostrar erro, apenas usar valor padrão
          setTargetRoas(null);
          setInputValue("");
        } else if (data?.success) {
          const value = data.target_value || data.default_value || null;
          setTargetRoas(value);
          setInputValue(value ? value.toString() : "");
        }
      } catch (error) {
        console.error("[TargetRoasForm] Erro ao buscar target ROAS:", error);
        setTargetRoas(null);
        setInputValue("");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTargetRoas();
  }, []);

  const handleSave = async () => {
    const value = parseFloat(inputValue);

    if (isNaN(value) || value <= 0) {
      toast({
        title: "Valor inválido",
        description: "Por favor, informe um valor numérico maior que zero (ex: 3.0, 5.5).",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Sessão não encontrada");
      }

      // Meta é global por usuário, account_id não é mais obrigatório
      const { data, error } = await supabase.functions.invoke('manage-client-goal', {
        body: {
          metric: 'target_roas',
          action: 'SET',
          target_value: value
          // account_id não é mais obrigatório (meta global por usuário)
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        throw new Error(error.message || "Erro ao salvar meta");
      }

      if (data?.success) {
        setTargetRoas(value);
        toast({
          title: "Meta salva com sucesso!",
          description: `Target ROAS definido como ${value}x. A Beacon AI usará este valor nas análises.`,
          variant: "default"
        });
      } else {
        throw new Error(data?.error || "Erro ao salvar meta");
      }
    } catch (error) {
      console.error("[TargetRoasForm] Erro ao salvar target ROAS:", error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível salvar a meta. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Target ROAS</CardTitle>
          <CardDescription>
            Definir o ROAS mínimo aceitável para análises
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Target ROAS</CardTitle>
        <CardDescription>
          Defina o ROAS mínimo aceitável que a Beacon AI usará como referência nas análises de desempenho. Esta meta é global para todas as suas contas. Se não definido, será usado o valor padrão de 2.0x.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="target-roas">
            ROAS Mínimo Aceitável (Target ROAS)
          </Label>
          <div className="flex gap-2">
            <Input
              id="target-roas"
              type="number"
              step="0.1"
              min="0"
              placeholder={targetRoas ? targetRoas.toString() : "2.0"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isSaving}
              className="flex-1"
            />
            <span className="flex items-center text-muted-foreground text-sm">x</span>
          </div>
          {targetRoas && (
            <p className="text-sm text-muted-foreground">
              Valor atual: <span className="font-semibold">{targetRoas}x</span>
            </p>
          )}
          {!targetRoas && (
            <p className="text-sm text-muted-foreground">
              Meta não definida. Valor padrão: <span className="font-semibold">2.0x</span>
            </p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving || !inputValue.trim()}
          className="w-full sm:w-auto"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Meta"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

