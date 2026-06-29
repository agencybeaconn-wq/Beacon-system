import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Folder, 
  Target, 
  Wallet, 
  MapPin, 
  Users, 
  Rocket, 
  Edit2, 
  X,
  CheckCircle2,
  Layers
} from "lucide-react";
import { useState } from "react";

interface CampaignReviewCardProps {
  data: {
    campaignName: string;
    objective: string;
    structure: string;
    budget: number;
    targeting: {
      age_min?: number;
      age_max?: number;
      genders?: number[]; // [1]=Male, [2]=Female
      countries?: string[];
      interests?: string[]; // Array of IDs or names (if names are passed for display)
      geo_locations?: string[]; // Array of keys or names
    };
    accountId: string;
  };
  onApprove: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CampaignReviewCard({ data, onApprove, onCancel, isSubmitting = false }: CampaignReviewCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formatObjective = (obj: string) => {
    const map: Record<string, string> = {
      'SALES': 'Vendas',
      'LEADS': 'Cadastros',
      'TRAFFIC': 'Tráfego',
      'ENGAGEMENT': 'Engajamento',
      'AWARENESS': 'Reconhecimento',
      'OUTCOME_SALES': 'Vendas',
      'OUTCOME_LEADS': 'Cadastros',
      'OUTCOME_TRAFFIC': 'Tráfego'
    };
    return map[obj] || obj;
  };

  const formatGender = (genders?: number[]) => {
    if (!genders || genders.length === 0 || genders.length === 2) return "Todos";
    return genders[0] === 1 ? "Homens" : "Mulheres";
  };

  return (
    <Card className="w-full overflow-hidden border-2 border-indigo-100 shadow-xl bg-white dark:bg-slate-950 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header - Blueprint Style */}
      <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-indigo-100" />
              <span className="font-mono text-xs text-indigo-200 uppercase tracking-wider">Nova Campanha</span>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-0 backdrop-blur-sm">
              {data.structure || "1-1-1"}
            </Badge>
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-bold leading-tight text-white truncate">
              {data.campaignName || "Nova Campanha"}
            </h3>
            <div className="flex items-center gap-2 text-indigo-100 text-sm">
              <Target className="h-4 w-4" />
              <span>Objetivo: <strong>{formatObjective(data.objective)}</strong></span>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Body - Technical Details */}
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          
          {/* Ad Set Section */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400">
              <Layers className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Conjunto de Anúncios</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Budget */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Orçamento Diário</span>
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 pl-5">
                  R$ {data.budget?.toFixed(2)}
                  <span className="text-xs text-slate-400 font-normal ml-1">(CBO)</span>
                </p>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Localização</span>
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 pl-5 truncate">
                  {data.targeting?.geo_locations && data.targeting.geo_locations.length > 0 
                    ? `${data.targeting.geo_locations.length} locais selecionados`
                    : (data.targeting?.countries?.includes('BR') ? 'Brasil (Todo o país)' : 'Brasil')}
                </p>
              </div>
            </div>
          </div>

          {/* Audience Section */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400">
              <Users className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Público Alvo</span>
            </div>

            <div className="space-y-3 pl-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Idade / Gênero:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {data.targeting?.age_min || 18} - {data.targeting?.age_max || 65}+ anos • {formatGender(data.targeting?.genders)}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 block">Interesses:</span>
                <div className="flex flex-wrap gap-1.5">
                  {data.targeting?.interests && data.targeting.interests.length > 0 ? (
                    data.targeting.interests.map((interest, i) => (
                      <Badge key={i} variant="outline" className="text-xs font-normal border-slate-200 text-slate-600 bg-slate-50">
                        {/* We might only have IDs here, so ideally we'd show the ID or a placeholder. 
                            The user prompt implies the card is "visual", so assuming the AI might pass names OR we display "ID: ..." */}
                        {interest.length > 15 && !interest.includes(' ') ? `ID: ${interest.substring(0, 8)}...` : interest}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-xs font-normal border-slate-200 text-slate-400 italic">
                      Público Aberto (Advantage+)
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Footer - Actions */}
      <CardFooter className="bg-slate-50 dark:bg-slate-900 p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
        <Button 
          variant="ghost" 
          className="flex-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        
        <Button 
          className={`flex-[2] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-200 dark:shadow-none transition-all duration-300 ${isHovered ? 'scale-[1.02]' : ''}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={onApprove}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
              Enviando para Meta...
            </>
          ) : (
            <>
              <Rocket className={`mr-2 h-4 w-4 ${isHovered ? 'animate-pulse' : ''}`} />
              Autorizar Lançamento
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

