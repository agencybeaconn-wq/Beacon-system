/**
 * Home NODE — landing pública da rota "/" (agencybeacon.site)
 * Direção: DIRECAO.md (Dark Immersive + Terminal/Dev-Tool, monocromático NODE)
 * Self-contained: CSS escopado em .nlp-, canvas vanilla, zero dependência nova.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import nodeLogo from '@/assets/node-logo.png';
import lojaPacerun from '@/assets/loja-pacerun.jpg';
import lojaThimports from '@/assets/loja-thimports.jpg';
import lojaMundotimao from '@/assets/loja-mundotimao.jpg';
import BrainField from './BrainField';
import { TOKENS } from './tokens';
import { registrar, observarProfundidade } from './rastreio';
import mShopify from '@/assets/marcas/shopify.svg';
import mSupabase from '@/assets/marcas/supabase.svg';
import mVercel from '@/assets/marcas/vercel.svg';
import mStripe from '@/assets/marcas/stripe.svg';
import mClaude from '@/assets/marcas/claude.svg';
import mAnthropic from '@/assets/marcas/anthropic.svg';
import mMeta from '@/assets/marcas/meta.svg';
import mReact from '@/assets/marcas/react.svg';
import mTypescript from '@/assets/marcas/typescript.svg';
import mNode from '@/assets/marcas/nodedotjs.svg';
import mNext from '@/assets/marcas/nextdotjs.svg';
import mVite from '@/assets/marcas/vite.svg';
import mTailwind from '@/assets/marcas/tailwindcss.svg';
import mWoo from '@/assets/marcas/woocommerce.svg';
import mVtex from '@/assets/marcas/vtex.svg';
import mPython from '@/assets/marcas/python.svg';
import mGithub from '@/assets/marcas/github.svg';
import mAnalytics from '@/assets/marcas/googleanalytics.svg';

const WHATS = 'https://wa.me/5531984083376?text=Ol%C3%A1%2C%20quero%20falar%20com%20a%20NODE%20sobre%20um%20projeto.';
const INSTA = 'https://www.instagram.com/noode.dev/';

// Foco em SERVIÇO PRESTADO, não em vaidade de escala: "clientes ativos" saiu porque
// afirmava um volume que a página não prova, e prometer o que não se mostra derruba
// a confiança justamente na seção que existe pra construí-la.
const STATS = [
    { value: 732, prefix: '', suffix: '', label: 'projetos entregues' },
    { value: 485, prefix: '', suffix: '', label: 'clientes atendidos' },
    { texto: '100%', label: 'únicos e independentes' },
    // "9h às 23h" saiu daqui: horário de atendimento não é prova de porte, e a
    // informação já vive no rodapé e no FAQ. Três números respiram melhor que quatro.
];

// Operações reais no ar. Formato de portfólio: categoria, cliente, projeto e o que
// foi feito. Prova de entrega, não peça de conversão (sem preço, sem "compre").
const OPERACOES = [
    {
        nome: 'Pace Run', url: 'https://lojapacerun.com.br/', img: lojaPacerun,
        categoria: 'E-commerce / Performance',
        projeto: 'Loja completa + checkout',
        desc: 'Loja de corrida montada do catálogo ao checkout transparente, com frete e pagamento configurados pra converter desde o primeiro dia.',
    },
    {
        nome: 'TH Imports', url: 'https://thimportsloja.com.br/', img: lojaThimports,
        categoria: 'E-commerce / Tema próprio',
        projeto: 'Tema autoral + operação',
        desc: 'Tema construído sob medida pra marca, com catálogo estruturado e a operação rodando junto com o time do cliente.',
    },
    {
        nome: 'Mundo Timão', url: 'https://mundotimao.com.br/', img: lojaMundotimao,
        categoria: 'E-commerce / Identidade',
        projeto: 'Identidade de clube',
        desc: 'Loja com a cara da torcida: identidade do clube aplicada na vitrine, com campanhas sazonais e catálogo grande organizado.',
    },
];

// Garantias de contrato. Tudo aqui é verificável no que a NODE já pratica.
const GARANTIAS = [
    {
        icone: 'chave', titulo: 'Código e acessos são seus',
        desc: 'Você recebe o repositório e todos os acessos no fim do projeto. Sem dependência eterna, sem refém de fornecedor.',
    },
    {
        icone: 'suporte', titulo: 'Suporte todo dia',
        desc: 'WhatsApp e e-mail das 9h às 23h, todos os dias, enquanto você for cliente ativo. Sem fila e sem robô.',
    },
    {
        icone: 'codigo', titulo: 'Stack moderna',
        desc: 'Shopify, Supabase, Vercel, React e TypeScript, com IA no dia a dia da engenharia. Nada de tecnologia legada.',
    },
    {
        icone: 'raio', titulo: 'Entrega em dias',
        desc: 'Lojas e sites completos costumam sair em dias, não em meses. O prazo fechado você recebe já no alinhamento.',
    },
];

const SOLUTIONS = [
    {
        num: '01', title: 'Sistemas & Aplicações de IA',
        desc: 'Dashboards, automações e agentes que trabalham 24h dentro da sua operação. Nada de demo bonita: aqui é sistema rodando de verdade.',
        tags: 'agentes · automação · dados',
    },
    {
        num: '02', title: 'E-commerce de alta conversão',
        desc: 'Loja não é vitrine. A gente monta e opera lojas pensadas pra converter, do catálogo ao checkout, prontas pra vender no dia do lançamento.',
        tags: 'shopify · cro · operação',
    },
    {
        num: '03', title: 'Sites & Landing pages',
        desc: 'Páginas rápidas, bonitas e medidas. Cada seção existe por um motivo: levar quem chega até a ação.',
        tags: 'performance · design · tracking',
    },
];

// As três frentes que a NODE vende. Cada uma diz O QUE é e COMO funciona na prática —
// é o elemento de venda da página, não um resumo institucional.
const OFERTAS = [
    {
        num: '01', titulo: 'Sites & Landing Pages',
        linha: 'Desenvolvimento personalizado de verdade. A gente não adapta layout pronto: constrói exatamente o que a sua operação precisa vender, do jeito que o seu negócio funciona.',
        grupos: [
            {
                label: 'o que entra',
                itens: [
                    'E-commerce completo em Shopify, WooCommerce, VTEX ou NuvemShop',
                    'Landing page de campanha, desenhada pra uma ação só',
                    'Site institucional e portfólio com identidade autoral',
                    'Catálogo, variações, frete e checkout configurados',
                    'Checkout transparente (Yampi, Appmax) quando faz sentido',
                    'Design do zero, sem nenhum tema reaproveitado de terceiro',
                ],
            },
            {
                label: 'como funciona',
                itens: [
                    'Partimos do seu produto e do seu público, nunca de um layout',
                    'Cada seção existe por um motivo ligado à venda',
                    'Pixel, GA4 e eventos instalados e testados antes de subir',
                    'Você recebe acessos e documentação: a loja é sua, não nossa',
                ],
            },
        ],
        cta: 'Fazer meu orçamento',
        pagina: 'criacao-de-sites',
        wa: 'Olá! Quero entender mais sobre o desenvolvimento de site / landing page com a NODE.',
    },
    {
        num: '02', titulo: 'Sistemas & IA aplicada',
        linha: 'Software que entra na operação e resolve gargalo real. Antes de escrever uma linha de código, a gente entende como você trabalha hoje e onde o processo trava.',
        grupos: [
            {
                label: 'o que entra',
                itens: [
                    'Painéis e dashboards com os seus dados, em tempo real',
                    'Automações que eliminam trabalho manual repetido',
                    'Agentes de IA que atendem, triam e respondem 24h',
                    'Integração com Shopify, WhatsApp, planilhas, ERP e CRM',
                    'Área de cliente com login e permissão por perfil',
                    'Banco próprio, com isolamento de dados e segurança',
                ],
            },
            {
                label: 'como funciona',
                itens: [
                    'Mapeamos a operação atual e achamos onde o tempo vaza',
                    'Definimos qual resultado o sistema precisa entregar',
                    'Entregamos em ciclos curtos, com você usando desde cedo',
                    'Depois do lançamento seguimos operando junto com você',
                ],
            },
        ],
        cta: 'Fazer meu orçamento',
        pagina: 'sistemas-e-ia',
        wa: 'Olá! Quero entender mais sobre sistemas e IA aplicada na minha operação com a NODE.',
    },
    {
        num: '03', titulo: 'Mentorias',
        linha: 'Formação 100% na prática. Você não assiste aula: constrói um projeto real do zero até o ar, com a gente do lado revisando cada decisão.',
        grupos: [
            {
                label: 'o que você aprende',
                itens: [
                    'IA aplicada de verdade: onde ela entra e onde não entra',
                    'Desenvolvimento de sites e LPs, do zero ao deploy',
                    'Construção de sistemas: banco, login, painel e automação',
                    'Geração de imagem e criativo com IA, do prompt ao entregável',
                    'Agentes de código no dia a dia, sem enrolação',
                    'Precificação e escopo: como vender o que você aprendeu',
                ],
            },
            {
                label: 'como é o ensino',
                itens: [
                    'Cada encontro termina com uma coisa funcionando, não com anotação',
                    'O projeto é seu, é real, e vai pro ar no final',
                    'Revisão do seu código e das suas decisões, uma a uma',
                    'Acompanhamento direto, sem turma gigante',
                ],
            },
        ],
        cta: 'Quero saber da mentoria',
        pagina: 'mentoria-de-ia',
        wa: 'Olá! Quero entender mais sobre as mentorias da NODE.',
    },
];

// cada frente abre o WhatsApp já com o assunto certo — quem chega não precisa explicar
const waLink = (texto: string) => `https://wa.me/5531984083376?text=${encodeURIComponent(texto)}`;

const STEPS = [
    { num: '01', title: 'Alinhamento estratégico', desc: 'Sentamos com você, entendemos o negócio e definimos a meta. Sem meta clara, nada começa.' },
    { num: '02', title: 'Arquitetura & identidade', desc: 'Desenhamos a estrutura, o visual e a stack sob medida pro seu projeto. Nada sai de template.' },
    { num: '03', title: 'Build acelerado por IA', desc: 'Nossa engenharia usa IA no dia a dia de verdade. É por isso que entregamos em dias, e não em meses.' },
    { num: '04', title: 'Lançamento & operação', desc: 'Projeto no ar com tracking e suporte. Depois do lançamento, a gente continua junto na operação.' },
];

// Faixa da stack com logo de verdade. Os SVGs ficam no repositório (nada de
// hotlink de terceiro): se o CDN de origem cair, a faixa continua no ar.
const STACK = [
    { nome: 'Shopify', logo: mShopify }, { nome: 'Supabase', logo: mSupabase },
    { nome: 'Vercel', logo: mVercel }, { nome: 'Stripe', logo: mStripe },
    { nome: 'Claude', logo: mClaude }, { nome: 'Anthropic', logo: mAnthropic },
    { nome: 'Meta', logo: mMeta }, { nome: 'React', logo: mReact },
    { nome: 'TypeScript', logo: mTypescript }, { nome: 'Node.js', logo: mNode },
    { nome: 'Next.js', logo: mNext }, { nome: 'Vite', logo: mVite },
    { nome: 'Tailwind', logo: mTailwind }, { nome: 'WooCommerce', logo: mWoo },
    { nome: 'VTEX', logo: mVtex }, { nome: 'Python', logo: mPython },
    { nome: 'GitHub', logo: mGithub }, { nome: 'Analytics', logo: mAnalytics },
];

const FAQS = [
    { q: 'Como começa um projeto com a NODE?', a: 'Você chama no WhatsApp e a gente marca um papo rápido de alinhamento. Dali sai escopo, prazo e investimento. Aprovou, entramos em produção no mesmo dia.' },
    { q: 'Qual o prazo de entrega?', a: 'Depende do escopo, mas trabalhamos em outra velocidade: lojas e sites completos costumam sair em dias. O prazo fechado você recebe no alinhamento.' },
    { q: 'Como funciona o suporte?', a: 'Suporte ilimitado via WhatsApp e e-mail durante a vigência do plano, das 9h às 23h, todos os dias.' },
    { q: 'O tema NODE para Shopify tem licença?', a: 'Sim. Cada licença vale pra uma loja, com atualizações inclusas enquanto você for cliente ativo. Pra uma segunda loja, basta uma licença adicional.' },
    { q: 'Quais tecnologias vocês dominam?', a: 'Shopify, WooCommerce, VTEX, NuvemShop e Yampi no e-commerce. Supabase, Vercel e Stripe em sistemas. OpenAI e Claude na parte de IA.' },
];

// Ícones das garantias: traço simples, herdam a cor do acento
function Icone({ nome }: { nome: string }) {
    const comum = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    if (nome === 'chave') return <svg {...comum}><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3m-3 3 2 2m-4 0 2 2" /></svg>;
    if (nome === 'suporte') return <svg {...comum}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" /><path d="m5.7 5.7 3.9 3.9m4.8 4.8 3.9 3.9m0-12.6-3.9 3.9m-4.8 4.8-3.9 3.9" /></svg>;
    if (nome === 'codigo') return <svg {...comum}><path d="m8 6-6 6 6 6m8-12 6 6-6 6" /></svg>;
    return <svg {...comum}><path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" /></svg>;
}

// ─── Contador animado no reveal ─────────────────────────────────────────────
function Counter({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.textContent = `${prefix}${value.toLocaleString('pt-BR')}${suffix}`;
            return;
        }
        const io = new IntersectionObserver(([e]) => {
            if (!e.isIntersecting) return;
            io.disconnect();
            const t0 = performance.now(), dur = 1400;
            const step = (t: number) => {
                const p = Math.min((t - t0) / dur, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                el.textContent = `${prefix}${Math.round(value * eased).toLocaleString('pt-BR')}${suffix}`;
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }, { threshold: .4 });
        io.observe(el);
        return () => io.disconnect();
    }, [value, prefix, suffix]);
    return <span ref={ref}>{prefix}0{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAMADA v2 — "REDE VIVA + HUD"

   Tese: o site para de ser uma página com uma arte no fundo e passa a ser um
   SISTEMA SENDO OBSERVADO. A moldura é de instrumento, a telemetria é real
   (rolagem, ato, hora, coordenada da operação), e o grafo à esquerda liga as
   seções — a página inteira é um node graph, que é literalmente o nome da marca.

   Regra que segurou a mão: o cérebro continua sendo a estrela. Tudo aqui é
   1px, mono e discreto. HUD que compete com a arte vira poluição.
   ═══════════════════════════════════════════════════════════════════════════ */

const ATOS_V2 = ['ABERTURA', 'SOLUÇÕES', 'OPERAÇÕES', 'CONTATO'];
const SECOES_V2 = [
    { id: 'top', rot: 'ABERTURA' },
    { id: 'solucoes', rot: 'SOLUÇÕES' },
    { id: 'resultados', rot: 'CLIENTES' },
    { id: 'ofertas', rot: 'FRENTES' },
    { id: 'processo', rot: 'PROCESSO' },
    { id: 'faq', rot: 'DÚVIDAS' },
];

/** Dispara a onda que atravessa o cérebro. A interface CONVERSA com a arte. */
const pulsar = () => window.dispatchEvent(new Event('node-pulse'));

/** Moldura de instrumento + telemetria ao vivo. */
function HudV2({ ato }: { ato: number }) {
    const [pct, setPct] = useState(0);
    const [hora, setHora] = useState('--:--:--');
    const [ativa, setAtiva] = useState(0);

    useEffect(() => {
        const onScroll = () => {
            const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
            setPct(Math.round(Math.min(1, scrollY / max) * 100));
            // qual seção está ocupando o meio da tela
            let idx = 0;
            SECOES_V2.forEach((s, i) => {
                const el = document.getElementById(s.id);
                if (el && el.getBoundingClientRect().top <= innerHeight * 0.45) idx = i;
            });
            setAtiva(idx);
        };
        const t = setInterval(() => setHora(new Date().toLocaleTimeString('pt-BR', { hour12: false })), 1000);
        addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => { removeEventListener('scroll', onScroll); clearInterval(t); };
    }, []);

    const barra = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

    return (
        <div className="v2-hud" aria-hidden="true">
            <span className="v2-canto v2-canto-tl" /><span className="v2-canto v2-canto-tr" />
            <span className="v2-canto v2-canto-bl" /><span className="v2-canto v2-canto-br" />

            {/* espinha de nós: a página É um grafo */}
            <div className="v2-espinha">
                {SECOES_V2.map((s, i) => (
                    <a key={s.id} href={`#${s.id}`} className={`v2-no${i === ativa ? ' on' : ''}`}
                        onClick={pulsar} style={{ pointerEvents: 'auto' }}>
                        {/* rótulo → número → PONTO. O ponto é o último de propósito:
                            com justify-content:flex-end ele fica ancorado na direita e a
                            coluna de pontos sai reta. Com o ponto em primeiro, a largura
                            variável de cada rótulo empurrava cada ponto pra um x diferente. */}
                        <b>{s.rot}</b><em>{String(i + 1).padStart(2, '0')}</em><i />
                    </a>
                ))}
            </div>

            {/* telemetria inferior */}
            <div className="v2-tele">
                <span>NODE//SYS</span>
                <span className="v2-tele-sep">·</span>
                <span className="v2-tele-ok"><i />NEURAL_LINK ATIVO</span>
                <span className="v2-tele-sep">·</span>
                <span>ATO {ato + 1}/4 {ATOS_V2[Math.min(ato, 3)]}</span>
                <span className="v2-tele-flex" />
                <span className="v2-tele-barra">{barra} {String(pct).padStart(3, '0')}%</span>
                <span className="v2-tele-sep">·</span>
                <span>-19.92 / -43.94</span>
                <span className="v2-tele-sep">·</span>
                <span className="v2-tele-hora">{hora}</span>
            </div>
        </div>
    );
}

/** Quebra o texto em glifos individuais para o ATO 1 (desmonte no scroll).
 *  Cada glifo é inline-block porque só assim aceita transform. O espaço vira
 *  NBSP: espaço normal colapsa e a frase perde o ritmo ao ser fatiada. */
function Glifos({ texto }: { texto: string }) {
    return (
        <>
            {texto.split('').map((c, i) => (
                <span className="v2-glifo" key={`${c}-${i}`} aria-hidden="true">
                    {c === ' ' ? ' ' : c}
                </span>
            ))}
            <span className="v2-leitor">{texto}</span>
        </>
    );
}

/** Texto que se RESOLVE: entra embaralhado e assenta caractere a caractere,
 *  da esquerda pra direita, como um sistema terminando de processar.
 *  Acessibilidade: o texto real vive num <span> lido por leitor de tela; o
 *  embaralhado é aria-hidden. Em reduced-motion nasce pronto. */
function Decodifica({ texto, atraso = 900 }: { texto: string; atraso?: number }) {
    const ALFA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/\\{}[]<>*+=';
    const [saida, setSaida] = useState(() =>
        matchMedia('(prefers-reduced-motion:reduce)').matches ? texto : texto.replace(/\S/g, ' '));

    useEffect(() => {
        if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
        let raf = 0, t0 = 0, timer = 0;
        const DUR = 1100;
        const passo = (t: number) => {
            if (!t0) t0 = t;
            const p = Math.min(1, (t - t0) / DUR);
            // a frente de resolução varre o texto; atrás dela é letra final, na frente é ruído
            const frente = p * (texto.length + 6);
            setSaida(texto.split('').map((c, i) => {
                if (c === ' ') return ' ';
                if (i < frente - 6) return c;
                if (i < frente) return ALFA[Math.floor(Math.random() * ALFA.length)];
                return ' ';
            }).join(''));
            if (p < 1) raf = requestAnimationFrame(passo); else setSaida(texto);
        };
        timer = window.setTimeout(() => { raf = requestAnimationFrame(passo); }, atraso);
        return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
    }, [texto, atraso]);

    return (
        <>
            <span className="v2-decod" aria-hidden="true">{saida}</span>
            <span className="v2-leitor">{texto}</span>
        </>
    );
}

/** TRILHO — o circuito que prova que a página é um grafo.
 *  Uma linha desce pela margem esquerda e SE DESENHA conforme você rola; cada
 *  seção tem um nó nela, que acende quando a seção entra e estende um ramo até
 *  o conteúdo. Fica na margem, não sobre a arte: o cérebro continua sendo a
 *  estrela e o trilho é a fiação. */
function TrilhoV2() {
    const [nos, setNos] = useState<{ y: number; rot: string }[]>([]);
    const [ativa, setAtiva] = useState(-1);
    const trilhoRef = useRef<HTMLDivElement>(null);
    // espelho em ref: o laço de rolagem lê daqui, não do estado do React
    const nosRef = useRef<{ y: number; rot: string }[]>([]);
    nosRef.current = nos;

    useEffect(() => {
        let raf = 0;
        const medir = () => {
            const ys: { y: number; rot: string }[] = [];
            SECOES_V2.forEach(s => {
                const el = document.getElementById(s.id);
                if (!el) return;
                // ancora no cabeçalho, não no topo da seção: é onde o olho está
                const alvo = el.querySelector('.nlp-head') ?? el;
                ys.push({ y: Math.round(alvo.getBoundingClientRect().top + scrollY + 18), rot: s.rot });
            });
            setNos(ys);
        };
        const pintar = () => {
            raf = 0;
            const doc = document.documentElement;
            const frente = scrollY + innerHeight * 0.55;
            const total = Math.max(1, doc.scrollHeight);
            trilhoRef.current?.style.setProperty('--desenho', Math.min(1, frente / total).toFixed(4));
            let idx = -1;
            nosRef.current.forEach((n, i) => { if (frente >= n.y) idx = i; });
            setAtiva(idx);
        };
        const aoRolar = () => { if (!raf) raf = requestAnimationFrame(pintar); };
        const remedir = () => { medir(); pintar(); };

        const t1 = setTimeout(remedir, 1600);
        const t2 = setTimeout(remedir, 3400); // depois das revelações mudarem a altura
        addEventListener('scroll', aoRolar, { passive: true });
        addEventListener('resize', remedir);
        return () => {
            clearTimeout(t1); clearTimeout(t2);
            removeEventListener('scroll', aoRolar); removeEventListener('resize', remedir);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);

    return (
        <div className="v2-trilho" ref={trilhoRef} aria-hidden="true">
            <span className="v2-trilho-base" />
            <span className="v2-trilho-luz" />
            {nos.map((n, i) => (
                <span key={n.rot} className={`v2-no-sec${i <= ativa ? ' on' : ''}`} style={{ top: n.y }}>
                    <b>{n.rot}</b>
                </span>
            ))}
        </div>
    );
}

/** Retículo que segue o ponteiro. Só em mouse — no toque não existe cursor. */
function CursorV2() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!matchMedia('(pointer:fine)').matches) return;
        if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
        const el = ref.current!;
        let x = 0, y = 0, pendente = false;

        /* SEM inércia. A primeira versão interpolava a posição (lerp .18) achando
           que "peso" daria caráter — o efeito real foi um cursor que anda mais
           devagar que a mão. Como o cursor nativo está escondido, não sobra nada
           na posição verdadeira e o ponteiro parece quebrado. Retículo tem que ser
           exato; o caráter vem da forma e do estado de mira, nunca do atraso.
           O rAF aqui só AGRUPA escritas no quadro — a posição pintada é sempre a
           última lida, não uma média. */
        const pintar = () => {
            pendente = false;
            el.style.transform = `translate3d(${x}px,${y}px,0)`;
        };
        const mover = (e: MouseEvent) => {
            x = e.clientX; y = e.clientY;
            if (el.style.opacity !== '1') el.style.opacity = '1';
            if (!pendente) { pendente = true; requestAnimationFrame(pintar); }
        };
        const sobre = (e: MouseEvent) => {
            const alvo = (e.target as HTMLElement)?.closest('a,button,summary,[role=button]');
            el.classList.toggle('mira', !!alvo);
        };
        // sem isto o retículo fica preso na última posição depois que o mouse sai
        const sair = () => { el.style.opacity = '0'; };

        el.style.display = 'block';
        el.style.opacity = '0'; // só aparece no primeiro movimento real
        addEventListener('mousemove', mover, { passive: true });
        addEventListener('mouseover', sobre, { passive: true });
        document.documentElement.addEventListener('mouseleave', sair);
        addEventListener('blur', sair);
        return () => {
            removeEventListener('mousemove', mover);
            removeEventListener('mouseover', sobre);
            document.documentElement.removeEventListener('mouseleave', sair);
            removeEventListener('blur', sair);
        };
    }, []);
    return (
        <div className="v2-cursor" ref={ref} aria-hidden="true">
            <span className="v2-cursor-anel" /><span className="v2-cursor-h" /><span className="v2-cursor-v" />
        </div>
    );
}

export default function HomeNodeV2() {
    const [faqOpen, setFaqOpen] = useState<number | null>(0);
    const [ato, setAto] = useState(0);
    const [abrindo, setAbrindo] = useState(true);

    // ABERTURA: segura a página o mínimo necessário pras fontes assentarem, pra ela
    // ABRIR em vez de "aparecer". Teto rígido de 1.4s — nunca vira tela de espera.
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setAbrindo(false); return; }
        let fechado = false;
        const fechar = () => { if (!fechado) { fechado = true; setAbrindo(false); } };
        const teto = setTimeout(fechar, 1400);
        document.fonts?.ready.then(() => setTimeout(fechar, 240));
        return () => clearTimeout(teto);
    }, []);

    // Reveal on scroll
    useEffect(() => {
        const io = new IntersectionObserver(
            es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('nlp-in'); io.unobserve(e.target); } }),
            { threshold: .12 }
        );
        document.querySelectorAll('.nlp-reveal').forEach(el => io.observe(el));
        return () => io.disconnect();
    }, []);

    // PROFUNDIDADE (DESIGN.md §5.3): a camada do meio anda mais devagar que o texto.
    // Aplicada só em elementos SEM .nlp-reveal — reveal também usa transform e os dois
    // brigariam pela mesma propriedade.
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const els = Array.from(document.querySelectorAll<HTMLElement>('.nlp-par'));
        if (!els.length) return;
        let raf = 0;
        const update = () => {
            raf = 0;
            const h = window.innerHeight;
            for (const el of els) {
                const r = el.getBoundingClientRect();
                if (r.bottom < -200 || r.top > h + 200) continue;
                const c = (r.top + r.height / 2 - h / 2) / h;   // -1 (topo) .. 1 (base)
                const d = parseFloat(el.dataset.par || '1');
                el.style.transform = `translate3d(0,${(-c * 30 * d).toFixed(1)}px,0)`;
            }
        };
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);

    // Indicador dos 4 atos — o mapa tem que bater com a ARTE, não com a contagem de
    // seções. Os marcos são exatamente onde cada ato do cérebro assume.
    useEffect(() => {
        const marcos = () => ['solucoes', 'resultados', 'faq']
            .map(id => document.getElementById(id))
            .map(el => (el ? el.getBoundingClientRect().top + window.scrollY : Infinity));
        let raf = 0;
        const update = () => {
            raf = 0;
            const h = window.innerHeight;
            const y = window.scrollY + h * 0.42;
            const [sol, res, faq] = marcos();
            // mesmos limiares das rampas do BrainField, pra ponto aceso == ato na tela
            setAto(y >= faq - h * 0.4 ? 3 : y >= res - h * 0.4 ? 2 : y >= sol - h * 0.4 ? 1 : 0);
        };
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
    }, []);

    // Rastreio: quem chegou, até onde leu e em qual CTA clicou
    useEffect(() => {
        registrar('landing_view');
        return observarProfundidade();
    }, []);

    // Hover numa operação real manda um pulso pro campo de partículas
    const pulso = () => window.dispatchEvent(new CustomEvent('node-pulse'));

    /* ═══════════════ ATO 1 — O DESMONTE ═══════════════
       Nos primeiros ~85vh de rolagem o herói fica PRESO e a frase se desfaz:
       cada glifo voa na direção do núcleo do cérebro e some. A tese resiste
       mais que o resto e é a última a partir.

       Por que assim e não um fade: a promessa da marca é "tecnologia que
       transforma marcas". Então o texto não sai de cena — ele VIRA a rede.
       O gesto é a tese, não enfeite.

       Custo: os vetores de voo são calculados uma vez (e no resize/troca de
       fonte). Por quadro escreve-se só uma custom property por glifo — nada
       de leitura de layout, só compositing. */
    useEffect(() => {
        if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
        const palco = document.querySelector<HTMLElement>('.v2 .nlp-hero');
        if (!palco) return;

        const MAX_ATRASO = 0.34;
        type Glifo = { el: HTMLElement; dx: number; dy: number; px: number; py: number; rot: number; atraso: number };
        let glifos: Glifo[] = [];
        let raf = 0, ultimo = -1;
        let pulsouA = false, pulsouB = false, engoliu = false;

        const medir = () => {
            const els = [...document.querySelectorAll<HTMLElement>('.v2-glifo')];
            // zera antes de medir: com os glifos já deslocados, o rect seria o de chegada
            els.forEach(el => { el.style.transform = ''; el.style.opacity = ''; });
            const alvoX = innerWidth * 0.72, alvoY = innerHeight * 0.46;
            glifos = els.map((el, i) => {
                const r = el.getBoundingClientRect();
                const dx = alvoX - (r.left + r.width / 2);
                const dy = alvoY - (r.top + r.height / 2);
                // desvio PERPENDICULAR ao voo: dá curva à trajetória sem impedir a
                // chegada. Feixe reto lê como artificial; desvio no destino lê como
                // "passou perto", que era o problema — elas não eram engolidas.
                const dist = Math.hypot(dx, dy) || 1;
                const esp = ((i * 37) % 100) / 100 - 0.5;
                return {
                    el, dx, dy,
                    px: (-dy / dist) * esp * 190,
                    py: (dx / dist) * esp * 190,
                    rot: esp * 200,
                    atraso: (i / Math.max(1, els.length - 1)) * MAX_ATRASO,
                };
            });
        };

        // a pista precisa casar com o padding-bottom do palco no CSS (85vh / 62vh)
        const pista = () => innerHeight * (innerWidth <= 860 ? 0.62 : 0.85);

        const desenhar = () => {
            raf = 0;
            const corrida = pista();
            const p = Math.max(0, Math.min(1, scrollY / corrida));
            // prende o conteúdo: sobe junto com a rolagem até a pista acabar
            palco.style.setProperty('--pin', `${Math.round(Math.min(scrollY, corrida))}px`);
            if (Math.abs(p - ultimo) < 0.002) return;
            ultimo = p;
            const vao = 1 - MAX_ATRASO;
            for (const g of glifos) {
                const pp = Math.max(0, Math.min(1, (p - g.atraso) / vao));
                if (pp <= 0) { g.el.style.transform = ''; g.el.style.opacity = ''; continue; }
                // acelera no fim: a letra é PUXADA pro núcleo, não flutua até lá
                const e = pp * pp * (3 - 2 * pp);
                const curva = Math.sin(pp * Math.PI);      // some nas duas pontas → converge
                const x = g.dx * e + g.px * curva;
                const y = g.dy * e + g.py * curva;
                const s = 1 - 0.94 * e;                     // fecha num ponto
                // segura a opacidade quase até o fim: sumir cedo lê como fade, não como engolir
                const o = pp < 0.8 ? 1 : Math.max(0, 1 - (pp - 0.8) / 0.2);
                g.el.style.transform =
                    `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(g.rot * e).toFixed(1)}deg) scale(${s.toFixed(3)})`;
                g.el.style.opacity = o.toFixed(3);
            }
            palco.style.setProperty('--ato', p.toFixed(3));
            // camada de GPU só durante o ato
            palco.classList.toggle('ativo', p > 0.002 && p < 0.998);
            // ondas enquanto o campo se alimenta...
            if (p > 0.34 && !pulsouA) { pulsouA = true; pulsar(); }
            if (p > 0.68 && !pulsouB) { pulsouB = true; pulsar(); }
            // ...e a ENGOLIDA quando a última letra chega: o campo se desfaz e remonta
            if (p > 0.95 && !engoliu) {
                engoliu = true;
                window.dispatchEvent(new CustomEvent('node-absorve', { detail: { forca: 1 } }));
            }
            if (p < 0.15) { pulsouA = false; pulsouB = false; engoliu = false; }
        };

        const aoRolar = () => { if (!raf) raf = requestAnimationFrame(desenhar); };
        const remedir = () => { medir(); ultimo = -1; desenhar(); };

        // a fonte de display muda a largura dos glifos: medir só depois que assentar
        const t = setTimeout(remedir, 1500);
        document.fonts?.ready.then(remedir).catch(() => { });
        addEventListener('scroll', aoRolar, { passive: true });
        addEventListener('resize', remedir);
        return () => {
            clearTimeout(t);
            removeEventListener('scroll', aoRolar);
            removeEventListener('resize', remedir);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);

    return (
        <div className="nlp v2">
            <style>{`
        /* Tokens — ver DESIGN.md §2. Base azulada (nunca preto puro), texto GELO
           (nunca #fff), e um acento único violeta que também manda na interface:
           é o matiz presente nos 3 atos da arte, o que faz página e canvas virarem uma peça só. */
        .nlp{${TOKENS}
          background-color:var(--bg);
          color:var(--fg);font-family:'Outfit','Inter Tight',sans-serif;min-height:100vh;overflow-x:hidden}
        .nlp *{box-sizing:border-box}
        .nlp ::selection{background:var(--accent);color:var(--fg)}
        .nlp :focus-visible{outline:2px solid var(--accent-hi);outline-offset:3px;border-radius:4px}
        .nlp-mono{font-family:'JetBrains Mono',monospace;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
        .nlp-wrap{max-width:1280px;margin-inline:auto;padding-inline:28px}
        .nlp section{padding-block:clamp(84px,10vw,150px);position:relative;z-index:1}
        .nlp h1,.nlp h2{letter-spacing:-.045em;line-height:1.02;font-weight:500;margin:0}
        .nlp-chip{display:inline-flex;align-items:center;gap:9px;padding:7px 16px;border:1px solid var(--line);border-radius:var(--r-pill);
          font-family:'JetBrains Mono',monospace;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
        .nlp-chip i{width:6px;height:6px;border-radius:50%;background:var(--fg);animation:nlp-pulse 2.2s var(--ease) infinite}
        @keyframes nlp-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}
        .nlp h1{font-size:clamp(2.6rem,4.9vw,4.5rem)}
        .nlp h2{font-size:clamp(2rem,4.2vw,3.4rem)}
        .nlp p{color:var(--muted);font-weight:300;line-height:1.7;max-width:60ch;margin:0;font-size:1.05rem}
        .nlp a{color:inherit;text-decoration:none}
        /* reveal */
        .nlp-reveal{opacity:0;transform:translateY(36px);transition:opacity var(--dur) var(--ease),transform var(--dur) var(--ease)}
        .nlp-reveal.nlp-in{opacity:1;transform:none}
        .nlp-d1{transition-delay:.08s}.nlp-d2{transition-delay:.16s}.nlp-d3{transition-delay:.24s}
        /* nav */
        .nlp-nav{position:fixed;inset-inline:0;top:0;z-index:50;background:rgba(8,9,12,.72);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
        .nlp-nav-in{display:flex;align-items:center;justify-content:space-between;height:64px}
        .nlp-nav .nlp-wrap{max-width:none;padding-inline:clamp(24px,3vw,48px)}
        .nlp-links{display:flex;gap:28px}
        .nlp-links a{font-size:.86rem;color:var(--muted);transition:color var(--micro) var(--ease)}
        .nlp-links a{position:relative}
        .nlp-links a::after{content:'';position:absolute;left:0;right:100%;bottom:-6px;height:1px;background:var(--accent);
          transition:right var(--micro) var(--ease)}
        .nlp-links a:hover{color:var(--fg)}
        .nlp-links a:hover::after{right:0}
        @media(max-width:760px){.nlp-links{display:none}}
        /* botões */
        .nlp-btn{display:inline-flex;align-items:center;gap:8px;padding:14px 30px;border-radius:var(--r-pill);font-weight:500;font-size:.94rem;border:1px solid transparent;
          transition:transform var(--micro) var(--ease),background var(--micro) var(--ease),border-color var(--micro) var(--ease),box-shadow var(--micro) var(--ease);cursor:pointer}
        .nlp-btn:hover{transform:translateY(-2px)}
        .nlp-btn:active{transform:translateY(0) scale(.97)}
        .nlp .nlp-btn-solid{background:var(--fg);color:var(--bg);box-shadow:0 0 26px var(--accent-dim),inset 0 -2px 6px rgba(0,0,0,.12)}
        .nlp .nlp-btn-solid:hover{background:#F9FBFF;color:var(--bg);box-shadow:0 0 48px rgba(139,111,224,.42),inset 0 -2px 6px rgba(0,0,0,.12)}
        .nlp .nlp-btn-ghost{border-color:var(--line-hi);background:rgba(190,200,225,.05);color:var(--fg);backdrop-filter:blur(8px)}
        .nlp .nlp-btn-ghost:hover{border-color:var(--accent);background:var(--accent-dim);box-shadow:0 0 28px rgba(139,111,224,.20)}
        .nlp-btn-sm{padding:9px 20px;font-size:.85rem}
        /* hero — texto à esquerda, cérebro respira à direita (fixo atrás) */
        .nlp-hero{position:relative;padding-top:190px!important;padding-bottom:110px!important;min-height:92vh;display:flex;align-items:center}
        .nlp-hero .nlp-wrap{max-width:none;margin:0;padding-left:clamp(24px,5.5vw,96px);padding-right:24px}
        .nlp-hero .nlp-wrap{max-width:1380px}
        .nlp-hero-in{position:relative;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:28px;z-index:1;max-width:640px}
        .nlp-hero p{font-size:clamp(1.02rem,1.4vw,1.16rem);max-width:44ch;color:var(--dim);text-shadow:0 0 18px rgba(8,9,12,.9)}
        .nlp-hero h1{text-shadow:0 0 28px rgba(8,9,12,.85)}
        .nlp-ctas{display:flex;gap:26px;flex-wrap:wrap;align-items:center}
        /* mobile: menos ar e menos passo entre seções — a página encolhe sem perder respiro */
        @media(max-width:760px){
          .nlp-hero{padding-top:132px!important;padding-bottom:72px!important;min-height:auto}
          .nlp-hero-in{gap:22px}
          .nlp section{padding-block:72px}
          .nlp-head{margin-bottom:44px}
          .nlp-ops{margin-top:52px}
        }
        .nlp-link-arrow{display:inline-flex;align-items:center;gap:8px;color:var(--dim);font-weight:400;font-size:.98rem;
          transition:color var(--micro) var(--ease),gap var(--micro) var(--ease)}
        .nlp-link-arrow span{transition:transform var(--micro) var(--ease)}
        .nlp-link-arrow:hover{color:var(--fg)}
        .nlp-link-arrow:hover span{transform:translateX(4px)}
        .nlp-link-arrow:active{opacity:.7}
        .nlp-stats{display:flex;flex-wrap:wrap;margin-top:58px;gap:0}
        .nlp-stat{padding:4px 38px;text-align:left;border-left:1px solid var(--line)}
        .nlp-stat:first-child{border-left:none;padding-left:0}
        .nlp-stat b{display:block;font-size:clamp(1.4rem,2.4vw,2rem);font-weight:500;letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin-bottom:6px}
        .nlp-stat span.nlp-mono{font-size:.6rem}
        @media(max-width:760px){.nlp-stat{flex:1 1 40%;border-left:none;padding:12px 10px 12px 0}}
        /* section head */
        .nlp-head{display:flex;flex-direction:column;gap:16px;margin-bottom:72px}
        /* bloco deslocado — cérebro ocupa a esquerda, conteúdo respira à direita */
        #solucoes .nlp-wrap{max-width:none;padding-inline:clamp(24px,5.5vw,96px)}
        .nlp-offset-r{max-width:600px;margin-left:auto}
        .nlp-offset-r .nlp-head{margin-bottom:56px}
        @media(max-width:960px){.nlp-offset-r{max-width:100%;margin-left:0}}
        .nlp-offset-r .nlp-grid3{grid-template-columns:1fr;gap:52px}
        /* soluções — colunas flutuando no void, sem caixa */
        .nlp-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:64px}
        @media(max-width:860px){.nlp-grid3{grid-template-columns:1fr;gap:48px}}
        /* MATÉRIA + VAZAMENTO DE LUZ (DESIGN.md §5): o card deixa de ser buraco preto com
           borda de 1px. Superfície translúcida que capta luz, e a borda de cima acende
           num gradiente que vem da ESQUERDA — o lado onde o cérebro está neste ato. */
        .nlp-card{position:relative;display:flex;flex-direction:column;gap:16px;padding:26px 22px 22px;
          border-radius:var(--r-md);border:1px solid transparent;
          background:
            linear-gradient(170deg,rgba(23,26,37,.92),rgba(13,15,22,.92)) padding-box,
            linear-gradient(100deg,rgba(139,111,224,.62),var(--line) 44%,rgba(190,200,225,.05)) border-box;
          backdrop-filter:blur(14px);
          transition:transform var(--micro) var(--ease),box-shadow var(--micro) var(--ease)}
        .nlp-card::before{content:'';position:absolute;inset:0;border-radius:var(--r-md);pointer-events:none;
          background:radial-gradient(120% 90% at 0% 0%,var(--accent-dim),transparent 58%);opacity:.9}
        .nlp-card>*{position:relative}
        .nlp-card:hover{transform:translateY(-6px);box-shadow:0 18px 50px -24px rgba(139,111,224,.55)}
        .nlp-card h3{margin:0;font-size:var(--fs-2);font-weight:500;letter-spacing:-.02em}
        .nlp-card .nlp-mono{margin-top:auto;padding-top:16px}
        /* resultados — ato 3: o neurônio ocupa a DIREITA, o título ancora na esquerda */
        #resultados .nlp-wrap{max-width:none;padding-inline:clamp(24px,5.5vw,96px)}
        #resultados .nlp-head{max-width:620px}
        /* ── OFERTAS: as três frentes de venda ──
           Painéis opacos o bastante pra ler por cima do campo de partículas, com a
           mesma matéria dos cards e a borda acendendo no topo (luz vem de cima). */
        #ofertas .nlp-wrap{max-width:none;padding-inline:clamp(24px,5.5vw,96px)}
        .nlp-ofertas{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;align-items:stretch}
        @media(max-width:1020px){.nlp-ofertas{grid-template-columns:1fr;gap:20px;max-width:640px}}
        /* MOBILE: empilhadas, as três frentes viravam uma coluna quilométrica.
           Vira carrossel com encaixe — o vizinho aparece pela borda, então dá pra ver
           que tem mais, e a página encurta em ~2 telas. */
        @media(max-width:760px){
          .nlp-ofertas{display:flex;max-width:none;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;
            padding-inline:24px;margin-inline:-24px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
          .nlp-ofertas::-webkit-scrollbar{display:none}
          .nlp-oferta{flex:0 0 87%;scroll-snap-align:center;padding:28px 24px 24px}
          .nlp-oferta h3{font-size:var(--fs-2)}
          .nlp-oferta li{font-size:.88rem}
        }
        .nlp-oferta{position:relative;display:flex;flex-direction:column;gap:14px;padding:34px 30px 30px;
          border-radius:var(--r-md);border:1px solid transparent;
          background:
            linear-gradient(180deg,rgba(16,18,26,.94),rgba(11,13,19,.94)) padding-box,
            linear-gradient(160deg,rgba(139,111,224,.60),var(--line) 46%,rgba(190,200,225,.05)) border-box;
          backdrop-filter:blur(16px);
          transition:transform var(--micro) var(--ease),box-shadow var(--micro) var(--ease)}
        .nlp-oferta::before{content:'';position:absolute;inset:0;border-radius:var(--r-md);pointer-events:none;
          background:radial-gradient(110% 70% at 18% 0%,var(--accent-dim),transparent 60%)}
        .nlp-oferta>*{position:relative}
        .nlp-oferta:hover{transform:translateY(-6px);box-shadow:0 26px 60px -28px rgba(139,111,224,.6)}
        .nlp-oferta-num{font-family:'JetBrains Mono',monospace;font-size:.68rem;letter-spacing:.18em;color:var(--accent)}
        .nlp-oferta h3{margin:0;font-size:var(--fs-2);font-weight:500;letter-spacing:-.025em}
        .nlp-oferta p{font-size:.96rem;color:var(--muted);max-width:none}
        /* grupos de detalhe: "o que entra" e "como funciona" — é o que separa
           esta seção do resumo em Soluções (lá é por alto, aqui é o detalhe) */
        .nlp-oferta-grupo{display:flex;flex-direction:column;gap:12px;padding-top:18px;border-top:1px solid var(--line)}
        .nlp-oferta-grupo .nlp-mono{font-size:.63rem;color:var(--accent);opacity:.9}
        /* "como funciona" recolhido: o card ficava alto demais com os dois blocos abertos */
        .nlp-oferta-drop{display:block}
        .nlp-oferta-drop summary{display:flex;align-items:center;justify-content:space-between;gap:12px;
          cursor:pointer;list-style:none;padding:2px 0;color:var(--accent);
          transition:opacity var(--micro) var(--ease)}
        .nlp-oferta-drop summary::-webkit-details-marker{display:none}
        .nlp-oferta-drop summary:hover{opacity:.75}
        .nlp-oferta-drop summary svg{flex:0 0 auto;transition:transform var(--micro) var(--ease)}
        .nlp-oferta-drop[open] summary svg{transform:rotate(45deg)}
        .nlp-oferta-drop ul{margin-top:14px}
        .nlp-oferta ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
        .nlp-oferta li{position:relative;padding-left:20px;font-size:.9rem;color:var(--dim);line-height:1.5}
        .nlp-oferta li::before{content:'';position:absolute;left:0;top:.5em;width:7px;height:7px;
          border:1px solid var(--accent);border-radius:2px;transform:rotate(45deg)}
        /* CTA de verdade em cada frente — botão, não link solto */
        .nlp-oferta-cta{margin-top:auto;padding-top:0;align-self:flex-start;padding:12px 24px;font-size:.9rem;
          border-color:var(--line-hi);background:rgba(190,200,225,.05);color:var(--fg);backdrop-filter:blur(8px)}
        .nlp-oferta-cta span{transition:transform var(--micro) var(--ease)}
        .nlp-oferta:hover .nlp-oferta-cta{border-color:var(--accent);background:var(--accent-dim)}
        .nlp-oferta-cta:hover{box-shadow:0 0 28px rgba(139,111,224,.24)}
        .nlp-oferta-cta:hover span{transform:translateX(4px)}
        .nlp-oferta-acoes{margin-top:auto;padding-top:22px;display:flex;flex-direction:column;
          align-items:flex-start;gap:14px}
        .nlp-oferta-acoes .nlp-oferta-cta{margin-top:0}
        .nlp-oferta-saiba{display:inline-flex;align-items:center;gap:7px;font-size:.86rem;color:var(--muted);
          transition:color var(--micro) var(--ease)}
        .nlp-oferta-saiba span{transition:transform var(--micro) var(--ease)}
        .nlp-oferta-saiba:hover{color:var(--accent-hi)}
        .nlp-oferta-saiba:hover span{transform:translateX(4px)}
        /* ══ PORTFÓLIO: cada operação no ar vira um caso ══
           Painel opaco (lê por cima do neurônio), categoria em acento, print grande,
           linha Cliente/Projeto e botão. */
        .nlp-ops{margin-top:clamp(56px,6vw,84px);display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
        @media(max-width:1020px){.nlp-ops{grid-template-columns:1fr;max-width:620px}}
        .nlp-caso{position:relative;display:flex;flex-direction:column;border-radius:var(--r-md);overflow:hidden;
          border:1px solid transparent;
          background:
            linear-gradient(180deg,rgba(18,20,29,.95),rgba(11,13,19,.95)) padding-box,
            linear-gradient(165deg,rgba(139,111,224,.55),var(--line) 45%,rgba(190,200,225,.05)) border-box;
          backdrop-filter:blur(16px);
          transition:transform var(--micro) var(--ease),box-shadow var(--micro) var(--ease)}
        .nlp-caso:hover{transform:translateY(-6px);box-shadow:0 26px 60px -28px rgba(139,111,224,.6)}
        .nlp-caso header{padding:24px 24px 18px;display:flex;flex-direction:column;gap:6px}
        .nlp-caso-cat{font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.16em;
          text-transform:uppercase;color:var(--accent)}
        .nlp-caso h3{margin:0;font-size:var(--fs-3);font-weight:500;letter-spacing:-.03em}
        .nlp-caso-shot{position:relative;overflow:hidden;border-block:1px solid var(--line);background:#0E1017}
        /* o print ROLA dentro do quadro no hover: a loja ganha vida em vez de ser foto parada */
        .nlp-caso-shot img{width:100%;height:auto;display:block;
          filter:saturate(.9) brightness(.9);
          transition:filter var(--micro) var(--ease),transform 2.6s cubic-bezier(.4,0,.2,1)}
        .nlp-caso:hover .nlp-caso-shot img{filter:saturate(1) brightness(1);transform:translateY(-18%)}
        .nlp-caso-meta{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:20px 24px 0}
        .nlp-caso-meta span{display:block;font-family:'JetBrains Mono',monospace;font-size:.6rem;
          letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:5px}
        .nlp-caso-meta strong{font-size:.95rem;font-weight:500}
        .nlp-caso p{padding:16px 24px 0;font-size:.9rem;color:var(--muted);line-height:1.55;max-width:none}
        .nlp-caso-cta{margin:22px 24px 24px;align-self:flex-start;padding:11px 22px;font-size:.88rem;
          border-color:var(--line-hi);background:rgba(190,200,225,.05);color:var(--fg)}
        .nlp-caso-cta span{transition:transform var(--micro) var(--ease)}
        .nlp-caso:hover .nlp-caso-cta{border-color:var(--accent);background:var(--accent-dim)}
        .nlp-caso-cta:hover span{transform:translateX(4px)}

        /* ══ GARANTIAS: o que o cliente leva pra casa ══ */
        .nlp-garantias{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
        @media(max-width:1020px){.nlp-garantias{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:600px){.nlp-garantias{grid-template-columns:1fr}}
        .nlp-garantia{padding:28px 24px;border-radius:var(--r-md);border:1px solid var(--line);
          background:rgba(16,18,26,.85);backdrop-filter:blur(14px);
          transition:transform var(--micro) var(--ease),border-color var(--micro) var(--ease)}
        .nlp-garantia:hover{transform:translateY(-4px);border-color:rgba(139,111,224,.45)}
        .nlp-garantia-icone{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;
          border-radius:var(--r-sm);background:var(--accent-dim);color:var(--accent);margin-bottom:18px}
        .nlp-garantia h3{margin:0 0 8px;font-size:var(--fs-1);font-weight:500;letter-spacing:-.01em}
        .nlp-garantia p{font-size:.88rem;color:var(--muted);line-height:1.55;max-width:none}

        /* ══ Faixa de venda cruzada da loja Shopify ══ */
        .nlp-faixa-shopify{margin-top:26px;display:flex;align-items:center;justify-content:space-between;
          gap:clamp(24px,4vw,56px);
          padding:30px clamp(26px,3vw,40px);border-radius:var(--r-md);text-decoration:none;color:inherit;
          border:1px solid rgba(139,111,224,.32);background:linear-gradient(100deg,rgba(139,111,224,.12),rgba(16,18,26,.9) 62%);
          backdrop-filter:blur(14px);
          transition:border-color var(--micro) var(--ease),transform var(--micro) var(--ease)}
        .nlp-faixa-shopify:hover{border-color:var(--accent);transform:translateY(-3px)}
        /* a etiqueta usa o MESMO padrão de todas as seções (// texto em mono, acento),
           dentro da coluna de texto. Como pílula preenchida ela lia como botão solto. */
        .nlp-faixa-txt{display:flex;flex-direction:column;gap:9px}
        .nlp-faixa-txt .nlp-mono{color:var(--accent);font-size:.63rem}
        .nlp-faixa-shopify strong{display:block;font-size:var(--fs-2);font-weight:500;letter-spacing:-.025em}
        .nlp-faixa-shopify p{font-size:.9rem;color:var(--muted);line-height:1.55;max-width:64ch}
        .nlp-faixa-link{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;font-size:.9rem;color:var(--accent-hi);white-space:nowrap}
        .nlp-faixa-link span{transition:transform var(--micro) var(--ease)}
        .nlp-faixa-shopify:hover .nlp-faixa-link span{transform:translateX(4px)}
        @media(max-width:860px){
          .nlp-faixa-shopify{flex-direction:column;align-items:flex-start;gap:16px}
        }
        /* (bloco de métricas removido — a prova da seção agora são as operações no ar) */
        /* ══ PROCESSO — REGISTRO INVERTIDO (DESIGN.md §6) ══
           A quebra de ritmo da página: superfície clara, texto escuro. É a única seção
           opaca — ela TAMPA a arte de propósito, e é isso que faz o olho descansar
           antes do finale. Prova também que o acento funciona nos dois modos. */
        /* Era uma FAIXA branca cortando a página de ponta a ponta — lia como recorte de
           outro site colado aqui. Virou um PAINEL: recuado das bordas, cantos redondos,
           tom frio da paleta (não branco puro) e um halo violeta que dissolve a borda
           no escuro. Assim a inversão continua sendo a quebra de ritmo, mas pertence. */
        #processo{position:relative;z-index:2;padding-block:0!important;background:transparent;
          margin-block:clamp(90px,10vw,150px)}
        #processo .nlp-wrap{position:relative;max-width:1240px;
          --fg:#171A22;--muted:#5C6272;--dim:#3C4252;--line:rgba(23,26,34,.13);--line-hi:rgba(23,26,34,.24);
          --accent:#6A4FCB;--accent-dim:rgba(106,79,203,.10);
          color:var(--fg);
          background:linear-gradient(165deg,#E7EAF3 0%,#DDE1EE 54%,#CFD4E6 100%);
          border:1px solid rgba(190,200,225,.22);border-radius:var(--r-lg);
          padding:clamp(52px,6vw,86px) clamp(28px,4vw,64px);
          box-shadow:0 0 0 1px rgba(8,9,12,.5),0 40px 120px -40px rgba(139,111,224,.55),
                     0 0 160px -30px rgba(139,111,224,.28)}
        /* halo: o painel VAZA luz violeta pro escuro em vez de encostar num corte seco */
        #processo .nlp-wrap::before{content:'';position:absolute;inset:-110px;border-radius:90px;pointer-events:none;
          background:radial-gradient(58% 54% at 50% 50%,rgba(139,111,224,.26),rgba(139,111,224,.10) 62%,transparent 76%);z-index:-1}
        @media(max-width:760px){#processo .nlp-wrap{border-radius:var(--r-lg)}}
        #processo h2{color:var(--fg)}
        #processo p{color:var(--muted)}
        #processo .nlp-mono{color:var(--accent);opacity:.85}
        .nlp-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:52px}
        @media(max-width:960px){.nlp-steps{grid-template-columns:repeat(2,1fr);gap:44px}}
        @media(max-width:520px){.nlp-steps{grid-template-columns:1fr}}
        .nlp-step{position:relative;border-top:1px solid var(--line-hi);padding-top:22px;display:flex;flex-direction:column;gap:12px}
        .nlp-step h3{margin:0;font-size:var(--fs-1);font-weight:500;position:relative}
        .nlp-step p{font-size:.94rem}
        /* momento editorial: o índice gigante vazado atrás do passo */
        .nlp-step-idx{position:absolute;top:8px;right:-6px;font-size:clamp(3.6rem,6vw,5.4rem);font-weight:600;
          line-height:1;letter-spacing:-.05em;color:var(--accent);opacity:.10;pointer-events:none;user-select:none;
          font-variant-numeric:tabular-nums;
          transition:opacity var(--micro) var(--ease),transform var(--micro) var(--ease)}
        /* o número acende em roxo quando o passo recebe o mouse */
        .nlp-step:hover .nlp-step-idx{opacity:.42;transform:translateY(-4px) scale(1.04)}
        .nlp-step{transition:transform var(--micro) var(--ease)}
        .nlp-step:hover{transform:translateY(-3px)}
        /* marquee */
        .nlp-marquee{overflow:hidden;border-block:1px solid var(--line);padding-block:22px;position:relative;
          mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
        .nlp-track{display:flex;gap:56px;width:max-content;animation:nlp-scroll 36s linear infinite}
        .nlp-marquee:hover .nlp-track{animation-play-state:paused}
        @keyframes nlp-scroll{to{transform:translateX(-50%)}}
        .nlp-track span{display:inline-flex;align-items:center;gap:11px;font-family:'JetBrains Mono',monospace;
          font-size:.85rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
        /* logos locais em branco; ficam discretos e acendem junto com o texto no hover */
        .nlp-track img{width:18px;height:18px;opacity:.55;flex:0 0 auto;
          transition:opacity var(--micro) var(--ease)}
        .nlp-marquee:hover .nlp-track img{opacity:.9}
        .nlp-marquee{position:relative;z-index:1;background:var(--bg)}
        /* MANIFESTO — registro próprio: bloco recuado com barra de acento à esquerda,
           tipografia maior e ar de página editorial. Era a última seção na receita padrão. */
        .nlp-manifesto{position:relative}
        .nlp-manifesto::before{content:'';position:absolute;inset:auto 0 0 0;top:0;width:2px;
          left:clamp(24px,5.5vw,96px);
          background:linear-gradient(180deg,transparent,var(--accent) 22%,var(--accent) 78%,transparent)}
        .nlp-manifesto .nlp-wrap{max-width:none;padding-inline:clamp(58px,7.5vw,140px)}
        /* coluna única à esquerda: em duas colunas o texto de apoio caía em cima do
           neurônio (ato 3 ocupa a direita) e ficava ilegível */
        .nlp-manif{display:flex;flex-direction:column;gap:clamp(28px,3vw,44px);max-width:660px}
        .nlp-manifesto h2{font-size:clamp(2.1rem,4.4vw,3.6rem);line-height:1.06}
        .nlp-manifesto p{font-size:1.04rem}
        /* marquee: deixa de ser barra chapada, mas precisa de um véu pra ler por cima
           das partículas. O véu some nas pontas, então não vira barra de novo. */
        .nlp-marquee{border-block:none!important;padding-block:34px!important;
          background:linear-gradient(90deg,transparent,rgba(8,9,12,.88) 10%,rgba(8,9,12,.88) 90%,transparent)!important}
        .nlp-marquee::before{content:'';position:absolute;inset-inline:0;top:0;height:1px;
          background:linear-gradient(90deg,transparent,var(--line-hi) 30%,var(--line-hi) 70%,transparent)}
        .nlp-marquee::after{content:'';position:absolute;inset-inline:0;bottom:0;height:1px;
          background:linear-gradient(90deg,transparent,var(--line-hi) 30%,var(--line-hi) 70%,transparent)}
        /* faq — sem caixa, só divisórias no void */
        /* o ato 4 explode cubos POR CIMA da coluna do FAQ; um véu suave (sem caixa,
           sem borda) devolve o contraste do texto sem quebrar o "sem caixa" da seção */
        #faq .nlp-wrap{position:relative}
        #faq .nlp-wrap::before{content:'';position:absolute;inset:-40px -56px;pointer-events:none;
          background:radial-gradient(72% 60% at 50% 46%,rgba(8,9,12,.82),rgba(8,9,12,.45) 62%,transparent);
          border-radius:var(--r-lg)}
        #faq .nlp-wrap>*{position:relative}
        .nlp-faq{border-top:1px solid var(--line)}
        .nlp-qa{border-bottom:1px solid var(--line)}
        .nlp-q{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:26px 4px;background:none;border:none;color:var(--fg);
          font:inherit;font-weight:400;font-size:1.12rem;letter-spacing:-.01em;text-align:left;cursor:pointer;transition:color var(--micro) var(--ease),padding-left var(--micro) var(--ease)}
        .nlp-q:hover{color:var(--dim);padding-left:12px}
        .nlp-q svg{flex-shrink:0;transition:transform var(--micro) var(--ease)}
        .nlp-qa.nlp-open .nlp-q svg{transform:rotate(45deg)}
        /* acordeão por grid (0fr→1fr) em vez de max-height com número mágico.
           O 220px fixo cortava resposta longa no mobile — a caixa parava de crescer e
           o texto sumia sem aviso. Com 1fr a altura é a do conteúdo, qualquer que seja. */
        .nlp-a{display:grid;grid-template-rows:0fr;overflow:hidden;transition:grid-template-rows var(--dur) var(--ease)}
        .nlp-a>*{min-height:0}
        .nlp-qa.nlp-open .nlp-a{grid-template-rows:1fr}
        .nlp-a p{padding:0 4px 26px;font-size:.98rem}
        /* cta final — registro próprio: halo de acento subindo do chão, fechando a narrativa */
        .nlp-cta-final{position:relative;overflow:hidden}
        .nlp-cta-final::before{content:'';position:absolute;inset-inline:-10%;bottom:-58%;height:120%;pointer-events:none;
          background:radial-gradient(50% 50% at 50% 50%,rgba(139,111,224,.20),transparent 68%)}
        .nlp-cta-final .nlp-wrap{position:relative}
        .nlp-cta-final h2{font-size:clamp(2.3rem,5vw,4rem)}
        .nlp-final{text-align:center;display:flex;flex-direction:column;align-items:center;gap:26px}
        .nlp-footer{border-top:1px solid var(--line);padding-top:72px;position:relative;z-index:1;background:var(--bg)}
        .nlp-footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:44px;padding-bottom:52px}
        @media(max-width:760px){.nlp-footer-grid{grid-template-columns:1fr;gap:36px}}
        .nlp-footer-col{display:flex;flex-direction:column;gap:14px}
        .nlp-footer-col p{font-size:.92rem;max-width:34ch}
        .nlp-footer-title{font-family:'JetBrains Mono',monospace;font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
        .nlp-footer-col a{color:var(--muted);font-size:.98rem;width:fit-content;transition:color var(--micro) var(--ease),transform var(--micro) var(--ease)}
        .nlp-footer-col a:hover{color:var(--accent-hi);transform:translateX(3px)}
        .nlp-footer-bottom{border-top:1px solid var(--line);padding-block:22px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}
        .nlp-footer-bottom .nlp-mono{font-size:.64rem}
        /* abertura: a página ABRE em vez de aparecer. Sai com um leve zoom, deixando
           o hero entrar por baixo — o gesto é de cortina, não de spinner. */
        .nlp-abertura{position:fixed;inset:0;z-index:100;background:var(--bg);
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;
          transition:opacity .62s var(--ease),transform .62s var(--ease),visibility 0s .62s}
        .nlp-abertura img{height:26px;width:auto;opacity:.94;animation:nlp-enter .7s var(--ease) both}
        .nlp-abertura-linha{display:block;width:132px;height:1px;background:var(--line-hi);position:relative;overflow:hidden}
        .nlp-abertura-linha::after{content:'';position:absolute;inset:0;background:var(--accent);
          transform:translateX(-100%);animation:nlp-carga 1.25s var(--ease) forwards}
        @keyframes nlp-carga{to{transform:translateX(0)}}
        .nlp-abertura.nlp-fora{opacity:0;transform:scale(1.04);visibility:hidden;pointer-events:none}
        /* trilho dos 4 atos — mapa da narrativa */
        .nlp-rail{position:fixed;right:26px;top:50%;transform:translateY(-50%);z-index:40;
          display:flex;flex-direction:column;gap:14px;pointer-events:none}
        .nlp-rail i{width:7px;height:7px;border-radius:50%;border:1px solid var(--line-hi);background:transparent;
          transition:background var(--micro) var(--ease),border-color var(--micro) var(--ease),transform var(--micro) var(--ease)}
        .nlp-rail i.on{background:var(--accent);border-color:var(--accent);transform:scale(1.45);
          box-shadow:0 0 12px rgba(139,111,224,.7)}
        @media(max-width:960px){.nlp-rail{display:none}}
        /* momento editorial: palavra-tese do hero */
        .nlp-tese{background:linear-gradient(96deg,var(--fg) 28%,var(--accent-hi));
          -webkit-background-clip:text;background-clip:text;color:transparent}
        /* Numeral fantasma REMOVIDO de Resultados: a seção já carrega o neurônio à direita,
           4 numerais grandes e 3 banners. O fantasma caía em cima do próprio título e lia
           como sujeira, não como momento editorial. A variedade dessa seção vem dos
           banners de operação — registro que nenhuma outra seção tem. (DESIGN.md §7) */
        /* coreografia de entrada do hero */
        @keyframes nlp-enter{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
        .nlp-hero-in>*{animation:nlp-enter .9s var(--ease) both}
        .nlp-hero-in>*:nth-child(1){animation-delay:.05s}
        .nlp-hero-in>*:nth-child(2){animation-delay:.13s}
        .nlp-hero-in>*:nth-child(3){animation-delay:.21s}
        .nlp-hero-in>*:nth-child(4){animation-delay:.29s}
        .nlp-hero-in>*:nth-child(5){animation-delay:.37s}
        .nlp-hero-in>*:nth-child(6){animation-delay:.45s}
        /* ALVO DE TOQUE: metade dos interativos do mobile media menos de 44px de altura.
           Link de texto continua parecendo link de texto — só ganha área de toque. */
        @media(max-width:760px){
          .nlp-link-arrow,.nlp-oferta-saiba,.nlp-footer-col a,.nlp-footer-bottom a{
            min-height:44px;display:inline-flex;align-items:center}
          .nlp-q{padding-block:22px;min-height:44px}
          .nlp-btn-sm{padding-block:12px;min-height:44px}
          .nlp-nav-in>a{min-height:44px;display:inline-flex;align-items:center}
        }
        /* ╔══════════════════════════════════════════════════════════════════╗
           ║  v2 — REDE VIVA + HUD                                            ║
           ║  Tudo abaixo é 1px, mono e discreto de propósito: a estrela      ║
           ║  continua sendo o cérebro. HUD que compete com a arte polui.     ║
           ╚══════════════════════════════════════════════════════════════════╝ */
        /* overflow-x:hidden no ancestral transforma ele em container de rolagem e
           MATA o position:sticky do palco do Ato 1. "clip" recorta igual, mas não
           cria container — é a única troca que faz o herói grudar de verdade. */
        .v2{--hud:rgba(190,200,225,.28);--hud-on:var(--accent-hi);cursor:none;
          overflow-x:clip!important}
        .v2 a,.v2 button,.v2 summary{cursor:none}
        @media(pointer:coarse){.v2,.v2 a,.v2 button,.v2 summary{cursor:auto}}

        /* textura de instrumento: grade fina + varredura. Quase invisível — some
           no print e aparece no olho, que é exatamente o ponto. */
        .v2::before{content:'';position:fixed;inset:0;z-index:3;pointer-events:none;
          background-image:linear-gradient(rgba(190,200,225,.028) 1px,transparent 1px),
                           linear-gradient(90deg,rgba(190,200,225,.028) 1px,transparent 1px);
          background-size:64px 64px;
          mask-image:radial-gradient(120% 90% at 50% 40%,#000 30%,transparent 78%)}
        .v2::after{content:'';position:fixed;inset-inline:0;height:140px;z-index:4;pointer-events:none;
          background:linear-gradient(180deg,transparent,rgba(139,111,224,.055),transparent);
          animation:v2-varre 7s linear infinite}
        @keyframes v2-varre{0%{top:-140px}100%{top:100%}}

        /* ── moldura ── */
        .v2-hud{position:fixed;inset:0;z-index:45;pointer-events:none;font-family:'JetBrains Mono',monospace}
        /* cantoneiras: é o que transforma a janela em VISOR. Precisam ser vistas —
           na primeira tentativa ficaram tão discretas que sumiam, e aí não comunicam nada. */
        .v2-canto{position:absolute;width:34px;height:34px;border:1px solid var(--accent);opacity:.55}
        .v2-canto::after{content:'';position:absolute;width:4px;height:4px;background:var(--accent);
          box-shadow:0 0 8px var(--accent)}
        .v2-canto-tl{top:12px;left:12px;border-right:0;border-bottom:0}
        .v2-canto-tl::after{top:-2px;left:-2px}
        .v2-canto-tr{top:12px;right:12px;border-left:0;border-bottom:0}
        .v2-canto-tr::after{top:-2px;right:-2px}
        .v2-canto-bl{bottom:46px;left:12px;border-right:0;border-top:0}
        .v2-canto-bl::after{bottom:-2px;left:-2px}
        .v2-canto-br{bottom:46px;right:12px;border-left:0;border-top:0}
        .v2-canto-br::after{bottom:-2px;right:-2px}

        /* ── espinha de nós: a página é um grafo, e você está num nó dele ── */
        .v2-espinha{position:absolute;right:30px;top:50%;transform:translateY(-50%);
          display:flex;flex-direction:column;gap:2px}
        .v2-no{display:flex;align-items:center;justify-content:flex-end;gap:10px;height:26px;
          text-decoration:none;position:relative}
        /* o fio que liga um nó ao outro — o grafo desenhado.
           right:3px alinha no centro do ponto de 7px ancorado na direita. */
        .v2-no:not(:last-child)::after{content:'';position:absolute;right:3px;top:17px;width:1px;height:21px;
          background:linear-gradient(180deg,var(--hud),rgba(190,200,225,.10));opacity:.6}
        .v2-no b{font-size:.56rem;letter-spacing:.18em;color:var(--muted);opacity:0;transform:translateX(8px);
          transition:opacity var(--micro) var(--ease),transform var(--micro) var(--ease);white-space:nowrap}
        .v2-no em{font-size:.54rem;letter-spacing:.1em;color:var(--muted);opacity:.5;font-style:normal;
          transition:opacity var(--micro) var(--ease)}
        .v2-no i{width:7px;height:7px;border-radius:50%;border:1px solid var(--hud);flex:0 0 auto;
          transition:background var(--micro) var(--ease),border-color var(--micro) var(--ease),
                     transform var(--micro) var(--ease),box-shadow var(--micro) var(--ease)}
        .v2-no:hover b,.v2-no.on b{opacity:1;transform:none}
        .v2-no:hover em,.v2-no.on em{opacity:.9}
        .v2-no.on i{background:var(--accent);border-color:var(--accent);transform:scale(1.5);
          box-shadow:0 0 14px rgba(139,111,224,.85)}
        .v2-no:hover i{border-color:var(--accent-hi);transform:scale(1.35)}
        @media(max-width:1100px){.v2-espinha{display:none}}

        /* ── telemetria ── */
        .v2-tele{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:10px;
          padding:9px clamp(44px,5vw,62px);font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;
          color:var(--muted);border-top:1px solid rgba(190,200,225,.10);
          background:linear-gradient(0deg,rgba(8,9,12,.92),rgba(8,9,12,.55))}
        .v2-tele-flex{flex:1}
        .v2-tele-sep{opacity:.35}
        .v2-tele-ok{display:inline-flex;align-items:center;gap:6px;color:var(--accent-hi)}
        .v2-tele-ok i{width:5px;height:5px;border-radius:50%;background:var(--accent);
          animation:nlp-pulse 2.2s var(--ease) infinite}
        .v2-tele-barra{letter-spacing:.02em;color:var(--dim)}
        .v2-tele-hora{color:var(--dim);font-variant-numeric:tabular-nums}
        /* No mobile a faixa quebrava em 2 linhas (43px) e virava tarja. Fica em UMA
           linha: só o essencial, sem quebra, com reticências se ainda assim faltar. */
        @media(max-width:860px){
          .v2-tele{font-size:.5rem;gap:6px;padding:7px 18px;flex-wrap:nowrap;white-space:nowrap;overflow:hidden}
          .v2-tele-barra,.v2-tele-hora{display:none}
          .v2-tele>span:nth-last-child(-n+3){display:none}  /* coordenada e separador */
        }
        /* a página precisa de chão pra faixa não cobrir o rodapé */
        .v2 .nlp-footer-bottom{padding-bottom:52px}

        /* ── retículo ── */
        /* O retículo é pintado exatamente sobre o ponteiro (sem inércia, ver o JS).
           A troca de estado anima só transform/opacity — a primeira versão animava
           width/height/left/top, que são layout e ainda por cima disputavam o
           quadro com a posição. */
        .v2-cursor{display:none;position:fixed;left:0;top:0;z-index:120;pointer-events:none;
          width:0;height:0;will-change:transform;transition:opacity .18s linear}
        .v2-cursor-anel{position:absolute;left:-13px;top:-13px;width:26px;height:26px;border-radius:50%;
          border:1px solid var(--accent-hi);opacity:.55;
          transition:transform var(--micro) var(--ease),opacity var(--micro) var(--ease)}
        .v2-cursor-h,.v2-cursor-v{position:absolute;background:var(--accent-hi);opacity:.85;
          transition:transform var(--micro) var(--ease),opacity var(--micro) var(--ease)}
        /* ponto central: fica sempre no pixel do ponteiro */
        .v2-cursor-h{left:-1.5px;top:-1.5px;width:3px;height:3px;border-radius:50%}
        /* traços da mira: existem sempre, mas encolhidos a zero até precisar */
        .v2-cursor-v{left:-.5px;top:-15px;width:1px;height:11px;transform:scaleY(0);transform-origin:bottom}
        .v2-cursor.mira .v2-cursor-anel{transform:scale(1.62);opacity:.9}
        .v2-cursor.mira .v2-cursor-v{transform:scaleY(1)}
        .v2-cursor.mira .v2-cursor-h{transform:scale(.6);opacity:1}

        /* ── TRILHO: a fiação da página ──
           Vive na margem esquerda, fora do caminho do cérebro. A linha base é
           sempre visível (o circuito existe); a linha de luz cresce por scaleY
           conforme você desce (o circuito é percorrido). */
        .v2{position:relative}
        .v2-trilho{position:absolute;left:clamp(14px,2.6vw,46px);top:0;bottom:0;width:1px;
          z-index:2;pointer-events:none}
        .v2-trilho-base{position:absolute;inset:0;background:rgba(190,200,225,.085)}
        .v2-trilho-luz{position:absolute;left:0;top:0;width:1px;height:100%;transform-origin:top;
          transform:scaleY(var(--desenho,0));
          background:linear-gradient(180deg,var(--accent),rgba(139,111,224,.22));
          box-shadow:0 0 10px rgba(139,111,224,.45)}
        /* nó de seção: apagado até a seção chegar, depois acende e estende o ramo */
        .v2-no-sec{position:absolute;left:-3.5px;width:8px;height:8px;border-radius:50%;
          border:1px solid rgba(190,200,225,.30);background:var(--bg);
          transition:background var(--micro) var(--ease),border-color var(--micro) var(--ease),
                     box-shadow var(--micro) var(--ease),transform var(--micro) var(--ease)}
        .v2-no-sec::before{content:'';position:absolute;left:7px;top:50%;height:1px;width:0;
          background:linear-gradient(90deg,var(--accent),transparent);
          transition:width .5s var(--ease)}
        /* Rótulo DEITADO ao longo do trilho. Na horizontal ele invadia a coluna de
           texto — "FRENTES" caía por cima do título da seção. Vertical, ele mora
           dentro da própria margem e nunca encosta no conteúdo. */
        .v2-no-sec>b{position:absolute;left:50%;top:15px;transform:translateX(-50%);
          writing-mode:vertical-rl;
          font-family:'JetBrains Mono',monospace;font-size:.46rem;letter-spacing:.22em;
          text-transform:uppercase;color:var(--muted);white-space:nowrap;
          opacity:0;transition:opacity .5s var(--ease)}
        .v2-no-sec.on{background:var(--accent);border-color:var(--accent);transform:scale(1.15);
          box-shadow:0 0 12px rgba(139,111,224,.7)}
        .v2-no-sec.on::before{width:26px}
        .v2-no-sec.on>b{opacity:.62}
        /* abaixo de 1100px não há margem sobrando — o trilho sai de cena */
        @media(max-width:1100px){.v2-trilho{display:none}}
        @media(prefers-reduced-motion:reduce){
          .v2-trilho-luz{transform:scaleY(1)}
        }

        /* ── cabeçalho centralizado (seções 03, 04 e 05) ──
           Alinhado à esquerda, o título competia com a arte que ocupa um dos lados.
           Centralizado, ele ancora a seção e o cérebro passa a emoldurar em vez de
           disputar. A medida do parágrafo cai pra 54ch: texto centralizado com linha
           longa é cansativo de ler — o olho perde o começo da linha seguinte. */
        .v2 .v2-centro{align-items:center;text-align:center;margin-inline:auto;
          max-width:1000px!important}
        /* o título pode ocupar a largura toda pra caber em UMA linha; o parágrafo
           não — texto centralizado com linha longa cansa, o olho perde o começo da
           linha seguinte. Por isso a medida do apoio fica travada em 54ch. */
        .v2 .v2-centro h2{max-width:none;text-wrap:balance}
        .v2 .v2-centro p{margin-inline:auto;max-width:54ch}

        /* VÉU DE LEGIBILIDADE
           O texto centralizado cruza as partículas claras e perde contraste em
           trechos — o teste de contraste passava porque media contra o fundo liso,
           não contra a arte. O véu é radial e mascarado: escurece onde o texto
           está e dissolve antes da borda, então não vira uma caixa colada por cima
           da cena. z-index -1 fica dentro do contexto da seção: acima do canvas,
           abaixo do texto. */
        .v2 .v2-centro{position:relative;isolation:auto}
        .v2 .v2-centro::before{content:'';position:absolute;inset:-38px -72px;z-index:-1;
          pointer-events:none;
          background:radial-gradient(58% 58% at 50% 50%,rgba(8,9,12,.90),rgba(8,9,12,.62) 52%,transparent 80%);
          mask-image:radial-gradient(62% 60% at 50% 50%,#000 50%,transparent 86%)}
        /* reforço barato no corpo: sombra da cor do fundo separa a letra do brilho */
        .v2 .v2-centro h2,.v2 .v2-centro p{text-shadow:0 0 22px rgba(8,9,12,.92)}
        /* o marcador do rótulo é absoluto: sem isso ele descola do texto centralizado */
        .v2 .v2-centro .nlp-mono{align-self:center}

        /* ── seções viram registros de sistema ── */
        .v2 .nlp-head .nlp-mono{display:inline-flex;align-items:center;gap:10px;position:relative;padding-left:26px}
        .v2 .nlp-head .nlp-mono::before{content:'';position:absolute;left:0;top:50%;width:16px;height:1px;
          background:var(--accent);opacity:.75}
        .v2 .nlp-head .nlp-mono::after{content:'';position:absolute;left:0;top:calc(50% - 2.5px);
          width:5px;height:5px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent)}

        /* cantoneiras nos painéis: cada card lê como módulo instrumentado */
        .v2 .nlp-oferta,.v2 .nlp-caso,.v2 .nlp-garantia{position:relative}
        .v2 .nlp-oferta::after,.v2 .nlp-caso::after,.v2 .nlp-garantia::after{
          content:'';position:absolute;left:10px;top:10px;width:12px;height:12px;pointer-events:none;
          border-left:1px solid var(--accent);border-top:1px solid var(--accent);opacity:.32;
          transition:opacity var(--micro) var(--ease),width var(--micro) var(--ease),height var(--micro) var(--ease)}
        .v2 .nlp-oferta:hover::after,.v2 .nlp-caso:hover::after,.v2 .nlp-garantia:hover::after{
          opacity:.95;width:20px;height:20px}

        /* ── CARDS COMO MÓDULOS ──────────────────────────────────────────
           Eram retângulos com borda. Viram peças instrumentadas: barra de topo
           com trilho de varredura, índice em mono virando identificador do
           módulo, e uma malha fina que só aparece no hover — a camada de dado
           que estava escondida. Tudo em pseudo-elemento: zero mudança de HTML. */
        /* ATENÇÃO: ::before (brilho radial) e ::after (cantoneira) desses cards já
           estão ocupados. Tudo aqui usa pseudo-elementos de FILHOS, que estão livres. */

        /* cabeçalho de instrumento: hairline separando o identificador do corpo */
        .v2 .nlp-oferta-num,.v2 .nlp-caso-cat{
          display:flex;align-items:center;gap:9px;padding-bottom:12px;margin-bottom:2px;
          border-bottom:1px solid rgba(190,200,225,.09)}
        /* malha de dado sob o conteúdo, revelada quando o módulo acende */
        .v2 .nlp-oferta>*,.v2 .nlp-caso>*{position:relative;z-index:1}
        .v2 .nlp-oferta-grupo{position:relative}
        .v2 .nlp-oferta-grupo::after{content:'';position:absolute;inset:-10px -12px;z-index:-1;
          pointer-events:none;opacity:0;transition:opacity .45s var(--ease);
          background-image:
            linear-gradient(rgba(190,200,225,.055) 1px,transparent 1px),
            linear-gradient(90deg,rgba(190,200,225,.055) 1px,transparent 1px);
          background-size:20px 20px;
          mask-image:radial-gradient(80% 70% at 50% 50%,#000,transparent 78%)}
        .v2 .nlp-oferta:hover .nlp-oferta-grupo::after{opacity:1}
        /* o índice ganha ponto de status que acende no hover */
        .v2 .nlp-oferta-num::before,.v2 .nlp-caso-cat::before{
          content:'';width:5px;height:5px;border-radius:50%;background:var(--accent);
          box-shadow:0 0 8px var(--accent);opacity:.55;
          transition:opacity var(--micro) var(--ease),transform var(--micro) var(--ease)}
        .v2 .nlp-oferta:hover .nlp-oferta-num::before,
        .v2 .nlp-caso:hover .nlp-caso-cat::before{opacity:1;transform:scale(1.35)}

        /* números com hairline embaixo: leitura de painel, não de banner */
        .v2 .nlp-stat b{position:relative;padding-bottom:8px}
        .v2 .nlp-stat b::after{content:'';position:absolute;left:0;bottom:0;width:22px;height:1px;
          background:var(--accent);opacity:.65}

        /* ── herói: cada linha sobe de dentro de uma máscara ── */
        .v2-h1{display:flex;flex-direction:column}
        .v2-linha{display:block;overflow:hidden;padding-bottom:.06em}
        .v2-linha>span{display:block;transform:translateY(105%);
          animation:v2-sobe .95s var(--ease) both;
          animation-delay:calc(.34s + var(--i) * .11s)}
        @keyframes v2-sobe{to{transform:none}}
        /* a coreografia antiga do hero brigava com a máscara — aqui a linha manda */
        .v2 .nlp-hero-in>h1{animation:none;opacity:1;transform:none}
        /* o texto embaralhado não pode empurrar layout: largura reservada pelo real */
        .v2-decod{white-space:pre}
        .v2-leitor{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}

        /* moldura do herói: colchete fino que abre à esquerda do bloco de texto */
        .v2 .nlp-hero-in::before{content:'';position:absolute;left:-26px;top:4px;bottom:4px;width:1px;
          background:linear-gradient(180deg,transparent,var(--accent) 16%,var(--accent) 84%,transparent);
          opacity:.5}
        @media(max-width:900px){.v2 .nlp-hero-in::before{display:none}}
        /* A faixa de telemetria comia os números do herói. A causa não era o padding:
           era o min-height:92vh, que espalhava o conteúdo até o pé da tela. Sem ele,
           o bloco fecha na altura do próprio conteúdo e sobra chão pra faixa. */
        /* ── PALCO DO ATO 1 ──
           O herói deixa de ser flex-centrado e vira bloco com PISTA: o conteúdo
           gruda (sticky) e a pista de 85vh é o tempo do desmonte. Sem a pista o
           texto sairia de cena rolando, e o gesto não teria onde acontecer.
           A pista casa com o innerHeight*0.85 usado no cálculo do progresso. */
        .v2 .nlp-hero{min-height:auto!important;display:block!important;
          padding-top:96px!important;padding-bottom:calc(76px + 85vh)!important}
        /* O pino NÃO é position:sticky. Um div do layout do app tem overflow-y:auto,
           o que o elege container de rolagem — mas quem rola é a janela, então o
           sticky nunca engata. Prender por transform não depende de ancestral algum
           e ainda é composição pura. --pin vem do mesmo laço que move os glifos. */
        .v2 .nlp-hero>.nlp-hero-in{gap:21px;
          transform:translate3d(0,var(--pin,0px),0)}
        @media(max-width:860px){
          .v2 .nlp-hero{padding-top:104px!important;padding-bottom:calc(68px + 62vh)!important}
        }

        /* ── os glifos ──
           inline-block porque só assim aceitam transform. Voam para o vetor
           medido em JS, giram e encolhem. Só transform e opacity: compositing puro. */
        /* transform e opacity são escritos pelo laço de rolagem (JS): a trajetória é
           curva e converge, coisa que calc() em CSS não expressa (precisa de sin()).
           Aqui fica só a base — sem transição, senão o JS briga com a interpolação. */
        /* will-change só ENQUANTO o ato roda. Deixá-lo fixo em 34 glifos + o palco
           mantém uma camada de GPU por elemento viva a página toda, o que é o
           oposto da otimização: a dica vira custo. A classe .ativo é ligada pelo
           laço de rolagem e desligada nas duas pontas. */
        .v2-glifo{display:inline-block;white-space:pre;transition:none!important}
        .v2 .nlp-hero.ativo .v2-glifo{will-change:transform,opacity}
        .v2 .nlp-hero.ativo>.nlp-hero-in{will-change:transform}
        .v2 .nlp-hero.ativo .nlp-tese{will-change:transform,opacity}

        /* a TESE resiste: parte por último, e inteira — não se estilhaça.
           .nlp-tese não carrega a animação de entrada (ela está no ancestral),
           então o transform aqui é livre de conflito. */
        /* A tese é a ÚLTIMA a partir. A opacidade dela era linear desde o primeiro
           pixel de rolagem, enquanto os glifos seguram opacidade cheia até 80% do
           voo — na prática a promessa sumia antes da frase, o oposto da intenção.
           Agora ela fica inteira até 72% da pista e só então se apaga. */
        .v2 .nlp-tese{display:inline-block;
          transform:translate3d(calc(var(--ato,0) * 54px),calc(var(--ato,0) * -16px),0)
                    scale(calc(1 - var(--ato,0) * .14));
          opacity:calc(1 - max(0, var(--ato,0) - .72) / .28)}

        /* Apoio, CTAs e números saem antes, pra frase ficar sozinha no fim.
           ARMADILHA: esses elementos já têm "animation ... both", que TRAVA
           transform e opacity no valor final — sobrescrever ali não pega.
           A propriedade "filter" não é tocada pelas keyframes, então é a saída.
           (E atenção: nada de crase neste bloco — o CSS mora dentro de um
            template literal, e uma crase solta fecha a string.) */
        .v2 .nlp-hero-in>p,.v2 .nlp-hero-in>.nlp-ctas,.v2 .nlp-hero-in>.nlp-stats,
        .v2 .nlp-hero-in>.nlp-chip,.v2 .nlp-hero-in>.nlp-mono{
          filter:opacity(calc(1 - var(--ato,0) * 1.25))}
        .v2 .nlp-hero-in>.nlp-ctas{pointer-events:auto}
        /* os números do herói viram leitura de painel, e sobem ~5% da tela:
           com o herói preso, eles ficavam baixos demais e a informação sumia
           no desmonte antes de ser lida. */
        .v2 .nlp-stats{border-top:1px solid rgba(190,200,225,.10);padding-top:16px;margin-top:14px}

        /* e SEGURAM a leitura: só começam a apagar depois de 28% da pista, em vez
           de desbotar desde o primeiro pixel de rolagem junto com o resto. */
        .v2 .nlp-hero-in>.nlp-stats{
          filter:opacity(calc(1 - max(0, var(--ato,0) - .28) * 1.7))}
        /* Véu atrás da espinha. O teste de contraste passava medindo contra o fundo
           liso — mas o rótulo cai POR CIMA do cérebro, e ali a leitura morre. O véu
           precisa ser opaco de verdade no eixo dos nós e dissolver pras bordas, senão
           vira uma caixa colada em cima da arte. */
        .v2-espinha::before{content:'';position:absolute;inset:-22px -20px -22px -14px;
          border-radius:var(--r-pill);z-index:-1;backdrop-filter:blur(7px);
          background:radial-gradient(72% 56% at 78% 50%,rgba(8,9,12,.90),rgba(8,9,12,.55) 58%,transparent 82%);
          mask-image:radial-gradient(78% 60% at 78% 50%,#000 55%,transparent 88%)}

        /* ── RODAPÉ COMO ATO ─────────────────────────────────────────────
           Era três colunas e um copyright colado no fim. Ganha uma assinatura
           vazada ocupando a largura inteira, que fecha a narrativa em vez de
           só encerrar a página. Vazada (contorno) e não sólida: preenchida ela
           competiria com o conteúdo em vez de emoldurá-lo. */
        .v2 .nlp-footer{overflow:hidden;padding-top:96px}
        .v2-assinatura{position:absolute;left:50%;bottom:-.16em;transform:translateX(-50%);
          font-family:var(--font-display),sans-serif;font-weight:500;
          font-size:clamp(6rem,19vw,17rem);line-height:.82;letter-spacing:-.05em;
          white-space:nowrap;pointer-events:none;user-select:none;z-index:0;
          color:transparent;-webkit-text-stroke:1px rgba(190,200,225,.13);
          mask-image:linear-gradient(180deg,#000,transparent 88%)}
        .v2 .nlp-footer .nlp-wrap{position:relative;z-index:1}
        /* links do rodapé: sublinhado que se desenha, em vez de só mudar de cor */
        .v2 .nlp-footer-col a{position:relative;padding-bottom:2px}
        .v2 .nlp-footer-col a::after{content:'';position:absolute;left:0;right:100%;bottom:0;height:1px;
          background:var(--accent-hi);transition:right var(--micro) var(--ease)}
        .v2 .nlp-footer-col a:hover{transform:none}
        .v2 .nlp-footer-col a:hover::after{right:0}

        /* CTA com halo respirando: o botão parece energizado, não pintado */
        .v2 .nlp-btn-solid{position:relative;overflow:hidden}
        .v2 .nlp-btn-solid::after{content:'';position:absolute;inset:0;pointer-events:none;
          background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,.55),transparent 80%);
          transform:translateX(-120%)}
        .v2 .nlp-btn-solid:hover::after{transform:translateX(120%);transition:transform .7s var(--ease)}

        @media(prefers-reduced-motion:reduce){
          .v2::after{animation:none;display:none}
          .v2-cursor{display:none!important}
          .nlp *,.nlp *::before,.nlp *::after{animation:none!important;transition:none!important}
          .nlp-reveal{opacity:1;transform:none}
          .nlp-hero-in>*{opacity:1;transform:none}
          .nlp-par{transform:none!important}
          .nlp-abertura{display:none}
        }
      `}</style>

            {/* abertura */}
            <div className={`nlp-abertura${abrindo ? '' : ' nlp-fora'}`} aria-hidden="true">
                <img src={nodeLogo} alt="" />
                <span className="nlp-abertura-linha" />
            </div>

            {/* v2: o trilho de bolinhas virou a espinha de nós dentro do HUD */}
            <HudV2 ato={ato} />
            <TrilhoV2 />
            <CursorV2 />

            {/* NAV */}
            <nav className="nlp-nav">
                <div className="nlp-wrap nlp-nav-in">
                    <a href="#top" aria-label="NODE"><img src={nodeLogo} alt="NODE" style={{ height: 18, width: 'auto', display: 'block' }} /></a>
                    <div className="nlp-links">
                        <a href="#solucoes">Soluções</a>
                        <a href="#resultados">Clientes</a>
                        <a href="#ofertas">O que fazemos</a>
                        <a href="#processo">Processo</a>
                        <a href="#faq">FAQ</a>
                    </div>
                    <Link to="/login" className="nlp-btn nlp-btn-solid nlp-btn-sm">Entrar</Link>
                </div>
            </nav>

            {/* CÉREBRO DE PARTÍCULAS — fixo atrás do site inteiro */}
            <BrainField />

            {/* HERO */}
            <section className="nlp-hero" id="top">
                <div className="nlp-wrap nlp-hero-in">
                    <span className="nlp-chip"><i />operando agora</span>
                    <span className="nlp-mono">{'// sistemas · e-commerce · ia aplicada'}</span>
                    {/* v2: cada linha sobe de dentro de uma máscara, escalonada.
                        A última palavra DECODIFICA — o texto se resolve de caractere
                        embaralhado para a palavra, como um sistema terminando de processar. */}
                    <h1 className="v2-h1">
                        <span className="v2-linha"><span style={{ ['--i' as string]: 0 }}><Glifos texto="Tecnologia que" /></span></span>
                        <span className="v2-linha"><span style={{ ['--i' as string]: 1 }}><Glifos texto="transforma marcas em" /></span></span>
                        <span className="v2-linha"><span style={{ ['--i' as string]: 2 }}>
                            <span className="nlp-tese"><Decodifica texto="máquinas de venda." /></span>
                        </span></span>
                    </h1>
                    <p>Sistemas, lojas e aplicações de IA sob medida, entregues em dias e gerando resultado desde o primeiro dia.</p>
                    <div className="nlp-ctas">
                        <a href={WHATS} target="_blank" rel="noopener" className="nlp-btn nlp-btn-solid"
                            onMouseEnter={pulsar}
                            onClick={() => registrar('cta_whatsapp', 'hero')}>Falar com a NODE</a>
                        <Link to="/login" className="nlp-link-arrow"
                            onClick={() => registrar('cta_login', 'hero')}>Acessar o sistema<span>→</span></Link>
                    </div>
                    <div className="nlp-stats">
                        {STATS.map(s => (
                            <div className="nlp-stat" key={s.label}>
                                <b>{s.texto ?? <Counter value={s.value!} prefix={s.prefix} suffix={s.suffix} />}</b>
                                <span className="nlp-mono">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SOLUÇÕES — cérebro remontado à esquerda, conteúdo à direita */}
            <section id="solucoes">
                <div className="nlp-wrap">
                    <div className="nlp-offset-r">
                        <div className="nlp-head nlp-reveal">
                            <span className="nlp-mono">{'// o que construímos'}</span>
                            {/* H2 carrega os termos de busca sem virar título feio de SEO */}
                            <h2>Criação de sites, lojas<br />e sistemas sob medida</h2>
                        </div>
                        <div className="nlp-grid3">
                            {SOLUTIONS.map((s, i) => (
                                <div className={`nlp-card nlp-reveal nlp-d${i + 1}`} key={s.num}>
                                    <span className="nlp-mono">{s.num}</span>
                                    <h3>{s.title}</h3>
                                    <p style={{ fontSize: '.96rem' }}>{s.desc}</p>
                                    <span className="nlp-mono">{s.tags}</span>
                                </div>
                            ))}
                        </div>
                        {/* deixa explícito que aqui é o resumo — o detalhe vive em #ofertas */}
                        <a href="#ofertas" className="nlp-link-arrow nlp-reveal" style={{ marginTop: 40 }}>
                            Ver cada frente em detalhe<span>↓</span>
                        </a>
                    </div>
                </div>
            </section>

            {/* RESULTADOS */}
            <section id="resultados">
                <div className="nlp-wrap">
                    <div className="nlp-head nlp-reveal v2-centro">
                        <span className="nlp-mono">{'// operações reais'}</span>
                        <h2>Quem opera com a NODE</h2>
                        <p style={{ marginTop: 8 }}>
                            Não é vitrine de portfólio: são lojas e sistemas no ar agora, vendendo
                            todo dia. Abra qualquer uma e confira você mesmo.
                        </p>
                    </div>
                    {/* Portfólio: cada operação no ar como um caso, não como link solto */}
                    <div className="nlp-ops">
                        {OPERACOES.map((o, i) => (
                            <article className={`nlp-caso nlp-reveal nlp-d${i + 1}`} key={o.nome}>
                                <header>
                                    <span className="nlp-caso-cat">{o.categoria}</span>
                                    <h3>{o.nome}</h3>
                                </header>
                                <div className="nlp-caso-shot">
                                    <img src={o.img} loading="lazy" width={760} height={404}
                                        alt={`Página inicial da loja ${o.nome}, desenvolvida pela NODE: ${o.projeto.toLowerCase()}`} />
                                </div>
                                <div className="nlp-caso-meta">
                                    <div><span>Cliente</span><strong>{o.nome}</strong></div>
                                    <div><span>Projeto</span><strong>{o.projeto}</strong></div>
                                </div>
                                <p>{o.desc}</p>
                                <a href={o.url} target="_blank" rel="noopener noreferrer"
                                    className="nlp-btn nlp-caso-cta" onMouseEnter={pulso}
                                    onClick={() => registrar('clique_operacao', o.nome)}>
                                    Conheça<span>→</span>
                                </a>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* O QUE VENDEMOS — três frentes, cada uma com o COMO na prática */}
            <section id="ofertas">
                <div className="nlp-wrap">
                    <div className="nlp-head nlp-reveal v2-centro">
                        <span className="nlp-mono">{'// três frentes'}</span>
                        <h2>O que a NODE constrói com você</h2>
                        <p style={{ marginTop: 8 }}>
                            Três frentes, um jeito só de trabalhar: nada sai de template e nada para
                            no slide. O que a gente entrega entra em operação e é medido pelo que vende.
                        </p>
                    </div>
                    <div className="nlp-ofertas">
                        {OFERTAS.map((o, i) => (
                            <article className={`nlp-oferta nlp-reveal nlp-d${i + 1}`} key={o.num}>
                                <span className="nlp-oferta-num" aria-hidden="true">{o.num}</span>
                                <h3>{o.titulo}</h3>
                                <p>{o.linha}</p>
                                {o.grupos.map((g, gi) => (
                                    gi === 0 ? (
                                        // o primeiro bloco fica sempre aberto: é o que vende
                                        <div className="nlp-oferta-grupo" key={g.label}>
                                            <span className="nlp-mono">{`// ${g.label}`}</span>
                                            <ul>{g.itens.map(t => <li key={t}>{t}</li>)}</ul>
                                        </div>
                                    ) : (
                                        // o "como funciona" recolhe: o card estava alto demais
                                        <details className="nlp-oferta-grupo nlp-oferta-drop" key={g.label}>
                                            <summary>
                                                <span className="nlp-mono">{`// ${g.label}`}</span>
                                                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                                    <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" />
                                                </svg>
                                            </summary>
                                            <ul>{g.itens.map(t => <li key={t}>{t}</li>)}</ul>
                                        </details>
                                    )
                                ))}
                                <div className="nlp-oferta-acoes">
                                    <a href={waLink(o.wa)} target="_blank" rel="noopener noreferrer"
                                        className="nlp-btn nlp-oferta-cta" onMouseEnter={pulso}
                                        onClick={() => registrar('cta_whatsapp', `oferta_${o.num}_${o.titulo}`)}>
                                        {o.cta}<span>→</span>
                                    </a>
                                    {/* link interno pra página da frente: é ele que dá força
                                        de busca pra ela e deixa quem quer ler mais se aprofundar */}
                                    <Link to={`/${o.pagina}`} className="nlp-oferta-saiba"
                                        onClick={() => registrar('abre_servico', o.pagina)}>
                                        Ver a página completa<span>→</span>
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* GARANTIAS + faixa de loja Shopify */}
            <section id="garantias">
                <div className="nlp-wrap">
                    <div className="nlp-garantias">
                        {GARANTIAS.map((g, i) => (
                            <div className={`nlp-garantia nlp-reveal nlp-d${(i % 3) + 1}`} key={g.titulo}>
                                <span className="nlp-garantia-icone" aria-hidden="true">
                                    <Icone nome={g.icone} />
                                </span>
                                <h3>{g.titulo}</h3>
                                <p>{g.desc}</p>
                            </div>
                        ))}
                    </div>

                    <a className="nlp-faixa-shopify nlp-reveal"
                        href={waLink('Olá! Quero uma loja Shopify com o tema próprio da NODE.')}
                        target="_blank" rel="noopener noreferrer"
                        onMouseEnter={pulso}
                        onClick={() => registrar('cta_whatsapp', 'faixa_shopify')}>
                        <div className="nlp-faixa-txt">
                            <span className="nlp-mono">{'// também construímos'}</span>
                            <strong>Precisa de uma loja Shopify?</strong>
                            <p>Lojas com o tema NODE proprietário, licença por loja e atualização inclusa enquanto você for cliente ativo. Construídas pela mesma equipe.</p>
                        </div>
                        <span className="nlp-faixa-link">Falar sobre a loja<span>→</span></span>
                    </a>
                </div>
            </section>

            {/* PROCESSO */}
            <section id="processo">
                <div className="nlp-wrap">
                    <div className="nlp-head nlp-reveal v2-centro">
                        <span className="nlp-mono">{'// como funciona'}</span>
                        <h2>Do alinhamento ao ar em quatro movimentos</h2>
                        <p style={{ marginTop: 8 }}>
                            Sem reunião que não muda nada e sem entrega surpresa. Você sabe o que
                            está sendo feito, em que ordem, e o que precisa de você em cada etapa.
                        </p>
                    </div>
                    <div className="nlp-steps">
                        {STEPS.map((s, i) => (
                            <div className={`nlp-step nlp-reveal nlp-d${(i % 3) + 1}`} key={s.num}>
                                <span className="nlp-step-idx nlp-par" data-par=".7" aria-hidden="true">{s.num}</span>
                                <span className="nlp-mono">{s.num}</span>
                                <h3>{s.title}</h3>
                                <p>{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* STACK MARQUEE */}
            <div className="nlp-marquee" aria-hidden="true">
                <div className="nlp-track">
                    {[...STACK, ...STACK].map((t, i) => (
                        <span key={i}><img src={t.logo} alt="" width={18} height={18} loading="lazy" />{t.nome}</span>
                    ))}
                </div>
            </div>

            {/* MANIFESTO */}
            <section className="nlp-manifesto">
                <div className="nlp-wrap nlp-manif">
                    <h2 className="nlp-reveal">Não construímos vitrines.<br />Construímos <span className="nlp-tese">tecnologia que vende</span>.</h2>
                    <div className="nlp-reveal nlp-d1" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <p>A NODE nasceu dentro da operação de e-commerce, não numa agência de design. Geramos mais de R$25 milhões nas nossas próprias lojas antes de entregar isso pra cliente nenhum. Tudo que a gente faz hoje carrega o que aprendeu vendendo de verdade.</p>
                        <p>IA aqui não é discurso de palco. É o motor que deixa a gente construir em dias o que o mercado entrega em meses, com acabamento de produto de verdade.</p>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq">
                <div className="nlp-wrap" style={{ maxWidth: 780 }}>
                    <div className="nlp-head nlp-reveal v2-centro">
                        <span className="nlp-mono">{'// perguntas frequentes'}</span>
                        <h2>Tire suas dúvidas</h2>
                    </div>
                    <div className="nlp-faq nlp-reveal">
                        {FAQS.map((f, i) => (
                            <div className={`nlp-qa${faqOpen === i ? ' nlp-open' : ''}`} key={f.q}>
                                <button className="nlp-q" onClick={() => setFaqOpen(faqOpen === i ? null : i)} aria-expanded={faqOpen === i}>
                                    {f.q}
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" /></svg>
                                </button>
                                <div className="nlp-a"><p>{f.a}</p></div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA FINAL */}
            <section className="nlp-cta-final">
                <div className="nlp-wrap nlp-final">
                    <span className="nlp-mono nlp-reveal">{'// pronto pra começar?'}</span>
                    <h2 className="nlp-reveal nlp-d1">Seu próximo sistema<br /><span className="nlp-tese">começa numa conversa</span></h2>
                    <div className="nlp-ctas nlp-reveal nlp-d2">
                        <a href={WHATS} target="_blank" rel="noopener" className="nlp-btn nlp-btn-solid"
                            onClick={() => registrar('cta_whatsapp', 'cta_final')}>Falar com a NODE</a>
                        <Link to="/login" className="nlp-btn nlp-btn-ghost"
                            onClick={() => registrar('cta_login', 'cta_final')}>Já sou cliente</Link>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="nlp-footer">
                {/* v2: o rodapé deixa de ser sobra e vira o último ato — assinatura
                    vazada ocupando a largura, sob a qual os links flutuam. */}
                <span className="v2-assinatura" aria-hidden="true">NODE</span>
                <div className="nlp-wrap">
                    <div className="nlp-footer-grid">
                        <div className="nlp-footer-col">
                            <img src={nodeLogo} alt="NODE" style={{ height: 22, width: 'auto', alignSelf: 'flex-start' }} />
                            <p>Sistemas, e-commerce e IA aplicada pra marcas que querem vender mais.</p>
                        </div>
                        <div className="nlp-footer-col">
                            <span className="nlp-footer-title">{'// navegação'}</span>
                            <a href="#solucoes">Soluções</a>
                            <a href="#resultados">Resultados</a>
                            <a href="#processo">Processo</a>
                            <a href="#faq">FAQ</a>
                            <Link to="/login">Área do cliente</Link>
                        </div>
                        <div className="nlp-footer-col">
                            <span className="nlp-footer-title">{'// contato'}</span>
                            <a href={WHATS} target="_blank" rel="noopener">(31) 98408-3376</a>
                            <a href="mailto:nodedev@gmail.com">nodedev@gmail.com</a>
                            <a href={INSTA} target="_blank" rel="noopener">@noode.dev</a>
                            <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Seg à Dom · 9h às 23h</span>
                        </div>
                    </div>
                    <div className="nlp-footer-bottom">
                        <span className="nlp-mono">© 2026 NODE. Todos os direitos reservados.</span>
                        {/* cidade: sinal de negócio local, bate com o Perfil da Empresa.
                            Só cidade e estado, sem endereço de rua. */}
                        <span className="nlp-mono">Sete Lagoas · MG · atendemos todo o Brasil</span>
                        <span className="nlp-mono">Feito pela própria NODE</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
