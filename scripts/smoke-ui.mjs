/**
 * Smoke UI no Electron (Windows/Linux) via CDP.
 * npm start em outro terminal com --remote-debugging-port=9222, depois:
 *   node scripts/smoke-ui.mjs
 * Ou: node scripts/smoke-ui.mjs --launch
 */
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { setTimeout as sleep } from 'timers/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const LAUNCH = process.argv.includes('--launch');

async function getPageWs(){
  const res = await fetch('http://127.0.0.1:9222/json/list');
  const list = await res.json();
  const page = list.find(p => p.type === 'page' && (p.url || '').includes('index.html'));
  if(!page) throw new Error('Página do painel não encontrada no CDP :9222');
  return page.webSocketDebuggerUrl;
}

async function withCdp(wsUrl, fn){
  let WebSocket;
  try{ WebSocket = require('ws'); }
  catch{
    throw new Error('Módulo "ws" ausente. Rode: npm i -D ws');
  }
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
  try{
    return await fn(send);
  } finally {
    ws.close();
  }
}

async function evalInPage(send, expression, awaitPromise = false){
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true
  });
  if(r.exceptionDetails){
    throw new Error(r.exceptionDetails.text || 'eval exception');
  }
  return r.result && r.result.value;
}

async function main(){
  let child = null;
  if(LAUNCH){
    const electron = require('electron');
    child = spawn(process.execPath, [path.join(root, 'scripts/start.js'), '--', '--remote-debugging-port=9222'], {
      cwd: root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '' },
      stdio: 'ignore'
    });
    // start.js spawns electron — use npm start path instead
    child.kill();
    child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['start', '--', '--remote-debugging-port=9222'], {
      cwd: root,
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':1' },
      stdio: 'ignore',
      shell: process.platform === 'win32'
    });
    await sleep(6000);
  }

  let fails = 0;
  const check = (name, ok) => {
    if(ok) console.log('  OK ', name);
    else { console.error(' FAIL', name); fails++; }
  };

  try{
    const wsUrl = await getPageWs();
    await withCdp(wsUrl, async (send) => {
      // tip off
      await evalInPage(send, `(() => {
        try{ localStorage.setItem('meta:firstTipV1','1'); }catch(e){}
        const t=document.getElementById('firstTip'); if(t) t.classList.remove('show');
        return true;
      })()`);

      const before = await evalInPage(send, `({ n: actions.length, hasEdit: !!document.getElementById('btnEditMode'), step })`);
      check('btnEditMode exists', !!before.hasEdit);
      check('actions loaded or empty array', typeof before.n === 'number');

      // Seed one action if empty for edit test
      await evalInPage(send, `(() => {
        if(actions.length) return actions.length;
        const ot = ots[0] || { key: 'ot:test', name: 'OT I — Macroprocesso dos Eventos Agudos' };
        if(!ots.length) ots.push(ot);
        const key = 'action:smoke_' + Date.now();
        const rec = { key, ubs: 'UBS ALTA LEITE', otKey: ot.key, otName: ot.name, action: 'SMOKE TEST EDIT', status: 'nao_concluida', date: new Date().toISOString() };
        actions.push(rec);
        return actions.length;
      })()`, true);

      // Click Editar
      const editOk = await evalInPage(send, `(() => {
        const b = document.getElementById('btnEditMode');
        if(!b) return { ok:false, reason:'no-btn' };
        b.click();
        return {
          ok: step === 'edit_pick',
          step,
          hasPanel: !!document.getElementById('editPickList'),
          listItems: document.querySelectorAll('.edit-pick-item').length
        };
      })()`);
      check('Editar entra em edit_pick', !!editOk.ok);
      check('lista de edição renderizada', editOk.hasPanel && editOk.listItems > 0);

      // Pick first item
      if(editOk.listItems > 0){
        const afterPick = await evalInPage(send, `(() => {
          const item = document.querySelector('.edit-pick-item');
          if(!item) return { ok:false };
          item.click();
          return { ok: step === 'status_single', step, hasEditKey: !!draft.editKey };
        })()`);
        check('clique no item inicia edição de status', !!afterPick.ok);
        check('draft.editKey preenchido', !!afterPick.hasEditKey);

        // Salva direto (espera async) — evita corrida de clique em chip
        const saved = await evalInPage(send, `(() => {
          draft.status = 'concluida';
          return saveEntry().then(() => {
            const smoke = actions.find(a => a.action && String(a.action).includes('SMOKE TEST'));
            return { ok: !!(smoke && smoke.status === 'concluida'), status: smoke && smoke.status, n: actions.length };
          });
        })()`, true);
        check('edição salva status concluida', !!(saved && saved.ok));
        if(saved && !saved.ok) console.log('   detail', saved);
      }

      // Dashboard navigation
      const dash = await evalInPage(send, `(() => {
        showPage('dashboard');
        const active = document.getElementById('page-dashboard').classList.contains('active');
        const total = document.getElementById('statTotal') && document.getElementById('statTotal').textContent;
        return { active, total: Number(total) };
      })()`);
      check('Dashboard abre', !!dash.active);
      check('KPI total numérico', Number.isFinite(dash.total));

      // Performance soft: renderAll timed
      const perf = await evalInPage(send, `(() => {
        const t0 = performance.now();
        renderAll(true);
        const ms = performance.now() - t0;
        return { ms };
      })()`);
      check('renderAll(full) < 800ms', perf.ms < 800);
      console.log('   renderAll ms:', Math.round(perf.ms));

      // Cadastro still works
      const cad = await evalInPage(send, `(() => {
        showPage('cadastro');
        startNewCadastro();
        return { step, page: document.getElementById('page-cadastro').classList.contains('active') };
      })()`);
      check('Novo cadastro step=ubs', cad.step === 'ubs' && cad.page);
    });
  } catch (e){
    console.error('Smoke UI error:', e.message || e);
    fails++;
  }

  if(child){
    try{ child.kill(); }catch(_){}
  }

  console.log(fails ? `\n${fails} falha(s) no smoke UI` : '\nSMOKE UI PASSOU');
  process.exit(fails ? 1 : 0);
}

main();
