import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Page } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_ROOT = resolve(__dirname, '../../runs');

export class RunLogger {
  readonly dir: string;
  private logFile: string;
  private step = 0;

  constructor(label: string) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    this.dir = resolve(RUNS_ROOT, `${ts}_${label}`);
    mkdirSync(this.dir, { recursive: true });
    this.logFile = resolve(this.dir, 'run.log');
    writeFileSync(this.logFile, `# ${label}  ${ts}\n\n`);
  }

  info(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    appendFileSync(this.logFile, line);
    process.stdout.write(line);
  }

  warn(msg: string) {
    this.info(`WARN: ${msg}`);
  }

  async snap(page: Page, label: string) {
    this.step += 1;
    const file = `${String(this.step).padStart(2, '0')}_${label}.png`;
    await page.screenshot({ path: resolve(this.dir, file), fullPage: true });
    this.info(`screenshot: ${file}`);
  }

  saveJSON(name: string, data: unknown) {
    writeFileSync(resolve(this.dir, `${name}.json`), JSON.stringify(data, null, 2));
    this.info(`saved: ${name}.json`);
  }

  saveText(name: string, content: string) {
    writeFileSync(resolve(this.dir, name), content);
    this.info(`saved: ${name}`);
  }
}
