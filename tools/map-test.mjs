/**
 * tools/map-test.mjs — 地图生成器的纯逻辑测试（无需浏览器）
 * 用法：node tools/map-test.mjs [轮数]
 * 输出：每轮约束结果 + 汇总通过率（要求 100%）
 */
import path from 'node:path';
import { boot, ROOT } from './boot.mjs';

const rounds = +(process.argv[2] || 30);
const { JN } = boot(['src/10-map.js']);

let pass = 0, fail = 0;
const ruleFails = {};
const sizes = [];
let worstDist = 1e9;
const t0 = Date.now();
for (let s = 1; s <= rounds; s++) {
  const seed = s * 7919;
  let map;
  try {
    map = JN.MapGen.generate(seed);
  } catch (e) {
    console.log(`✗ seed ${seed} 生成抛错: ${e.message}\n${e.stack.split('\n')[1]}`);
    fail++; continue;
  }
  const bad = map.checks.list.filter(r => !r.ok);
  if (map.pagoda) {
    let md = 1e9;
    map.buildings.forEach(b => {
      md = Math.min(md, Math.hypot(b.i + b.w / 2 - map.pagoda.i, b.j + b.d / 2 - map.pagoda.j));
    });
    if (md < 1e8) worstDist = Math.min(worstDist, md);
  }
  sizes.push(map.stats.houses);
  if (bad.length === 0) pass++;
  else {
    fail++;
    bad.forEach(r => {
      ruleFails[r.id] = (ruleFails[r.id] || 0) + 1;
      if (fail <= 4) console.log(`  seed ${seed}: [${r.id}] ${r.name} — ${r.detail}`);
    });
  }
}
const dt = Date.now() - t0;
console.log(`\n地图生成 ${rounds} 轮：通过 ${pass} / 失败 ${fail}   (${(dt / rounds).toFixed(1)} ms/张)`);
console.log(`房屋数量 min/avg/max = ${Math.min(...sizes)} / ${(sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1)} / ${Math.max(...sizes)}`);
console.log(`宝塔最近民居距离最小值 = ${worstDist === 1e9 ? 'n/a' : worstDist.toFixed(1)} 格`);
if (Object.keys(ruleFails).length) {
  console.log('\n失败规则统计：');
  Object.entries(ruleFails).forEach(([k, v]) => console.log(`  ${k}: ${v} 次`));
  process.exit(1);
}

// 详细打印一张
const m = JN.MapGen.generate(20261102);
console.log('\n—— 样例 seed 20261102 ——');
console.log(`风格：${m.style.layout.name} / ${m.style.season.name} / ${m.style.time.name}`);
m.checks.list.forEach(r => console.log(` ${r.ok ? '✓' : '✗'} [${r.id}] ${r.name}  ${r.detail}`));
console.log('统计：', JSON.stringify(m.stats));
