#!/usr/bin/env node
// curator-trigger-detect — UserPromptSubmit hook
// Lê prompt do Pedro, detecta gatilhos de obsidian/squad-knowledge,
// e injeta instrução pro Boss invocar obsidian-curator ANTES de escrever no vault.
//
// Gatilhos: frases tipo "sobe isso pro obsidian", "salva no obsidian",
// "registra no fiscal", "obsidian:", "comita no vault", "salva no Lever QI".
//
// Bypass: env CURATOR_OFF=1, frase "bypass curator", "sem fiscal"

import fs from 'fs';

if (process.env.CURATOR_OFF === '1') process.exit(0);

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let payload;
try { payload = JSON.parse(raw); } catch { process.exit(0); }

const prompt = (payload.prompt || payload.user_prompt || '').toLowerCase();
if (!prompt) process.exit(0);

// Bypass explícito
if (/bypass\s+curator|sem\s+fiscal|skip\s+obsidian/i.test(prompt)) process.exit(0);

// === Padrões-gatilho ===
// Verbo de ação + obsidian/vault/Lever QI/fiscal/pedro-dev
// Tolerância a typos (obsidin, obsidan, comit) + verbos curtos (fz, sv)
const ACTION_VERBS = '(sobe|sobir|subir|salva|salvar|salv|sv|registra|registrar|escreve|escrever|posta|postar|comita?r?|fz|faz|fazer|cria|criar|adiciona|adicionar|atualiza|atualizar|cataloga|catalogar|arquiva|arquivar|guarda|guardar|joga|jogar|coloca|colocar|documenta|documentar|anota|anotar|limpa|limpar|fixa|fixar|mete|meter|sobe(?!\\sbug))';
// "obsidi[ao]?n?\\w*" pega obsidian, obsidin, obsidiano, obsidiana, obsidi
const TARGETS = '(obsidi[ao]?n?\\w*|vault|lever\\s*qi|fiscal|curador?|colecionador?|pedro-dev|changelog|errors?-cookbook|playbook|knowledge\\s*base|kb)';

const re1 = new RegExp(`${ACTION_VERBS}[^.!?]{0,120}${TARGETS}`, 'i');
const re2 = new RegExp(`${TARGETS}[^.!?]{0,120}${ACTION_VERBS}`, 'i');
const reDirect = /^(obsidi\w*|fiscal|curator|colecionador?|curador?)\s*[:>]/i;
// Padrões curtos isolados que indicam intenção mesmo sem verbo+alvo claro
const reShort = /\b(obsidi\w+|comita\w*|comit\b)\b/i;

const triggered = re1.test(prompt) || re2.test(prompt) || reDirect.test(prompt) || reShort.test(prompt);

if (!triggered) process.exit(0);

// === Injetar context ===
// Stdout do UserPromptSubmit hook vira system-reminder pro Boss
const msg = `[curator-trigger] gatilho obsidian detectado no prompt do Pedro.

REGRA: ANTES de fazer Write/Edit em \`Lever QI/\`, invoque o agente obsidian-curator (subagent_type: "obsidian-curator") com o conteúdo proposto + path destino. Espere veredicto (PASS / SOFT-FLAG / HARD-FLAG) antes de aplicar.

Bypass:
- "bypass curator" / "sem fiscal" no prompt
- env CURATOR_OFF=1
- arquivo com frontmatter \`do_not_curate: true\`

Modo soft-flag ativo: Fiscal não bloqueia, mas warnings dele DEVEM ser anotados em \`07-team/05-pedro-dev/sub-agentes-pedro/obsidian-curator/curator-decisions-$(date).md\`.`;

console.log(msg);
process.exit(0);
