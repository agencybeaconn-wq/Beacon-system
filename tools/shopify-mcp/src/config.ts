import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const ShopConfigSchema = z.object({
  label: z.string().min(1),
  domain: z
    .string()
    .regex(/^[a-z0-9-]+\.myshopify\.com$/i, "domain must be <handle>.myshopify.com"),
  tokenEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/, "tokenEnv must be UPPER_SNAKE_CASE"),
  apiVersion: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

const ConfigSchema = z.object({
  $schema: z.string().optional(),
  defaults: z
    .object({
      apiVersion: z.string().regex(/^\d{4}-\d{2}$/),
    })
    .default({ apiVersion: "2025-01" }),
  shops: z.record(
    z.string().regex(/^[a-z][a-z0-9-]*$/, "alias must be kebab-case"),
    ShopConfigSchema,
  ),
});

export type ShopConfig = z.infer<typeof ShopConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export type ResolvedShop = ShopConfig & {
  alias: string;
  apiVersion: string;
  accessToken: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));

function findConfigPath(): string {
  // Priority: SHOPIFY_MCP_CONFIG env var -> shops.json next to dist/ -> shops.json in cwd
  const fromEnv = process.env.SHOPIFY_MCP_CONFIG;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const nextToBin = resolve(__dirname, "..", "shops.json");
  if (existsSync(nextToBin)) return nextToBin;

  const inCwd = resolve(process.cwd(), "shops.json");
  if (existsSync(inCwd)) return inCwd;

  throw new Error(
    `shops.json not found. Tried: ${[fromEnv, nextToBin, inCwd].filter(Boolean).join(", ")}. ` +
      `Copy shops.example.json to shops.json and set SHOPIFY_<ALIAS>_TOKEN env vars.`,
  );
}

let cached: { path: string; config: Config } | null = null;

export function loadConfig(): Config {
  if (cached) return cached.config;
  const path = findConfigPath();
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid ${path}:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  cached = { path, config: parsed.data };
  return parsed.data;
}

export function listShopAliases(): string[] {
  return Object.keys(loadConfig().shops);
}

export function resolveShop(alias: string): ResolvedShop {
  const config = loadConfig();
  const shop = config.shops[alias];
  if (!shop) {
    throw new Error(
      `Unknown shop alias "${alias}". Available: ${listShopAliases().join(", ")}`,
    );
  }
  const token = process.env[shop.tokenEnv];
  if (!token) {
    throw new Error(
      `Missing env var ${shop.tokenEnv} for shop "${alias}". ` +
        `Set it to the Admin API access token from your Shopify custom app.`,
    );
  }
  return {
    ...shop,
    alias,
    apiVersion: shop.apiVersion ?? config.defaults.apiVersion,
    accessToken: token,
  };
}
