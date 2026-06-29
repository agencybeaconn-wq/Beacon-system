import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sparkles, Search, Wrench, Package, FolderOpen, Palette, Tag,
  Activity, ShieldCheck, Boxes, Code, FileCode, Zap, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SkillEntry = {
  id: string;
  name: string;
  family: 'deploy' | 'precos' | 'tema' | 'produtos' | 'audit' | 'promocoes' | 'dev';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  naturalLanguageExamples: string[];
  whenToUse: string;
  whenNotToUse?: string;
  relatedSkills?: string[];
};

const FAMILIES = {
  deploy: { label: 'Deploy & Setup', color: 'bg-blue-500/10 text-blue-600', icon: Zap },
  precos: { label: 'Preços', color: 'bg-green-500/10 text-green-600', icon: Tag },
  tema: { label: 'Tema', color: 'bg-purple-500/10 text-purple-600', icon: Palette },
  produtos: { label: 'Produtos', color: 'bg-orange-500/10 text-orange-600', icon: Package },
  audit: { label: 'Auditoria', color: 'bg-red-500/10 text-red-600', icon: ShieldCheck },
  promocoes: { label: 'Promoções', color: 'bg-pink-500/10 text-pink-600', icon: Sparkles },
  dev: { label: 'Dev Interno', color: 'bg-gray-500/10 text-gray-600', icon: Code },
} as const;

const SKILLS: SkillEntry[] = [
  // Deploy & Setup
  {
    id: 'plan', family: 'deploy', icon: Boxes, name: '/plan',
    description: 'Planejamento socrático — decompõe a demanda em passos mapeados pras skills existentes.',
    naturalLanguageExamples: ['"o que fazer com o cliente X?"', '"bolar plano pra loja nova"', '"planeja as tarefas"'],
    whenToUse: 'Antes de começar qualquer trabalho complexo ou demanda ambígua',
  },
  {
    id: 'deploy-store', family: 'deploy', icon: Zap, name: '/deploy-store',
    description: 'Deploy completo de loja nova — coleções + menus + páginas + tema + produtos em 1 comando.',
    naturalLanguageExamples: ['"deploy loja nova cliente X"', '"subir template completo"', '"replicar BR pro cliente Y"'],
    whenToUse: 'Cliente novo sem catálogo — primeira implementação',
  },
  {
    id: 'implement', family: 'deploy', icon: Activity, name: '/implement',
    description: 'Executa automaticamente tasks do kanban do cliente (deploy + configure + fix).',
    naturalLanguageExamples: ['"rodar as demandas do cliente X"', '"implementar o que tá pendente"'],
    whenToUse: 'Cliente com tarefas já no kanban aguardando execução',
  },

  // Preços
  {
    id: 'update-prices', family: 'precos', icon: Tag, name: '/update-prices',
    description: 'Recebe tabela de preços em texto livre, salva no banco e aplica na Shopify.',
    naturalLanguageExamples: [
      '"atualiza os preços da loja X"',
      '"cole essa tabela: Torcedor R$209 Jogador R$249..."',
      '"novos valores do cliente Y"',
    ],
    whenToUse: 'Cliente mandou tabela nova de preços (WhatsApp, briefing)',
    relatedSkills: ['bulk-fix-prices'],
  },
  {
    id: 'bulk-fix-prices', family: 'precos', icon: Tag, name: '/bulk-fix-prices',
    description: 'Audita preços atuais vs banco e corrige divergências. Ideal pra "reset" após import.',
    naturalLanguageExamples: ['"auditar preços do cliente X"', '"corrigir preços divergentes"', '"preços tão errados"'],
    whenToUse: 'Suspeita de divergência, ou após rodar /import-missing',
  },

  // Tema
  {
    id: 'lever-theme', family: 'tema', icon: Palette, name: '/lever-theme',
    description: 'Workflow completo de tema: pull, duplicate, edit, preview, publish. Dev-first, nunca edita live.',
    naturalLanguageExamples: [
      '"o preço na página do produto tá estranho"',
      '"menu mobile do cliente X quebrado"',
      '"barra de progresso do carrinho não aparece"',
      '"yampi não tá funcionando"',
    ],
    whenToUse: 'Qualquer edição de tema de cliente — sempre usa draft copy dentro do shop do cliente',
    relatedSkills: ['configure-theme'],
  },
  {
    id: 'configure-theme', family: 'tema', icon: Palette, name: '/configure-theme',
    description: 'Configura settings do tema (header, footer, milestones, frete) a partir do briefing.',
    naturalLanguageExamples: ['"configurar tema do cliente X"', '"aplicar announcement bar"', '"frete grátis R$X"'],
    whenToUse: 'Após deploy inicial — personalizar settings do tema',
  },

  // Produtos
  {
    id: 'import-missing', family: 'produtos', icon: Package, name: '/import-missing',
    description: 'Compara catálogo do cliente com template e lista produtos faltantes (read-only).',
    naturalLanguageExamples: ['"quais produtos faltam na loja X"', '"comparar cliente com template"'],
    whenToUse: 'Antes de rodar /deploy-store pra ver o que vai importar',
  },
  {
    id: 'clean-titles', family: 'produtos', icon: Wrench, name: '/clean-titles',
    description: 'Remove marcas (Nike, Adidas) + corrige typos gramaticais ("Feminino" → "Feminina" em camisas).',
    naturalLanguageExamples: ['"limpar títulos"', '"tirar Nike/Adidas dos nomes"', '"corrigir Feminino pra Feminina"'],
    whenToUse: 'Loja de revendedor que não pode citar marcas, ou após import com typos',
  },
  {
    id: 'fix-options', family: 'produtos', icon: Wrench, name: '/fix-options',
    description: 'Padroniza opções (Tamanho/Personalizar) + gerencia escassez (PP/5GG).',
    naturalLanguageExamples: ['"padronizar tamanhos"', '"Size deveria ser Tamanho"', '"PP/5GG não aparecem"'],
    whenToUse: 'Após import de template EN ou quando opções ficam desalinhadas',
  },
  {
    id: 'fix-handles', family: 'produtos', icon: Wrench, name: '/fix-handles',
    description: 'Corrige handles de coleções em lojas EN que ficaram em português.',
    naturalLanguageExamples: ['"handles em português na loja EN"', '"URLs de coleção estão erradas"'],
    whenToUse: 'Loja EN onde handles foram gerados em PT (ex: brasileirao em vez de brazilian-league)',
  },
  {
    id: 'sort-collections', family: 'produtos', icon: FolderOpen, name: '/sort-collections',
    description: 'Reordena produtos dentro das coleções por Ano → Tipo → Número.',
    naturalLanguageExamples: ['"ordenar coleções"', '"2026/27 tem que vir primeiro"', '"organizar produtos"'],
    whenToUse: 'Após import novo, ou quando a home fica visualmente bagunçada',
  },

  // Promoções
  {
    id: 'create-discount', family: 'promocoes', icon: Sparkles, name: '/create-discount',
    description: 'Cria cupons BXGY (Pague 2 Leve 3, Pague 3 Leve 5) com presets pré-configurados.',
    naturalLanguageExamples: ['"criar pague 2 leve 3"', '"promoção de feriado"', '"cupom PAGUE3LEVE5"'],
    whenToUse: 'Qualquer promoção de desconto. Requer escopo write_discounts no app.',
  },

  // Auditoria
  {
    id: 'audit-store', family: 'audit', icon: ShieldCheck, name: '/audit-store',
    description: 'Auditoria completa (11 checks) da loja — preços, coleções, páginas, tema, SEO, estoque.',
    naturalLanguageExamples: ['"auditoria completa do cliente X"', '"saúde da loja"', '"relatório detalhado"'],
    whenToUse: 'Diagnóstico profundo ou relatório pra cliente. Mais lento (~2-5min).',
  },
  {
    id: 'quality-gate', family: 'audit', icon: Activity, name: '/quality-gate',
    description: 'Radar rápido (14 checks, ~90s) — preços, estoque, imagens, duplicados, menus quebrados, SEO, e mais.',
    naturalLanguageExamples: ['"rodar quality-gate"', '"checar saúde rápido"', '"tem algo errado?"'],
    whenToUse: 'Diagnóstico rápido, pré-flight antes de rodar skills destrutivas, check semanal',
    relatedSkills: ['audit-store'],
  },

  // Fallback + Dev
  {
    id: 'shopify', family: 'deploy', icon: Boxes, name: '/shopify',
    description: 'Fallback genérico — operações ad-hoc não cobertas pelas skills específicas.',
    naturalLanguageExamples: ['"listar pedidos de ontem"', '"CRUD avulso"'],
    whenToUse: 'Operações pontuais que não encaixam em outras skills',
  },
  {
    id: 'code-blocks', family: 'produtos', icon: FileCode, name: '/code-blocks',
    description: 'Copia features/seções de uma loja pra outra (Liquid blocks).',
    naturalLanguageExamples: ['"copiar seção X do cliente A pro cliente B"'],
    whenToUse: 'Propagar bloco específico entre lojas',
  },
  {
    id: 'component', family: 'dev', icon: Code, name: '/component',
    description: 'Cria componente React interno do Beacon System (shadcn/ui + Tailwind).',
    naturalLanguageExamples: ['"criar componente X"'],
    whenToUse: 'Dev interno do dashboard',
  },
  {
    id: 'edge-function', family: 'dev', icon: Code, name: '/edge-function',
    description: 'Cria edge function Supabase seguindo padrões do projeto.',
    naturalLanguageExamples: ['"criar edge function X"'],
    whenToUse: 'Dev interno — nova funcionalidade server-side',
  },
];

export function SkillReference() {
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);

  const filtered = SKILLS.filter(s => {
    if (familyFilter && s.family !== familyFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q)
        || s.description.toLowerCase().includes(q)
        || s.naturalLanguageExamples.some(e => e.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header + Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Referência de Skills — Automação Claude Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {SKILLS.length} skills organizadas por família. Você pode invocar em linguagem natural —
            não precisa digitar <code className="text-xs bg-muted px-1 rounded">/nome-da-skill</code>.
            O Claude identifica automaticamente qual usar via a "Regra Zero" no CLAUDE.md.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, descrição ou exemplo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Family filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFamilyFilter(null)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                familyFilter === null ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              )}
            >
              Todas ({SKILLS.length})
            </button>
            {Object.entries(FAMILIES).map(([key, fam]) => {
              const count = SKILLS.filter(s => s.family === key).length;
              const Icon = fam.icon;
              return (
                <button
                  key={key}
                  onClick={() => setFamilyFilter(key)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                    familyFilter === key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {fam.label} ({count})
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Skills grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(skill => {
          const Icon = skill.icon;
          const family = FAMILIES[skill.family];
          return (
            <Card key={skill.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', family.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{skill.name}</h3>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 mt-0.5">{family.label}</Badge>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{skill.description}</p>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Exemplos em linguagem natural</p>
                  <ul className="space-y-1">
                    {skill.naturalLanguageExamples.map((ex, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                        <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <span className="italic">{ex}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 border-t space-y-1">
                  <p className="text-[10px]">
                    <span className="font-semibold">Quando usar: </span>
                    <span className="text-muted-foreground">{skill.whenToUse}</span>
                  </p>
                  {skill.relatedSkills && (
                    <p className="text-[10px]">
                      <span className="font-semibold">Relacionada: </span>
                      <span className="text-muted-foreground">{skill.relatedSkills.map(s => `/${s}`).join(', ')}</span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nenhuma skill encontrada pra "{search}".
        </div>
      )}
    </div>
  );
}
