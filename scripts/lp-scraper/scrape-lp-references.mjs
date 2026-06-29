#!/usr/bin/env node
/**
 * Lever LP Reference Scraper
 *
 * Para cada URL em urls.json, gera em
 * lever/src/features/landing-system/_references/<categoria>/<slug>/:
 *
 *   - screenshot-desktop.png  (1440×900, full page)
 *   - screenshot-mobile.png   (375×812, full page)
 *   - structure.md            (outline humano: headings, CTAs, seções)
 *   - content.md              (HTML→Markdown via Turndown, navegável)
 *   - meta.json               (URL, fonts, paleta, scrapedAt, errors)
 *
 * Tolera falhas individuais — uma URL travada não derruba o batch.
 *
 * Uso:
 *   npm run install:browsers   # primeira vez
 *   npm run scrape             # roda em cima de urls.json
 */
import { chromium } from "playwright";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "urls.json");
const REFS_ROOT = resolve(
  __dirname,
  "../../src/features/landing-system/_references",
);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const NAV_TIMEOUT = 45_000;
const SETTLE_MS = 1_500;

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
turndown.remove(["script", "style", "noscript", "iframe"]);

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const { category, urls } = config;
  if (!category || !Array.isArray(urls)) {
    throw new Error("urls.json precisa ter { category, urls[] }");
  }
  const outRoot = resolve(REFS_ROOT, category);
  await mkdir(outRoot, { recursive: true });

  console.log(`\n📥 Scraping ${urls.length} URLs → ${category}\n`);

  const browser = await chromium.launch({ headless: true });
  const report = [];

  for (const entry of urls) {
    const t0 = Date.now();
    const dest = resolve(outRoot, entry.slug);
    await mkdir(dest, { recursive: true });
    const result = { ...entry, ok: false, ms: 0, errors: [] };

    try {
      console.log(`→ ${entry.slug.padEnd(18)} ${entry.url}`);
      await scrapeOne(browser, entry, dest, result);
      result.ok = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(msg);
      console.log(`  ✗ falhou: ${msg.slice(0, 120)}`);
    }
    result.ms = Date.now() - t0;
    report.push(result);
    console.log(`  ✓ ${(result.ms / 1000).toFixed(1)}s\n`);
  }

  await browser.close();

  const ok = report.filter((r) => r.ok).length;
  const fail = report.length - ok;
  console.log(`\n📊 Resumo: ${ok} ok · ${fail} falhou\n`);
  await writeFile(
    resolve(outRoot, "_scrape-report.json"),
    JSON.stringify({ scrapedAt: new Date().toISOString(), report }, null, 2),
  );
  if (fail > 0) process.exitCode = 1;
}

async function scrapeOne(browser, entry, dest, result) {
  const ctx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const page = await ctx.newPage();

  // Desktop pass
  await page.goto(entry.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await page.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT }).catch(() => {});
  await autoScroll(page);
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: resolve(dest, "screenshot-desktop.png"), fullPage: true });

  const html = await page.content();
  const visualMeta = await extractVisualMeta(page);

  // Mobile pass
  await ctx.close();
  const mobileCtx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "pt-BR",
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(entry.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await mobilePage
    .waitForLoadState("networkidle", { timeout: NAV_TIMEOUT })
    .catch(() => {});
  await autoScroll(mobilePage);
  await mobilePage.waitForTimeout(SETTLE_MS);
  await mobilePage.screenshot({ path: resolve(dest, "screenshot-mobile.png"), fullPage: true });
  await mobileCtx.close();

  // Parse e gera artefatos
  const $ = cheerio.load(html);
  const structure = buildStructure($, entry);
  const content = buildContent($);
  const meta = {
    slug: entry.slug,
    url: entry.url,
    scrapedAt: new Date().toISOString(),
    title: $("title").text().trim(),
    description: $('meta[name="description"]').attr("content")?.trim() ?? "",
    ogImage: $('meta[property="og:image"]').attr("content")?.trim() ?? "",
    headings: structure.headingCount,
    ctas: structure.ctas.length,
    visual: visualMeta,
  };

  await writeFile(resolve(dest, "structure.md"), structure.md);
  await writeFile(resolve(dest, "content.md"), content);
  await writeFile(resolve(dest, "meta.json"), JSON.stringify(meta, null, 2));
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((done) => {
      let y = 0;
      const step = 600;
      const tick = setInterval(() => {
        window.scrollBy(0, step);
        y += step;
        if (y >= document.body.scrollHeight) {
          clearInterval(tick);
          window.scrollTo(0, 0);
          done(null);
        }
      }, 120);
    });
  });
}

async function extractVisualMeta(page) {
  return page.evaluate(() => {
    const body = document.body;
    const cs = getComputedStyle(body);
    const fonts = new Set();
    document.querySelectorAll("h1, h2, h3, p, button, a").forEach((el) => {
      const f = getComputedStyle(el).fontFamily;
      if (f) fonts.add(f.split(",")[0].replace(/['"]/g, "").trim());
    });
    return {
      fontPrimary: cs.fontFamily.split(",")[0].replace(/['"]/g, "").trim(),
      fonts: Array.from(fonts).slice(0, 8),
      bg: cs.backgroundColor,
      fg: cs.color,
    };
  });
}

function buildStructure($, entry) {
  const h1 = $("h1").first().text().trim();
  const headings = [];
  $("h1, h2, h3").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) headings.push({ tag, text });
  });

  const ctas = [];
  $('a, button').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const href = $(el).attr("href") ?? "";
    if (!text || text.length > 60) return;
    const isCTA =
      /(comece|começar|cadastrar|cadastre|inscrever|inscreva|agendar|demo|trial|sign ?up|get started|book|try|criar conta|entrar|login)/i.test(
        text,
      ) ||
      ($(el).is("button") && text.length < 40) ||
      (href && /(signup|sign-up|register|cadastro|trial|demo|contact)/i.test(href));
    if (isCTA) ctas.push({ text, href });
  });

  const sections = [];
  $("section, [class*='section'], main > div").each((_, el) => {
    const heading = $(el).find("h1, h2").first().text().replace(/\s+/g, " ").trim();
    if (heading) sections.push(heading);
  });

  const md = [
    `# Estrutura — ${entry.slug}`,
    "",
    `**URL:** ${entry.url}`,
    `**H1:** ${h1 || "(não encontrado)"}`,
    "",
    `## Hierarquia de headings (${headings.length})`,
    "",
    ...headings.map((h) => `- **${h.tag}** ${h.text}`),
    "",
    `## Seções detectadas (${sections.length})`,
    "",
    ...sections.map((s, i) => `${i + 1}. ${s}`),
    "",
    `## CTAs identificadas (${ctas.length})`,
    "",
    ...ctas
      .filter((c, i, arr) => arr.findIndex((x) => x.text === c.text) === i)
      .slice(0, 20)
      .map((c) => `- "${c.text}" → \`${c.href}\``),
    "",
  ].join("\n");

  return { md, headingCount: headings.length, ctas };
}

function buildContent($) {
  $("script, style, noscript, iframe, svg").remove();
  const main = $("main").length ? $("main").html() : $("body").html();
  const md = turndown.turndown(main ?? "");
  return md.replace(/\n{3,}/g, "\n\n").trim();
}

main().catch((err) => {
  console.error("\n💥 Fatal:", err);
  process.exit(1);
});
