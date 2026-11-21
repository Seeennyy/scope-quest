// Unit tests for the pure engine: answer keys, scoring, tolerance, board maths, inventory totals.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newState, addPlayer, hostCommand, submitAnswer, scoreCalc, footprint, inventory, leaderboard, computeTeamPlans, sceneOf } from '../shared/engine';
import { publicContent, screenView } from '../shared/views';
// c = the 2-activity version in use; cf = the full 23-scene version kept as a backup (still supported by the engine)
const c = JSON.parse(fs.readFileSync(path.join(__dirname, '../content/content.json'), 'utf8'));
const cf = JSON.parse(fs.readFileSync(path.join(__dirname, '../content/content-full-23-scenes.json'), 'utf8'));
let n = 0; const t = (name: string, f: () => void) => { f(); n++; console.log('✓', name); };

t('calc answers equal activity × factor', () => {
  const f = (id: string) => c.factors.find((x: any) => x.id === id).value;
  assert.equal(+(18000 * f('diesel') / 1000).toFixed(3), c.calcs.calc_vans.answer);
  assert.equal(+(435000 * f('grid_eg') / 1000).toFixed(3), c.calcs.calc_elec.answer); assert.equal(c.boardModel.gridKWh, 435000);
  assert.equal(+(42 * f('r134a') / 1000).toFixed(3), c.calcs.calc_fridge.answer);
  assert.equal(+(6 * 2 * 2420 * f('flight') / 1000).toFixed(3), c.calcs.calc_flights.answer);
  assert.equal(+(4800 * f('diesel') / 1000).toFixed(3), c.methods.options.fuel.answer);
  assert.equal(+(26000 * f('van_tkm') / 1000).toFixed(3), c.methods.options.distance.answer);
  assert.equal(+(1650000 / f('fx') * f('eeio_truck') / 1000).toFixed(3), c.methods.options.spend.answer);
  assert.equal(+(2400 * f('natgas') / 1000).toFixed(3), c.prefilled.find((p: any) => p.id === 'pre_gas').value);
  assert.equal(1200 * 1000 * f('flour_pcf') / 1000, c.prefilled.find((p: any) => p.id === 'pre_flour').value);
});
t('natural gas factor = IPCC defaults × AR6 GWPs', () => assert.equal(+((56100 + 5 * 29.8 + 0.1 * 273) / 1000).toFixed(3), c.factors.find((x: any) => x.id === 'natgas').value));
t('±5% tolerance, close band and kg slip', () => {
  assert.equal(scoreCalc(47.908 * 1.049, 47.908).ok, true);
  assert.equal(scoreCalc(47.908 * 1.06, 47.908).ok, false);
  assert.equal(scoreCalc(47.908 * 1.10, 47.908).close, true);
  assert.equal(scoreCalc(47908, 47.908).unitSlip, true);
});
t('half of Chapter 1 sources are transport, all 16 present', () => {
  const ids = cf.scenes.filter((s: any) => s.type === 'classify' && s.mode === 'scope').flatMap((s: any) => s.items);
  assert.equal(ids.length, 16); assert.equal(new Set(ids).size, 16);
  assert.ok(ids.filter((id: string) => cf.items.find((i: any) => i.id === id).transport).length >= 8);
});
t('public content hides every answer key', () => {
  const p = JSON.stringify(publicContent(c));
  for (const k of ['"scope":"S', '"reason"', '"wisdom"', '"answer"', '"correct"', '"formula"', '"iso":[', '"cat":', '"dtype"', '"dReason"', '"dHalf"']) assert.ok(!p.includes(k), k);
});
t('classify scoring: scope, category bonus, only after Confirm', () => {
  const s = newState('1234', 0);
  const a = addPlayer(s, cf, 'Ana', 0), b = addPlayer(s, cf, 'Bo', 0);
  const idx = cf.scenes.findIndex((x: any) => x.id === 'ch1_b');
  hostCommand(s, cf, { type: 'goto', idx }, 0); hostCommand(s, cf, { type: 'start' }, 0);
  assert.equal(submitAnswer(s, cf, a.id, { scene: 'ch1_b', item: 'leased_vans', c: 'S3', cat: '8' }, 1000), null);
  assert.equal(submitAnswer(s, cf, b.id, { scene: 'ch1_b', item: 'leased_vans', c: 'S1' }, 1000), null);
  assert.equal(leaderboard(s, cf).players.find(p => p.id === a.id)!.score, 0);
  hostCommand(s, cf, { type: 'close' }, 2000); hostCommand(s, cf, { type: 'next' }, 2000); // split item 1 (fridge)
  hostCommand(s, cf, { type: 'confirm' }, 2000); hostCommand(s, cf, { type: 'next' }, 2000); hostCommand(s, cf, { type: 'confirm' }, 2000);
  const ra = s.results.ch1_b[a.id].items!.leased_vans; const rb = s.results.ch1_b[b.id].items!.leased_vans;
  assert.equal(ra.ok, true); assert.equal(ra.catOk, true); assert.ok(ra.pts >= 150); assert.equal(rb.ok, false);
});
t('answers rejected when closed or for the wrong scene', () => {
  const s = newState('1234', 0); const a = addPlayer(s, cf, 'Ana', 0);
  assert.equal(submitAnswer(s, cf, a.id, { scene: 'coldopen', c: 'b' }, 0), 'wrong-scene');
  hostCommand(s, cf, { type: 'next' }, 0);
  assert.equal(submitAnswer(s, cf, a.id, { scene: 'coldopen', c: 'b' }, 0), 'closed');
});
t('board: EV vans move S1 to S2; green contract only changes market-based', () => {
  const base = footprint(cf, []); const ev = footprint(cf, ['ev']); const ppa = footprint(cf, ['ppa']);
  assert.ok(Math.abs((base.S1 - ev.S1) - 47.908) < 0.01); assert.ok(ev.S2LB > base.S2LB);
  assert.equal(ppa.S2LB, base.S2LB); assert.equal(ppa.S2MB, 0);
  assert.ok(Math.abs(base.LB - inventory(newState('1', 0), cf).rows.reduce((a: number, r: any) => a + r.value, 0)) < 0.01);
});
t('team plan respects the budget', () => {
  const s = newState('1', 0); const ps = [0, 1, 2, 3].map(i => addPlayer(s, cf, 'P' + i, 0));
  const idx = cf.scenes.findIndex((x: any) => x.id === 'board'); hostCommand(s, cf, { type: 'goto', idx }, 0); hostCommand(s, cf, { type: 'start' }, 0);
  for (const p of ps) assert.equal(submitAnswer(s, cf, p.id, { scene: 'board', levers: ['ev', 'solar', 'leak'] }, 0), null);
  assert.equal(submitAnswer(s, cf, ps[0].id, { scene: 'board', levers: ['ev', 'solar', 'supplier'] }, 0), 'over-budget');
  for (const plan of Object.values(computeTeamPlans(s, cf))) assert.ok(plan.reduce((a, id) => a + c.levers.find((l: any) => l.id === id).cost, 0) <= 100);
});
t('back/forward never leaves the scene list', () => {
  const s = newState('1', 0);
  for (let i = 0; i < 300; i++) hostCommand(s, c, { type: 'next' }, i);
  assert.equal(sceneOf(s, c).id, 'finale');
  for (let i = 0; i < 300; i++) hostCommand(s, c, { type: 'back' }, i);
  assert.equal(s.sceneIdx, 0);
});
t('two activities only: lobby → scopes → data types → finale', () => {
  assert.deepEqual(c.scenes.map((x: any) => x.id), ['lobby', 'act1', 'act2', 'finale']);
  for (const sc of c.scenes.filter((x: any) => x.type === 'classify')) {
    assert.ok(sc.drag && sc.bins.length === 3);
    const ids = sc.bins.map((b: any) => b.id);
    const per: Record<string, number> = {};
    for (const id of sc.items) {
      const it = c.items.find((i: any) => i.id === id); assert.ok(it, id);
      const ans = sc.mode === 'data' ? it.dtype : it.scope; assert.ok(ids.includes(ans), `${id} → ${ans}`);
      per[ans] = (per[ans] || 0) + 1;
      assert.ok(c.sources[sc.mode === 'data' ? it.dSource : it.source], `source for ${id}`);
      assert.ok((sc.mode === 'data' ? it.dReason : it.reason).ar, `arabic reason ${id}`);
    }
    assert.deepEqual(Object.values(per), [3, 3, 3], `${sc.id} has 3 cards per basket`);
  }
});
t('data types: site-specific full points, "primary" half, secondary 0; only at Confirm', () => {
  const s = newState('1234', 0);
  const [a, b, d] = ['Ana', 'Bo', 'Di'].map(x => addPlayer(s, c, x, 0));
  const idx = c.scenes.findIndex((x: any) => x.id === 'act2');
  hostCommand(s, c, { type: 'goto', idx }, 0); hostCommand(s, c, { type: 'start' }, 0);
  assert.equal(submitAnswer(s, c, a.id, { scene: 'act2', item: 'd_gas_bill', c: 'SS' }, 1000), null);
  assert.equal(submitAnswer(s, c, b.id, { scene: 'act2', item: 'd_gas_bill', c: 'P' }, 1000), null);
  assert.equal(submitAnswer(s, c, d.id, { scene: 'act2', item: 'd_gas_bill', c: 'S' }, 1000), null);
  assert.equal(submitAnswer(s, c, d.id, { scene: 'act2', item: 'd_gas_bill', c: 'S1' }, 1000), 'bad-choice');
  assert.equal(leaderboard(s, c).players.find(p => p.id === a.id)!.score, 0);
  hostCommand(s, c, { type: 'close' }, 2000); hostCommand(s, c, { type: 'next' }, 2000); hostCommand(s, c, { type: 'confirm' }, 2000);
  const r = (p: any) => s.results.act2[p.id].items!.d_gas_bill;
  assert.equal(r(a).ok, true); assert.ok(r(a).pts >= 100);
  assert.equal(r(b).ok, false); assert.equal(r(b).half, true); assert.equal(r(b).pts, 50);
  assert.equal(r(d).pts, 0);
});
t('drag activity ends on a results summary; "All → summary" confirms every card', () => {
  const s = newState('1234', 0); const a = addPlayer(s, c, 'Ana', 0);
  hostCommand(s, c, { type: 'next' }, 0); assert.equal(sceneOf(s, c).id, 'act1');
  hostCommand(s, c, { type: 'start' }, 0);
  for (const id of c.scenes[1].items) submitAnswer(s, c, a.id, { scene: 'act1', item: id, c: c.items.find((i: any) => i.id === id).scope }, 500);
  hostCommand(s, c, { type: 'confirmAll' }, 1000);
  assert.equal(s.phase, 'confirmed'); assert.equal(s.confirmedItems.act1.length, 9);
  assert.ok(s.results.act1[a.id].pts >= 900);
  const v = screenView(s, c, 1000); assert.equal(v.summary.length, 9); assert.ok(v.summary.every((x: any) => x.pct === 100));
  hostCommand(s, c, { type: 'back' }, 1100); assert.equal(s.phase, 'reveal');
  hostCommand(s, c, { type: 'next' }, 1200); assert.equal(s.phase, 'confirmed');
  hostCommand(s, c, { type: 'next' }, 1300); assert.equal(sceneOf(s, c).id, 'act2');
  // step through act2 card by card: split → confirm × 9 → summary
  hostCommand(s, c, { type: 'start' }, 1400); hostCommand(s, c, { type: 'close' }, 1500);
  for (let i = 0; i < 1 + 9 * 2; i++) hostCommand(s, c, { type: 'next' }, 1600 + i);
  assert.equal(s.phase, 'confirmed'); assert.equal(s.confirmedItems.act2.length, 9);
  hostCommand(s, c, { type: 'next' }, 2000); assert.equal(sceneOf(s, c).id, 'finale');
  for (let i = 0; i < 5; i++) hostCommand(s, c, { type: 'next' }, 2100 + i);
  assert.equal(s.step, 2); // podium, top, takeaways
});
console.log(`${n} engine tests passed`);
