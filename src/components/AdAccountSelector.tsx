import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Folder, Users, Plus, Loader2, ArrowLeft } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation, matchPath } from "react-router-dom";
import { useSelectedClient } from "@/contexts/DashboardContext";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Find the Beacon internal client from the clients list
export const LEVER_INTERNAL_NAME = "Beacon";

// Generate a color based on client name
const generateColor = (name: string): string => {
  const colors = ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6', '#FF6B6B', '#4ECDC4', '#45B7D1'];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

type ClientScope = 'fixo' | 'geral';

export function AdAccountSelector() {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ClientScope>(() => (localStorage.getItem('client_picker_scope') as ClientScope) || 'geral');
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedClientId, selectedClientName, setSelectedClient, isLoading, clients } = useSelectedClient();
  const { toast } = useToast();

  useEffect(() => { localStorage.setItem('client_picker_scope', scope); }, [scope]);

  // Find the real Lever client from the clients list
  const leverClient = useMemo(() => clients.find((c: any) => c.name === 'Beacon'), [clients]);

  const getSelectedLabel = () => {
    if (selectedClientId && selectedClientName) {
      return selectedClientName;
    }
    return "Visão Geral";
  };

  const handleSelectClient = (clientId: string | null, clientName?: string) => {
    console.log('[AdAccountSelector] Selecting client:', clientId);

    // Get client ID from current URL if applicable
    const match = matchPath({ path: "/clients/:id" }, location.pathname);
    const urlClientId = match?.params.id;

    // Se é o mesmo cliente NO CONTEXTO e NA URL, não faz nada
    if (clientId === selectedClientId && (clientId === urlClientId || !urlClientId)) {
      toast({
        description: `Você já está na ${clientName || (clientId ? 'aba deste cliente' : 'Visão Geral')}`,
      });
      setOpen(false);
      return;
    }

    // Fecha o dropdown
    setOpen(false);

    // Atualiza o contexto
    setSelectedClient(clientId);

    // Verifica se está na página de demandas/tasks
    const isOnTasksPage = location.pathname === '/tasks';

    // Navegar para o destino apropriado
    if (clientId) {
      console.log('[AdAccountSelector] Client selected:', { clientId, clientName, currentPath: location.pathname });

      // Toast de feedback
      toast({
        title: "Cliente alterado",
        description: `Visualizando: ${clientName}`,
      });

      const matchClientRoute = matchPath("/clients/:id", location.pathname);
      console.log('[AdAccountSelector] matchClientRoute:', matchClientRoute);

      if (matchClientRoute) {
        // If inside a client hub, preserve the tab/query params
        const newUrl = `/clients/${clientId}${location.search}`;
        console.log('[AdAccountSelector] Navigating to same hub with new ID:', newUrl);
        navigate(newUrl);
      } else {
        // WE DO NOT REDIRECT! That way if they are in /agency/new-demand or /general-board, they stay there!
        console.log('[AdAccountSelector] Not inside a client hub, staying on current page.');
      }
    } else {
      console.log('[AdAccountSelector] Deselected client (Visão Geral)');
      toast({
        title: "Visão Geral",
        description: `Exibindo demandas de todos os clientes`,
      });
    }
  };

  // Find selected client from real client list
  const selectedClient = useMemo(() =>
    clients.find((c: any) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  // Detect if we're inside a client detail page
  const isClientDetailPage = !!matchPath({ path: "/clients/:id" }, location.pathname);

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[280px] justify-between h-10 border border-input shadow-sm bg-background hover:bg-accent hover:text-accent-foreground transition-all duration-200"
            disabled={isLoading}
          >
            <div className="flex items-center truncate">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : selectedClientId ? (
                null
              ) : (
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
              )}
              <span className="truncate">{isLoading ? "Carregando..." : getSelectedLabel()}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          {/* Toggle Fixos | Geral */}
          <div className="p-2 border-b border-border/40 bg-secondary/20">
            <div className="inline-flex w-full items-center p-1 rounded-xl bg-background/60 border border-border/30">
              <button
                type="button"
                onClick={() => setScope('fixo')}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  scope === 'fixo'
                    ? "bg-emerald-500/15 text-emerald-500 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Fixos (MRR)
              </button>
              <button
                type="button"
                onClick={() => setScope('geral')}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  scope === 'geral'
                    ? "bg-primary/15 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todos
              </button>
            </div>
          </div>
          <Command>
            <CommandInput placeholder="Buscar cliente..." />
            <CommandList>
              <CommandEmpty>Nenhum cliente encontrado</CommandEmpty>

              {/* Padrão Geral (ver todos) */}
              <CommandGroup heading="Ações">
                <CommandItem
                  value="visao-geral"
                  onSelect={() => handleSelectClient(null)}
                  className="cursor-pointer"
                >
                  Visão Geral
                  {selectedClientId === null && (
                    <Check className="ml-auto h-4 w-4 text-primary" />
                  )}
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              {/* Lever — Demandas internas fixas */}
              {leverClient && (
                <>
                  <CommandGroup heading="Interno">
                    <CommandItem
                      value="lever-interno"
                      onSelect={() => handleSelectClient(leverClient.id, "Beacon")}
                      className="cursor-pointer"
                    >
                      Beacon
                      {selectedClientId === leverClient.id && (
                        <Check className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  </CommandGroup>

                  <CommandSeparator />
                </>
              )}

              {/* Lista de Clientes Reais do Supabase */}
              <CommandGroup heading={scope === 'fixo' ? 'Clientes Fixos' : 'Clientes'}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : clients.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum cliente cadastrado
                  </div>
                ) : (
                  clients
                    .filter((c: any) => c.name !== 'Beacon' && !c.is_internal && c.is_ecommerce !== false)
                    .filter((c: any) => scope === 'geral' || (c.client_type || 'avulso') === 'fixo')
                    .map((client: any) => (
                    <CommandItem
                      key={client.id}
                      value={`client-${client.name}`}
                      onSelect={() => handleSelectClient(client.id, client.name)}
                      className="cursor-pointer"
                    >
                      {client.name}
                      {selectedClientId === client.id && (
                        <Check className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  ))
                )}
              </CommandGroup>

              <CommandSeparator />

              {/* Ação para cadastrar novo cliente */}
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    navigate('/clients');
                  }}
                  className="cursor-pointer text-primary font-medium"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Gerenciar Portfólio
                </CommandItem>
              </CommandGroup>

            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

    </div>
  );
}
