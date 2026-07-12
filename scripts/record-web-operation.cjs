#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

function parseArgs(argv) {
  const args = {
    format: 'mp4',
    name: 'operation-demo',
    width: 1440,
    height: 900,
    cursorTrail: false,
    headed: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (['cursor-trail', 'headed'].includes(key)) {
      args[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = true;
    } else {
      args[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    }
  }
  for (const required of ['scenario', 'baseUrl', 'outDir']) {
    if (!args[required]) throw new Error(`Missing --${required.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
  }
  args.width = Number(args.width);
  args.height = Number(args.height);
  return args;
}

function requirePlaywright() {
  try {
    return require('playwright');
  } catch (error) {
    throw new Error('Cannot find playwright. Install it in the project or set NODE_PATH to a temp install, e.g. /tmp/web-demo-recorder/node_modules.');
  }
}

function hasCommand(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
  return result.status === 0;
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { chromium } = requirePlaywright();
  const scenarioPath = path.resolve(args.scenario);
  const outDir = path.resolve(args.outDir);
  const workDir = path.join(outDir, 'video-work');
  const id = stamp();
  const baseName = `${args.name}-${id}`;
  fs.mkdirSync(workDir, { recursive: true });

  const events = [];
  let currentStep = 'init';
  let cursor = { x: 80, y: 80 };
  const baseUrl = args.baseUrl.replace(/\/$/, '');

  const push = (type, detail) => events.push({ at: new Date().toISOString(), step: currentStep, type, ...detail });

  const browser = await chromium.launch({ headless: !args.headed });
  const context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    recordVideo: { dir: workDir, size: { width: args.width, height: args.height } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  page.on('console', (msg) => {
    if (msg.type() === 'error') push('console', { level: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (error) => push('pageerror', { message: error.message, stack: error.stack }));
  page.on('requestfailed', (request) => push('requestfailed', {
    method: request.method(),
    url: request.url(),
    failure: request.failure()?.errorText,
  }));
  page.on('response', async (response) => {
    const status = response.status();
    if (status < 400) return;
    const request = response.request();
    let body = '';
    try {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('json') || contentType.includes('text')) {
        body = (await response.text()).slice(0, 600);
      }
    } catch {}
    push('http_error', { status, method: request.method(), url: response.url(), body });
  });

  async function installCursor() {
    if (!args.cursorTrail) return;
    await page.evaluate((pos) => {
      if (!document.body) return;
      if (!document.getElementById('web-demo-recorder-style')) {
        const style = document.createElement('style');
        style.id = 'web-demo-recorder-style';
        style.textContent = `
          html, body, body * { cursor: none !important; }
          #web-demo-recorder-cursor {
            position: fixed; left: 0; top: 0; width: 22px; height: 22px;
            z-index: 2147483647; pointer-events: none;
            transform: translate(${pos.x}px, ${pos.y}px); transition: transform 24ms linear;
          }
          #web-demo-recorder-cursor::before {
            content: ""; position: absolute; left: 2px; top: 2px; width: 14px; height: 14px;
            border-radius: 50%; background: #2563eb; border: 3px solid white;
            box-shadow: 0 3px 14px rgba(37, 99, 235, 0.45);
          }
          .web-demo-recorder-trail {
            position: fixed; width: 12px; height: 12px; margin-left: 5px; margin-top: 5px;
            border-radius: 999px; background: rgba(37, 99, 235, 0.28);
            z-index: 2147483646; pointer-events: none;
            animation: web-demo-recorder-trail-fade 900ms ease-out forwards;
          }
          .web-demo-recorder-click {
            position: fixed; width: 44px; height: 44px; margin-left: -11px; margin-top: -11px;
            border-radius: 999px; border: 3px solid rgba(37, 99, 235, 0.65);
            z-index: 2147483646; pointer-events: none;
            animation: web-demo-recorder-click-pulse 620ms ease-out forwards;
          }
          @keyframes web-demo-recorder-trail-fade {
            from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.35); }
          }
          @keyframes web-demo-recorder-click-pulse {
            from { opacity: 0.9; transform: scale(0.4); } to { opacity: 0; transform: scale(1.35); }
          }
        `;
        document.head.appendChild(style);
      }
      let cursorEl = document.getElementById('web-demo-recorder-cursor');
      if (!cursorEl) {
        cursorEl = document.createElement('div');
        cursorEl.id = 'web-demo-recorder-cursor';
        document.body.appendChild(cursorEl);
      }
      window.__webDemoRecorderMove = (x, y, click = false) => {
        cursorEl.style.transform = `translate(${x}px, ${y}px)`;
        const trail = document.createElement('span');
        trail.className = 'web-demo-recorder-trail';
        trail.style.left = `${x}px`;
        trail.style.top = `${y}px`;
        document.body.appendChild(trail);
        window.setTimeout(() => trail.remove(), 950);
        if (click) {
          const ring = document.createElement('span');
          ring.className = 'web-demo-recorder-click';
          ring.style.left = `${x}px`;
          ring.style.top = `${y}px`;
          document.body.appendChild(ring);
          window.setTimeout(() => ring.remove(), 700);
        }
      };
      window.__webDemoRecorderMove(pos.x, pos.y, false);
    }, cursor).catch(() => {});
  }

  async function moveTo(x, y, options = {}) {
    await installCursor();
    const steps = options.steps || 18;
    const start = { ...cursor };
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const nx = Math.round(start.x + (x - start.x) * eased);
      const ny = Math.round(start.y + (y - start.y) * eased);
      await page.mouse.move(nx, ny);
      if (args.cursorTrail) {
        await page.evaluate(([px, py]) => window.__webDemoRecorderMove?.(px, py, false), [nx, ny]).catch(() => {});
      }
      await page.waitForTimeout(10);
    }
    cursor = { x, y };
    if (options.click && args.cursorTrail) {
      await page.evaluate(([px, py]) => window.__webDemoRecorderMove?.(px, py, true), [x, y]).catch(() => {});
    }
  }

  async function locatorPoint(locator) {
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    if (!box) throw new Error('Element has no bounding box');
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + Math.min(box.height / 2, 34)) };
  }

  const recorder = {
    page,
    baseUrl,
    events,
    step(name) {
      currentStep = name;
    },
    async wait(ms) {
      await page.waitForTimeout(ms);
    },
    async installCursor() {
      await installCursor();
    },
    async moveTo(x, y, options) {
      await moveTo(x, y, options);
    },
    async goto(target, stepName = target) {
      currentStep = stepName;
      const url = /^https?:\/\//.test(target) ? target : `${baseUrl}${target.startsWith('/') ? '' : '/'}${target}`;
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await installCursor();
    },
    async click(locator) {
      const point = await locatorPoint(locator);
      await moveTo(point.x, point.y, { click: true });
      await page.mouse.click(point.x, point.y);
    },
    async fill(locator, value) {
      const point = await locatorPoint(locator);
      await moveTo(point.x, point.y, { click: true });
      await page.mouse.click(point.x, point.y);
      await locator.fill(value);
      await page.waitForTimeout(250);
    },
    async press(locator, key) {
      const point = await locatorPoint(locator);
      await moveTo(point.x, point.y, { click: true });
      await page.mouse.click(point.x, point.y);
      await page.keyboard.press(key);
    },
    async scrollTo(y) {
      await installCursor();
      const start = await page.evaluate(() => window.scrollY).catch(() => 0);
      for (let i = 1; i <= 24; i += 1) {
        const t = i / 24;
        const nextY = Math.round(start + (y - start) * (1 - Math.pow(1 - t, 3)));
        await moveTo(Math.round(args.width * 0.82), Math.round(args.height * 0.72 + Math.sin(t * Math.PI) * 42), { steps: 2 });
        await page.evaluate((targetY) => window.scrollTo(0, targetY), nextY).catch(() => {});
        await page.waitForTimeout(18);
      }
    },
  };

  const scenario = require(scenarioPath);
  if (typeof scenario.run !== 'function') throw new Error('Scenario must export async function run({ page, recorder })');
  await scenario.run({ page, recorder });

  const video = page.video();
  await context.close();
  await browser.close();

  const rawVideo = await video.path();
  const webmPath = path.join(outDir, `${baseName}.webm`);
  const latestWebm = path.join(outDir, `${args.name}.webm`);
  fs.copyFileSync(rawVideo, webmPath);
  fs.copyFileSync(rawVideo, latestWebm);

  let finalVideo = webmPath;
  let latestVideo = latestWebm;
  if (args.format === 'mp4') {
    if (!hasCommand('ffmpeg')) throw new Error('ffmpeg is required for MP4 conversion.');
    finalVideo = path.join(outDir, `${baseName}.mp4`);
    latestVideo = path.join(outDir, `${args.name}.mp4`);
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', webmPath,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', finalVideo,
    ], { stdio: 'inherit' });
    fs.copyFileSync(finalVideo, latestVideo);
  }

  const framePath = path.join(outDir, `${baseName}-frame.png`);
  if (hasCommand('ffmpeg')) {
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', finalVideo, '-frames:v', '1', framePath,
    ], { stdio: 'inherit' });
    if (fs.existsSync(framePath)) {
      fs.copyFileSync(framePath, path.join(outDir, `${args.name}-frame.png`));
    }
  }

  const summary = events.reduce((acc, event) => {
    const key = `${event.type}:${event.status || event.level || ''}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const report = {
    video: finalVideo,
    latestVideo,
    webm: webmPath,
    latestWebm,
    frame: fs.existsSync(framePath) ? framePath : null,
    summary,
    events,
  };
  const reportPath = path.join(outDir, `${baseName}.recording-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, report: reportPath }, null, 2));
  if (events.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
