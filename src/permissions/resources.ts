import { type Role } from './policies';

export const hiddenResources: Partial<Record<Role, string[]>> = {
    FUNCIONARIO: [
        'clientes.configuracoes', // esconde a aba Configurações dentro da página de Clientes
    ],
    CLIENTE: [
        'clientes.configuracoes',
        'clientes.timeline',
        'clientes.pedidos',
        'clientes.documentos',
        'clientes.conexoes',
    ],
};

export function canSee(user: { role: Role } | null | undefined, resource: string): boolean {
    if (!user || !user.role) return false;

    const blocked = hiddenResources[user.role] ?? [];
    return !blocked.includes(resource);
}
