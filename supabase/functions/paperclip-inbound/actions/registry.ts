import type { ActionDefinition } from './types.ts';
import { getClientSnapshot } from './get-client-snapshot.ts';
import { createClientTask } from './create-client-task.ts';
import { updateClientTaskStatus } from './update-client-task-status.ts';

// Registro explícito. Nada fora daqui é executável — allow-list é parte da segurança.
// deno-lint-ignore no-explicit-any
const all: ActionDefinition<any>[] = [
  getClientSnapshot,
  createClientTask,
  updateClientTaskStatus,
];

// deno-lint-ignore no-explicit-any
const byName: Record<string, ActionDefinition<any>> = Object.fromEntries(
  all.map((a) => [a.name, a]),
);

export function getAction(name: string) {
  return byName[name] ?? null;
}

export function listManifest() {
  return all.map((a) => ({
    name: a.name,
    description: a.description,
    // deno-lint-ignore no-explicit-any
    params_schema: zodToSummary((a as any).paramsSchema),
  }));
}

// Resumo de um ZodType para o manifest. Não é JSON Schema completo — apenas o
// suficiente para o agente saber nomes, tipos e obrigatoriedade dos campos.
// deno-lint-ignore no-explicit-any
function zodToSummary(schema: any): unknown {
  try {
    const def = schema?._def;
    if (!def) return { type: 'unknown' };

    if (def.typeName === 'ZodObject') {
      const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
      const props: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(shape ?? {})) {
        props[key] = zodToSummary(value);
      }
      return { type: 'object', properties: props };
    }
    if (def.typeName === 'ZodString') return { type: 'string' };
    if (def.typeName === 'ZodNumber') return { type: 'number' };
    if (def.typeName === 'ZodBoolean') return { type: 'boolean' };
    if (def.typeName === 'ZodEnum') return { type: 'enum', values: def.values };
    if (def.typeName === 'ZodArray') return { type: 'array', items: zodToSummary(def.type) };
    if (def.typeName === 'ZodOptional') {
      const inner = zodToSummary(def.innerType);
      return { ...(inner as object), optional: true };
    }
    if (def.typeName === 'ZodDefault') {
      const inner = zodToSummary(def.innerType);
      return { ...(inner as object), default: def.defaultValue?.() };
    }
    if (def.typeName === 'ZodEffects') return zodToSummary(def.schema);
    return { type: def.typeName };
  } catch {
    return { type: 'unknown' };
  }
}
