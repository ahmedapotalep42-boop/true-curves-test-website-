// usage: node render.js <scene> <out.mp4> [fps]        -> full clip
//        node render.js <scene> <out.png> --stills t1,t2,...  -> contact sheet
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');

(async () => {
  const [scene, out, a3, a4] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.resolve(__dirname, 'scenes.html') + '?scene=' + scene);
  await page.evaluate(() => document.fonts.ready);
  const dur = await page.evaluate(() => window.DUR);

  if (a3 === '--stills') {
    const times = a4.split(',').map(Number);
    const tmp = [];
    for (const [i, t] of times.entries()) {
      await page.evaluate(t => window.seek(t), t);
      const f = `${out}.${i}.png`;
      await page.screenshot({ path: f });
      tmp.push(f);
    }
    const cols = Math.min(3, tmp.length), rows = Math.ceil(tmp.length / cols);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...tmp.flatMap(f => ['-i', f]),
      '-filter_complex', tmp.map((_, i) => `[${i}]scale=640:360,drawtext=text='t=${times[i]}':x=10:y=10:fontsize=24:fontcolor=red[v${i}]`).join(';') + ';' +
      tmp.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${tmp.length}:layout=` +
      tmp.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|') + (tmp.length < cols * rows ? ':fill=gray' : ''),
      out]);
    tmp.forEach(f => require('fs').unlinkSync(f));
  } else {
    const fps = +(a3 || 30), n = Math.round(dur * fps);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => window.seek(t), i / fps);
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
