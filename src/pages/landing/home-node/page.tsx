/**
 * Home NODE — landing pública da rota "/" (agencybeacon.site)
 * Direção: DIRECAO.md (Dark Immersive + Terminal/Dev-Tool, monocromático NODE)
 * Self-contained: CSS escopado em .nlp-, canvas vanilla, zero dependência nova.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import nodeLogo from '@/assets/node-logo.png';
import BrainField from './BrainField';

const WHATS = 'https://wa.me/5531984083376?text=Ol%C3%A1%2C%20quero%20falar%20com%20a%20NODE%20sobre%20um%20projeto.';
const INSTA = 'https://www.instagram.com/noode.dev/';

const STATS = [
    { value: 168, prefix: 'R$', suffix: 'M+', label: 'faturamento gerado' },
    { value: 1732, prefix: '', suffix: '', label: 'projetos entregues' },
    { value: 742, prefix: '', suffix: '', label: 'marcas atendidas' },
    { value: 1389, prefix: '', suffix: '', label: 'clientes ativos' },
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

const RESULTS = [
    { brand: 'Mantos do PH', value: 180, prefix: '+', suffix: '%', metric: 'em vendas' },
    { brand: 'TrybuteHA', value: 7, prefix: '', suffix: 'x', metric: 'de ROAS' },
    { brand: 'Vargard & Co', value: 320, prefix: '+', suffix: '%', metric: 'em leads' },
    { brand: 'TrackSoul', value: 150, prefix: '+', suffix: '%', metric: 'em conversão' },
];

const STEPS = [
    { num: '01', title: 'Alinhamento estratégico', desc: 'Sentamos com você, entendemos o negócio e definimos a meta. Sem meta clara, nada começa.' },
    { num: '02', title: 'Arquitetura & identidade', desc: 'Desenhamos a estrutura, o visual e a stack sob medida pro seu projeto. Nada sai de template.' },
    { num: '03', title: 'Build acelerado por IA', desc: 'Nossa engenharia usa IA no dia a dia de verdade. É por isso que entregamos em dias, e não em meses.' },
    { num: '04', title: 'Lançamento & operação', desc: 'Projeto no ar com tracking e suporte. Depois do lançamento, a gente continua junto na operação.' },
];

const STACK = ['Shopify', 'Supabase', 'Vercel', 'Stripe', 'Meta Ads', 'Klaviyo', 'WooCommerce', 'VTEX', 'NuvemShop', 'Yampi', 'OpenAI', 'Claude'];

const FAQS = [
    { q: 'Como começa um projeto com a NODE?', a: 'Você chama no WhatsApp e a gente marca um papo rápido de alinhamento. Dali sai escopo, prazo e investimento. Aprovou, entramos em produção no mesmo dia.' },
    { q: 'Qual o prazo de entrega?', a: 'Depende do escopo, mas trabalhamos em outra velocidade: lojas e sites completos costumam sair em dias. O prazo fechado você recebe no alinhamento.' },
    { q: 'Como funciona o suporte?', a: 'Suporte ilimitado via WhatsApp e e-mail durante a vigência do plano, das 9h às 23h, todos os dias.' },
    { q: 'O tema NODE para Shopify tem licença?', a: 'Sim. Cada licença vale pra uma loja, com atualizações inclusas enquanto você for cliente ativo. Pra uma segunda loja, basta uma licença adicional.' },
    { q: 'Quais tecnologias vocês dominam?', a: 'Shopify, WooCommerce, VTEX, NuvemShop e Yampi no e-commerce. Supabase, Vercel e Stripe em sistemas. OpenAI e Claude na parte de IA.' },
];

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

    // Reveal on scroll
    useEffect(() => {
        const io = new IntersectionObserver(
            es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('nlp-in'); io.unobserve(e.target); } }),
            { threshold: .12 }
        );
        document.querySelectorAll('.nlp-reveal').forEach(el => io.observe(el));
        return () => io.disconnect();
    }, []);

    return (
        <div className="nlp">
            <style>{`
        .nlp{--bg:#050505;--fg:#ffffff;--muted:#ababab;--dim:#c9c9c9;--line:rgba(255,255,255,.09);--dur:.7s;--ease:cubic-bezier(.22,1,.36,1);
          background-color:var(--bg);
          color:var(--fg);font-family:'Inter Tight',sans-serif;min-height:100vh;overflow-x:hidden}
        .nlp *{box-sizing:border-box}
        .nlp ::selection{background:#fff;color:#050505}
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
        .nlp-nav{position:fixed;inset-inline:0;top:0;z-index:50;background:rgba(5,5,5,.72);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
        .nlp-nav-in{display:flex;align-items:center;justify-content:space-between;height:64px}
        .nlp-nav .nlp-wrap{max-width:none;padding-inline:clamp(24px,3vw,48px)}
        .nlp-links{display:flex;gap:28px}
        .nlp-links a{font-size:.86rem;color:var(--muted);transition:color var(--dur) var(--ease)}
        .nlp-links a:hover{color:var(--fg)}
        @media(max-width:760px){.nlp-links{display:none}}
        /* botões */
        .nlp-btn{display:inline-flex;align-items:center;gap:8px;padding:14px 30px;border-radius:999px;font-weight:500;font-size:.94rem;border:1px solid transparent;
          transition:transform var(--dur) var(--ease),background var(--dur) var(--ease),border-color var(--dur) var(--ease),box-shadow var(--dur) var(--ease);cursor:pointer}
        .nlp-btn:hover{transform:translateY(-2px)}
        .nlp-btn:active{transform:translateY(0) scale(.97)}
        .nlp .nlp-btn-solid{background:var(--fg);color:#0a0a0a;box-shadow:0 0 24px rgba(255,255,255,.18),inset 0 -2px 6px rgba(0,0,0,.12)}
        .nlp .nlp-btn-solid:hover{background:#fff;color:#0a0a0a;box-shadow:0 0 44px rgba(255,255,255,.32),inset 0 -2px 6px rgba(0,0,0,.12)}
        .nlp .nlp-btn-ghost{border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.05);color:var(--fg);backdrop-filter:blur(8px)}
        .nlp .nlp-btn-ghost:hover{border-color:rgba(255,255,255,.45);background:rgba(255,255,255,.10);box-shadow:0 0 24px rgba(255,255,255,.07)}
        .nlp-btn-sm{padding:9px 20px;font-size:.85rem}
        /* hero — texto à esquerda, cérebro respira à direita (fixo atrás) */
        .nlp-hero{position:relative;padding-top:190px!important;padding-bottom:110px!important;min-height:92vh;display:flex;align-items:center}
        .nlp-hero .nlp-wrap{max-width:none;margin:0;padding-left:clamp(24px,5.5vw,96px);padding-right:24px}
        .nlp-hero .nlp-wrap{max-width:1380px}
        .nlp-hero-in{position:relative;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:28px;z-index:1;max-width:640px}
        .nlp-hero p{font-size:clamp(1.02rem,1.4vw,1.16rem);max-width:44ch;color:var(--dim);text-shadow:0 0 18px rgba(5,5,5,.9)}
        .nlp-hero h1{text-shadow:0 0 28px rgba(5,5,5,.85)}
        .nlp-ctas{display:flex;gap:26px;flex-wrap:wrap;align-items:center}
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
        .nlp-card{display:flex;flex-direction:column;gap:16px;padding-top:26px;border-top:1px solid var(--line);
          transition:transform var(--dur) var(--ease)}
        .nlp-card:hover{transform:translateY(-6px)}
        .nlp-card h3{margin:0;font-size:1.35rem;font-weight:500;letter-spacing:-.02em}
        .nlp-card .nlp-mono{margin-top:auto;padding-top:16px}
        /* resultados — números gigantes flutuando */
        .nlp-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:64px}
        @media(max-width:960px){.nlp-grid4{grid-template-columns:repeat(2,1fr);gap:48px}}
        @media(max-width:520px){.nlp-grid4{grid-template-columns:1fr}}
        .nlp-res{padding-top:26px;border-top:1px solid var(--line);transition:transform var(--dur) var(--ease)}
        .nlp-res:hover{transform:translateY(-6px)}
        .nlp-res b{display:block;font-size:clamp(2.8rem,5vw,4.4rem);font-weight:400;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
        .nlp-res small{color:var(--muted);font-size:.92rem;font-weight:300}
        /* processo */
        .nlp-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:64px}
        @media(max-width:960px){.nlp-steps{grid-template-columns:repeat(2,1fr);gap:48px}}
        @media(max-width:520px){.nlp-steps{grid-template-columns:1fr}}
        .nlp-step{border-top:1px solid var(--line);padding-top:22px;display:flex;flex-direction:column;gap:12px}
        .nlp-step h3{margin:0;font-size:1.08rem;font-weight:500}
        .nlp-step p{font-size:.94rem}
        /* marquee */
        .nlp-marquee{overflow:hidden;border-block:1px solid var(--line);padding-block:22px;position:relative;
          mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
        .nlp-track{display:flex;gap:56px;width:max-content;animation:nlp-scroll 36s linear infinite}
        .nlp-marquee:hover .nlp-track{animation-play-state:paused}
        @keyframes nlp-scroll{to{transform:translateX(-50%)}}
        .nlp-track span{font-family:'JetBrains Mono',monospace;font-size:.85rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
        .nlp-marquee{position:relative;z-index:1;background:var(--bg)}
        /* manifesto */
        .nlp-manif{display:grid;grid-template-columns:1.2fr 1fr;gap:56px;align-items:center}
        @media(max-width:860px){.nlp-manif{grid-template-columns:1fr}}
        /* faq — sem caixa, só divisórias no void */
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
        /* cta final + footer */
        .nlp-final{text-align:center;display:flex;flex-direction:column;align-items:center;gap:26px}
        .nlp-footer{border-top:1px solid var(--line);padding-top:72px;position:relative;z-index:1;background:var(--bg)}
        .nlp-footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:44px;padding-bottom:52px}
        @media(max-width:760px){.nlp-footer-grid{grid-template-columns:1fr;gap:36px}}
        .nlp-footer-col{display:flex;flex-direction:column;gap:14px}
        .nlp-footer-col p{font-size:.92rem;max-width:34ch}
        .nlp-footer-title{font-family:'JetBrains Mono',monospace;font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
        .nlp-footer-col a{color:var(--muted);font-size:.98rem;width:fit-content;transition:color var(--dur) var(--ease),transform var(--dur) var(--ease)}
        .nlp-footer-col a:hover{color:var(--fg);transform:translateX(3px)}
        .nlp-footer-bottom{border-top:1px solid var(--line);padding-block:22px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}
        .nlp-footer-bottom .nlp-mono{font-size:.64rem}
        @media(prefers-reduced-motion:reduce){
          .nlp *,.nlp *::before,.nlp *::after{animation:none!important;transition:none!important}
          .nlp-reveal{opacity:1;transform:none}
        }
      `}</style>

            {/* NAV */}
            <nav className="nlp-nav">
                <div className="nlp-wrap nlp-nav-in">
                    <a href="#top" aria-label="NODE"><img src={nodeLogo} alt="NODE" style={{ height: 18, width: 'auto', display: 'block' }} /></a>
                    <div className="nlp-links">
                        <a href="#solucoes">Soluções</a>
                        <a href="#resultados">Resultados</a>
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
                    <span className="nlp-chip nlp-reveal"><i />operando agora</span>
                    <span className="nlp-mono nlp-reveal">{'// sistemas · e-commerce · ia aplicada'}</span>
                    <h1 className="nlp-reveal nlp-d1">Tecnologia que<br />transforma marcas em<br />máquinas de venda.</h1>
                    <p className="nlp-reveal nlp-d2">Sistemas, lojas e aplicações de IA sob medida, entregues em dias e gerando resultado desde o primeiro dia.</p>
                    <div className="nlp-ctas nlp-reveal nlp-d3">
                        <a href={WHATS} target="_blank" rel="noopener" className="nlp-btn nlp-btn-solid">Falar com a NODE</a>
                        <Link to="/login" className="nlp-link-arrow">Acessar o sistema<span>→</span></Link>
                    </div>
                    <div className="nlp-stats nlp-reveal">
                        {STATS.map(s => (
                            <div className="nlp-stat" key={s.label}>
                                <b><Counter value={s.value} prefix={s.prefix} suffix={s.suffix} /></b>
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
                            <h2>Engenharia completa,<br />da ideia à operação</h2>
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
                    </div>
                </div>
            </section>

            {/* RESULTADOS */}
            <section id="resultados">
                <div className="nlp-wrap">
                    <div className="nlp-head nlp-reveal">
                        <span className="nlp-mono">{'// resultados reais'}</span>
                        <h2>Números de quem opera<br />com a NODE</h2>
                    </div>
                    <div className="nlp-grid4">
                        {RESULTS.map((r, i) => (
                            <div className={`nlp-res nlp-reveal nlp-d${(i % 3) + 1}`} key={r.brand}>
                                <b><Counter value={r.value} prefix={r.prefix} suffix={r.suffix} /></b>
                                <small>{r.metric}</small>
                                <div className="nlp-mono" style={{ marginTop: 18 }}>{r.brand}</div>
                            </div>
                        ))}
                    </div>
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
                    {[...STACK, ...STACK].map((t, i) => <span key={i}>{t}</span>)}
                </div>
            </div>

            {/* MANIFESTO */}
            <section>
                <div className="nlp-wrap nlp-manif">
                    <h2 className="nlp-reveal">Não construímos vitrines.<br />Construímos tecnologia<br />que vende.</h2>
                    <div className="nlp-reveal nlp-d1" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <p>A NODE nasceu dentro da operação de e-commerce, não numa agência de design. Tudo que entregamos carrega o que aprendemos gerando mais de R$170 milhões pros nossos clientes.</p>
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
            <section>
                <div className="nlp-wrap nlp-final">
                    <span className="nlp-mono nlp-reveal">{'// pronto pra começar?'}</span>
                    <h2 className="nlp-reveal nlp-d1">Seu próximo sistema<br />começa numa conversa</h2>
                    <div className="nlp-ctas nlp-reveal nlp-d2">
                        <a href={WHATS} target="_blank" rel="noopener" className="nlp-btn nlp-btn-solid">Falar com a NODE</a>
                        <Link to="/login" className="nlp-btn nlp-btn-ghost">Já sou cliente</Link>
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
                        <span className="nlp-mono">Feito pela própria NODE</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
