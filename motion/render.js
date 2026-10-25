// usage: node render.js <clip> <out.mp4> [fps]               -> full clip
//        node render.js <clip> <out.png> --stills t1,t2,...  -> contact sheet (clip-local seconds)
//        node render.js --list                               -> clip ids with in/out
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const PAGE = 'file://' + path.resolve(__dirname, 'ocd.html');

(async () => {
  const [clip, out, a3, a4] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  if (clip === '--list') {
    await page.goto(PAGE + '?clip=__list');
    console.log(JSON.stringify(await page.evaluate(() => window.CLIP_LIST)));
    return browser.close();
  }
  await page.goto(PAGE + '?clip=' + clip);
  await page.evaluate(() => document.fonts.ready);
  const dur = await page.evaluate(() => window.DUR);

  if (a3 === '--stills') {
    const times = a4.split(',').map(Number);
    const tmp = [];
    for (const [i, t] of times.entries()) {
      await page.evaluate(t => window.seek(t), t);
      const f = `${out}.${i}.png`;
      await page.screenshot({ path: f, omitBackground: true });
      tmp.push(f);
    }
    const cols = Math.min(3, tmp.length), rows = Math.ceil(tmp.length / cols);
    const label = tmp.map((_, i) => `[${i}]scale=640:360,drawtext=text='t=${times[i]}':x=10:y=10:fontsize=24:fontcolor=red[v${i}]`).join(';');
    const filter = tmp.length === 1 ? label.replace('[v0]', '') :
      label + ';' + tmp.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${tmp.length}:layout=` +
      tmp.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|') + (tmp.length < cols * rows ? ':fill=gray' : '');
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...tmp.flatMap(f => ['-i', f]), '-filter_complex', filter, out]);
    tmp.forEach(f => fs.unlinkSync(f));
  } else {
    const fps = a3 || '30000/1001';
    const alpha = out.endsWith('.mov');
    const [num, den] = fps.split('/').map(Number);
    const rate = num / (den || 1), n = Math.round(dur * rate);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', fps, '-i', '-',
      ...(alpha ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le'] : ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => window.seek(t), i / rate);
      const buf = await page.screenshot({ type: 'png', omitBackground: alpha });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
