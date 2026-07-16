import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

const HTML = path.resolve('presentation/deck/deck.html');
const OUT = path.resolve('presentation/deck/slides');

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const slides = await page.locator('section.slide').all();
  for (let i = 0; i < slides.length; i++) {
    const file = path.join(OUT, `slide${String(i + 1).padStart(2, '0')}.png`);
    await slides[i].scrollIntoViewIfNeeded();
    await slides[i].screenshot({ path: file });
    console.log(`Saved ${file}`);
  }
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
