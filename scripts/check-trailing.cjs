// Acha functions instrumentadas com codigo top-level DEPOIS do serve — caso onde
// o transform simples (insere ) antes do ultimo )) pode ter colocado errado.
const fs = require("fs");
const path = require("path");
const FN_DIR = path.join(__dirname, "..", "supabase", "functions");
const SKIP = new Set(["_shared", "system-alert-dispatcher", "resolve-system-log"]);
const TOP = /^(async function |function |const |let |var |export |interface |type |class )/;

let flagged = 0;
for (const d of fs.readdirSync(FN_DIR, { withFileTypes: true })) {
    if (!d.isDirectory() || SKIP.has(d.name)) continue;
    const file = path.join(FN_DIR, d.name, "index.ts");
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    const serveLine = lines.findIndex((l) => /serve\(instrument\(/.test(l));
    if (serveLine === -1) continue; // nao instrumentada
    const after = lines.slice(serveLine + 1).filter((l) => TOP.test(l));
    if (after.length > 0) {
        flagged++;
        console.log(`${d.name}: ${after.length} decl(s) top-level apos serve (linha ${serveLine + 1})`);
    }
}
console.log(flagged === 0 ? "NENHUMA com codigo apos serve" : `${flagged} pra revisar`);
