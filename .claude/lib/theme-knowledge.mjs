// theme-knowledge.mjs — parser do themes/KNOWLEDGE_BASE.md
//
// Transforma o markdown em estrutura consultável: cada tópico tem
// nome, termos naturais, arquivos-chave, settings, bugs comuns.
//
// Uso:
//   import { loadKnowledge, findTopic, listTopics } from '../../lib/theme-knowledge.mjs';
//   const kb = await loadKnowledge();
//   const topic = findTopic(kb, "o preço não aparece no produto");
//   console.log(topic.name, topic.files);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_PATH = path.resolve(__dirname, '../../themes/KNOWLEDGE_BASE.md');

/**
 * Parse do KNOWLEDGE_BASE.md em array de tópicos estruturados.
 * @returns {Promise<Array<{name, number, terms, files, settings, commonBugs, rawMd}>>}
 */
export async function loadKnowledge() {
  const content = fs.readFileSync(KNOWLEDGE_PATH, 'utf8');

  // Cada tópico começa com "## N. Nome"
  const topicRegex = /^## (\d+)\.\s+(.+?)$/gm;
  const topics = [];
  const matches = [];

  let m;
  while ((m = topicRegex.exec(content)) !== null) {
    matches.push({ number: parseInt(m[1]), name: m[2].trim(), start: m.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].start;
    const end = i + 1 < matches.length ? matches[i + 1].start : content.length;
    const section = content.slice(start, end);
    const topic = parseTopic(matches[i], section);
    topics.push(topic);
  }

  return topics;
}

/**
 * Parse de uma seção individual do markdown pra estrutura.
 */
function parseTopic({ number, name, start }, section) {
  const terms = extractListUnder(section, '**Termos naturais:**');
  const files = extractListUnder(section, '**Arquivos-chave:**').map(cleanFilePath);
  const settings = extractSettingsBlock(section);
  const commonBugs = extractListUnder(section, '**Bugs comuns:**');

  return {
    number,
    name,
    terms,
    files,
    settings,
    commonBugs,
    rawMd: section,
  };
}

/**
 * Extrai lista de bullets após um header. Ex:
 *   **Termos naturais:**
 *   - "o preço"
 *   - "valor errado"
 */
function extractListUnder(section, header) {
  const headerIdx = section.indexOf(header);
  if (headerIdx === -1) return [];
  const rest = section.slice(headerIdx + header.length);
  // Pega bullets até próximo header em negrito ou fim
  const lines = rest.split('\n');
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      // Remove aspas e crases
      let item = trimmed.slice(2).trim();
      item = item.replace(/^["'`]|["'`]$/g, '');
      // Remove bold markers
      item = item.replace(/\*\*/g, '');
      if (item) out.push(item);
    } else if (trimmed.startsWith('**') && trimmed.endsWith(':**')) {
      // próximo header
      break;
    } else if (trimmed.startsWith('## ') || trimmed.startsWith('---')) {
      break;
    }
  }
  return out;
}

/**
 * Extrai settings (linhas após "**Settings:**" ou "Settings relacionados:")
 */
function extractSettingsBlock(section) {
  const patterns = ['**Settings:**', '**Settings relacionados:**'];
  for (const p of patterns) {
    const items = extractListUnder(section, p);
    if (items.length) return items;
  }
  return [];
}

/**
 * Remove backticks e aspas de paths.
 */
function cleanFilePath(s) {
  return s.replace(/`/g, '').replace(/\s*—.*$/, '').trim();
}

/**
 * Busca fuzzy: encontra o tópico mais relevante pra uma query em linguagem natural.
 *
 * Estratégia: pra cada tópico, conta quantos termos naturais têm overlap (words) com a query.
 * Retorna os top N matches ordenados por score.
 *
 * @param {Array} topics - retornado por loadKnowledge()
 * @param {string} query - fala do user (ex: "o preço não aparece")
 * @param {number} topN - quantos retornar (default 3)
 * @returns {Array<{topic, score, matchedTerms}>}
 */
export function findTopic(topics, query, topN = 3) {
  const queryWords = normalize(query).split(/\s+/).filter(w => w.length > 2);
  if (!queryWords.length) return [];

  const scored = topics.map(topic => {
    const allTerms = [topic.name, ...topic.terms].map(normalize);
    let score = 0;
    const matchedTerms = [];

    for (const term of allTerms) {
      const termWords = term.split(/\s+/).filter(w => w.length > 2);
      if (!termWords.length) continue;
      // Contagem de palavras em comum
      const common = queryWords.filter(w => termWords.includes(w)).length;
      if (common > 0) {
        // Bonus se o termo inteiro aparece na query
        const fullMatchBonus = query.toLowerCase().includes(term) ? 5 : 0;
        score += common + fullMatchBonus;
        matchedTerms.push(term);
      }
    }

    return { topic, score, matchedTerms };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Lista todos os tópicos (só metadata, sem raw markdown).
 */
export function listTopics(topics) {
  return topics.map(t => ({
    number: t.number,
    name: t.name,
    fileCount: t.files.length,
    termCount: t.terms.length,
  }));
}

/**
 * Normaliza string: lowercase + remove acentos + remove pontuação.
 */
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Se chamado como CLI: node theme-knowledge.mjs "sua query"
import { fileURLToPath as _fileURLToPath } from 'url';
import { realpathSync as _realpathSync } from 'fs';
const _isMainKB = process.argv[1] && (() => {
  try {
    return _realpathSync(_fileURLToPath(import.meta.url)) === _realpathSync(process.argv[1]);
  } catch { return false; }
})();
if (_isMainKB) {
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.log('Uso: node theme-knowledge.mjs "sua descrição do problema"');
    console.log('\nTópicos disponíveis:');
    loadKnowledge().then(topics => {
      listTopics(topics).forEach(t => console.log(`  ${t.number}. ${t.name} (${t.fileCount} arquivos)`));
    });
  } else {
    loadKnowledge().then(topics => {
      const matches = findTopic(topics, query, 3);
      if (!matches.length) {
        console.log(`\nNenhum tópico encontrado pra "${query}".`);
        console.log('Tente usar palavras mais específicas ou ver todos com: node theme-knowledge.mjs');
        return;
      }
      console.log(`\n=== Top ${matches.length} matches para "${query}" ===`);
      matches.forEach(({ topic, score, matchedTerms }, idx) => {
        console.log(`\n${idx + 1}. [score ${score}] ${topic.name}`);
        console.log(`   Termos que bateram: ${matchedTerms.slice(0, 3).join(' | ')}`);
        console.log(`   Arquivos:`);
        topic.files.slice(0, 5).forEach(f => console.log(`     - ${f}`));
        if (topic.settings.length) {
          console.log(`   Settings: ${topic.settings.slice(0, 3).join(', ')}`);
        }
      });
    });
  }
}
