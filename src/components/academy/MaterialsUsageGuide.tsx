import { useState } from 'react';
import { ChevronDown, Sparkles, Terminal, Code2, Lightbulb, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  /** URL do GETTING_STARTED.md ou guia equivalente, mostrado como CTA */
  fullGuideUrl?: string;
}

/**
 * Card inline de orientação sobre como usar os materiais da aula.
 * Renderizado acima da grade de materiais na página de aula privada/curso.
 *
 * Pensado pra alunos de mentoria que recebem link de repositório GitHub
 * como material — ensina setup, uso com IA, e link pro guia completo.
 */
export function MaterialsUsageGuide({ fullGuideUrl }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background mb-4">
      {/* Decoração */}
      <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-extrabold text-base tracking-tight">Como usar os materiais</h4>
              <p className="text-xs text-muted-foreground font-light">
                Setup rápido + integração com IA em 3 passos
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg h-8 gap-1 text-xs font-bold"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Recolher' : 'Ver dicas'}
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>

        {/* 3 passos rápidos (sempre visíveis) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <StepCard
            n="1"
            icon={Terminal}
            title="Clone"
            body="Baixa o repositório na sua máquina em 5 segundos."
          />
          <StepCard
            n="2"
            icon={Code2}
            title="Abre no Cursor / Claude Code"
            body="Pode ser VS Code com Copilot também. A IA usa como contexto."
          />
          <StepCard
            n="3"
            icon={Lightbulb}
            title="Pergunta o que precisa"
            body="A IA lê a doc e entrega código certo — sem endpoint inventado."
          />
        </div>

        {/* Conteúdo expandido */}
        {expanded && (
          <div className="mt-5 space-y-4 pt-4 border-t border-border/40">
            {/* Bloco 1: comando de clone */}
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground mb-2">
                ⚡ Setup (copia e cola)
              </p>
              <CodeBlock>{`git clone https://github.com/leveragency/lever-academy-docs.git
cd lever-academy-docs
# abre no Cursor (ou code . / claude code)
cursor .`}</CodeBlock>
            </div>

            {/* Bloco 2: instruções pra IA */}
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground mb-2">
                🤖 Integra com seu projeto (recomendado)
              </p>
              <p className="text-sm text-muted-foreground font-light mb-2 leading-relaxed">
                Clona a doc dentro do seu projeto e cria um <code className="text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono">CLAUDE.md</code> (ou <code className="text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono">.cursorrules</code>) apontando pra ela:
              </p>
              <CodeBlock>{`# Dentro do seu projeto
git clone https://github.com/leveragency/lever-academy-docs.git docs/reference
echo "docs/reference/" >> .gitignore  # opcional

# Cria CLAUDE.md na raiz:`}</CodeBlock>
              <div className="mt-2 p-3 rounded-xl bg-muted/40 border border-border/40">
                <p className="text-[10px] font-mono text-muted-foreground mb-1">CLAUDE.md (ou .cursorrules)</p>
                <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap leading-relaxed">{`# Contexto
Fontes de verdade — consulte SEMPRE antes de escrever integração:
- Meta Marketing API: docs/reference/meta-marketing-api/
- Shopify: docs/reference/shopify-ai-toolkit/

# Regras
- Não invente endpoint — leia a doc específica antes
- Prefira GraphQL sobre REST quando disponível
- Use versão mais recente (ex: Shopify 2026-04)`}</pre>
              </div>
            </div>

            {/* Bloco 3: exemplos de perguntas */}
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground mb-2">
                💬 Exemplos do que pedir pra IA
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground font-light">
                <li className="flex gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  <span>"Cria edge function que recebe webhook <code className="text-[11px] px-1 py-0.5 rounded bg-muted font-mono">orders/create</code> da Shopify e envia pro Slack"</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  <span>"Faz script que gera feed Meta com produtos em destaque da Shopify (categoria X)"</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  <span>"Cria app Shopify com App Bridge + embedded admin que edita metafields em bulk"</span>
                </li>
              </ul>
            </div>

            {/* Bloco 4: armadilhas comuns */}
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground mb-2">
                ⚠️ Evite essas armadilhas
              </p>
              <ul className="space-y-1.5 text-[13px] text-muted-foreground font-light">
                <li>• <strong className="text-foreground font-bold">Token Meta expira em 60 dias</strong> — implemente refresh antes de rodar em produção</li>
                <li>• <strong className="text-foreground font-bold">Webhook Shopify timeout</strong> — responda em &lt;5s; lógica pesada vai pra queue</li>
                <li>• <strong className="text-foreground font-bold">GraphQL sempre &gt; REST</strong> na Shopify — menos roundtrips, campos específicos</li>
                <li>• <strong className="text-foreground font-bold">HMAC em webhook é obrigatório</strong> — nunca consuma sem validar</li>
              </ul>
            </div>

            {/* CTA pro guia completo */}
            {fullGuideUrl && (
              <a
                href={fullGuideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:gap-3 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Ver guia completo com 6 exemplos + 7 dicas
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepCard({
  n, icon: Icon, title, body,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-background/60 border border-border/40">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-5 h-5 rounded-md bg-primary/15 text-primary text-[10px] font-black flex items-center justify-center">
          {n}
        </span>
        <Icon className="w-3.5 h-3.5 text-primary" />
        <p className="font-extrabold text-xs tracking-tight">{title}</p>
      </div>
      <p className="text-[11px] text-muted-foreground font-light leading-snug">{body}</p>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="text-[11px] font-mono p-3 rounded-xl bg-zinc-950 text-zinc-100 overflow-x-auto leading-relaxed border border-zinc-800">
      <code>{children}</code>
    </pre>
  );
}
