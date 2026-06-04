import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

import { chromium } from 'playwright';

const ROOT_DIR = process.cwd();
const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const FRAME_DIR = path.join(ROOT_DIR, 'public', 'frames');
const MANIFEST_PATH = path.join(ROOT_DIR, 'public', 'shot-manifest.json');
const OUTPUT_VIDEO_PATH = path.join(ROOT_DIR, 'reels', 'outputs', 'nunchi-reel-remotion.mp4');

const MOBILE_VIEWPORT = {
  width: 390,
  height: 844
};

const args = new Set(process.argv.slice(2));
const doCaptureOnly = args.has('--capture-only');
const doRenderOnly = args.has('--render-only');

const baseShotDurationSec = 2.2;

async function serverReachable() {
  try {
    const response = await fetch(SERVER_URL);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 30000) {
    if (await serverReachable()) return;
    await sleep(500);
  }
  throw new Error('server timeout');
}

async function ensureServer() {
  const alreadyUp = await serverReachable();
  if (alreadyUp) {
    return { stop: async () => {} };
  }

  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(SERVER_PORT)
    }
  });

  child.stdout?.on('data', (chunk) => {
    const message = String(chunk);
    if (message.includes('눈치온도 running on')) {
      // noop - keep listener for visibility in case child process output is needed
    }
  });

  child.stderr?.on('data', (chunk) => {
    const message = String(chunk);
    if (message.toLowerCase().includes('error')) {
      process.stderr.write(message);
    }
  });

  await waitForServer();
  return {
    stop: async () => {
      if (!child.killed) {
        child.kill();
      }
    }
  };
}

function cleanDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

async function createMobileContext(browser) {
  return browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
}

async function waitTotalVotes(page, expected) {
  await page.waitForFunction(
    (target) => {
      const el = document.querySelector('#total-count');
      return el && Number(el.textContent || '0') === target;
    },
    expected,
    { timeout: 12000 }
  );
}

async function captureWithCaption(page, shots, filename, caption, duration) {
  await page.screenshot({
    path: path.join(FRAME_DIR, filename),
    fullPage: false,
    animations: 'disabled'
  });

  shots.push({
    filename,
    caption,
    durationInSeconds: duration
  });
}

async function captureShots() {
  const browser = await chromium.launch({ headless: true });
  const shots = [];
  cleanDir(FRAME_DIR);

  const hostContext = await createMobileContext(browser);
  const hostPage = await hostContext.newPage();
  await hostPage.goto(`${SERVER_URL}/`, { waitUntil: 'domcontentloaded' });

  await captureWithCaption(
    hostPage,
    shots,
    'shot-01-home.png',
    '회의실 온도, 말보다 먼저 투표 시작',
    baseShotDurationSec
  );

  const roomName = `회의실-${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
  await hostPage.fill('#room-name', roomName);
  await hostPage.selectOption('#ttl-minutes', '45');
  await hostPage.click('button[type="submit"]');
  await hostPage.waitForURL(/\/#\/r\/[A-Z0-9]+/, { waitUntil: 'domcontentloaded' });
  await sleep(700);
  await captureWithCaption(
    hostPage,
    shots,
    'shot-02-room-empty.png',
    '방 만들고 링크 공유하면 바로 참여',
    baseShotDurationSec
  );

  const roomUrl = hostPage.url();

  const openVoter = async () => {
    const context = await createMobileContext(browser);
    const page = await context.newPage();
    await page.goto(roomUrl, { waitUntil: 'domcontentloaded' });
    return { page, context };
  };

  const voterHot = await openVoter();
  await voterHot.page.click('[data-vote="hot"]');
  await sleep(600);
  await waitTotalVotes(hostPage, 1);
  await sleep(300);
  await captureWithCaption(
    hostPage,
    shots,
    'shot-03-hot-hot.png',
    '한 명의 불편함도 시작이 된다',
    baseShotDurationSec
  );
  await voterHot.page.close();
  await voterHot.context.close();

  const voterOk = await openVoter();
  await voterOk.page.click('[data-vote="ok"]');
  await sleep(600);
  await waitTotalVotes(hostPage, 2);
  await sleep(300);
  await captureWithCaption(
    hostPage,
    shots,
    'shot-04-hot-ok.png',
    '각자 한 번씩, 집계가 만들어진다',
    baseShotDurationSec
  );
  await voterOk.page.close();
  await voterOk.context.close();

  const voterCold = await openVoter();
  await voterCold.page.click('[data-vote="cold"]');
  await sleep(600);
  await waitTotalVotes(hostPage, 3);
  await sleep(300);
  await captureWithCaption(
    hostPage,
    shots,
    'shot-05-mixed.png',
    '의견이 모이면 기준이 선명해짐',
    baseShotDurationSec
  );
  await voterCold.page.close();
  await voterCold.context.close();

  const voterHotSecond = await openVoter();
  await voterHotSecond.page.click('[data-vote="hot"]');
  await sleep(600);
  await waitTotalVotes(hostPage, 4);
  await sleep(300);
  await captureWithCaption(
    hostPage,
    shots,
    'shot-06-hot-majority.png',
    '숫자가 조절 시점을 알려줌',
    baseShotDurationSec
  );
  await voterHotSecond.page.close();
  await voterHotSecond.context.close();

  await captureWithCaption(
    hostPage,
    shots,
    'shot-07-result-final.png',
    '눈치 대신 데이터로 바로 결정',
    3.0
  );

  await hostPage.close();
  await hostContext.close();
  await browser.close();

  const totalDurationInFrames = Math.max(
    1,
    shots.reduce((acc, item) => acc + Math.round((item.durationInSeconds || baseShotDurationSec) * 30), 0)
  );

  const manifest = {
    fps: 30,
    totalDurationInFrames,
    shots
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  return manifest;
}

function runRender() {
  const yarnCommand = 'yarn';
  const renderArgs = [
    'remotion',
    'render',
    'reels/remotion/src/index.tsx',
    'NunchiMobileReel',
    OUTPUT_VIDEO_PATH,
    '--props',
    MANIFEST_PATH,
    '--overwrite',
    '--width',
    '1080',
    '--height',
    '1920',
    '--fps',
    '30'
  ];

  const result = spawnSync(yarnCommand, renderArgs, {
    stdio: 'inherit',
    cwd: ROOT_DIR,
    shell: true
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`remotion render failed: ${result.status}`);
  }
}

async function main() {
  let manifest;

  if (!doRenderOnly) {
    const server = await ensureServer();
    try {
      manifest = await captureShots();
      console.log(`[mobile] captured ${manifest.shots.length} shots`);
    } finally {
      await server.stop();
    }
  }

  if (doCaptureOnly) {
    return;
  }

  if (!manifest) {
    if (!fs.existsSync(MANIFEST_PATH)) {
      throw new Error('manifest not found. run capture first');
    }
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    manifest = parsed;
  }

  runRender();
  console.log(`[mobile] rendered -> ${OUTPUT_VIDEO_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
