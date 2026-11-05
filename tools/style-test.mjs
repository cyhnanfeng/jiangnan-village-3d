import { boot } from './boot.mjs';
const { JN } = boot(['src/10-map.js']);

const layouts = ['yinhe', 'shizi', 'qugang', 'huanhu', 'shuanghe'];
const seasons = ['spring', 'summer', 'autumn', 'winter'];
const times = ['dawn', 'noon', 'dusk', 'night'];
let bad = 0, n = 0;
for (const L of layouts) {
  for (const S of seasons) {
    for (const T of times) {
      n++;
      const seed = 1000 + n * 37;
      const m = JN.MapGen.generate(seed, { layout: L, season: S, time: T });
      if (!m.checks.allPass) {
        bad++;
        console.log('FAIL', L, S, T, seed, m.checks.list.filter(r => !r.ok).map(r => r.id));
      }
    }
  }
}
console.log(`\n${n} 种风格组合：通过 ${n - bad} / 失败 ${bad}`);
// 打印各布局的规模
for (const L of layouts) {
  const m = JN.MapGen.generate(20261102, { layout: L });
  console.log(`${L.padEnd(8)} 屋${m.stats.houses} 桥${m.stats.bridges} 田${m.stats.fields} 树${m.stats.trees} 坊${m.stats.paifangs} 水${m.stats.waterCells} 塔距${m.checks.list.find(r => r.id === 'R6').detail}`);
}
process.exit(bad ? 1 : 0);
