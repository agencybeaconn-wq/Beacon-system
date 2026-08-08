/**
 * Página de serviço (uma por frente da NODE).
 *
 * Existe por SEO: uma página só não disputa termo concorrido, e o Google prefere
 * quem tem página inteira dedicada ao que a pessoa buscou. Aqui cada frente tem
 * endereço, título e conteúdo próprios.
 *
 * O HTML dessas rotas é gerado no build (scripts/seo-prerender.mjs), então o robô
 * recebe o texto pronto sem precisar executar JavaScript.
 */
import { useEffect } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import nodeLogo from '@/assets/node-logo.png';
import { TOKENS, EMAIL, INSTAGRAM, waLink } from '../home-node/tokens';
import { porSlug, SERVICOS } from './conteudo';
import { registrar } from '../home-node/rastreio';

// links cruzados entre as frentes: ajudam o visitante e distribuem força entre as páginas
const outrasFrentes = (slugAtual: string) => SERVICOS.filter(x => x.slug !== slugAtual);

export default function ServicoPage() {
    // as rotas são declaradas uma a uma no App (e não como /:slug, que engoliria
    // qualquer endereço), então o slug vem do próprio caminho
    const { pathname } = useLocation();
    const s = porSlug(pathname.replace(/^\/+|\/+$/g, ''));

    // Título e descrição por rota: numa SPA isso não vem do HTML inicial na navegação
    // interna, então precisa ser aplicado ao montar.
    useEffect(() => {
        if (!s) return;
        const tituloAnterior = document.title;
        document.title = s.title;
        const meta = document.querySelector('meta[name="description"]');
        const descAnterior = meta?.getAttribute('content') ?? '';
        meta?.setAttribute('content', s.descricao);
        registrar('servico_view', s.slug);
        return () => {
            document.title = tituloAnterior;
            meta?.setAttribute('content', descAnterior);
        };
    }, [s]);

    if (!s) return <Navigate to="/" replace />;

    return (
        <div className="nsv">
            <style>{`
        .nsv{${TOKENS}
          background:var(--bg);color:var(--fg);font-family:'Outfit','Inter Tight',sans-serif;
          min-height:100vh;overflow-x:hidden}
        .nsv *{box-sizing:border-box}
        .nsv ::selection{background:var(--accent);color:var(--fg)}
        .nsv :focus-visible{outline:2px solid var(--accent-hi);outline-offset:3px;border-radius:4px}
        .nsv a{color:inherit;text-decoration:none}
        .nsv-wrap{max-width:900px;margin-inline:auto;padding-inline:clamp(24px,5vw,40px)}
        .nsv-mono{font-family:'JetBrains Mono',monospace;font-size:.68rem;letter-spacing:.16em;
          text-transform:uppercase;color:var(--accent)}
        /* nav */
        .nsv-nav{position:sticky;top:0;z-index:20;background:rgba(8,9,12,.82);backdrop-filter:blur(14px);
          border-bottom:1px solid var(--line)}
        .nsv-nav-in{display:flex;align-items:center;justify-content:space-between;height:64px}
        .nsv-voltar{display:inline-flex;align-items:center;gap:9px;font-size:.9rem;color:var(--muted);
          transition:color var(--dur) var(--ease)}
        .nsv-voltar:hover{color:var(--fg)}
        /* hero */
        .nsv-hero{padding-block:clamp(64px,9vw,110px) clamp(40px,5vw,64px);position:relative}
        .nsv-hero::before{content:'';position:absolute;inset:-20% -10% auto;height:520px;pointer-events:none;
          background:radial-gradient(50% 60% at 50% 0%,rgba(139,111,224,.20),transparent 70%)}
        .nsv-hero>*{position:relative}
        .nsv h1{margin:14px 0 0;font-size:clamp(2.1rem,5vw,3.5rem);font-weight:500;letter-spacing:-.035em;line-height:1.05}
        .nsv-abertura{margin-top:28px;display:flex;flex-direction:column;gap:18px}
        .nsv-abertura p{margin:0;color:var(--dim);font-size:1.06rem;line-height:1.68;max-width:70ch}
        /* botões */
        .nsv-btn{display:inline-flex;align-items:center;gap:9px;padding:14px 28px;border-radius:999px;
          font-weight:500;font-size:.95rem;border:1px solid transparent;cursor:pointer;
          transition:transform var(--dur) var(--ease),background var(--dur) var(--ease),
                     border-color var(--dur) var(--ease),box-shadow var(--dur) var(--ease)}
        .nsv-btn:hover{transform:translateY(-2px)}
        .nsv-btn span{transition:transform var(--dur) var(--ease)}
        .nsv-btn:hover span{transform:translateX(4px)}
        .nsv-btn-solid{background:var(--fg);color:var(--bg);box-shadow:0 0 26px var(--accent-dim)}
        .nsv-btn-solid:hover{background:#F9FBFF;box-shadow:0 0 48px rgba(139,111,224,.42)}
        .nsv-ctas{margin-top:36px;display:flex;gap:18px;flex-wrap:wrap;align-items:center}
        /* seções */
        .nsv section{padding-block:clamp(44px,6vw,72px);border-top:1px solid var(--line)}
        .nsv h2{margin:12px 0 0;font-size:clamp(1.5rem,3vw,2.1rem);font-weight:500;letter-spacing:-.03em}
        .nsv-lista{margin:26px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:14px}
        .nsv-lista li{position:relative;padding-left:24px;color:var(--dim);font-size:1rem;line-height:1.6;max-width:74ch}
        .nsv-lista li::before{content:'';position:absolute;left:0;top:.55em;width:8px;height:8px;
          border:1px solid var(--accent);border-radius:2px;transform:rotate(45deg)}
        /* faq */
        .nsv-qa{border-top:1px solid var(--line);padding-block:22px}
        .nsv-qa:first-of-type{border-top:none}
        .nsv-qa h3{margin:0 0 10px;font-size:1.08rem;font-weight:500;letter-spacing:-.01em}
        .nsv-qa p{margin:0;color:var(--muted);font-size:.98rem;line-height:1.62;max-width:74ch}
        /* outras frentes */
        .nsv-outras{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:26px}
        @media(max-width:700px){.nsv-outras{grid-template-columns:1fr}}
        .nsv-outra{display:block;padding:22px;border-radius:14px;border:1px solid var(--line);
          background:var(--bg-elev);transition:transform var(--dur) var(--ease),border-color var(--dur) var(--ease)}
        .nsv-outra:hover{transform:translateY(-4px);border-color:var(--accent)}
        .nsv-outra strong{display:block;font-size:1.05rem;font-weight:500;margin-top:8px}
        /* fecho */
        .nsv-fecho{text-align:center;padding-block:clamp(56px,7vw,90px)!important;position:relative;overflow:hidden}
        .nsv-fecho::before{content:'';position:absolute;inset-inline:-20%;bottom:-60%;height:120%;pointer-events:none;
          background:radial-gradient(50% 50% at 50% 50%,rgba(139,111,224,.20),transparent 68%)}
        .nsv-fecho>*{position:relative}
        .nsv-fecho .nsv-ctas{justify-content:center}
        .nsv-rodape{border-top:1px solid var(--line);padding-block:30px;display:flex;gap:16px;
          justify-content:space-between;flex-wrap:wrap;color:var(--muted);font-size:.86rem}
        .nsv-rodape a:hover{color:var(--accent-hi)}
        @media(prefers-reduced-motion:reduce){.nsv *{transition:none!important;animation:none!important}}
      `}</style>

            <nav className="nsv-nav">
                <div className="nsv-wrap nsv-nav-in">
                    <Link to="/" aria-label="NODE">
                        <img src={nodeLogo} alt="NODE" style={{ height: 17, width: 'auto', display: 'block' }} />
                    </Link>
                    <Link to="/" className="nsv-voltar">Voltar para a home</Link>
                </div>
            </nav>

            <header className="nsv-hero">
                <div className="nsv-wrap">
                    <span className="nsv-mono">{s.etiqueta}</span>
                    <h1>{s.h1}</h1>
                    <div className="nsv-abertura">
                        {s.abertura.map(p => <p key={p.slice(0, 24)}>{p}</p>)}
                    </div>
                    <div className="nsv-ctas">
                        <a href={waLink(s.wa)} target="_blank" rel="noopener noreferrer"
                            className="nsv-btn nsv-btn-solid"
                            onClick={() => registrar('cta_whatsapp', `servico_${s.slug}`)}>
                            {s.cta}<span>→</span>
                        </a>
                    </div>
                </div>
            </header>

            {s.blocos.map(b => (
                <section key={b.titulo}>
                    <div className="nsv-wrap">
                        <h2>{b.titulo}</h2>
                        <ul className="nsv-lista">
                            {b.itens.map(i => <li key={i}>{i}</li>)}
                        </ul>
                    </div>
                </section>
            ))}

            <section>
                <div className="nsv-wrap">
                    <h2>Para quem é</h2>
                    <ul className="nsv-lista">
                        {s.publico.map(p => <li key={p}>{p}</li>)}
                    </ul>
                </div>
            </section>

            <section>
                <div className="nsv-wrap">
                    <span className="nsv-mono">{'// perguntas frequentes'}</span>
                    <h2 style={{ marginBottom: 26 }}>Dúvidas sobre esta frente</h2>
                    {s.perguntas.map(p => (
                        <div className="nsv-qa" key={p.q}>
                            <h3>{p.q}</h3>
                            <p>{p.a}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <div className="nsv-wrap">
                    <span className="nsv-mono">{'// as outras frentes'}</span>
                    <h2>A NODE também constrói</h2>
                    <div className="nsv-outras">
                        {outrasFrentes(s.slug).map(o => (
                            <Link className="nsv-outra" to={`/${o.slug}`} key={o.slug}>
                                <span className="nsv-mono">{o.etiqueta}</span>
                                <strong>{o.h1}</strong>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="nsv-fecho">
                <div className="nsv-wrap">
                    <span className="nsv-mono">{'// pronto pra começar?'}</span>
                    <h2>Vamos conversar sobre o seu projeto</h2>
                    <div className="nsv-ctas">
                        <a href={waLink(s.wa)} target="_blank" rel="noopener noreferrer"
                            className="nsv-btn nsv-btn-solid"
                            onClick={() => registrar('cta_whatsapp', `servico_fecho_${s.slug}`)}>
                            {s.cta}<span>→</span>
                        </a>
                    </div>
                </div>
            </section>

            <footer>
                <div className="nsv-wrap nsv-rodape">
                    <span>© 2026 NODE · Sete Lagoas · MG · atendemos todo o Brasil</span>
                    <span>
                        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
                        {' · '}
                        <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer">@noode.dev</a>
                    </span>
                </div>
            </footer>
        </div>
    );
}
