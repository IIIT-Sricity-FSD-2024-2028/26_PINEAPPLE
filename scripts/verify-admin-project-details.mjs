/**
 * Browser layout verification script for Admin Project Details (`/admin/projects/:id`).
 *
 * Uses local Microsoft Edge or Google Chrome via DevTools Protocol (CDP) over Node 22 native WebSocket
 * (no extra npm packages required).
 *
 * Prerequisites:
 *   1. Start backend (`PORT=3000 AUTH_MODE=jwt npm run start` in `back-end/`).
 *   2. Start frontend (`VITE_AUTH_MODE=jwt npm run dev -- --port 5173` in `React-Implementation/React-Implementation/`).
 *
 * Run:
 *   node scripts/verify-admin-project-details.mjs --out=docs/ui-checks/admin-project-details/after --projB=<CLOSED_PROJECT_ID>
 *
 * Exits with code 0 when zero overflow, overlap, card escape, un-ellipsed clip, or narrow-column
 * offenders are found across all 3 projects and 6 viewport widths [1920, 1440, 1280, 1024, 768, 390].
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const WIDTHS = [1920, 1440, 1280, 1024, 768, 390];
const HEIGHT = 900;

function parseArgs() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=');
    args[k] = v ?? true;
  }
  return args;
}

function findBrowserBinary() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Could not find msedge.exe or chrome.exe');
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.openPromise = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }

  async send(method, params = {}) {
    await this.openPromise;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function seedClosedProjectIfNeeded(apiBase) {
  const suRes = await fetch(`${apiBase}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superuser@teamforge.io', password: 'Super@123' }),
  });
  const suData = await suRes.json();
  const suToken = suData.token || suData.accessToken;

  const ownerRes = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'priya.patel@teamforge.io', password: 'password123' }),
  });
  const ownerToken = (await ownerRes.json()).accessToken;

  const adityaRes = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aditya.sai@teamforge.io', password: 'password123' }),
  });
  const adityaToken = (await adityaRes.json()).accessToken;

  await fetch(`${apiBase}/users/6`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adityaToken}` },
    body: JSON.stringify({
      name: 'Alexandrina Maximillian-Montgomery-Schwarzenegger-Vanderbilt III',
    }),
  });

  const unbroken = 'SupercalifragilisticexpialidociousUnbrokenUrlAndIdentifierSegmentWithoutSpaces'.repeat(4);
  const projRes = await fetch(`${apiBase}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      title: 'Very Long Project Title For Overflow And Wrapping Verification Across Narrow Viewports',
      description: `Long unbroken string test: ${unbroken}`,
      dueDate: '2027-06-01T00:00:00.000Z',
      requiredSkills: ['TypeScript', 'React', 'Distributed-Systems-Architecture-Engineering', 'UI/UX', 'CSS-Grid'],
      difficulty: 'Advanced',
    }),
  });
  const created = await projRes.json();

  const invRes = await (
    await fetch(`${apiBase}/projects/${created.id}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ username: 'adityasai' }),
    })
  ).json();

  if (invRes?.id) {
    await fetch(`${apiBase}/invites/${invRes.id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adityaToken}` },
    });
  }

  await fetch(`${apiBase}/admin/projects/${created.id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${suToken}` },
    body: JSON.stringify({
      reason: `Closed due to extended inactivity with an unbroken-reference-id-${'X'.repeat(80)}`,
    }),
  });

  return created.id;
}

async function run() {
  const args = parseArgs();
  const feUrl = args.url || 'http://localhost:5173';
  const apiUrl = args.api || 'http://localhost:3000';
  const outDir = path.resolve(process.cwd(), args.out || 'docs/ui-checks/admin-project-details/after');
  fs.mkdirSync(outDir, { recursive: true });

  const projBId = args.projB && args.projB !== true ? args.projB : await seedClosedProjectIfNeeded(apiUrl);
  const projects = [
    { key: 'proj-a', id: 'proj-1', label: 'Normal 4 members + tasks' },
    { key: 'proj-b', id: projBId, label: 'Closed long unbroken text + long member name' },
    { key: 'proj-c', id: 'proj-4', label: 'No tasks + no mentor' },
  ];

  const userDataDir = path.join(os.tmpdir(), `tf-cdp-profile-${Date.now()}`);
  const browserBin = findBrowserBinary();
  const debugPort = Number(args.port || 9231);

  const chrome = spawn(
    browserBin,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let client;
  const allOffenders = [];
  const report = [];

  try {
    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
        const list = await res.json();
        const pageTarget = list.find((t) => t.type === 'page');
        if (pageTarget?.webSocketDebuggerUrl) {
          wsUrl = pageTarget.webSocketDebuggerUrl;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!wsUrl) throw new Error('Timed out waiting for headless browser DevTools endpoint');

    client = new CDPClient(wsUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Log in as Super User on /admin/login
    await client.send('Page.navigate', { url: `${feUrl}/admin/login` });
    for (let i = 0; i < 40; i++) {
      const ready = await client.send('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('input[type="email"]'))`,
        returnByValue: true,
      });
      if (ready.result.value) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        const setVal = (el, val) => {
          const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          proto.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setVal(emailInput, 'superuser@teamforge.io');
        setVal(passInput, 'Super@123');
        document.querySelector('button[type="submit"]').click();
      })()`,
    });

    for (let i = 0; i < 40; i++) {
      const loc = await client.send('Runtime.evaluate', {
        expression: `window.location.pathname`,
        returnByValue: true,
      });
      if (loc.result.value === '/admin') break;
      await new Promise((r) => setTimeout(r, 200));
    }

    // Helper: navigate via SPA link / history without full page reload (keeps in-memory admin session)
    for (const proj of projects) {
      await client.send('Runtime.evaluate', {
        expression: `(() => {
          window.history.pushState({}, '', '/admin/projects/${proj.id}');
          window.dispatchEvent(new PopStateEvent('popstate'));
        })()`,
      });

      for (let i = 0; i < 40; i++) {
        const loaded = await client.send('Runtime.evaluate', {
          expression: `Boolean(document.querySelector('.admin-project-details-page h1'))`,
          returnByValue: true,
        });
        if (loaded.result.value) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      await new Promise((r) => setTimeout(r, 300));

      for (const width of WIDTHS) {
        await client.send('Emulation.setDeviceMetricsOverride', {
          width,
          height: HEIGHT,
          deviceScaleFactor: 1,
          mobile: width <= 768,
        });
        await new Promise((r) => setTimeout(r, 150));

        const evalRes = await client.send('Runtime.evaluate', {
          expression: `(() => {
            const docEl = document.documentElement;
            const main = document.querySelector('.admin-main-content');
            const offenders = [];

            if (docEl.scrollWidth > docEl.clientWidth + 1) {
              const wideEls = Array.from(document.querySelectorAll('*'))
                .map((el) => {
                  const r = el.getBoundingClientRect();
                  return { tag: el.tagName, cls: String(el.className || ''), right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width) };
                })
                .filter((x) => x.right > docEl.clientWidth + 1)
                .slice(0, 8);
              offenders.push({ type: 'page-overflow', selector: 'html', scrollWidth: docEl.scrollWidth, clientWidth: docEl.clientWidth, wideEls });
            }
            if (main && main.scrollWidth > main.clientWidth + 1) {
              offenders.push({ type: 'main-overflow', selector: '.admin-main-content', scrollWidth: main.scrollWidth, clientWidth: main.clientWidth });
            }

            const checkOverlap = (aSel, bSel) => {
              const a = document.querySelector(aSel);
              const b = document.querySelector(bSel);
              if (!a || !b) return;
              const ra = a.getBoundingClientRect();
              const rb = b.getBoundingClientRect();
              if (ra.width === 0 || rb.width === 0) return;
              const overlap = ra.left < rb.right - 1 && ra.right > rb.left + 1 && ra.top < rb.bottom - 1 && ra.bottom > rb.top + 1;
              if (overlap) {
                offenders.push({
                  type: 'overlap',
                  pair: [aSel, bSel],
                  a: { left: Math.round(ra.left), top: Math.round(ra.top), right: Math.round(ra.right), bottom: Math.round(ra.bottom) },
                  b: { left: Math.round(rb.left), top: Math.round(rb.top), right: Math.round(rb.right), bottom: Math.round(rb.bottom) },
                });
              }
            };

            const hdrControls = ['.admin-back-btn', '.admin-project-title', '.admin-project-status-badge', '.admin-project-tabs', '.admin-delete-btn'];
            const cards = ['.admin-details-card', '.admin-team-card', '.admin-tasks-card'];
            for (let i = 0; i < hdrControls.length; i++) {
              for (let j = i + 1; j < hdrControls.length; j++) checkOverlap(hdrControls[i], hdrControls[j]);
              for (const c of cards) checkOverlap(hdrControls[i], c);
            }
            checkOverlap('.admin-details-card', '.admin-team-card');
            checkOverlap('.admin-details-card', '.admin-tasks-card');
            checkOverlap('.admin-team-card', '.admin-tasks-card');

            // Check element right-edge overflow inside cards and header
            const descCard = document.querySelector('.admin-details-card');
            if (descCard) {
              const dcRect = descCard.getBoundingClientRect();
              for (const sel of ['.admin-project-description', '.admin-notice-box', '.admin-notice-body', '.admin-skills-list']) {
                const el = document.querySelector(sel);
                if (el) {
                  const r = el.getBoundingClientRect();
                  if (r.right > dcRect.right + 1 || el.scrollWidth > el.clientWidth + 2) {
                    offenders.push({ type: 'card-exceed', selector: sel, elRight: Math.round(r.right), cardRight: Math.round(dcRect.right), scrollW: el.scrollWidth, clientW: el.clientWidth });
                  }
                }
              }
            }

            // Team member rows: badge same line as name, distinct badge style, no clipping without ellipsis
            document.querySelectorAll('.admin-team-member-row').forEach((row, idx) => {
              const nameEl = row.querySelector('.admin-team-member-name');
              const badgeEl = row.querySelector('.admin-team-member-badge .tf-badge');
              const rowRect = row.getBoundingClientRect();
              if (nameEl && badgeEl) {
                const nr = nameEl.getBoundingClientRect();
                const br = badgeEl.getBoundingClientRect();
                if (nr.width < 12) {
                  offenders.push({ type: 'member-name-collapsed', row: idx, width: Math.round(nr.width) });
                }
                if (Math.abs(nr.top - br.top) > 12) {
                  offenders.push({ type: 'member-badge-wrapped', row: idx, nameTop: Math.round(nr.top), badgeTop: Math.round(br.top) });
                }
                if (br.right > rowRect.right + 1) {
                  offenders.push({ type: 'member-badge-overflow', row: idx, badgeRight: Math.round(br.right), rowRight: Math.round(rowRect.right) });
                }
                const cs = getComputedStyle(badgeEl);
                if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent') {
                  offenders.push({ type: 'badge-unstyled', row: idx, text: badgeEl.textContent });
                }
              }
            });

            // Header overflow check
            document.querySelectorAll('.admin-project-tabs, .admin-delete-btn, .admin-back-btn, .admin-project-title, .admin-project-status-badge').forEach((el) => {
              const r = el.getBoundingClientRect();
              if (r.right > window.innerWidth + 1) {
                offenders.push({ type: 'header-right-overflow', selector: el.className, right: Math.round(r.right), viewport: window.innerWidth });
              }
            });

            // Clipped text without ellipsis & table column widths inside tasks card
            const tasksCard = document.querySelector('.admin-tasks-card');
            if (tasksCard) {
              const tcRect = tasksCard.getBoundingClientRect();
              const scrollWrap = tasksCard.querySelector('.tf-datatable-scroll');
              const table = tasksCard.querySelector('.tf-datatable');
              if (table && window.innerWidth > 768) {
                const trRect = table.getBoundingClientRect();
                if (trRect.right > tcRect.right + 1) {
                  offenders.push({ type: 'table-exceeds-card', right: Math.round(trRect.right), cardRight: Math.round(tcRect.right) });
                }
              }
              if (scrollWrap) {
                scrollWrap.querySelectorAll('th, td').forEach((cell, idx) => {
                  if (cell.scrollWidth > cell.clientWidth + 2) {
                    offenders.push({ type: 'table-cell-narrow', cell: idx, text: (cell.textContent || '').slice(0, 30), scrollW: cell.scrollWidth, clientW: cell.clientWidth });
                  }
                });
              }
            }

            // Full page height for screenshot
            const layout = document.querySelector('.admin-layout');
            const fullH = Math.max(docEl.scrollHeight, main ? main.scrollHeight + 80 : 900, 900);
            if (layout && main) {
              // Temporarily expand scroll height measurement info only
            }
            return {
              offenders,
              scrollH: fullH,
              scrollW: docEl.scrollWidth,
              clientW: docEl.clientWidth,
            };
          })()`,
          returnByValue: true,
        });

        const data = evalRes.result.value;
        // Temporarily unclamp .admin-layout height during screenshot so captureBeyondViewport gets full content
        await client.send('Runtime.evaluate', {
          expression: `(() => {
            const l = document.querySelector('.admin-layout');
            const m = document.querySelector('.admin-main-content');
            if (l) { l.dataset.origH = l.style.height; l.style.height = 'auto'; l.style.minHeight = '100vh'; l.style.overflow = 'visible'; }
            if (m) { m.dataset.origOv = m.style.overflowY; m.style.overflowY = 'visible'; }
          })()`,
        });
        const fullHeightRes = await client.send('Runtime.evaluate', {
          expression: `Math.max(document.documentElement.scrollHeight, 900)`,
          returnByValue: true,
        });
        const fullH = Math.min(Number(fullHeightRes.result.value || 900), 6000);
        await client.send('Emulation.setDeviceMetricsOverride', {
          width,
          height: fullH,
          deviceScaleFactor: 1,
          mobile: width <= 768,
        });
        await new Promise((r) => setTimeout(r, 120));
        const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        fs.writeFileSync(path.join(outDir, `${proj.key}-${width}.png`), Buffer.from(shot.data, 'base64'));
        await client.send('Runtime.evaluate', {
          expression: `(() => {
            const l = document.querySelector('.admin-layout');
            const m = document.querySelector('.admin-main-content');
            if (l) { l.style.height = l.dataset.origH || ''; l.style.minHeight = ''; l.style.overflow = ''; }
            if (m) { m.style.overflowY = m.dataset.origOv || ''; }
          })()`,
        });

        report.push({ project: proj.key, width, offenderCount: data.offenders.length, offenders: data.offenders });
        for (const off of data.offenders) {
          allOffenders.push({ project: proj.key, width, ...off });
        }
      }
    }

    console.log(JSON.stringify({ totalOffenders: allOffenders.length, summary: report }, null, 2));
    if (allOffenders.length > 0 && !args.allowOffenders) {
      process.exitCode = 1;
    }

    // Quick check of Escrow & Financials tab on proj-a (1280 & 390) and Admin Projects list (1280 & 390)
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        window.history.pushState({}, '', '/admin/projects/proj-1');
        window.dispatchEvent(new PopStateEvent('popstate'));
      })()`,
    });
    await new Promise((r) => setTimeout(r, 400));
    await client.send('Runtime.evaluate', {
      expression: `document.querySelector('[data-testid="admin-project-escrow-tab"]')?.click()`,
    });
    await new Promise((r) => setTimeout(r, 250));
    for (const w of [1280, 390]) {
      await client.send('Emulation.setDeviceMetricsOverride', { width: w, height: HEIGHT, deviceScaleFactor: 1, mobile: w <= 768 });
      await new Promise((r) => setTimeout(r, 150));
      const res = await client.send('Runtime.evaluate', {
        expression: `(() => ({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
          hasEscrowPanel: Boolean(document.querySelector('[data-testid="admin-project-escrow-panel"]')),
        }))()`,
        returnByValue: true,
      });
      if (res.result.value.scrollW > res.result.value.clientW + 1) {
        allOffenders.push({ project: 'escrow-tab', width: w, ...res.result.value });
      }
    }
    const shotEscrow = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'escrow-tab-390.png'), Buffer.from(shotEscrow.data, 'base64'));

    await client.send('Runtime.evaluate', {
      expression: `(() => {
        window.history.pushState({}, '', '/admin/projects');
        window.dispatchEvent(new PopStateEvent('popstate'));
      })()`,
    });
    await new Promise((r) => setTimeout(r, 400));
    for (const w of [1280, 390]) {
      await client.send('Emulation.setDeviceMetricsOverride', { width: w, height: HEIGHT, deviceScaleFactor: 1, mobile: w <= 768 });
      await new Promise((r) => setTimeout(r, 150));
      const res = await client.send('Runtime.evaluate', {
        expression: `({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth })`,
        returnByValue: true,
      });
      if (res.result.value.scrollW > res.result.value.clientW + 1) {
        allOffenders.push({ project: 'admin-projects-list', width: w, ...res.result.value });
      }
    }
    const shotList = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'admin-projects-list-390.png'), Buffer.from(shotList.data, 'base64'));
  } finally {
    if (client) client.close();
    chrome.kill('SIGKILL');
    await new Promise((r) => setTimeout(r, 300));
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    } catch {}
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
