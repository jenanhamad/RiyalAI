import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';

const BASE = process.env.APP_URL || 'https://riyalai.up.railway.app';
const OUT = path.resolve('presentation/screenshots');
const VIEWPORT = { width: 390, height: 844 };

const SHOTS = [
  { file: '01-home.png', path: '/home', wait: 2000 },
  { file: '02-voice.png', path: '/voice', wait: 1500 },
  { file: '03-receipt.png', path: '/voice', action: 'receipt', wait: 1000 },
  { file: '04-business.png', path: '/home', mode: 'business', wait: 2000 },
  { file: '05-add-expense.png', path: '/add', wait: 1500 },
  { file: '06-friends.png', path: '/friends', wait: 1500 },
  { file: '07-leaderboard.png', path: '/leaderboard', wait: 1500 },
];

async function login(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('مثال: jenan').fill('jinan');
  await page.locator('input[type="password"]').fill('123456');
  await page.getByRole('button', { name: 'دخول' }).click();
  await page.waitForTimeout(2500);
}

async function switchMode(page, mode) {
  const btn = page.locator('.mode-switcher button, .mode-strip button, button').filter({
    hasText: mode === 'business' ? 'أعمال' : 'أفراد',
  }).first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(1500);
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  await login(page);

  for (const shot of SHOTS) {
    if (shot.mode === 'business') {
      await switchMode(page, 'business');
    } else if (shot.mode !== 'business') {
      await switchMode(page, 'personal');
    }

    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(shot.wait || 1000);

    if (shot.action === 'receipt') {
      const receiptBtn = page.getByRole('button', { name: 'إيصال' });
      if (await receiptBtn.count()) {
        await receiptBtn.click();
        await page.waitForTimeout(800);
      }
    }

    const outPath = path.join(OUT, shot.file);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved ${outPath}`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
