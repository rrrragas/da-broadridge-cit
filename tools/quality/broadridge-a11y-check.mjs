#!/usr/bin/env node
/**
 * a11y-check — axe-core (WCAG 2.1 A/AA) via Playwright (docs/broadridge-EDS-RULES.md §7).
 * Usage: node tools/quality/broadridge-a11y-check.mjs [url ...]   (defaults to http://localhost:3000/)
 * Fails on any violation. Requires dev deps: playwright + @axe-core/playwright.
 */
import process from 'node:process';

let chromium;
let AxeBuilder;
try {
  ({ chromium } = await import('playwright'));
  ({ default: AxeBuilder } = await import('@axe-core/playwright'));
} catch {
  console.error('broadridge:test:a11y needs dev deps. Run:');
  console.error('  npm i -D playwright @axe-core/playwright && npx playwright install chromium');
  process.exit(1);
}

const urls = process.argv.slice(2);
if (!urls.length) urls.push('http://localhost:3000/');

const browser = await chromium.launch();
let total = 0;

for (const url of urls) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    if (!violations.length) {
      console.log(`✓ ${url} — no a11y violations`);
    } else {
      console.error(`✘ ${url} — ${violations.length} violation type(s):`);
      for (const v of violations) {
        console.error(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
        console.error(`     ${v.helpUrl}`);
      }
      total += violations.length;
    }
  } catch (err) {
    console.error(`✘ ${url} — could not audit: ${err.message}`);
    total += 1;
  } finally {
    await page.close();
  }
}

await browser.close();
if (total) {
  console.error(`\n✘ a11y-check: ${total} issue(s). See docs/broadridge-EDS-RULES.md §7.\n`);
  process.exit(1);
}
console.log('✓ a11y-check: all pages pass WCAG 2.1 A/AA (axe-core)');
