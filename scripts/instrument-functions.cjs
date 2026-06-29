// Instrumenta edge functions: envolve o handler do serve com instrument(name, ...)
// e adiciona o import do logger. Robusto: nao parseia o corpo — insere logo apos
// o "serve(" e um ")" antes do ultimo ")" do arquivo (sempre o fechamento do serve).
// Idempotente: pula arquivos que ja tem o logger. Uso: node instrument-functions.cjs <fn> [<fn> ...]
const fs = require("fs");
const path = require("path");

const FN_DIR = path.join(__dirname, "..", "supabase", "functions");
const IMPORT_LINE = 'import { instrument } from "../_shared/logger.ts";';
// Minhas functions (nao instrumentar): dispatcher e resolve.
const SKIP = new Set(["_shared", "system-alert-dispatcher", "resolve-system-log"]);
let names = process.argv.slice(2);
if (names.length === 1 && names[0] === "ALL") {
    names = fs
        .readdirSync(FN_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !SKIP.has(d.name))
        .map((d) => d.name);
}

function processFn(name) {
    const file = path.join(FN_DIR, name, "index.ts");
    if (!fs.existsSync(file)) return `${name}: SKIP (sem index.ts)`;
    let c = fs.readFileSync(file, "utf8");
    if (c.includes("_shared/logger.ts") || c.includes("instrument(")) return `${name}: SKIP (ja instrumentada)`;

    // 1. Achar a abertura do serve.
    let serveTokenIdx;
    let insertPos; // posicao logo apos o "(" do serve
    const denoIdx = c.indexOf("Deno.serve(");
    if (denoIdx !== -1) {
        serveTokenIdx = denoIdx;
        insertPos = denoIdx + "Deno.serve(".length;
    } else {
        const m = c.match(/(^|[^\w.])serve\(/m);
        if (!m) return `${name}: ERRO (nenhum serve() encontrado)`;
        const matchIdx = c.indexOf(m[0]);
        const prefixLen = m[1] ? m[1].length : 0;
        serveTokenIdx = matchIdx + prefixLen;
        insertPos = serveTokenIdx + "serve(".length;
    }

    // 2. Ultimo ")" do arquivo = fechamento do serve.
    const lastParen = c.lastIndexOf(")");
    if (lastParen === -1 || lastParen < insertPos) return `${name}: ERRO (fechamento nao localizado)`;

    // 3. Posicao do import (antes do primeiro import existente).
    const fm = c.match(/^import .*$/m);
    const importPos = fm ? fm.index : c.lastIndexOf("\n", serveTokenIdx) + 1;

    // 4. Aplicar inserts do maior indice pro menor (preserva posicoes).
    const wrapName = JSON.stringify(name);
    c = c.slice(0, lastParen) + ")" + c.slice(lastParen);
    c = c.slice(0, insertPos) + `instrument(${wrapName}, ` + c.slice(insertPos);
    c = c.slice(0, importPos) + IMPORT_LINE + "\n" + c.slice(importPos);

    fs.writeFileSync(file, c, "utf8");
    return `${name}: OK`;
}

for (const n of names) console.log(processFn(n));
