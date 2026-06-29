import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Terminal, Bot, ShoppingCart, Package, FolderOpen,
  FileText, Palette, Settings2, BarChart3, Layers,
} from 'lucide-react';

interface Capability {
  title: string;
  icon: React.ReactNode;
  items: string[];
}

const CAPABILITIES: Capability[] = [
  {
    title: 'Produtos',
    icon: <Package className="h-5 w-5" />,
    items: [
      'Listar, criar, atualizar e deletar produtos',
      'Atualizar precos em massa (texto livre, WhatsApp, planilha)',
      'Gerenciar variantes e opcoes (tamanhos, cores)',
      'Upload e gerenciamento de imagens',
      'Controle de inventario',
      'SEO meta tags (title, description)',
      'Compare-at price (preco riscado)',
    ],
  },
  {
    title: 'Colecoes',
    icon: <FolderOpen className="h-5 w-5" />,
    items: [
      'Criar colecoes smart (regras automaticas) e custom',
      'Deploy em batch (ate 20 por vez)',
      'Ordenar produtos dentro das colecoes',
      'Deduplicacao automatica ao criar',
    ],
  },
  {
    title: 'Paginas',
    icon: <FileText className="h-5 w-5" />,
    items: [
      'Criar e editar paginas via GraphQL',
      'Templates prontos: Politica de Troca, Privacidade, Termos, Sobre Nos',
      'Conteudo HTML profissional com placeholders',
    ],
  },
  {
    title: 'Menus',
    icon: <Layers className="h-5 w-5" />,
    items: [
      'Criar menus com subitens (dropdown)',
      'Tipos corretos: FRONTPAGE, HTTP, COLLECTION, SHOP_POLICY',
      'Menu principal e rodape',
    ],
  },
  {
    title: 'Tema Beacon',
    icon: <Palette className="h-5 w-5" />,
    items: [
      'Configurar contato no cabecalho (telefone, email)',
      'Configurar contato e horario no rodape',
      'Announcement bar (promos, frete gratis)',
      'Progress bar do carrinho (milestones de ofertas)',
      'Mensagens dinamicas do carrinho',
      'Opcoes de frete (padrao, expresso)',
      'Licenca do tema (LEVER-XXXX-YYYY)',
      'Editar qualquer section ou settings_data.json',
    ],
  },
  {
    title: 'Pedidos',
    icon: <BarChart3 className="h-5 w-5" />,
    items: [
      'Consultar pedidos por data (timezone Brasil)',
      'Filtrar por status (pago, pendente, reembolsado)',
      'Identificar gateway (cartao, pix)',
    ],
  },
];

const MANUAL_STEPS = [
  { step: 'Instalar app custom na Shopify', detail: 'Admin > Apps > Desenvolver app > Instalar' },
  { step: 'Conectar no Beacon System', detail: 'Clientes > Conexoes > Conectar Shopify' },
  { step: 'Importar zip do tema Beacon', detail: 'Admin > Temas > Adicionar tema > Upload zip' },
];

const FLOW_STEPS = [
  { n: '1', text: 'Configurar tema (contatos, ofertas, carrinho)', auto: true },
  { n: '2', text: 'Criar colecoes (smart por time/liga/tipo)', auto: true },
  { n: '3', text: 'Criar paginas (politicas, sobre nos)', auto: true },
  { n: '4', text: 'Criar menus (principal + rodape)', auto: true },
  { n: '5', text: 'Importar produtos com imagens', auto: true },
  { n: '6', text: 'Definir precos e variantes', auto: true },
  { n: '7', text: 'Ordenar produtos nas colecoes', auto: true },
  { n: '8', text: 'Ajustes pontuais e revisao', auto: true },
];

export default function SkillsPage() {
  return (
    <div className="w-full px-4 md:px-8 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Shopify Manager</h1>
          <p className="text-muted-foreground mt-1">Todas as capacidades de automacao Shopify via Claude Code</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 py-1">
            <Bot className="h-3.5 w-3.5" />
            Claude Code
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1">
            <Terminal className="h-3.5 w-3.5" />
            /shopify
          </Badge>
        </div>
      </div>

      {/* How it works */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-red-500/10 text-red-600 border border-red-500/20">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Como funciona</h2>
              <p className="text-muted-foreground mt-1">
                Voce pede em linguagem natural no chat e o Claude executa via Shopify API.
                Nao precisa de comandos especificos — basta descrever o que precisa.
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground">Exemplo 1</p>
                  <p className="text-sm mt-1">"Cria as colecoes do Brasileirao pra loja do Julico"</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground">Exemplo 2</p>
                  <p className="text-sm mt-1">"Atualiza os precos: torcedor 209,90 / jogador 249,90"</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground">Exemplo 3</p>
                  <p className="text-sm mt-1">"Configura o tema do cliente com email e telefone do briefing"</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup manual vs automatizado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-amber-500" />
              Setup Manual (1x por cliente)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MANUAL_STEPS.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{s.step}</p>
                    <p className="text-xs text-muted-foreground">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-emerald-500" />
              Fluxo de Implementacao (automatizado)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {FLOW_STEPS.map(s => (
                <div key={s.n} className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold flex items-center justify-center">
                    {s.n}
                  </span>
                  <p className="text-sm">{s.text}</p>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Capabilities grid */}
      <div>
        <h2 className="text-lg font-bold mb-4">Capacidades</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAPABILITIES.map(cap => (
            <Card key={cap.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span className="text-red-500">{cap.icon}</span>
                  {cap.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {cap.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
