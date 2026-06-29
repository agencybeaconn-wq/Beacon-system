import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = resolve(__dirname, '../../runs');

let currentRunDir: string | null = null;
let stepCounter = 0;

// Buffer de eventos do run — o worker drena pra onboarding_jobs.logs (observabilidade
// via Claude Code). info/warn/err/snap registram aqui, além do console.
export type LogEntry = { ts: string; level: 'info' | 'warn' | 'err' | 'snap'; msg: string; screenshot?: string };
let logBuffer: LogEntry[] = [];

function record(level: LogEntry['level'], msg: string, screenshot?: string) {
  logBuffer.push({ ts: new Date().toISOString(), level, msg, ...(screenshot ? { screenshot } : {}) });
}

/** Retorna os eventos acumulados e limpa o buffer (chamado pelo worker pra persistir no job). */
export function drainLogs(): LogEntry[] {
  const b = logBuffer;
  logBuffer = [];
  return b;
}

export function startRun(label: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  currentRunDir = resolve(RUNS_DIR, `${ts}_${label}`);
  mkdirSync(currentRunDir, { recursive: true });
  stepCounter = 0;
  logBuffer = [];
  console.log(`[run] ${currentRunDir}`);
  return currentRunDir;
}

export function getRunDir(): string {
  if (!currentRunDir) throw new Error('startRun() not called');
  return currentRunDir;
}

export async function snap(page: Page, label: string): Promise<string> {
  if (!currentRunDir) return '';
  stepCounter += 1;
  const file = resolve(currentRunDir, `${String(stepCounter).padStart(2, '0')}_${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  [snap] ${file}`);
  record('snap', label, file);
  return file;
}

export function info(msg: string) {
  console.log(`[info] ${msg}`);
  record('info', msg);
}

export function warn(msg: string) {
  console.warn(`[warn] ${msg}`);
  record('warn', msg);
}

export function err(msg: string) {
  console.error(`[err]  ${msg}`);
  record('err', msg);
}
