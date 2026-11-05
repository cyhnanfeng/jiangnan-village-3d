/**
 * build.mjs — 把 src + models + three.min.js 打成单个 HTML
 * node build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, 'src');
const tpl = fs.readFileSync(path.join(src, 'index.template.html'), 'utf8');
const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
const three = fs.readFileSync(path.join(here, 'three.min.js'), 'utf8')
  // 把开头的 console.warn(...) 换成 0，保留 "0, function(t,e){...}(...)" 的合法表达式结构
  .replace(/^console\.warn\(([\s\S]{0,400}?)\),/, '0,')
  .replace(/\/\/# sourceMappingURL=.*$/gm, '')
  .replace(/<\/script/gi, '<\\/script');

const modelFiles = fs.readdirSync(path.join(here, 'models'))
  .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
  .sort();
const required = ['house', 'hall', 'shop', 'bridge', 'bridgeFlat', 'paifang', 'pagoda', 'tree', 'boat', 'field', 'wharf', 'props', 'pavilion', 'corridor'];
const have = modelFiles.map((f) => f.replace(/\.js$/, ''));
const missing = required.filter((m) => !have.includes(m));

const modelCode = modelFiles
  .map((f) => `/* ================= ${f} ================= */\n` + fs.readFileSync(path.join(here, 'models', f), 'utf8'))
  .join('\n')
  .replace(/<\/script/gi, '<\\/script');

const readSrc = (f) => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(src, f), 'utf8');
const pre = ['00-utils.js', '05-kit.js'].map(readSrc).join('\n');
const post = ['10-map.js', '20-world.js', '30-app.js'].map(readSrc).join('\n');
const app = (pre + '\n' + modelCode + '\n' + post).replace(/<\/script/gi, '<\\/script');

let out = tpl
  .replace('/*__CSS__*/', () => css)
  .replace('/*__THREE__*/', () => three)
  .replace('/*__APP__*/', () => app);              // 先基础库 → 再模型注册 → 最后地图/世界/应用

// 同时输出：仓库根 index.html（GitHub Pages 入口）与上级目录的独立成品
const targets = [path.join(here, 'index.html'), path.join(here, '..', '江南古村.html')];
for (const t of targets) fs.writeFileSync(t, out, 'utf8');
console.log(`✓ ${targets.join('\n✓ ')}`);
console.log(`  ${(out.length / 1024).toFixed(0)} KB · 模型 ${modelFiles.length} 个`);
if (missing.length) console.log(`  ⚠ 缺少模型：${missing.join(', ')}（将用占位/跳过）`);
