import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Slot no cabeçalho global: cada página pode teleportar seu seletor/tabs pra
 * DENTRO do topbar do shell, ocupando o espaço vazio ao lado do seletor de
 * cliente — só enquanto a página está montada.
 *
 * Uso no shell:   <HeaderSlotProvider> ... <HeaderSlotOutlet /> ... </HeaderSlotProvider>
 * Uso na página:  <HeaderPortal><TabsList>...</TabsList></HeaderPortal>
 *
 * createPortal preserva o contexto do REACT (não do DOM): um <TabsList>
 * portalado continua enxergando o <Tabs> pai da página — é o que permite
 * mover o trilho sem reescrever o estado das abas.
 */
const HeaderSlotContext = createContext<{
    node: HTMLElement | null;
    setNode: (el: HTMLElement | null) => void;
} | null>(null);

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
    const [node, setNode] = useState<HTMLElement | null>(null);
    return (
        <HeaderSlotContext.Provider value={{ node, setNode }}>
            {children}
        </HeaderSlotContext.Provider>
    );
}

/** Ponto de montagem dentro do topbar do shell. */
export function HeaderSlotOutlet({ className }: { className?: string }) {
    const ctx = useContext(HeaderSlotContext);
    if (!ctx) return null;
    return <div ref={ctx.setNode} className={className} />;
}

/** Teleporta children pro slot do cabeçalho. Sem provider/slot, renderiza no lugar (fallback seguro). */
export function HeaderPortal({ children }: { children: ReactNode }) {
    const ctx = useContext(HeaderSlotContext);
    if (!ctx?.node) return <>{children}</>;
    return createPortal(children, ctx.node);
}
