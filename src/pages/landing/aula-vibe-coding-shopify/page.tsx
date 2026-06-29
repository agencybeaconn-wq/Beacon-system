/**
 * Aula: Vibe Coding com Shopify
 * Mindmap interativo (pan + zoom + drag nodes + conectar) tipo Miro / Mindmeister.
 * Tema: Lever (white + grid + primary red).
 * Rota: /aula/vibe-coding-shopify
 */
import { useEffect, useRef, useState, MouseEvent } from "react";
import {
    Code2, Bot, Terminal, Palette, Package, Zap, Cpu,
    ZoomIn, ZoomOut, Maximize2, Link2, X,
    BookOpen, ChevronRight, Save,
} from "lucide-react";

// ─── Persistência (localStorage) ────────────────────────────────────────
const STORAGE_KEY = "lever-aula-vibe-coding-shopify-v1";

interface SavedState {
    positions: Record<string, { x: number; y: number }>;
    connections: { from: string; to: string }[];
    transform: { x: number; y: number; scale: number };
}

function loadState(): SavedState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

function saveState(state: SavedState) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ─── Casos práticos pra demo ao vivo ────────────────────────────────────
interface UseCase {
    category: string;
    color: string; // bg + text class
    items: { prompt: string; explain: string; skill?: string }[];
}

const USE_CASES: UseCase[] = [
    {
        category: "Alterar descrição",
        color: "bg-rose-50 text-rose-700 border-rose-200",
        items: [
            {
                prompt: '"Limpa as descrições de todos os produtos do fornecedor X (Jersey Zone)"',
                explain: "Detecta padrão tri-língue boilerplate e substitui body_html por vazio em massa.",
                skill: "bulk-descriptions",
            },
            {
                prompt: '"Aplica template em PT/EN/ES nas Camisas de Time"',
                explain: "Aplica template Beacon com placeholders do briefing (preço, prazo, contato).",
                skill: "bulk-descriptions --template",
            },
            {
                prompt: '"Tira a frase \'frete grátis\' de todas as descrições"',
                explain: "Find/replace simples via productUpdate em bulk operation.",
                skill: "bulk-descriptions --find=... --replace=",
            },
        ],
    },
    {
        category: "Alterar preço",
        color: "bg-amber-50 text-amber-700 border-amber-200",
        items: [
            {
                prompt: '"Aumenta 10% no preço de toda Camisa Torcedor"',
                explain: "Filtra por categoria detectada no título, multiplica price + compare_at_price.",
                skill: "update-prices",
            },
            {
                prompt: '"Aplica essa tabela: Torcedor R$249, Jogador R$329, Retrô R$219, Manga Longa R$269"',
                explain: "Cola texto livre. Agente parseia, mapeia pra categorias e aplica via bulk.",
                skill: "update-prices",
            },
            {
                prompt: '"Audita preços vs banco — me mostra o que tá divergente"',
                explain: "Compara variant.price com client_pricing. Não modifica, só relata.",
                skill: "bulk-fix-prices --dry-run",
            },
        ],
    },
    {
        category: "Alterar variante",
        color: "bg-violet-50 text-violet-700 border-violet-200",
        items: [
            {
                prompt: '"Cria variante PP em todas as camisas femininas"',
                explain: "Adiciona option value PP em produtos filtrados, herda preço da menor.",
                skill: "fix-options",
            },
            {
                prompt: '"Aumenta R$10 nas variantes 2GG e 3GG"',
                explain: "Filtra variantes por option1 e ajusta price + compare_at em massa.",
                skill: "update-prices --extras",
            },
            {
                prompt: '"Copia variantes do produto X (modelo) pra todos os outros que não têm"',
                explain: "Replica option set completo (PP/P/M/G/GG/Personalizar) baseado num modelo.",
                skill: "duplicate-variants",
            },
        ],
    },
    {
        category: "Alterar título",
        color: "bg-blue-50 text-blue-700 border-blue-200",
        items: [
            {
                prompt: '"Remove Nike/Adidas/Puma de todos os títulos"',
                explain: "Find/replace regex multi-marca via productUpdate bulk.",
                skill: "clean-titles --remove-brands",
            },
            {
                prompt: '"Conserta Feminino → Feminina em camisas femininas"',
                explain: "Detecta typo gramatical e corrige só onde aplicável (não quebra masculino).",
                skill: "clean-titles --fix-gender",
            },
            {
                prompt: '"Renomeia 24/25 pra 2024/25 em todos os produtos"',
                explain: "Find/replace simples mas em escala — 1500 produtos em 1 prompt.",
                skill: "bulk-product-meta + GraphQL",
            },
        ],
    },
    {
        category: "Alterar SEO",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        items: [
            {
                prompt: '"Padroniza meta title pra \'{título} | Loja X\' em tudo"',
                explain: "Aplica template SEO Beacon — preenche meta_title e meta_description vazios.",
                skill: "bulk-product-meta --seo-auto",
            },
            {
                prompt: '"Troca o vendor de todos os produtos pra Beacon Ecomm"',
                explain: "vendor field via productUpdate bulk — usado pra filtros internos.",
                skill: "bulk-product-meta --vendor=...",
            },
            {
                prompt: '"Quais produtos não têm SEO preenchido?"',
                explain: "Read-only — lista produtos com meta_title ou meta_description vazios.",
                skill: "audit-store / quality-gate",
            },
        ],
    },
];

interface NodeData {
    id: string;
    title: string;
    icon: any;
    accent: string;
    iconBg: string;
    items: string[];
    commands?: string[]; // bloco terminal-style opcional
    x: number;
    y: number;
    isHub?: boolean;
}

const INITIAL_NODES: NodeData[] = [
    {
        id: "hub", title: "Você + IA", icon: Cpu,
        accent: "", iconBg: "",
        x: 0, y: 0, isHub: true,
        items: ["Vibe coding"],
    },
    {
        id: "ide", title: "IDE com IA", icon: Code2,
        accent: "border-t-blue-500", iconBg: "bg-blue-500",
        x: -520, y: -360,
        items: ["Antigravity (grátis)", "Cursor ($20/mês)", "Claude Code (CLI)", "VS Code + Copilot"],
    },
    {
        id: "agentes", title: "Agentes", icon: Bot,
        accent: "border-t-purple-500", iconBg: "bg-purple-500",
        x: 520, y: -360,
        items: ["LLM com ferramentas", "Lê e edita arquivos", "Roda comandos", "Trabalha em background"],
    },
    {
        id: "shopify-cli", title: "Shopify Stack", icon: Terminal,
        accent: "border-t-emerald-500", iconBg: "bg-emerald-500",
        x: 740, y: 0,
        items: [
            "Shopify CLI (theme dev, push/pull)",
            "AI Toolkit / MCP — IA conversa direto com a loja",
            "Shopify Magic — IA dentro do admin",
            "GraphQL Admin API",
        ],
    },
    {
        id: "produtos", title: "Edição de Produtos", icon: Package,
        accent: "border-t-orange-500", iconBg: "bg-orange-500",
        x: 520, y: 360,
        items: ["Título / descrição / preço", "Imagens, variantes", "Coleções, SEO", "1500 produtos em 1 prompt"],
    },
    {
        id: "bulk", title: "Edição em Massa", icon: Zap,
        accent: "border-t-rose-500", iconBg: "bg-rose-500",
        x: -520, y: 360,
        items: ["Find/replace descrições", "Template tri-língue", "Limpar lixo de fornecedor", "Sort coleções (Brasil first)"],
    },
    {
        id: "tema", title: "Tema (Liquid)", icon: Palette,
        accent: "border-t-indigo-500", iconBg: "bg-indigo-500",
        x: -740, y: 0,
        items: ["Header / Footer / Banners", "Sections + Templates", "Hot reload no preview"],
        commands: [
            "shopify auth login",
            "shopify theme pull",
            "shopify theme dev",
            "shopify theme push",
        ],
    },
];

const INITIAL_CONNECTIONS: { from: string; to: string }[] = [
    { from: "hub", to: "ide" },
    { from: "hub", to: "agentes" },
    { from: "hub", to: "shopify-cli" },
    { from: "hub", to: "produtos" },
    { from: "hub", to: "bulk" },
    { from: "hub", to: "tema" },
];

const HUB_W = 200, HUB_H = 200;
const NODE_W = 280, NODE_H = 180;

export default function AulaVibeCodingShopify() {
    // Hidrata do localStorage no mount (lazy initial state)
    const initialSaved = typeof window !== "undefined" ? loadState() : null;

    const [transform, setTransform] = useState(
        initialSaved?.transform || { x: 0, y: 0, scale: 1 }
    );
    const [nodes, setNodes] = useState(() => {
        if (!initialSaved?.positions) return INITIAL_NODES;
        return INITIAL_NODES.map(n =>
            initialSaved.positions[n.id]
                ? { ...n, ...initialSaved.positions[n.id] }
                : n
        );
    });
    const [connections, setConnections] = useState(
        initialSaved?.connections || INITIAL_CONNECTIONS
    );
    const [connectMode, setConnectMode] = useState(false);
    const [pendingFrom, setPendingFrom] = useState<string | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [savedAt, setSavedAt] = useState<Date | null>(null);

    // Auto-save em qualquer mudança (debounced via React batching)
    useEffect(() => {
        const positions: Record<string, { x: number; y: number }> = {};
        for (const n of nodes) positions[n.id] = { x: n.x, y: n.y };
        saveState({ positions, connections, transform });
        setSavedAt(new Date());
    }, [nodes, connections, transform]);

    const [panning, setPanning] = useState(false);
    const panStart = useRef({ mouseX: 0, mouseY: 0, transformX: 0, transformY: 0 });

    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const dragNodeStart = useRef({ mouseX: 0, mouseY: 0, nodeX: 0, nodeY: 0 });

    const containerRef = useRef<HTMLDivElement>(null);

    function getNodeSize(n: NodeData) {
        return n.isHub ? { w: HUB_W, h: HUB_H } : { w: NODE_W, h: NODE_H };
    }

    // ─── Pan + drag do canvas ───────────────────────────────────────
    function onCanvasMouseDown(e: MouseEvent) {
        if ((e.target as HTMLElement).closest("[data-node]")) return;
        // Click em vazio em modo conectar = cancela
        if (connectMode && pendingFrom) setPendingFrom(null);
        setPanning(true);
        panStart.current = {
            mouseX: e.clientX, mouseY: e.clientY,
            transformX: transform.x, transformY: transform.y,
        };
    }
    function onCanvasMouseMove(e: MouseEvent) {
        if (panning) {
            const dx = e.clientX - panStart.current.mouseX;
            const dy = e.clientY - panStart.current.mouseY;
            setTransform(t => ({ ...t, x: panStart.current.transformX + dx, y: panStart.current.transformY + dy }));
        }
        if (draggingNode) {
            const dx = (e.clientX - dragNodeStart.current.mouseX) / transform.scale;
            const dy = (e.clientY - dragNodeStart.current.mouseY) / transform.scale;
            setNodes(prev => prev.map(n =>
                n.id === draggingNode
                    ? { ...n, x: dragNodeStart.current.nodeX + dx, y: dragNodeStart.current.nodeY + dy }
                    : n
            ));
        }
    }
    function onCanvasMouseUp() {
        setPanning(false);
        setDraggingNode(null);
    }

    // ─── Drag de node ───────────────────────────────────────────────
    function onNodeMouseDown(e: MouseEvent, nodeId: string) {
        if (connectMode) return; // em modo conectar, não dragga
        e.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        setDraggingNode(nodeId);
        dragNodeStart.current = {
            mouseX: e.clientX, mouseY: e.clientY,
            nodeX: node.x, nodeY: node.y,
        };
    }

    // ─── Click em node (modo conectar) ──────────────────────────────
    function onNodeClick(e: MouseEvent, nodeId: string) {
        if (!connectMode) return;
        e.stopPropagation();
        if (!pendingFrom) {
            setPendingFrom(nodeId);
            return;
        }
        if (pendingFrom === nodeId) {
            setPendingFrom(null);
            return;
        }
        // Adiciona conexão (evita duplicada — em ambos os sentidos)
        const exists = connections.some(c =>
            (c.from === pendingFrom && c.to === nodeId) ||
            (c.from === nodeId && c.to === pendingFrom)
        );
        if (!exists) {
            setConnections([...connections, { from: pendingFrom, to: nodeId }]);
        }
        setPendingFrom(null);
    }

    // ─── Deletar conexão ────────────────────────────────────────────
    function deleteConnection(idx: number) {
        setConnections(connections.filter((_, i) => i !== idx));
    }

    // ─── Zoom ───────────────────────────────────────────────────────
    function zoomBy(factor: number, cursorX?: number, cursorY?: number) {
        const newScale = Math.max(0.3, Math.min(2.5, transform.scale * factor));
        if (cursorX !== undefined && cursorY !== undefined) {
            const ratio = newScale / transform.scale;
            setTransform(t => ({
                scale: newScale,
                x: cursorX - (cursorX - t.x) * ratio,
                y: cursorY - (cursorY - t.y) * ratio,
            }));
        } else {
            setTransform(t => ({ ...t, scale: newScale }));
        }
    }
    function reset() {
        if (!confirm("Resetar layout? Você perde as posições e conexões salvas.")) return;
        clearState();
        setTransform({ x: 0, y: 0, scale: 1 });
        setNodes(INITIAL_NODES);
        setConnections(INITIAL_CONNECTIONS);
    }

    // wheel listener nativo pra preventDefault
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const cursorX = e.clientX - rect.left - rect.width / 2;
            const cursorY = e.clientY - rect.top - rect.height / 2;
            zoomBy(e.deltaY > 0 ? 0.9 : 1.1, cursorX, cursorY);
        };
        el.addEventListener("wheel", handler, { passive: false });
        return () => el.removeEventListener("wheel", handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transform]);

    // ESC sai do modo conectar
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setConnectMode(false);
                setPendingFrom(null);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // ─── Coordenadas pra SVG ────────────────────────────────────────
    const SVG_OFFSET_X = 1500;
    const SVG_OFFSET_Y = 1000;
    function nodeCenter(n: NodeData) {
        return { x: SVG_OFFSET_X + n.x, y: SVG_OFFSET_Y + n.y };
    }

    // ─── Render ────────────────────────────────────────────────────
    return (
        <div className="h-screen w-screen overflow-hidden bg-white text-slate-900 select-none">
            {/* Top bar Lever */}
            <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold shadow-sm">L</div>
                    <div>
                        <div className="text-sm font-bold leading-tight">Beacon Academy</div>
                        <div className="text-xs text-slate-500 leading-tight">Vibe Coding com Shopify</div>
                    </div>
                </div>
                <div className="text-xs text-slate-400 hidden md:block">
                    {connectMode
                        ? (pendingFrom ? "Clique em outro card pra conectar · ESC pra cancelar" : "Clique no primeiro card · ESC pra sair")
                        : "Arrasta o fundo · arrasta cards · scroll pra zoom"}
                </div>
            </header>

            {/* Canvas */}
            <div
                ref={containerRef}
                onMouseDown={onCanvasMouseDown}
                onMouseMove={onCanvasMouseMove}
                onMouseUp={onCanvasMouseUp}
                onMouseLeave={onCanvasMouseUp}
                className={`absolute inset-0 ${panning ? "cursor-grabbing" : connectMode ? "cursor-crosshair" : "cursor-grab"}`}
                style={{
                    backgroundImage: `
                        linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)
                    `,
                    backgroundSize: `${24 * transform.scale}px ${24 * transform.scale}px`,
                    backgroundPosition: `${transform.x}px ${transform.y}px`,
                }}
            >
                <div
                    className="absolute top-1/2 left-1/2"
                    style={{
                        transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        transformOrigin: "center center",
                    }}
                >
                    {/* SVG conectores */}
                    <svg
                        className="absolute"
                        style={{ left: -SVG_OFFSET_X, top: -SVG_OFFSET_Y, width: SVG_OFFSET_X * 2, height: SVG_OFFSET_Y * 2, overflow: "visible" }}
                    >
                        <defs>
                            <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#dc2626" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.4" />
                            </linearGradient>
                        </defs>
                        {connections.map((c, idx) => {
                            const from = nodes.find(n => n.id === c.from);
                            const to = nodes.find(n => n.id === c.to);
                            if (!from || !to) return null;
                            const a = nodeCenter(from);
                            const b = nodeCenter(to);
                            const midX = (a.x + b.x) / 2;
                            const midY = (a.y + b.y) / 2;
                            return (
                                <g key={idx} className="group">
                                    {/* Hit area mais grossa pra facilitar click */}
                                    <path
                                        d={`M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`}
                                        stroke="transparent"
                                        strokeWidth="14"
                                        fill="none"
                                        className="pointer-events-stroke cursor-pointer"
                                    />
                                    <path
                                        d={`M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`}
                                        stroke="url(#line-grad)"
                                        strokeWidth="2"
                                        fill="none"
                                        strokeDasharray="6,5"
                                        className="pointer-events-none group-hover:stroke-rose-500 transition-colors"
                                    />
                                    {/* Botão X pra deletar (aparece em hover) */}
                                    <g
                                        className="opacity-0 group-hover:opacity-100 cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); deleteConnection(idx); }}
                                    >
                                        <circle cx={midX} cy={midY} r="10" fill="white" stroke="#e11d48" strokeWidth="1.5" />
                                        <line x1={midX - 4} y1={midY - 4} x2={midX + 4} y2={midY + 4} stroke="#e11d48" strokeWidth="1.5" />
                                        <line x1={midX - 4} y1={midY + 4} x2={midX + 4} y2={midY - 4} stroke="#e11d48" strokeWidth="1.5" />
                                    </g>
                                </g>
                            );
                        })}
                    </svg>

                    {/* Nodes */}
                    {nodes.map(n => {
                        const Icon = n.icon;
                        const size = getNodeSize(n);
                        const isPending = pendingFrom === n.id;
                        const highlight = connectMode && (isPending || pendingFrom);

                        if (n.isHub) {
                            return (
                                <div
                                    key={n.id}
                                    data-node={n.id}
                                    onMouseDown={(e) => onNodeMouseDown(e, n.id)}
                                    onClick={(e) => onNodeClick(e, n.id)}
                                    className={`absolute ${connectMode ? "cursor-pointer" : "cursor-move"}`}
                                    style={{ left: n.x - size.w / 2, top: n.y - size.h / 2, width: size.w, height: size.h }}
                                >
                                    <div className={`relative w-full h-full ${isPending ? "ring-4 ring-blue-400 rounded-3xl" : ""}`}>
                                        <div className="absolute inset-0 bg-primary rounded-3xl blur-2xl opacity-30" />
                                        <div className="relative w-full h-full bg-gradient-to-br from-primary to-red-700 rounded-3xl shadow-xl flex flex-col items-center justify-center text-white border border-red-800/30">
                                            <Cpu className="w-10 h-10 mb-2" strokeWidth={1.5} />
                                            <div className="font-bold text-lg">{n.title}</div>
                                            <div className="text-xs opacity-90 mt-0.5">{n.items[0]}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={n.id}
                                data-node={n.id}
                                onMouseDown={(e) => onNodeMouseDown(e, n.id)}
                                onClick={(e) => onNodeClick(e, n.id)}
                                className={`absolute ${connectMode ? "cursor-pointer" : "cursor-move"}`}
                                style={{ left: n.x - size.w / 2, top: n.y - size.h / 2, width: size.w }}
                            >
                                <div className={`bg-white rounded-2xl shadow-md hover:shadow-xl border border-slate-200 border-t-4 ${n.accent} transition-all p-4 ${isPending ? "ring-4 ring-blue-400" : ""} ${highlight && !isPending ? "ring-2 ring-blue-200" : ""}`}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`w-9 h-9 rounded-lg ${n.iconBg} flex items-center justify-center text-white shadow-sm`}>
                                            <Icon className="w-5 h-5" strokeWidth={2} />
                                        </div>
                                        <h3 className="font-bold text-sm">{n.title}</h3>
                                    </div>
                                    <ul className="space-y-1">
                                        {n.items.map((item, idx) => (
                                            <li key={idx} className="text-xs text-slate-600 leading-relaxed flex items-start gap-1.5">
                                                <span className="text-slate-300 mt-0.5">·</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    {n.commands && n.commands.length > 0 && (
                                        <div className="mt-3 bg-slate-900 rounded-md p-2 font-mono text-[11px] leading-relaxed">
                                            {n.commands.map((cmd, idx) => (
                                                <div key={idx} className="text-slate-100 flex items-baseline gap-1.5">
                                                    <span className="text-emerald-400 select-none">$</span>
                                                    <span>{cmd}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Toolbar lateral direita */}
            <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2">
                {/* Botão pedidos práticos */}
                <button
                    onClick={() => setPanelOpen(!panelOpen)}
                    className={`p-2.5 rounded-xl shadow-lg border transition-all ${panelOpen ? "bg-primary text-white border-primary" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
                    title="Pedidos práticos pra demo"
                >
                    <BookOpen className="w-4 h-4" />
                </button>

                {/* Botão conectar */}
                <button
                    onClick={() => { setConnectMode(!connectMode); setPendingFrom(null); }}
                    className={`p-2.5 rounded-xl shadow-lg border transition-all ${connectMode ? "bg-primary text-white border-primary" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
                    title={connectMode ? "Sair do modo conectar (ESC)" : "Conectar cards"}
                >
                    <Link2 className="w-4 h-4" />
                </button>

                {/* Zoom group */}
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col overflow-hidden">
                    <button onClick={() => zoomBy(1.2)} className="p-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100" title="Zoom in">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button onClick={() => zoomBy(0.8)} className="p-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100" title="Zoom out">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button onClick={reset} className="p-2.5 hover:bg-slate-50 transition-colors" title="Reset (volta tudo ao início)">
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Status bar inferior esquerda */}
            <div className="absolute bottom-6 left-6 z-30 flex items-center gap-2">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 px-3 py-1.5 text-xs text-slate-600 font-mono">
                    {Math.round(transform.scale * 100)}%
                </div>
                {savedAt && (
                    <div className="bg-emerald-50 text-emerald-700 rounded-lg shadow-sm border border-emerald-200 px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                        <Save className="w-3 h-3" />
                        Salvo
                    </div>
                )}
                {connectMode && (
                    <div className="bg-blue-50 text-blue-700 rounded-lg shadow-sm border border-blue-200 px-3 py-1.5 text-xs font-medium flex items-center gap-1.5">
                        <Link2 className="w-3 h-3" />
                        Modo conectar
                        {pendingFrom && (
                            <button onClick={() => setPendingFrom(null)} className="ml-1 hover:text-blue-900">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Painel lateral — Pedidos práticos */}
            <div
                className={`fixed top-0 right-0 h-full w-[440px] max-w-[90vw] bg-white border-l border-slate-200 shadow-2xl z-40 transition-transform duration-300 ${panelOpen ? "translate-x-0" : "translate-x-full"}`}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-primary" />
                        <div>
                            <div className="font-bold text-sm">Pedidos práticos</div>
                            <div className="text-xs text-slate-500">Use ao vivo durante a aula</div>
                        </div>
                    </div>
                    <button
                        onClick={() => setPanelOpen(false)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
                        title="Fechar"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto h-[calc(100%-60px)] p-4 space-y-5">
                    {USE_CASES.map((cat) => (
                        <div key={cat.category}>
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${cat.color} mb-2`}>
                                <ChevronRight className="w-3 h-3" />
                                {cat.category}
                            </div>
                            <div className="space-y-2 ml-1">
                                {cat.items.map((item, idx) => (
                                    <div key={idx} className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                                        <div className="font-mono text-xs text-slate-800 leading-relaxed mb-1.5">
                                            {item.prompt}
                                        </div>
                                        <div className="text-xs text-slate-600 leading-relaxed">
                                            {item.explain}
                                        </div>
                                        {item.skill && (
                                            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-mono bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                <span className="text-slate-400">skill:</span>
                                                <span>{item.skill}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="pt-3 mt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
                        <div className="font-semibold text-slate-700 mb-1">💡 Dica de aula</div>
                        Mostre cada prompt antes de rodar — explique o que a IA vai fazer, quais ferramentas/skills ela vai usar, e por quê isso seria difícil sem agente.
                    </div>
                </div>
            </div>
        </div>
    );
}
