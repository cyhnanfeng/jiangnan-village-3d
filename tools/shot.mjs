/**
 * tools/shot.mjs — 用无头 Chrome 打开构建产物截图（便于视觉审查）
 * 用法：node tools/shot.mjs <html路径> <输出png> [等待毫秒] [宽] [高]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [html, out, waitMs = '6000', w = '1600', h = '900'] = process.argv.slice(2);
if (!html || !out) { console.error('用法: node tools/shot.mjs <html> <png> [waitMs] [w] [h]'); process.exit(2); }
const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => p && fs.existsSync(p));
if (!chrome) { console.error('未找到 Chrome/Edge'); process.exit(1); }
const url = 'file:///' + path.resolve(html).replace(/\\/g, '/');
const args = [
  '--headless=new', '--disable-gpu-sandbox', '--no-sandbox', '--hide-scrollbars',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files',
  `--window-size=${w},${h}`, `--screenshot=${path.resolve(out)}`,
  `--virtual-time-budget=${waitMs}`, url
];
const r = spawnSync(chrome, args, { encoding: 'utf8', timeout: 120000 });
if (r.stderr) console.error(r.stderr.split('\n').filter(l => /ERROR|error|fail/i.test(l)).slice(0, 6).join('\n'));
console.log(fs.existsSync(out) ? '✓ ' + out + ' ' + fs.statSync(out).size + 'B' : '✗ 截图失败');
