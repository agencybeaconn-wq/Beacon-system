import { z } from "zod";
import { resolveShop } from "../../config.js";
import { runGraphQL } from "../../client.js";
import type { Tool } from "../types.js";

/**
 * clone_theme — server-side clone de tema entre 2 shops do MCP.
 *
 * Pull files do source theme, opcionalmente aplica search/replace de hex colors
 * (ex: rebrand), e push pra target theme. Resolve o pattern de migração entre
 * lojas (Kron → MATIGNON, Lever client → cliente novo) sem queimar contexto Claude.
 *
 * Fluxo:
 *   1. Lista files do source theme (paginate até esgotar)
 *   2. Para cada file, baixa conteúdo (texto inline; URL pra binários)
 *   3. Aplica color_replacements em arquivos text-based
 *   4. Push pra target via themeFilesUpsert em batches paralelos
 *   5. Retorna sumário com counts + erros agregados
 *
 * Sem confirm=true porque é uma operação composta — confirmação é via
 * caller do MCP (humano OK na sessão Claude antes de invocar).
 */

const TEXT_EXTENSIONS = new Set([
  ".liquid", ".json", ".css", ".js", ".svg", ".html",
  ".txt", ".md", ".yml", ".yaml",
]);

function isTextFile(filename: string): boolean {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return false;
  return TEXT_EXTENSIONS.has(filename.slice(idx).toLowerCase());
}

function applyReplacements(
  content: string,
  replacements: Record<string, string>,
): { content: string; count: number } {
  let result = content;
  let count = 0;
  for (const [from, to] of Object.entries(replacements)) {
    // case-sensitive + case-variant pra hex colors
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "g");
    const matches = result.match(regex);
    if (matches) {
      count += matches.length;
      result = result.replace(regex, to);
    }
    // Tenta também variante UPPERCASE se from começa com # (hex color)
    if (from.startsWith("#") && from !== from.toUpperCase()) {
      const upperFrom = from.toUpperCase();
      const upperEscaped = upperFrom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const upperRegex = new RegExp(upperEscaped, "g");
      const upperMatches = result.match(upperRegex);
      if (upperMatches) {
        count += upperMatches.length;
        result = result.replace(upperRegex, to);
      }
    }
  }
  return { content: result, count };
}

type EntityType = "products" | "collections" | "pages" | "menus";

/**
 * Build handle → GID map by querying shop for all entities of a type.
 * Used for entity_remap (G8 fix): source/target may share handles but have
 * different GIDs — rewriting JSON theme templates needs accurate cross-shop remap.
 */
async function buildHandleMap(
  shop: ReturnType<typeof resolveShop>,
  type: EntityType,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  // Query each entity type with pagination
  const queries: Record<EntityType, { rootField: string; nodeFields: string }> = {
    products: { rootField: "products", nodeFields: "id handle" },
    collections: { rootField: "collections", nodeFields: "id handle" },
    pages: { rootField: "pages", nodeFields: "id handle" },
    menus: { rootField: "menus", nodeFields: "id handle" },
  };
  const { rootField, nodeFields } = queries[type];

  type ListResp = {
    [k: string]: {
      edges: Array<{ node: { id: string; handle: string } }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };

  let cursor: string | null = null;
  const PAGE_SIZE = 250;
  while (true) {
    const q = `query($first: Int!, $after: String) {
      ${rootField}(first: $first, after: $after) {
        edges { node { ${nodeFields} } cursor }
        pageInfo { hasNextPage endCursor }
      }
    }`;
    const resp: { data?: ListResp; errors?: unknown } = await runGraphQL<ListResp>(shop, q, {
      first: PAGE_SIZE,
      after: cursor,
    });
    if (resp.errors) {
      throw new Error(
        `Failed to list ${type} on ${shop.alias}: ${JSON.stringify(resp.errors)}`,
      );
    }
    const root = resp.data?.[rootField];
    if (!root) break;
    for (const edge of root.edges) {
      if (edge.node.handle) result[edge.node.handle] = edge.node.id;
    }
    if (!root.pageInfo.hasNextPage) break;
    cursor = root.pageInfo.endCursor;
  }
  return result;
}

/**
 * Build full GID remap: source GID → target GID, for all entities matched by handle.
 */
async function buildEntityRemap(
  sourceShop: ReturnType<typeof resolveShop>,
  targetShop: ReturnType<typeof resolveShop>,
  types: EntityType[],
): Promise<Record<string, string>> {
  const remap: Record<string, string> = {};
  for (const type of types) {
    const sourceMap = await buildHandleMap(sourceShop, type);
    const targetMap = await buildHandleMap(targetShop, type);
    for (const [handle, sourceGid] of Object.entries(sourceMap)) {
      const targetGid = targetMap[handle];
      if (targetGid && targetGid !== sourceGid) {
        remap[sourceGid] = targetGid;
        // Also map the numeric ID variant (Shopify sometimes uses ".id" without gid:// prefix)
        const sourceNumericMatch = sourceGid.match(/\/(\d+)$/);
        const targetNumericMatch = targetGid.match(/\/(\d+)$/);
        const srcNum = sourceNumericMatch?.[1];
        const tgtNum = targetNumericMatch?.[1];
        if (srcNum && tgtNum) {
          remap[srcNum] = tgtNum;
        }
      }
    }
  }
  return remap;
}

function applyEntityRemap(content: string, remap: Record<string, string>): { content: string; count: number } {
  let result = content;
  let count = 0;
  // Sort by length descending so longer keys (e.g. full GIDs) replace before shorter (numeric IDs)
  const entries = Object.entries(remap).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "g");
    const matches = result.match(re);
    if (matches) {
      count += matches.length;
      result = result.replace(re, to);
    }
  }
  return { content: result, count };
}

export const cloneThemeTool: Tool = {
  name: "clone_theme",
  description:
    "Clone a Shopify theme from one shop to another (both configured in MCP). Pulls all files from source theme, optionally applies hex color replacements, generic text replacements (brand swap), and/or entity ID remap (source product/collection/page/menu GIDs → target equivalents resolved by handle). Then pushes to target theme. Use for rebrand migrations (Kron→MATIGNON), or replicating a base theme across clients (Kron→client X). Server-side — does not consume Claude context for file transfer. Returns summary with file counts, replacements applied, and errors. NOTE: target theme must already exist (use Shopify Admin or themeCreate first); operation is upsert, not delete-orphans.",
  inputSchema: z.object({
    source_shop: z
      .string()
      .describe("Source shop alias (must be in shops.json)."),
    source_theme_id: z
      .string()
      .describe(
        'Source theme GID (e.g. "gid://shopify/OnlineStoreTheme/154720141475"). Use list themes via graphql_query first.',
      ),
    target_shop: z
      .string()
      .describe("Target shop alias (must be in shops.json)."),
    target_theme_id: z
      .string()
      .describe(
        "Target theme GID where files will be upserted. Must exist beforehand (themeCreate or pick existing unpublished theme).",
      ),
    color_replacements: z
      .record(z.string())
      .optional()
      .describe(
        'Optional map of hex colors to replace, e.g. {"#2c4a3a": "#334FB4"}. Applied to text files only.',
      ),
    text_replacements: z
      .record(z.string())
      .optional()
      .describe(
        'Generic text find/replace map applied to ALL text files (liquid, json, css, js, svg). Use for brand swap: {"Kron Watches": "Matignon", "kronwatches.co.uk": "matignonwatch.com", "hello@kronwatches.co.uk": "hello@matignonwatch.com"}. CASE-SENSITIVE. Order matters — longer keys applied first internally to avoid partial matches.',
      ),
    entity_remap: z
      .object({
        types: z
          .array(z.enum(["products", "collections", "pages", "menus"]))
          .default(["products", "collections", "pages", "menus"]),
      })
      .optional()
      .describe(
        "G8 fix: auto-resolve source entity GIDs → target equivalents by matching handles. CRITICAL when JSON theme templates (templates/index.json, settings_data.json) reference specific product/collection IDs that differ between shops. Set to {} (empty object) to enable with all entity types. Skip if templates use handles only or both shops share GIDs.",
      ),
    exclude_filenames: z
      .array(z.string())
      .optional()
      .describe("Filenames to skip (e.g. theme assets you don't want to overwrite)."),
    include_only: z
      .array(z.string())
      .optional()
      .describe(
        "Optional whitelist — if provided, only these filenames are cloned (rest skipped).",
      ),
    batch_size: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Files per themeFilesUpsert mutation. Default 10."),
    skip_binary: z
      .boolean()
      .default(true)
      .describe(
        "Skip binary files (images, fonts). Binary files require stagedUploadsCreate flow — set false only if your target theme already has matching binaries.",
      ),
  }),
  async handler({
    source_shop,
    source_theme_id,
    target_shop,
    target_theme_id,
    color_replacements,
    text_replacements,
    entity_remap,
    exclude_filenames,
    include_only,
    batch_size,
    skip_binary,
  }) {
    const sourceResolved = resolveShop(source_shop);
    const targetResolved = resolveShop(target_shop);
    const startedAt = Date.now();

    // ─── 0. Build entity remap if requested ─────────────────────
    let resolvedEntityRemap: Record<string, string> = {};
    if (entity_remap) {
      resolvedEntityRemap = await buildEntityRemap(
        sourceResolved,
        targetResolved,
        entity_remap.types ?? ["products", "collections", "pages", "menus"],
      );
    }

    const excludeSet = new Set(exclude_filenames ?? []);
    const includeSet = include_only ? new Set(include_only) : null;

    // ─── 1. List all files in source theme ──────────────────────
    type FileNode = { filename: string; size: string };
    type ListResp = {
      data?: {
        theme: {
          files: {
            nodes: FileNode[];
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
          };
        } | null;
      };
      errors?: unknown;
    };

    const allFiles: FileNode[] = [];
    let cursor: string | null = null;
    const LIST_PAGE = 250;

    while (true) {
      const listQuery = `query($themeId: ID!, $first: Int!, $after: String) {
        theme(id: $themeId) {
          files(first: $first, after: $after) {
            nodes { filename size }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`;
      const listResp: ListResp = await runGraphQL(sourceResolved, listQuery, {
        themeId: source_theme_id,
        first: LIST_PAGE,
        after: cursor,
      }) as ListResp;
      if (listResp.errors) {
        throw new Error(
          `Failed to list source theme files: ${JSON.stringify(listResp.errors)}`,
        );
      }
      const fileNodes = listResp.data?.theme?.files;
      if (!fileNodes) {
        throw new Error("Source theme not found or no files returned.");
      }
      allFiles.push(...fileNodes.nodes);
      if (!fileNodes.pageInfo.hasNextPage) break;
      cursor = fileNodes.pageInfo.endCursor;
    }

    // Filter
    const filtered = allFiles.filter((f) => {
      if (excludeSet.has(f.filename)) return false;
      if (includeSet && !includeSet.has(f.filename)) return false;
      if (skip_binary && !isTextFile(f.filename)) return false;
      return true;
    });

    // ─── 2. Pull file contents in batches ──────────────────────
    const contentByFilename = new Map<string, string>();
    const binarySkipped: string[] = [];
    const pullErrors: { filename: string; error: string }[] = [];

    const PULL_BATCH = 5;
    for (let i = 0; i < filtered.length; i += PULL_BATCH) {
      const slice = filtered.slice(i, i + PULL_BATCH);
      const filenamesArg = slice.map((f) => `"${f.filename}"`).join(",");
      const pullQuery: string = `query($themeId: ID!) {
        theme(id: $themeId) {
          files(filenames: [${filenamesArg}], first: ${slice.length}) {
            nodes {
              filename
              body {
                ... on OnlineStoreThemeFileBodyText { content }
                ... on OnlineStoreThemeFileBodyBase64 { contentBase64 }
                ... on OnlineStoreThemeFileBodyUrl { url }
              }
            }
          }
        }
      }`;
      const pullResp = await runGraphQL<{
        theme: { files: { nodes: Array<{ filename: string; body: { content?: string; contentBase64?: string; url?: string } }> } };
      }>(sourceResolved, pullQuery, { themeId: source_theme_id });

      if (pullResp.errors) {
        for (const f of slice) {
          pullErrors.push({
            filename: f.filename,
            error: JSON.stringify(pullResp.errors).slice(0, 200),
          });
        }
        continue;
      }

      for (const node of pullResp.data?.theme?.files?.nodes ?? []) {
        if (node.body.content !== undefined) {
          contentByFilename.set(node.filename, node.body.content);
        } else if (node.body.contentBase64 !== undefined) {
          // base64 — push as is, target accepts it
          contentByFilename.set(node.filename, `__BASE64__${node.body.contentBase64}`);
        } else if (node.body.url) {
          binarySkipped.push(node.filename);
        }
      }
      // Polite delay between batches
      await new Promise((r) => setTimeout(r, 100));
    }

    // ─── 3. Apply color + text replacements + entity remap ──────────────────────
    let totalColorReplacements = 0;
    let totalTextReplacements = 0;
    let totalEntityRemaps = 0;
    if (color_replacements || text_replacements || Object.keys(resolvedEntityRemap).length > 0) {
      for (const [filename, content] of contentByFilename.entries()) {
        if (content.startsWith("__BASE64__")) continue; // skip base64 files
        if (!isTextFile(filename)) continue;
        let current = content;
        if (color_replacements) {
          const { content: c, count } = applyReplacements(current, color_replacements);
          current = c;
          totalColorReplacements += count;
        }
        if (text_replacements) {
          const { content: c, count } = applyReplacements(current, text_replacements);
          current = c;
          totalTextReplacements += count;
        }
        if (Object.keys(resolvedEntityRemap).length > 0) {
          const { content: c, count } = applyEntityRemap(current, resolvedEntityRemap);
          current = c;
          totalEntityRemaps += count;
        }
        if (current !== content) {
          contentByFilename.set(filename, current);
        }
      }
    }

    // ─── 4. Push files to target theme via themeFilesUpsert ──────────────────────
    const pushedFiles: string[] = [];
    const pushErrors: { filename: string; code: string; message: string }[] = [];

    const allEntries = Array.from(contentByFilename.entries());
    for (let i = 0; i < allEntries.length; i += batch_size) {
      const batch = allEntries.slice(i, i + batch_size);
      const filesInput = batch.map(([filename, content]) => {
        if (content.startsWith("__BASE64__")) {
          return {
            filename,
            body: { type: "BASE64", value: content.slice("__BASE64__".length) },
          };
        }
        return { filename, body: { type: "TEXT", value: content } };
      });

      const upsertMutation: string = `mutation($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          upsertedThemeFiles { filename }
          userErrors { filename code message }
        }
      }`;

      const upsertResp = await runGraphQL<{
        themeFilesUpsert: {
          upsertedThemeFiles: Array<{ filename: string }>;
          userErrors: Array<{ filename: string; code: string; message: string }>;
        };
      }>(targetResolved, upsertMutation, {
        themeId: target_theme_id,
        files: filesInput,
      });

      if (upsertResp.errors) {
        for (const f of batch) {
          pushErrors.push({
            filename: f[0],
            code: "GQL_ERROR",
            message: JSON.stringify(upsertResp.errors).slice(0, 200),
          });
        }
        continue;
      }

      const result = upsertResp.data?.themeFilesUpsert;
      if (result) {
        for (const f of result.upsertedThemeFiles) pushedFiles.push(f.filename);
        for (const e of result.userErrors) pushErrors.push(e);
      }
      // Polite delay
      await new Promise((r) => setTimeout(r, 200));
    }

    return {
      summary: {
        source_shop,
        source_theme_id,
        target_shop,
        target_theme_id,
        total_files_in_source: allFiles.length,
        files_filtered_for_clone: filtered.length,
        files_pulled: contentByFilename.size,
        files_pushed: pushedFiles.length,
        push_errors: pushErrors.length,
        binary_skipped: binarySkipped.length,
        color_replacements_applied: totalColorReplacements,
        text_replacements_applied: totalTextReplacements,
        entity_remaps_applied: totalEntityRemaps,
        entity_remap_size: Object.keys(resolvedEntityRemap).length,
        duration_ms: Date.now() - startedAt,
      },
      pushed_files: pushedFiles,
      push_errors: pushErrors,
      binary_skipped_files: binarySkipped,
      pull_errors: pullErrors,
    };
  },
};
