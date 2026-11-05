/**
 * tools/preview-build.mjs — 生成工具模型预览页（内联 models）
 * node tools/preview-build.mjs [m1,m2,...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './boot.mjs';

const names = (process.argv[2] || '').split(',').filter(Boolean);
const dir = path.join(ROOT, 'models');
const files = (names.length ? names.map(n => path.join(dir, n + '.js')).filter(f => fs.existsSync(f)) : fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('_')).map(f => path.join(dir, f)));
let code = files.map(f => `/* ==== ${path.basename(f)} ==== */\n` + fs.readFileSync(f, 'utf8')).join('\n').replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync(path.join(ROOT, 'tools/preview.html'), 'utf8');
let out = tpl.replace('/*__MODELS__*/', code);
// 默认展示本次打包的模型
out = out.replace("var names = (q.get('m') || '_smoke').split(',');",
  "var names = (q.get('m') || '" + (names.join(',') || '_smoke') + "').split(',');");
const target = path.join(ROOT, 'tools/_preview.html');
fs.writeFileSync(target, out, 'utf8');
console.log('✓ ' + target + ' (' + (out.length / 1024).toFixed(0) + 'KB) models=' + files.length);
