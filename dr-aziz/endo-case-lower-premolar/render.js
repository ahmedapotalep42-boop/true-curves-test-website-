// Renders each .slide in carousel.html to export/NN.png at 2160x2700 (2x of 1080x1350).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(__dirname, 'carousel.html'));
  await page.evaluate(() => document.fonts.ready);
  const slides = await page.$$('.slide');
  for (let i = 0; i < slides.length; i++) {
    const out = path.join(__dirname, 'export', String(i + 1).padStart(2, '0') + '.png');
    await slides[i].screenshot({ path: out });
    console.log(out);
  }
  await browser.close();
})();
