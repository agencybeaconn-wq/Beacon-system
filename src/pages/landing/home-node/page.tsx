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
    { texto: '9h às 23h', label: 'suporte todo dia' },
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

export default function HomeNode() {
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

    return (
        <div className="nlp">
            <style>{`
        /* Tokens — ver DESIGN.md §2. Base azulada (nunca preto puro), texto GELO
           (nunca #fff), e um acento único violeta que também manda na interface:
           é o matiz presente nos 3 atos da arte, o que faz página e canvas virarem uma peça só. */
        .nlp{--bg:#08090C;--bg-elev:#0E1017;--fg:#EEF1F7;--muted:#8A90A2;--dim:#B9C0D0;
          --line:rgba(190,200,225,.11);--line-hi:rgba(190,200,225,.20);
          --accent:#8B6FE0;--accent-hi:#A48CEE;--accent-dim:rgba(139,111,224,.14);
          --dur:.7s;--ease:cubic-bezier(.22,1,.36,1);
          background-color:var(--bg);
          color:var(--fg);font-family:'Outfit','Inter Tight',sans-serif;min-height:100vh;overflow-x:hidden}
        .nlp *{box-sizing:border-box}
        .nlp ::selection{background:var(--accent);color:var(--fg)}
        .nlp :focus-visible{outline:2px solid var(--accent-hi);outline-offset:3px;border-radius:4px}
        .nlp-mono{font-family:'JetBrains Mono',monospace;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
        .nlp-wrap{max-width:1280px;margin-inline:auto;padding-inline:28px}
        .nlp section{padding-block:clamp(84px,10vw,150px);position:relative;z-index:1}
        .nlp h1,.nlp h2{letter-spacing:-.045em;line-height:1.02;font-weight:500;margin:0}
        .nlp-chip{display:inline-flex;align-items:center;gap:9px;padding:7px 16px;border:1px solid var(--line);border-radius:999px;
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
        .nlp-links a{font-size:.86rem;color:var(--muted);transition:color var(--dur) var(--ease)}
        .nlp-links a{position:relative}
        .nlp-links a::after{content:'';position:absolute;left:0;right:100%;bottom:-6px;height:1px;background:var(--accent);
          transition:right var(--dur) var(--ease)}
        .nlp-links a:hover{color:var(--fg)}
        .nlp-links a:hover::after{right:0}
        @media(max-width:760px){.nlp-links{display:none}}
        /* botões */
        .nlp-btn{display:inline-flex;align-items:center;gap:8px;padding:14px 30px;border-radius:999px;font-weight:500;font-size:.94rem;border:1px solid transparent;
          transition:transform var(--dur) var(--ease),background var(--dur) var(--ease),border-color var(--dur) var(--ease),box-shadow var(--dur) var(--ease);cursor:pointer}
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
          transition:color var(--dur) var(--ease),gap var(--dur) var(--ease)}
        .nlp-link-arrow span{transition:transform var(--dur) var(--ease)}
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
          border-radius:14px;border:1px solid transparent;
          background:
            linear-gradient(170deg,rgba(23,26,37,.92),rgba(13,15,22,.92)) padding-box,
            linear-gradient(100deg,rgba(139,111,224,.62),var(--line) 44%,rgba(190,200,225,.05)) border-box;
          backdrop-filter:blur(14px);
          transition:transform var(--dur) var(--ease),box-shadow var(--dur) var(--ease)}
        .nlp-card::before{content:'';position:absolute;inset:0;border-radius:14px;pointer-events:none;
          background:radial-gradient(120% 90% at 0% 0%,var(--accent-dim),transparent 58%);opacity:.9}
        .nlp-card>*{position:relative}
        .nlp-card:hover{transform:translateY(-6px);box-shadow:0 18px 50px -24px rgba(139,111,224,.55)}
        .nlp-card h3{margin:0;font-size:1.35rem;font-weight:500;letter-spacing:-.02em}
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
          .nlp-oferta h3{font-size:1.28rem}
          .nlp-oferta li{font-size:.88rem}
        }
        .nlp-oferta{position:relative;display:flex;flex-direction:column;gap:14px;padding:34px 30px 30px;
          border-radius:18px;border:1px solid transparent;
          background:
            linear-gradient(180deg,rgba(16,18,26,.94),rgba(11,13,19,.94)) padding-box,
            linear-gradient(160deg,rgba(139,111,224,.60),var(--line) 46%,rgba(190,200,225,.05)) border-box;
          backdrop-filter:blur(16px);
          transition:transform var(--dur) var(--ease),box-shadow var(--dur) var(--ease)}
        .nlp-oferta::before{content:'';position:absolute;inset:0;border-radius:18px;pointer-events:none;
          background:radial-gradient(110% 70% at 18% 0%,var(--accent-dim),transparent 60%)}
        .nlp-oferta>*{position:relative}
        .nlp-oferta:hover{transform:translateY(-6px);box-shadow:0 26px 60px -28px rgba(139,111,224,.6)}
        .nlp-oferta-num{font-family:'JetBrains Mono',monospace;font-size:.68rem;letter-spacing:.18em;color:var(--accent)}
        .nlp-oferta h3{margin:0;font-size:1.42rem;font-weight:500;letter-spacing:-.025em}
        .nlp-oferta p{font-size:.96rem;color:var(--muted);max-width:none}
        /* grupos de detalhe: "o que entra" e "como funciona" — é o que separa
           esta seção do resumo em Soluções (lá é por alto, aqui é o detalhe) */
        .nlp-oferta-grupo{display:flex;flex-direction:column;gap:12px;padding-top:18px;border-top:1px solid var(--line)}
        .nlp-oferta-grupo .nlp-mono{font-size:.63rem;color:var(--accent);opacity:.9}
        /* "como funciona" recolhido: o card ficava alto demais com os dois blocos abertos */
        .nlp-oferta-drop{display:block}
        .nlp-oferta-drop summary{display:flex;align-items:center;justify-content:space-between;gap:12px;
          cursor:pointer;list-style:none;padding:2px 0;color:var(--accent);
          transition:opacity var(--dur) var(--ease)}
        .nlp-oferta-drop summary::-webkit-details-marker{display:none}
        .nlp-oferta-drop summary:hover{opacity:.75}
        .nlp-oferta-drop summary svg{flex:0 0 auto;transition:transform var(--dur) var(--ease)}
        .nlp-oferta-drop[open] summary svg{transform:rotate(45deg)}
        .nlp-oferta-drop ul{margin-top:14px}
        .nlp-oferta ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
        .nlp-oferta li{position:relative;padding-left:20px;font-size:.9rem;color:var(--dim);line-height:1.5}
        .nlp-oferta li::before{content:'';position:absolute;left:0;top:.5em;width:7px;height:7px;
          border:1px solid var(--accent);border-radius:2px;transform:rotate(45deg)}
        /* CTA de verdade em cada frente — botão, não link solto */
        .nlp-oferta-cta{margin-top:auto;padding-top:0;align-self:flex-start;padding:12px 24px;font-size:.9rem;
          border-color:var(--line-hi);background:rgba(190,200,225,.05);color:var(--fg);backdrop-filter:blur(8px)}
        .nlp-oferta-cta span{transition:transform var(--dur) var(--ease)}
        .nlp-oferta:hover .nlp-oferta-cta{border-color:var(--accent);background:var(--accent-dim)}
        .nlp-oferta-cta:hover{box-shadow:0 0 28px rgba(139,111,224,.24)}
        .nlp-oferta-cta:hover span{transform:translateX(4px)}
        /* ══ PORTFÓLIO: cada operação no ar vira um caso ══
           Painel opaco (lê por cima do neurônio), categoria em acento, print grande,
           linha Cliente/Projeto e botão. */
        .nlp-ops{margin-top:clamp(56px,6vw,84px);display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
        @media(max-width:1020px){.nlp-ops{grid-template-columns:1fr;max-width:620px}}
        .nlp-caso{position:relative;display:flex;flex-direction:column;border-radius:18px;overflow:hidden;
          border:1px solid transparent;
          background:
            linear-gradient(180deg,rgba(18,20,29,.95),rgba(11,13,19,.95)) padding-box,
            linear-gradient(165deg,rgba(139,111,224,.55),var(--line) 45%,rgba(190,200,225,.05)) border-box;
          backdrop-filter:blur(16px);
          transition:transform var(--dur) var(--ease),box-shadow var(--dur) var(--ease)}
        .nlp-caso:hover{transform:translateY(-6px);box-shadow:0 26px 60px -28px rgba(139,111,224,.6)}
        .nlp-caso header{padding:24px 24px 18px;display:flex;flex-direction:column;gap:6px}
        .nlp-caso-cat{font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.16em;
          text-transform:uppercase;color:var(--accent)}
        .nlp-caso h3{margin:0;font-size:1.5rem;font-weight:500;letter-spacing:-.03em}
        .nlp-caso-shot{position:relative;overflow:hidden;border-block:1px solid var(--line);background:#0E1017}
        /* o print ROLA dentro do quadro no hover: a loja ganha vida em vez de ser foto parada */
        .nlp-caso-shot img{width:100%;height:auto;display:block;
          filter:saturate(.9) brightness(.9);
          transition:filter var(--dur) var(--ease),transform 2.6s cubic-bezier(.4,0,.2,1)}
        .nlp-caso:hover .nlp-caso-shot img{filter:saturate(1) brightness(1);transform:translateY(-18%)}
        .nlp-caso-meta{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:20px 24px 0}
        .nlp-caso-meta span{display:block;font-family:'JetBrains Mono',monospace;font-size:.6rem;
          letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:5px}
        .nlp-caso-meta strong{font-size:.95rem;font-weight:500}
        .nlp-caso p{padding:16px 24px 0;font-size:.9rem;color:var(--muted);line-height:1.55;max-width:none}
        .nlp-caso-cta{margin:22px 24px 24px;align-self:flex-start;padding:11px 22px;font-size:.88rem;
          border-color:var(--line-hi);background:rgba(190,200,225,.05);color:var(--fg)}
        .nlp-caso-cta span{transition:transform var(--dur) var(--ease)}
        .nlp-caso:hover .nlp-caso-cta{border-color:var(--accent);background:var(--accent-dim)}
        .nlp-caso-cta:hover span{transform:translateX(4px)}

        /* ══ GARANTIAS: o que o cliente leva pra casa ══ */
        .nlp-garantias{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
        @media(max-width:1020px){.nlp-garantias{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:600px){.nlp-garantias{grid-template-columns:1fr}}
        .nlp-garantia{padding:28px 24px;border-radius:16px;border:1px solid var(--line);
          background:rgba(16,18,26,.85);backdrop-filter:blur(14px);
          transition:transform var(--dur) var(--ease),border-color var(--dur) var(--ease)}
        .nlp-garantia:hover{transform:translateY(-4px);border-color:rgba(139,111,224,.45)}
        .nlp-garantia-icone{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;
          border-radius:11px;background:var(--accent-dim);color:var(--accent);margin-bottom:18px}
        .nlp-garantia h3{margin:0 0 8px;font-size:1.02rem;font-weight:500;letter-spacing:-.01em}
        .nlp-garantia p{font-size:.88rem;color:var(--muted);line-height:1.55;max-width:none}

        /* ══ Faixa de venda cruzada da loja Shopify ══ */
        .nlp-faixa-shopify{margin-top:26px;display:flex;align-items:center;justify-content:space-between;
          gap:clamp(24px,4vw,56px);
          padding:30px clamp(26px,3vw,40px);border-radius:16px;text-decoration:none;color:inherit;
          border:1px solid rgba(139,111,224,.32);background:linear-gradient(100deg,rgba(139,111,224,.12),rgba(16,18,26,.9) 62%);
          backdrop-filter:blur(14px);
          transition:border-color var(--dur) var(--ease),transform var(--dur) var(--ease)}
        .nlp-faixa-shopify:hover{border-color:var(--accent);transform:translateY(-3px)}
        /* a etiqueta usa o MESMO padrão de todas as seções (// texto em mono, acento),
           dentro da coluna de texto. Como pílula preenchida ela lia como botão solto. */
        .nlp-faixa-txt{display:flex;flex-direction:column;gap:9px}
        .nlp-faixa-txt .nlp-mono{color:var(--accent);font-size:.63rem}
        .nlp-faixa-shopify strong{display:block;font-size:1.34rem;font-weight:500;letter-spacing:-.025em}
        .nlp-faixa-shopify p{font-size:.9rem;color:var(--muted);line-height:1.55;max-width:64ch}
        .nlp-faixa-link{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;font-size:.9rem;color:var(--accent-hi);white-space:nowrap}
        .nlp-faixa-link span{transition:transform var(--dur) var(--ease)}
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
          border:1px solid rgba(190,200,225,.22);border-radius:30px;
          padding:clamp(52px,6vw,86px) clamp(28px,4vw,64px);
          box-shadow:0 0 0 1px rgba(8,9,12,.5),0 40px 120px -40px rgba(139,111,224,.55),
                     0 0 160px -30px rgba(139,111,224,.28)}
        /* halo: o painel VAZA luz violeta pro escuro em vez de encostar num corte seco */
        #processo .nlp-wrap::before{content:'';position:absolute;inset:-110px;border-radius:90px;pointer-events:none;
          background:radial-gradient(58% 54% at 50% 50%,rgba(139,111,224,.26),rgba(139,111,224,.10) 62%,transparent 76%);z-index:-1}
        @media(max-width:760px){#processo .nlp-wrap{border-radius:22px}}
        #processo h2{color:var(--fg)}
        #processo p{color:var(--muted)}
        #processo .nlp-mono{color:var(--accent);opacity:.85}
        .nlp-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:52px}
        @media(max-width:960px){.nlp-steps{grid-template-columns:repeat(2,1fr);gap:44px}}
        @media(max-width:520px){.nlp-steps{grid-template-columns:1fr}}
        .nlp-step{position:relative;border-top:1px solid var(--line-hi);padding-top:22px;display:flex;flex-direction:column;gap:12px}
        .nlp-step h3{margin:0;font-size:1.08rem;font-weight:500;position:relative}
        .nlp-step p{font-size:.94rem}
        /* momento editorial: o índice gigante vazado atrás do passo */
        .nlp-step-idx{position:absolute;top:8px;right:-6px;font-size:clamp(3.6rem,6vw,5.4rem);font-weight:600;
          line-height:1;letter-spacing:-.05em;color:var(--accent);opacity:.10;pointer-events:none;user-select:none;
          font-variant-numeric:tabular-nums;
          transition:opacity var(--dur) var(--ease),transform var(--dur) var(--ease)}
        /* o número acende em roxo quando o passo recebe o mouse */
        .nlp-step:hover .nlp-step-idx{opacity:.42;transform:translateY(-4px) scale(1.04)}
        .nlp-step{transition:transform var(--dur) var(--ease)}
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
          transition:opacity var(--dur) var(--ease)}
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
          border-radius:28px}
        #faq .nlp-wrap>*{position:relative}
        .nlp-faq{border-top:1px solid var(--line)}
        .nlp-qa{border-bottom:1px solid var(--line)}
        .nlp-q{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:26px 4px;background:none;border:none;color:var(--fg);
          font:inherit;font-weight:400;font-size:1.12rem;letter-spacing:-.01em;text-align:left;cursor:pointer;transition:color var(--dur) var(--ease),padding-left var(--dur) var(--ease)}
        .nlp-q:hover{color:var(--dim);padding-left:12px}
        .nlp-q svg{flex-shrink:0;transition:transform var(--dur) var(--ease)}
        .nlp-qa.nlp-open .nlp-q svg{transform:rotate(45deg)}
        .nlp-a{max-height:0;overflow:hidden;transition:max-height var(--dur) var(--ease)}
        .nlp-qa.nlp-open .nlp-a{max-height:220px}
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
        .nlp-footer-col a{color:var(--muted);font-size:.98rem;width:fit-content;transition:color var(--dur) var(--ease),transform var(--dur) var(--ease)}
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
          transition:background var(--dur) var(--ease),border-color var(--dur) var(--ease),transform var(--dur) var(--ease)}
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
        @media(prefers-reduced-motion:reduce){
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

            {/* trilho dos atos */}
            <div className="nlp-rail" aria-hidden="true">
                {[0, 1, 2, 3].map(i => <i key={i} className={i === ato ? 'on' : ''} />)}
            </div>

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
                    <h1>Tecnologia que<br />transforma marcas em<br /><span className="nlp-tese">máquinas de venda.</span></h1>
                    <p>Sistemas, lojas e aplicações de IA sob medida, entregues em dias e gerando resultado desde o primeiro dia.</p>
                    <div className="nlp-ctas">
                        <a href={WHATS} target="_blank" rel="noopener" className="nlp-btn nlp-btn-solid"
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
                    <div className="nlp-head nlp-reveal">
                        <span className="nlp-mono">{'// operações reais'}</span>
                        <h2>Quem opera<br />com a NODE</h2>
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
                    <div className="nlp-head nlp-reveal" style={{ maxWidth: 640 }}>
                        <span className="nlp-mono">{'// três frentes'}</span>
                        <h2>O que a NODE constrói<br />com você</h2>
                        <p style={{ marginTop: 8 }}>
                            Tudo sob medida e tudo na prática. Nada aqui sai de template, e nada é ensinado
                            no quadro branco: é IA aplicada em projeto que vai pro ar.
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
                                <a href={waLink(o.wa)} target="_blank" rel="noopener noreferrer"
                                    className="nlp-btn nlp-oferta-cta" onMouseEnter={pulso}
                                    onClick={() => registrar('cta_whatsapp', `oferta_${o.num}_${o.titulo}`)}>
                                    {o.cta}<span>→</span>
                                </a>
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
                    <div className="nlp-head nlp-reveal">
                        <span className="nlp-mono">{'// como funciona'}</span>
                        <h2>Do alinhamento ao ar<br />em quatro movimentos</h2>
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
                    <div className="nlp-head nlp-reveal">
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
