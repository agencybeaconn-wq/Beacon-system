#!/usr/bin/env node
// Re-detects file type by content sniffing and renames code blocks accordingly.
import fs from 'node:fs';
import path from 'node:path';

const DIR = '/Users/joaovithorbauer/Documents/Projetos Lever/Lever System/clients/monte-royal/code-blocks';

function detect(content) {
  const head = content.slice(0, 300);
  if (/^\s*--\s.*\n.*ALTER\s+TABLE|CREATE\s+TABLE|INSERT\s+INTO/im.test(content)) return 'sql';
  if (/^\s*<!DOCTYPE\s+html|<html|<\?xml/i.test(head)) return 'html';
  if (/^\s*\{[\s\S]*"sections"|"settings":\s*\{|"type":\s*"\w+"/m.test(head) && content.trim().startsWith('{')) return 'json';
  if (/^\s*\{\%\s|\{\{\s.*\}\}/m.test(content) && /<[a-z]+[\s>]/i.test(content)) return 'liquid';
  if (/^\s*(import|export|const|let|function|async)\s/m.test(head) && /\.mjs|from\s+['"]/.test(content)) return 'mjs';
  if (/^\s*(import|export|const|let|function|async)\s/m.test(head)) return 'js';
  if (/^#\s|^##\s/m.test(head) && /\*\*|##\s/.test(content)) return 'md';
  if (/^\s*(SELECT|UPDATE|DELETE|INSERT|CREATE|ALTER)\s/im.test(head)) return 'sql';
  if (/^\s*#!\/.*sh|^\s*(curl|grep|cd|ls|node)\s/m.test(head)) return 'sh';
  return 'txt';
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.txt'));
let renamed = 0;
const summary = { mjs: 0, js: 0, json: 0, html: 0, liquid: 0, md: 0, sql: 0, sh: 0, txt: 0 };

for (const f of files) {
  const fp = path.join(DIR, f);
  const content = fs.readFileSync(fp, 'utf8');
  const ext = detect(content);
  summary[ext] = (summary[ext] || 0) + 1;
  if (ext !== 'txt') {
    const newName = f.replace(/_txt\.txt$/, `_${ext}.${ext}`);
    if (newName !== f) {
      fs.renameSync(fp, path.join(DIR, newName));
      renamed++;
    }
  }
}

console.log(`Renamed ${renamed} files`);
console.log('Summary:', summary);
