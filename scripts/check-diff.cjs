// Verifica 1 a 1: a unica diferenca de cada function vs git HEAD e o embrulho
// instrument (import + serve( + ) no fim). Qualquer outra mudanca = FLAG.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const FN_DIR = path.join(ROOT, "supabase", "functions");
const SKIP = new Set(["_shared", "system-alert-dispatcher", "resolve-system-log", "system-watchdog"]);
const IMPORT = 'import { instrument } from "../_shared/logger.ts";';
const norm = (s) => s.replace(/\s/g, "");

let checked = 0, flagged = 0;
for (const d of fs.readdirSync(FN_DIR, { withFileTypes: true })) {
    if (!d.isDirectory() || SKIP.has(d.name)) continue;
    const file = path.join(FN_DIR, d.name, "index.ts");
    if (!fs.existsSync(file)) continue;
    const cur = fs.readFileSync(file, "utf8");
    if (!cur.includes("_shared/logger.ts")) continue; // nao instrumentada
    checked++;

    const rel = `supabase/functions/${d.name}/index.ts`;
    let diff;
    try {
        diff = execSync(`git diff HEAD -- "${rel}"`, { cwd: ROOT, encoding: "utf8" });
    } catch {
        console.log(`FLAG ${d.name}: erro no git diff`);
        flagged++;
        continue;
    }

    const removed = [], added = [];
    for (const line of diff.split("\n")) {
        if (line.startsWith("+") && !line.startsWith("+++")) added.push(line.slice(1));
        else if (line.startsWith("-") && !line.startsWith("---")) removed.push(line.slice(1));
    }

    const hasImport = added.some((l) => l.trim() === IMPORT);
    const addedNoImport = added.filter((l) => l.trim() !== IMPORT).join("\n");
    // Esperado = removidas com instrument inserido no serve( e um ) inserido ANTES
    // do ultimo ) (exatamente o que o transform fez — preserva ; ou } finais).
    let expected = removed.join("\n").replace(/((?:Deno\.)?serve)\(/, `$1(instrument(${JSON.stringify(d.name)}, `);
    const li = expected.lastIndexOf(")");
    if (li !== -1) expected = expected.slice(0, li) + ")" + expected.slice(li);

    if (!hasImport || norm(expected) !== norm(addedNoImport)) {
        flagged++;
        console.log(`FLAG ${d.name}: removed=${removed.length} added=${added.length} hasImport=${hasImport}`);
    }
}
console.log(`\nChecadas: ${checked} | Limpas: ${checked - flagged} | FLAG: ${flagged}`);
