// Draws the link-preview image (public/og.png, 1200×630) that Discord, Slack and others show for links to the site.
// Run after changing the design or the vehicle art: `npm run og-image`. Uses the site's fonts (from Google Fonts),
// colours and the exported vehicle art; nothing is downloaded except the fonts.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const art = (name: string): string => `data:image/webp;base64,${readFileSync(`src/assets/icons/${name}.webp`).toString('base64')}`;
const bike = art('T_UI_VehicleSelect_Bike_Fallback');
const icons = ['T_UI_Vehicle_Car', 'T_UI_Vehicle_Bike', 'T_UI_Vehicle_Skimmer', 'T_UI_Vehicle_Plane_Icn'].map(art);

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@900&family=Barlow+Semi+Condensed:ital,wght@0,700;1,500&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #e8e1d2; color: #1d2428; font-family: 'Barlow Semi Condensed', sans-serif; position: relative; }
  .arc { position: absolute; right: -300px; top: -360px; width: 900px; height: 900px; border: 2px solid rgb(29 36 40 / 13%); border-radius: 50%; }
  .card { position: absolute; inset: 36px; display: flex; gap: 48px; padding: 52px 52px 64px 88px; border-radius: 22px; background: #f4efe4; border: 2px solid #cdc1a8; overflow: hidden; }
  .stripes { position: absolute; left: 0; top: 0; bottom: 0; width: 30px; background: linear-gradient(90deg, #b84a31 0 50%, #d6a03a 50%); }
  .text { display: flex; flex: 1; flex-direction: column; }
  .eyebrow { color: #b84a31; font: italic 500 30px 'Barlow Semi Condensed'; }
  h1 { margin-top: 16px; font: 900 58px/1.02 'Unbounded'; letter-spacing: -0.01em; text-transform: uppercase; }
  .lede { margin-top: 22px; color: #675f50; font: 500 28px/1.3 'Barlow Semi Condensed'; }
  .tags { display: flex; gap: 12px; margin-top: auto; }
  .tag { padding: 9px 20px; border-radius: 999px; background: #24505f; color: #f3ead6; font: 700 22px 'Barlow Semi Condensed'; letter-spacing: 0.05em; text-transform: uppercase; }
  .tag.-accent { background: #b84a31; }
  .side { display: flex; flex: none; flex-direction: column; gap: 22px; width: 380px; }
  .vehicle { height: 250px; border-radius: 22px; background: #e2d9c7; border: 2px solid #cdc1a8; display: grid; place-items: center; }
  .vehicle img { width: 340px; filter: drop-shadow(0 10px 14px rgb(0 0 0 / 25%)); }
  .classes { display: flex; justify-content: space-between; }
  .classes span { width: 80px; height: 80px; border-radius: 50%; background: #24505f; display: grid; place-items: center; }
  .classes img { width: 54px; height: 54px; object-fit: contain; opacity: 0.94; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 12px; background: linear-gradient(90deg, #b84a31 0 40%, #d6a03a 40% 62%, #24505f 62%); }
  .note { position: absolute; right: 52px; bottom: 24px; color: #675f50; font: italic 500 18px 'Barlow Semi Condensed'; }
</style></head>
<body>
  <div class="arc"></div>
  <div class="card">
    <div class="stripes"></div>
    <div class="text">
      <p class="eyebrow">STAR WARS: Galactic Racer</p>
      <h1>Build planner &amp; tour simulator</h1>
      <p class="lede">Plan your perfect racer build.</p>
      <div class="tags"><span class="tag -accent">Multiplayer Tour</span><span class="tag">Campaign</span></div>
    </div>
    <div class="side">
      <div class="vehicle"><img src="${bike}" alt=""></div>
      <div class="classes">${icons.map((src) => `<span><img src="${src}" alt=""></span>`).join('')}</div>
    </div>
    <div class="bar"></div>
    <p class="note">Fan-made tool · not affiliated with Lucasfilm or Electronic Arts</p>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('wrote public/og.png');
