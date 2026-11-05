/**
 * tools/verify.mjs — 单个模型的质量与契约自检
 * 用法：node tools/verify.mjs <modelName> [--file models/xxx.js] [--strict]
 */
import fs from 'node:fs';
import path from 'node:path';
import { boot, ROOT } from './boot.mjs';

const args = process.argv.slice(2);
const name = args[0];
if (!name) { console.error('用法: node tools/verify.mjs <modelName>'); process.exit(2); }
const fileIdx = args.indexOf('--file');
const rel = fileIdx >= 0 ? args[fileIdx + 1] : `models/${name}.js`;
const strict = args.includes('--strict');

const { JN, THREE } = boot([rel]);
const factory = JN.models[name];
const fails = [];
const warns = [];
const stat = { name, meshes: 0, tris: 0, mats: new Set(), seeds: [], bbox: null };

if (typeof factory !== 'function') {
  console.error(`✗ JN.models['${name}'] 未注册（应在文件里写 JN.defineModel('${name}', fn) 或 JN.models['${name}'] = fn）`);
  process.exit(1);
}

function checkTriangles(root) {
  let tris = 0, meshes = 0;
  root.traverse(o => {
    if (o.isMesh && o.geometry) {
      meshes++;
      const g = o.geometry;
      const n = g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
      tris += n;
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => stat.mats.add(m.name || m.uuid.slice(0, 6)));
      if (o.castShadow === false && o.receiveShadow === false) warns.push('存在未开阴影的网格（可能是有意为之）');
    }
  });
  return { tris, meshes };
}

const seeds = [1, 7, 2024, 99991];
for (const seed of seeds) {
  let root;
  try {
    const ctx = JN.kit.makeCtx(seed);
    root = factory(ctx);
  } catch (e) {
    fails.push(`seed ${seed} 构建抛错: ${e.message}\n${e.stack.split('\n').slice(1, 4).join('\n')}`);
    continue;
  }
  if (!root || !root.isObject3D) { fails.push(`seed ${seed} 未返回 THREE.Object3D（得到 ${root}）`); continue; }
  const r = checkTriangles(root);
  if (seed === 1) { stat.tris = r.tris; stat.meshes = r.meshes; }
  if (r.tris > 120000) warns.push(`seed ${seed} 三角面 ${r.tris.toFixed(0)} 过多（建议 < 60k）`);
  if (r.meshes > 900) warns.push(`seed ${seed} 网格数量 ${r.meshes} 过多（合并前建议 < 600）`);

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (!isFinite(box.min.x) || !isFinite(box.max.y)) fails.push(`seed ${seed} 包围盒含 NaN/Infinity`);
  const size = box.getSize(new THREE.Vector3());
  if (seed === 1) stat.bbox = [size.x, size.y, size.z].map(v => +v.toFixed(2));
  if (Math.abs(box.min.y) > 0.06 && !root.userData.allowFloat) warns.push(`seed ${seed} 底部 y=${box.min.y.toFixed(3)} 未贴地（模型原点应在脚底）`);

  // 几何数据健康检查
  let bad = 0;
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const p = o.geometry.attributes.position;
    if (!p) { bad++; return; }
    for (let i = 0; i < p.array.length; i++) if (!Number.isFinite(p.array[i])) { bad++; break; }
    if (o.scale.x === 0 || o.scale.y === 0 || o.scale.z === 0) bad++;
  });
  if (bad) fails.push(`seed ${seed} 有 ${bad} 个网格含 NaN 或零缩放`);
  if (seed === 1) {
    const need = { house: 8, hall: 8, shop: 8, bridge: 6, bridgeFlat: 4, paifang: 4, pagoda: 8, tree: 4, boat: 3, field: 2, wharf: 3, props: 3, pavilion: 4, corridor: 4 };
    const minTris = need[name] || 3;
    if (stat.tris < minTris * 1500) warns.push(`细节量可能不足：三角面 ${stat.tris.toFixed(0)}（${name} 建议 ≥ ${(minTris * 1500).toLocaleString()}）`);
  }
  JN.dispose(root);
}

if (!stat.bbox) { console.error('✗ 无法得出包围盒'); process.exit(1); }

console.log(`\n=== ${name} ===`);
console.log(`  文件      ${rel}`);
console.log(`  三角面    ${stat.tris.toFixed(0)}（合并前，seed 1）`);
console.log(`  网格      ${stat.meshes}`);
console.log(`  尺寸 W×H×D ${stat.bbox.join(' × ')}`);
console.log(`  材质      ${[...stat.mats].length} 种`);
if (warns.length) { console.log('\n  提示:'); [...new Set(warns)].forEach(w => console.log('   · ' + w)); }
if (fails.length) {
  console.log('\n  错误:');
  fails.forEach(f => console.log('   ✗ ' + f));
  process.exit(1);
}
console.log('\n✓ 契约检查通过');
