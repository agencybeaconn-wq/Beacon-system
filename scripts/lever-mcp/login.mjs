#!/usr/bin/env node
/**
 * login.mjs — autentica colaborador no Lever System (Supabase Auth) e salva
 * credentials em ~/.lever-mcp/credentials.json pra o MCP server usar.
 *
 * Uso (Wesley/Campanhã/Pedro fazem 1 vez):
 *   node lever/scripts/lever-mcp/login.mjs
 *
 * Pede email + senha (mesmos do Lever System web app).
 * Salva refresh_token (30 dias) + access_token (1h, renovado automático).
 * Wesley NUNCA precisa ver/colar service role key.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEVER_ROOT = resolve(__dirname, "../..");

// Read .env pra pegar URL + anon key
const env = {};
for (const f of [".env", ".env.local", ".env.clean"]) {
  try {
    const c = readFileSync(resolve(LEVER_ROOT, f), "utf8").replace(/\r/g, "");
    for (const l of c.split("\n")) {
      const i = l.indexOf("=");
      if (i < 1 || !/^[A-Z_][A-Z0-9_]*$/.test(l.slice(0, i))) continue;
      env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const SB_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SB_ANON = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SB_URL || !SB_ANON) {
  console.error("FATAL: .env do Lever precisa ter VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (ou PUBLISHABLE_KEY).");
  console.error("Esses não são secrets — pode pegar do .env.clean ou pedir pro João.");
  process.exit(1);
}

// Prompt interativo
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q, hidden = false) {
  return new Promise((res) => {
    if (hidden) {
      // Hide echo pra senha (Windows-friendly via stdout manip)
      const wasRaw = process.stdin.isRaw;
      process.stdout.write(q);
      let pwd = "";
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      const onData = (ch) => {
        ch = ch.toString();
        if (ch === "\r" || ch === "\n" || ch === "") {
          process.stdout.write("\n");
          process.stdin.setRawMode?.(wasRaw || false);
          process.stdin.pause();
          process.stdin.off("data", onData);
          res(pwd);
        } else if (ch === "") {
          process.exit(1);
        } else if (ch === "" || ch === "\b") {
          if (pwd.length > 0) {
            pwd = pwd.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          pwd += ch;
          process.stdout.write("*");
        }
      };
      process.stdin.on("data", onData);
    } else {
      rl.question(q, (a) => res(a.trim()));
    }
  });
}

console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log("║         Lever System MCP — Login do Colaborador          ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");
console.log("Use os mesmos email + senha do Lever System web app.");
console.log("Se ainda não tem conta, peça pro João/Matheus criar.\n");

const email = await ask("Email: ");
const password = await ask("Senha: ", true);
rl.close();

console.log("\n→ Autenticando...");

const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: SB_ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

if (!r.ok) {
  const err = await r.text();
  console.error(`\n❌ Login falhou (${r.status}): ${err}\n`);
  if (err.includes("Invalid login")) {
    console.error("Verifica email/senha. Se esqueceu senha, recupera no web app.");
  } else if (err.includes("Email not confirmed")) {
    console.error("Email não confirmado. Verifica caixa de entrada ou pede pro João reenviar.");
  }
  process.exit(1);
}

const data = await r.json();
const credentials = {
  access_token: data.access_token,
  refresh_token: data.refresh_token,
  expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  user: { id: data.user?.id, email: data.user?.email, role: data.user?.user_metadata?.role },
};

const credsPath = resolve(homedir(), ".lever-mcp", "credentials.json");
mkdirSync(dirname(credsPath), { recursive: true });
writeFileSync(credsPath, JSON.stringify(credentials, null, 2));

console.log("\n✅ Login OK!\n");
console.log(`   Usuário: ${data.user?.email}`);
console.log(`   User ID: ${data.user?.id}`);
console.log(`   Credentials salvas em: ${credsPath}`);
console.log(`   Refresh token válido por ~30 dias\n`);
console.log("Pronto. O MCP `lever-system` já pode usar essas credenciais.");
console.log("Reinicia o Claude Code pra carregar.\n");
console.log("Pra rotacionar token (ex: trocou senha): rodar `login.mjs` de novo.\n");
