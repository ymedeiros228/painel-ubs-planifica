/**
 * Bateria de testes de lógica (sem UI) — roda em Node.
 * node scripts/logic-test.mjs
 */
function statusKeyFromLabel(labelOrKey){
  if(!labelOrKey) return 'nao_concluida';
  const s = String(labelOrKey).toLowerCase().trim();
  if(s === 'concluida' || s.startsWith('conclu')) return 'concluida';
  if(s === 'atrasada' || s.startsWith('atras')) return 'atrasada';
  if(s === 'nao_concluida' || s.includes('não conclu') || s.includes('nao conclu')) return 'nao_concluida';
  return 'nao_concluida';
}

function pickRichest(candidates){
  let best = null;
  let bestCount = -1;
  for(const item of candidates){
    if(!item || !item.data) continue;
    const count = Array.isArray(item.data.actions) ? item.data.actions.length : 0;
    const updated = Date.parse(item.data.updatedAt || 0) || 0;
    const bestUpdated = best ? Date.parse(best.data.updatedAt || 0) || 0 : 0;
    if(count > bestCount || (count === bestCount && updated >= bestUpdated)){
      best = item;
      bestCount = count;
    }
  }
  return best;
}

function applyPrimaryAsTruth(primary, auxiliary){
  // principal vazio (0 ações) ainda é verdade — não sobrescreve com auxiliar
  if(primary && typeof primary === 'object' && Array.isArray(primary.actions)){
    return primary;
  }
  return auxiliary || primary;
}

let failed = 0;
function assert(name, cond){
  if(cond) console.log('  OK ', name);
  else {
    console.error(' FAIL', name);
    failed++;
  }
}

console.log('— statusKeyFromLabel —');
assert('concluida key', statusKeyFromLabel('concluida') === 'concluida');
assert('Concluída label', statusKeyFromLabel('Concluída') === 'concluida');
assert('atrasada', statusKeyFromLabel('Atrasada') === 'atrasada');
assert('nao concluida', statusKeyFromLabel('Não concluída') === 'nao_concluida');
assert('empty -> nao', statusKeyFromLabel('') === 'nao_concluida');

console.log('— load primary truth —');
const emptyPrimary = { actions: [], ots: [] };
const richAux = { actions: [{ key: 'a1' }, { key: 'a2' }], ots: [] };
assert('empty primary wins over rich aux', applyPrimaryAsTruth(emptyPrimary, richAux).actions.length === 0);
assert('missing primary uses aux', applyPrimaryAsTruth(null, richAux).actions.length === 2);

console.log('— pick richest only for probe —');
const richest = pickRichest([
  { data: { actions: [{}, {}], updatedAt: '2020-01-01' } },
  { data: { actions: [{}], updatedAt: '2026-01-01' } }
]);
assert('richest by count', richest.data.actions.length === 2);

console.log('— edit key stability —');
function upsertKey({ existing, editKey, ubs, otName, action }){
  if(editKey) return editKey;
  if(existing) return existing.key;
  return 'action:new';
}
assert('edit keeps key', upsertKey({ editKey: 'action:1', existing: { key: 'action:9' } }) === 'action:1');
assert('reuse existing combo', upsertKey({ existing: { key: 'action:7' }, ubs: 'U', otName: 'OT', action: 'A' }) === 'action:7');

console.log('\n' + (failed ? failed + ' falha(s)' : 'TODOS OS TESTES DE LÓGICA PASSARAM'));
process.exit(failed ? 1 : 0);
