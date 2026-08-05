/**
 * Debug grande — reproduz H1–H5 via CDP e coleta window.__DBG.
 * Uso: node scripts/debug-repro.mjs --launch
 */
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { setTimeout as sleep } from 'timers/promises';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const LAUNCH = process.argv.includes('--launch');
const OUT = '/tmp/painel-debug/repro-result.json';

async function getPageWs(){
  for(let i = 0; i < 30; i++){
    try{
      const res = await fetch('http://127.0.0.1:9222/json/list');
      const list = await res.json();
      const page = list.find(p => p.type === 'page' && (p.url || '').includes('index.html'));
      if(page) return page.webSocketDebuggerUrl;
    }catch(_e){}
    await sleep(500);
  }
  throw new Error('CDP :9222 indisponível');
}

async function withCdp(wsUrl, fn){
  const WebSocket = require('ws');
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  ws.on('message', (raw) => {
    const msg = JSON.parse(String(raw));
    if(msg.id && pending.has(msg.id)){
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if(msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  await send('Runtime.enable');
  try{ return await fn(send); }
  finally { ws.close(); }
}

async function evalInPage(send, expression, awaitPromise = false){
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true
  });
  if(r.exceptionDetails){
    throw new Error(JSON.stringify(r.exceptionDetails));
  }
  return r.result && r.result.value;
}

async function main(){
  let child = null;
  if(LAUNCH){
    child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['start', '--', '--remote-debugging-port=9222'], {
      cwd: root,
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':1' },
      stdio: 'ignore',
      shell: process.platform === 'win32'
    });
    await sleep(7000);
  }

  const wsUrl = await getPageWs();
  const result = await withCdp(wsUrl, async (send) => {
    await evalInPage(send, `(() => { try{ localStorage.setItem('meta:tipSeenV1','1'); }catch(e){} return true; })()`);
    await sleep(800);

    // Baseline load
    const baseline = await evalInPage(send, `(() => ({
      n: actions.length,
      ots: ots.length,
      src: dataSourceLabel || null,
      hasDesktop: !!hasDesktopBackup,
      version: APP_VERSION
    }))()`);

    // --- H2: edit resets date ---
    const h2 = await evalInPage(send, `(() => {
      window.__DBG = [];
      const oldDate = '2026-01-15T12:00:00.000Z';
      const key = 'action:debug_h2_' + Date.now();
      const ot = ots[0] || { key: 'ot:debug', name: 'OT DEBUG' };
      if(!ots.length) ots.push(ot);
      actions.push({
        key, ubs: 'UBS DEBUG', otKey: ot.key, otName: ot.name,
        action: 'Ação debug H2', status: 'atrasada', date: oldDate
      });
      draft = {
        ubs: 'UBS DEBUG', otName: ot.name, action: 'Ação debug H2',
        editKey: key, currentStatus: 'atrasada', status: 'concluida',
        classifications: {}, checked: {}
      };
      return saveEntry().then(() => {
        const rec = actions.find(a => a.key === key);
        return {
          oldDate,
          newDate: rec && rec.date,
          dateReset: !!(rec && rec.date !== oldDate),
          status: rec && rec.status,
          logs: (window.__DBG || []).filter(l => l.hypothesisId === 'H2' || l.hypothesisId === 'H1')
        };
      });
    })()`, true);

    // --- H1: false success when flush fails ---
    const h1 = await evalInPage(send, `(() => {
      window.__DBG = [];
      const key = 'action:debug_h1_' + Date.now();
      const ot = ots[0] || { key: 'ot:debug', name: 'OT DEBUG' };
      actions.push({
        key, ubs: 'UBS DEBUG', otKey: ot.key, otName: ot.name,
        action: 'Ação debug H1', status: 'atrasada', date: '2026-02-01T10:00:00.000Z'
      });
      const origSave = window.painelApp && window.painelApp.backup && window.painelApp.backup.save;
      const hadBackup = !!hasDesktopBackup;
      // Force desktop path failure even if localOnly
      if(window.painelApp && window.painelApp.backup){
        window.painelApp.backup.save = async () => ({ ok: false, error: 'debug-forced-fail' });
      }
      // Patch flushBackupNow behavior via temporary override of hasDesktopBackup is hard;
      // instead intercept after ensuring desktop path: stub save + pretend desktop.
      const prevHas = hasDesktopBackup;
      // mutate const? cannot — wrap flush by monkeypatching backup.save is enough when hasDesktopBackup true.
      draft = {
        ubs: 'UBS DEBUG', otName: ot.name, action: 'Ação debug H1',
        editKey: key, currentStatus: 'atrasada', status: 'concluida',
        classifications: {}, checked: {}
      };
      const chatBefore = document.getElementById('chatBody')
        ? document.getElementById('chatBody').innerText
        : '';
      return saveEntry().then(() => {
        const chatAfter = document.getElementById('chatBody')
          ? document.getElementById('chatBody').innerText
          : '';
        const successShown = /atualizado e salvo|Ação salva/i.test(chatAfter.slice(chatBefore.length));
        const failShown = /Não foi possível salvar|falha/i.test(chatAfter.slice(chatBefore.length));
        const saveEl = document.getElementById('saveStatus');
        if(origSave) window.painelApp.backup.save = origSave;
        return {
          hadBackup,
          successShown,
          failShown,
          saveStatusText: saveEl ? saveEl.textContent : null,
          saveState,
          logs: (window.__DBG || []).filter(l => l.hypothesisId === 'H1')
        };
      }).catch(e => {
        if(origSave) window.painelApp.backup.save = origSave;
        return { error: String(e && e.message || e) };
      });
    })()`, true);

    // --- H3: delete only schedules backup ---
    const h3 = await evalInPage(send, `(() => {
      window.__DBG = [];
      const key = 'action:debug_h3_' + Date.now();
      const ot = ots[0] || { key: 'ot:debug', name: 'OT DEBUG' };
      actions.push({
        key, ubs: 'UBS DEBUG', otKey: ot.key, otName: ot.name,
        action: 'Ação debug H3', status: 'concluida', date: '2026-03-01T10:00:00.000Z'
      });
      let flushCalled = false;
      const orig = flushBackupNow;
      flushBackupNow = async function(){
        flushCalled = true;
        return orig.apply(this, arguments);
      };
      return deleteActionWithUndo(key).then(() => {
        flushBackupNow = orig;
        const still = actions.some(a => a.key === key);
        return {
          stillInMemory: still,
          flushCalledImmediately: flushCalled,
          logs: (window.__DBG || []).filter(l => l.hypothesisId === 'H3')
        };
      });
    })()`, true);

    // --- H4: seed file shape ---
    const h4 = await evalInPage(send, `(() => {
      return fetchSeedRecovered().then(seed => ({
        ok: !!(seed && Array.isArray(seed.actions)),
        n: seed && seed.actions ? seed.actions.length : 0,
        source: seed && seed.source || null,
        hasOts: !!(seed && seed.ots && seed.ots.length)
      }));
    })()`, true);

    // --- H6: appPrompt exists ---
    const h6 = await evalInPage(send, `(() => ({
      appPrompt: typeof appPrompt === 'function',
      promptModal: !!document.getElementById('promptModal'),
      btnEdit: !!document.getElementById('btnEditMode')
    }))()`);

    const allLogs = await evalInPage(send, `(() => window.__DBG || [])()`);

    return { baseline, h1, h2, h3, h4, h6, allLogs };
  });

  // Verdicts
  const verdicts = {
    H1_false_success: !!(result.h1 && result.h1.successShown && result.h1.hadBackup && (result.h1.saveState === 'err' || (result.h1.logs || []).some(l => l.data && l.data.flushOk === false))),
    H2_date_reset: !!(result.h2 && result.h2.dateReset),
    H3_no_immediate_flush: !!(result.h3 && result.h3.flushCalledImmediately === false),
    H4_seed_ok: !!(result.h4 && result.h4.ok && result.h4.n >= 46),
    H6_edit_ui_ok: !!(result.h6 && result.h6.appPrompt && result.h6.promptModal && result.h6.btnEdit)
  };

  const out = { verdicts, result };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ verdicts, baseline: result.baseline, h1: result.h1, h2: result.h2, h3: result.h3, h4: result.h4, h6: result.h6 }, null, 2));

  if(child){
    try{ child.kill('SIGTERM'); }catch(_e){}
  }
  // leave process; caller kills electron if needed
}

main().catch((e) => {
  console.error('debug-repro failed:', e);
  process.exit(1);
});
