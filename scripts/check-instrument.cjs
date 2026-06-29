// Sanity check das functions instrumentadas: 1 instrument(), 1 import, termina em )).
const fs = require("fs");
const path = require("path");
const FN_DIR = path.join(__dirname, "..", "supabase", "functions");
const SKIP = new Set(["_shared", "system-alert-dispatcher", "resolve-system-log"]);

let problems = 0;
for (const d of fs.readdirSync(FN_DIR, { withFileTypes: true })) {
    if (!d.isDirectory() || SKIP.has(d.name)) continue;
    const file = path.join(FN_DIR, d.name, "index.ts");
    if (!fs.existsSync(file)) continue;
    const c = fs.readFileSync(file, "utf8");
    const instr = (c.match(/instrument\(/g) || []).length;
    const imp = (c.match(/import \{ instrument \}/g) || []).length;
    const trimmed = c.replace(/\s+$/, "");
    const endsOk = /\)\)\s*;?$/.test(trimmed);
    if (instr !== 1 || imp !== 1 || !endsOk) {
        problems++;
        console.log(`PROBLEMA ${d.name}: instrument=${instr} import=${imp} endsOk=${endsOk} | fim="${trimmed.slice(-40).replace(/\n/g, "\\n")}"`);
    }
}
console.log(problems === 0 ? "TODAS OK" : `${problems} com problema`);
