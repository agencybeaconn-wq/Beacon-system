/**
 * Home NODE — landing pública da rota "/" (agencybeacon.site)
 * Direção: DIRECAO.md (Dark Immersive + Terminal/Dev-Tool, monocromático NODE)
 * Self-contained: CSS escopado em .nlp-, canvas vanilla, zero dependência nova.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import nodeLogo from '@/assets/node-logo.png';

const WHATS = 'https://wa.me/5531984083376?text=Ol%C3%A1%2C%20quero%20falar%20com%20a%20NODE%20sobre%20um%20projeto.';
const INSTA = 'https://www.instagram.com/noode.dev/';

const STATS = [
    { value: 575, prefix: 'R$', suffix: 'M+', label: 'faturamento gerado' },
    { value: 5654, prefix: '', suffix: '+', label: 'projetos entregues' },
    { value: 2523, prefix: '', suffix: '+', label: 'marcas atendidas' },
    { value: 4800, prefix: '', suffix: '+', label: 'clientes ativos' },
];

const SOLUTIONS = [
    {
        num: '01', title: 'Sistemas & Aplicações de IA',
        desc: 'Dashboards, automações e agentes de IA operando dentro do seu negócio — não demos, sistemas em produção.',
        tags: 'agentes · automação · dados',
    },
    {
        num: '02', title: 'E-commerce de alta conversão',
        desc: 'Não criamos vitrines bonitas. Criamos lojas que vendem — Shopify, checkout otimizado e operação completa desde o primeiro dia.',
        tags: 'shopify · cro · operação',
    },
    {
        num: '03', title: 'Sites & Landing pages',
        desc: 'Páginas de alto padrão com engenharia de conversão: rápidas, medidas e desenhadas para o seu público, não para um template.',
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
    { num: '01', title: 'Alinhamento estratégico', desc: 'Entendemos o negócio, o público e a meta. Nada começa sem saber o que é sucesso pra você.' },
    { num: '02', title: 'Arquitetura & identidade', desc: 'Design system, estrutura e tecnologia definidos sob medida — cada decisão justificada.' },
    { num: '03', title: 'Build acelerado por IA', desc: 'Nossa engenharia usa IA aplicada de verdade: entregamos em dias o que o mercado entrega em meses.' },
    { num: '04', title: 'Lançamento & operação', desc: 'No ar com tracking, suporte e evolução contínua. A entrega é o começo, não o fim.' },
];

const STACK = ['Shopify', 'Supabase', 'Vercel', 'Stripe', 'Meta Ads', 'Klaviyo', 'WooCommerce', 'VTEX', 'NuvemShop', 'Yampi', 'OpenAI', 'Claude'];

const FAQS = [
    { q: 'Como começa um projeto com a NODE?', a: 'Você chama no WhatsApp, fazemos um alinhamento estratégico e devolvemos escopo, prazo e investimento. Aprovou, entramos em produção no mesmo dia.' },
    { q: 'Qual o prazo de entrega?', a: 'Depende do escopo — mas nosso build acelerado por IA entrega lojas e sites completos em dias, não meses. O prazo fechado vem no alinhamento.' },
    { q: 'Como funciona o suporte?', a: 'Suporte ilimitado via WhatsApp e e-mail durante a vigência do plano, das 9h às 23h, todos os dias.' },
    { q: 'O tema NODE para Shopify tem licença?', a: 'Sim. Cada licença é vinculada a uma loja/URL, com atualizações inclusas para clientes ativos. Para uma segunda loja, basta uma licença adicional.' },
    { q: 'Quais tecnologias vocês dominam?', a: 'Shopify, WooCommerce, VTEX, NuvemShop e Yampi no e-commerce; Supabase, Vercel e Stripe em sistemas; OpenAI e Claude em IA aplicada.' },
];

// ─── Canvas: rede de nós (assinatura visual do nome) ────────────────────────
function useNodeGraph(canvasRef: React.RefObject<HTMLCanvasElement>) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let raf = 0;
        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        const N = 42;
        let W = 0, H = 0;
        const pts = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .0004, vy: (Math.random() - .5) * .0004 }));
        const resize = () => {
            W = canvas.offsetWidth; H = canvas.offsetHeight;
            canvas.width = W * DPR; canvas.height = H * DPR;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);
        const tick = () => {
            ctx.clearRect(0, 0, W, H);
            for (const p of pts) {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > 1) p.vx *= -1;
                if (p.y < 0 || p.y > 1) p.vy *= -1;
            }
            for (let i = 0; i < N; i++) {
                for (let j = i + 1; j < N; j++) {
                    const dx = (pts[i].x - pts[j].x) * W, dy = (pts[i].y - pts[j].y) * H;
                    const d = Math.hypot(dx, dy);
                    if (d < 130) {
                        ctx.strokeStyle = `rgba(255,255,255,${(1 - d / 130) * .10})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(pts[i].x * W, pts[i].y * H);
                        ctx.lineTo(pts[j].x * W, pts[j].y * H);
                        ctx.stroke();
                    }
                }
            }
            ctx.fillStyle = 'rgba(255,255,255,.35)';
            for (const p of pts) {
                ctx.beginPath();
                ctx.arc(p.x * W, p.y * H, 1.4, 0, Math.PI * 2);
                ctx.fill();
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
    }, [canvasRef]);
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
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [faqOpen, setFaqOpen] = useState<number | null>(0);
    useNodeGraph(canvasRef);

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
        .nlp{--bg:#050505;--elev:#0e0e10;--fg:#fafafa;--muted:#a1a1aa;--line:rgba(255,255,255,.08);--dur:.7s;--ease:cubic-bezier(.22,1,.36,1);
          background:var(--bg);color:var(--fg);font-family:'Inter Tight',sans-serif;min-height:100vh;overflow-x:hidden}
        .nlp *{box-sizing:border-box}
        .nlp ::selection{background:#fafafa;color:#050505}
        .nlp-mono{font-family:'Geist Mono','JetBrains Mono',monospace;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
        .nlp-wrap{max-width:1140px;margin-inline:auto;padding-inline:24px}
        .nlp section{padding-block:clamp(72px,9vw,130px)}
        .nlp h1,.nlp h2{letter-spacing:-.03em;line-height:1.04;font-weight:800;margin:0}
        .nlp h1{font-size:clamp(2.6rem,6.5vw,4.9rem)}
        .nlp h2{font-size:clamp(1.9rem,3.6vw,2.9rem)}
        .nlp p{color:var(--muted);line-height:1.65;max-width:62ch;margin:0}
        .nlp a{color:inherit;text-decoration:none}
        /* reveal */
        .nlp-reveal{opacity:0;transform:translateY(36px);transition:opacity var(--dur) var(--ease),transform var(--dur) var(--ease)}
        .nlp-reveal.nlp-in{opacity:1;transform:none}
        .nlp-d1{transition-delay:.08s}.nlp-d2{transition-delay:.16s}.nlp-d3{transition-delay:.24s}
        /* nav */
        .nlp-nav{position:fixed;inset-inline:0;top:0;z-index:50;background:rgba(5,5,5,.72);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
        .nlp-nav-in{display:flex;align-items:center;justify-content:space-between;height:64px}
        .nlp-links{display:flex;gap:28px}
        .nlp-links a{font-size:.86rem;color:var(--muted);transition:color var(--dur) var(--ease)}
        .nlp-links a:hover{color:var(--fg)}
        @media(max-width:760px){.nlp-links{display:none}}
        /* botões */
        .nlp-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 26px;border-radius:999px;font-weight:600;font-size:.92rem;border:1px solid transparent;
          transition:transform var(--dur) var(--ease),background var(--dur) var(--ease),border-color var(--dur) var(--ease);cursor:pointer}
        .nlp-btn:hover{transform:translateY(-2px)}
        .nlp-btn:active{transform:translateY(0) scale(.97)}
        .nlp .nlp-btn-solid{background:var(--fg);color:#0a0a0a}
        .nlp .nlp-btn-solid:hover{background:#fff;color:#0a0a0a}
        .nlp .nlp-btn-ghost{border-color:var(--line);color:var(--fg)}
        .nlp .nlp-btn-ghost:hover{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.04)}
        .nlp-btn-sm{padding:9px 20px;font-size:.85rem}
        /* hero */
        .nlp-hero{position:relative;padding-top:170px!important;padding-bottom:90px!important}
        .nlp-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;
          mask-image:radial-gradient(120% 90% at 50% 30%,#000 30%,transparent 78%)}
        .nlp-hero-in{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:26px}
        .nlp-hero p{font-size:clamp(1rem,1.4vw,1.18rem)}
        .nlp-ctas{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
        .nlp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-top:64px;width:100%}
        .nlp-stat{background:var(--bg);padding:26px 14px;text-align:center}
        .nlp-stat b{display:block;font-size:clamp(1.5rem,2.6vw,2.2rem);font-weight:800;letter-spacing:-.02em}
        .nlp-stat span.nlp-mono{font-size:.62rem}
        @media(max-width:760px){.nlp-stats{grid-template-columns:repeat(2,1fr)}}
        /* section head */
        .nlp-head{display:flex;flex-direction:column;gap:14px;margin-bottom:52px}
        /* bento soluções */
        .nlp-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        @media(max-width:860px){.nlp-grid3{grid-template-columns:1fr}}
        .nlp-card{background:var(--elev);border:1px solid var(--line);border-radius:16px;padding:30px;display:flex;flex-direction:column;gap:14px;
          transition:transform var(--dur) var(--ease),border-color var(--dur) var(--ease)}
        .nlp-card:hover{transform:translateY(-4px);border-color:rgba(255,255,255,.22)}
        .nlp-card h3{margin:0;font-size:1.22rem;font-weight:700;letter-spacing:-.01em}
        .nlp-card .nlp-mono{margin-top:auto;padding-top:14px;border-top:1px solid var(--line)}
        /* resultados */
        .nlp-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
        @media(max-width:960px){.nlp-grid4{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:520px){.nlp-grid4{grid-template-columns:1fr}}
        .nlp-res{background:var(--elev);border:1px solid var(--line);border-radius:16px;padding:28px;
          transition:transform var(--dur) var(--ease),border-color var(--dur) var(--ease)}
        .nlp-res:hover{transform:translateY(-4px);border-color:rgba(255,255,255,.22)}
        .nlp-res b{display:block;font-size:clamp(2.2rem,4vw,3.2rem);font-weight:800;letter-spacing:-.03em;line-height:1}
        .nlp-res small{color:var(--muted);font-size:.9rem}
        /* processo */
        .nlp-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
        @media(max-width:960px){.nlp-steps{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:520px){.nlp-steps{grid-template-columns:1fr}}
        .nlp-step{border-top:1px solid var(--line);padding-top:20px;display:flex;flex-direction:column;gap:10px}
        .nlp-step h3{margin:0;font-size:1.05rem;font-weight:700}
        .nlp-step p{font-size:.9rem}
        /* marquee */
        .nlp-marquee{overflow:hidden;border-block:1px solid var(--line);padding-block:22px;position:relative;
          mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
        .nlp-track{display:flex;gap:56px;width:max-content;animation:nlp-scroll 36s linear infinite}
        .nlp-marquee:hover .nlp-track{animation-play-state:paused}
        @keyframes nlp-scroll{to{transform:translateX(-50%)}}
        .nlp-track span{font-family:'Geist Mono',monospace;font-size:.85rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
        /* manifesto */
        .nlp-manif{display:grid;grid-template-columns:1.2fr 1fr;gap:56px;align-items:center}
        @media(max-width:860px){.nlp-manif{grid-template-columns:1fr}}
        /* faq */
        .nlp-faq{border:1px solid var(--line);border-radius:16px;overflow:hidden}
        .nlp-qa+.nlp-qa{border-top:1px solid var(--line)}
        .nlp-q{width:100%;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 24px;background:none;border:none;color:var(--fg);
          font:inherit;font-weight:600;font-size:1rem;text-align:left;cursor:pointer;transition:background var(--dur) var(--ease)}
        .nlp-q:hover{background:rgba(255,255,255,.03)}
        .nlp-q svg{flex-shrink:0;transition:transform var(--dur) var(--ease)}
        .nlp-qa.nlp-open .nlp-q svg{transform:rotate(45deg)}
        .nlp-a{max-height:0;overflow:hidden;transition:max-height var(--dur) var(--ease)}
        .nlp-qa.nlp-open .nlp-a{max-height:220px}
        .nlp-a p{padding:0 24px 22px;font-size:.94rem}
        /* cta final + footer */
        .nlp-final{text-align:center;display:flex;flex-direction:column;align-items:center;gap:26px}
        .nlp-footer{border-top:1px solid var(--line);padding-block:34px}
        .nlp-footer-in{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}
        .nlp-footer .nlp-mono{font-size:.66rem}
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

            {/* HERO */}
            <section className="nlp-hero" id="top">
                <canvas ref={canvasRef} className="nlp-canvas" />
                <div className="nlp-wrap nlp-hero-in">
                    <span className="nlp-mono nlp-reveal">Sistemas · E-commerce · IA aplicada</span>
                    <h1 className="nlp-reveal nlp-d1">Tecnologia que transforma<br />marcas em máquinas de venda</h1>
                    <p className="nlp-reveal nlp-d2">Sistemas, lojas e aplicações de IA construídos sob medida — entregues em dias, operando com resultado desde o primeiro dia.</p>
                    <div className="nlp-ctas nlp-reveal nlp-d3">
                        <a href={WHATS} target="_blank" rel="noopener" className="nlp-btn nlp-btn-solid">Falar com a NODE</a>
                        <Link to="/login" className="nlp-btn nlp-btn-ghost">Acessar o sistema</Link>
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

            {/* SOLUÇÕES */}
            <section id="solucoes">
                <div className="nlp-wrap">
                    <div className="nlp-head nlp-reveal">
                        <span className="nlp-mono">O que construímos</span>
                        <h2>Engenharia completa,<br />da ideia à operação</h2>
                    </div>
                    <div className="nlp-grid3">
                        {SOLUTIONS.map((s, i) => (
                            <div className={`nlp-card nlp-reveal nlp-d${i + 1}`} key={s.num}>
                                <span className="nlp-mono">{s.num}</span>
                                <h3>{s.title}</h3>
                                <p style={{ fontSize: '.94rem' }}>{s.desc}</p>
                                <span className="nlp-mono">{s.tags}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* RESULTADOS */}
            <section id="resultados">
                <div className="nlp-wrap">
                    <div className="nlp-head nlp-reveal">
                        <span className="nlp-mono">Resultados reais</span>
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
                        <span className="nlp-mono">Como funciona</span>
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
                        <p>A NODE nasceu dentro da operação de e-commerce — não de uma agência de design. Cada sistema, loja e página que entregamos carrega o que aprendemos gerando mais de R$575 milhões para nossos clientes.</p>
                        <p>IA aqui não é discurso: é o motor que nos deixa construir em dias o que o mercado entrega em meses, com acabamento de produto e engenharia de verdade.</p>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq">
                <div className="nlp-wrap" style={{ maxWidth: 780 }}>
                    <div className="nlp-head nlp-reveal">
                        <span className="nlp-mono">FAQ</span>
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
                    <span className="nlp-mono nlp-reveal">Pronto pra começar?</span>
                    <h2 className="nlp-reveal nlp-d1">Seu próximo sistema<br />começa numa conversa</h2>
                    <div className="nlp-ctas nlp-reveal nlp-d2">
                        <a href={WHATS} target="_blank" rel="noopener" className="nlp-btn nlp-btn-solid">Falar com a NODE</a>
                        <Link to="/login" className="nlp-btn nlp-btn-ghost">Já sou cliente</Link>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="nlp-footer">
                <div className="nlp-wrap nlp-footer-in">
                    <img src={nodeLogo} alt="NODE" style={{ height: 14, width: 'auto' }} />
                    <span className="nlp-mono">Seg à Dom · 9h às 23h · (31) 98408-3376 · nodedev@gmail.com</span>
                    <span className="nlp-mono"><a href={INSTA} target="_blank" rel="noopener" style={{ transition: 'color .7s' }}>@noode.dev</a> · © 2026 NODE</span>
                </div>
            </footer>
        </div>
    );
}
