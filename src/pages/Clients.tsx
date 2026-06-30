import { useNavigate } from "react-router-dom";
import { useSelectedClient, useDashboard } from "@/contexts/DashboardContext";
import { ArrowRight, Users, Plus, Loader2, Check, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { NewClientModal } from "@/components/clients/NewClientModal";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useState, useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";


const Clients = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setSelectedClient, selectedClientId, clients, isLoading: isLoadingClients } = useSelectedClient();
  const { workspaceId } = useDashboard();
  const { canEdit } = usePermissions();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [clientTaskInfo, setClientTaskInfo] = useState<Map<string, { count: number; latestDue: string | null }>>(new Map());

  // Fetch active tasks per client
  useEffect(() => {
    const fetchClientTasks = async () => {
      try {
        let query = (supabase as any)
          .from('client_tasks')
          .select('client_id, due_date, status')
          .neq('status', 'completed');
        if (workspaceId) {
          query = query.eq('workspace_id', workspaceId);
        }
        const { data } = await query;
        if (data) {
          const map = new Map<string, { count: number; latestDue: string | null }>();
          for (const t of data) {
            if (!t.client_id) continue;
            const existing = map.get(t.client_id) || { count: 0, latestDue: null };
            existing.count++;
            if (t.due_date && (!existing.latestDue || t.due_date > existing.latestDue)) {
              existing.latestDue = t.due_date;
            }
            map.set(t.client_id, existing);
          }
          setClientTaskInfo(map);
        }
      } catch (err) {
        console.warn('Could not fetch client tasks:', err);
      }
    };
    fetchClientTasks();
  }, []);

  const handleSelectClient = (clientId: string) => {
    setSelectedClient(clientId);
    navigate(`/client-config`);
  };

  // Normaliza string para busca insensível a caixa e a acentos
  const normalize = (s: string): string =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filteredClients = clients.filter((client: any) => {
    if (searchTerm.trim()) {
      const q = normalize(searchTerm.trim());
      const haystack = normalize(`${client.name || ''} ${client.project_name || ''}`);
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (isLoadingClients) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Cartela de Clientes
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Selecione um cliente para acessar o Hub de Projeto completo.
          </p>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Buscar cliente ou projeto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-9 pr-9"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-sm hover:bg-muted transition-colors"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredClients.map((client: any) => {
          const initials = client.name
            .split(' ')
            .map((n: string) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

          const isSelected = selectedClientId === client.id;

          return (
            <Card
              key={client.id}
              className={cn(
                "group hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer relative",
                isSelected && "border-emerald-500 bg-emerald-500/5 shadow-md"
              )}
              onClick={() => handleSelectClient(client.id)}
            >
              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 bg-emerald-500 text-white p-1 rounded-sm shadow-sm animate-in zoom-in-50 duration-300 z-10">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <Avatar className="h-12 w-12 border-2 border-border group-hover:border-primary transition-colors">
                    <AvatarImage src={client.logo_url || ""} />
                    <AvatarFallback className="font-bold bg-muted" style={{ backgroundColor: client.primaryColor + '20', color: client.primaryColor }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <CardTitle className="mt-4 text-xl font-bold truncate">{client.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Clique para acessar o Hub de Projeto.
                </div>

              </CardContent>
              <CardFooter>
                <Button
                  className="w-full font-bold group-hover:bg-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectClient(client.id);
                  }}
                >
                  Ver Projeto
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}

        {/* Card de Novo Cliente */}
        {canEdit('clients') && (
          <NewClientModal trigger={
            <Card className="group hover:border-primary/50 transition-all duration-300 hover:shadow-lg border-dashed cursor-pointer flex flex-col items-center justify-center min-h-[280px]">
              <div className="flex flex-col items-center gap-3 text-muted-foreground group-hover:text-foreground transition-colors">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm">Novo Cliente</span>
              </div>
            </Card>
          } />
        )}
      </div>

      {searchTerm.trim() && filteredClients.length > 0 && (
        <div className="text-xs text-muted-foreground -mt-6">
          {filteredClients.length} {filteredClients.length === 1 ? 'cliente encontrado' : 'clientes encontrados'} para "{searchTerm.trim()}"
        </div>
      )}

      {filteredClients.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {searchTerm.trim() ? `Nenhum cliente encontrado para "${searchTerm.trim()}".` : 'Nenhum cliente encontrado com esse filtro.'}
        </div>
      )}
    </div>
  );
};

export default Clients;
