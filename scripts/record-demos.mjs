import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, rename, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const baseURL = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:4175';
const output = resolve(root, 'demos/videos');
const rawDir = resolve(root, '.demo-video-cache');
const components = [
  'SmartAutocomplete', 'EmojiPicker', 'SmartTextarea', 'SmartTags', 'SmartMention', 'SmartSearch', 'SmartInput',
  'SmartIcon', 'SmartColor', 'SmartCategory', 'SmartPriority', 'SmartStatus', 'SmartRoute', 'SmartSentiment', 'SmartAssignee', 'SmartEnum',
  'SmartDatePicker', 'SmartAddress', 'SmartNumber', 'SmartUnit', 'SmartForm', 'SmartValidation', 'SmartColumnMapper',
  'SmartTitle', 'SmartSummary', 'SmartHighlight', 'SmartTooltip', 'SmartEmptyState', 'SmartNotification', 'SmartDiff', 'SmartSort',
];
const slug = name => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

await rm(output, { recursive: true, force: true });
await rm(rawDir, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(rawDir, { recursive: true });

let server;
try { await fetch(baseURL); }
catch {
  server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { cwd: root, stdio: 'ignore', env: process.env });
  let ready = false;
  for (let i = 0; i < 60; i++) { try { await fetch(baseURL); ready = true; break; } catch { await delay(250); } }
  if (!ready) { server.kill(); throw new Error('Vite demo server did not start on port 4175.'); }
}

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const component of components) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } } });
    const page = await context.newPage();
    page.on('pageerror', error => console.error(`${component}: ${error.message}`));
    await page.goto(`${baseURL}/demos.html?component=${component}&mode=preview`, { waitUntil: 'networkidle' });
    await page.locator(`[data-demo-component="${component}"]`).waitFor();
    await page.waitForTimeout(850);
    if (component === 'SmartTooltip') await page.locator('.tooltip-demo').hover();
    else if (['SmartTextarea', 'SmartSearch', 'SmartDatePicker', 'SmartAddress', 'SmartNumber', 'SmartUnit', 'SmartForm', 'SmartTitle', 'SmartSummary', 'SmartHighlight', 'SmartEmptyState', 'SmartNotification', 'SmartDiff'].includes(component)) {
      await page.locator('.stage-widget button').first().click();
    } else if (component === 'SmartColumnMapper' || component === 'SmartSort') {
      await page.locator('.stage-widget button').first().click();
    }
    await page.waitForTimeout(component === 'SmartSort' ? 1500 : 950);
    const video = page.video();
    await context.close();
    const source = await video.path();
    await rename(source, join(output, `${slug(component)}.webm`));
    console.log(`Saved ${component}`);
  }
} finally {
  await browser?.close();
  if (server) server.kill();
  await rm(rawDir, { recursive: true, force: true });
}
