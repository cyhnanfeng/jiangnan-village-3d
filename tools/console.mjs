/**
 * tools/console.mjs — 用 CDP 抓取页面控制台与报错（无头 Chrome）
 * 用法：node tools/console.mjs <html> [waitMs]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [html, waitMs = '7000'] = process.argv.slice(2);
const chrome = [
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find(p => p && fs.existsSync(p));
if (!chrome) { console.error('未找到 Chrome'); process.exit(1); }
const url = 'file:///' + path.resolve(html).replace(/\\/g, '/');
const port = 9333;
const args = [
  '--headless=new', '--no-sandbox', '--hide-scrollbars', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--allow-file-access-from-files',
  `--remote-debugging-port=${port}`, '--window-size=1400,820', 'about:blank'
];
const proc = spawn(chrome, args, { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(1600);

async function getWs() {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = await res.json();
  const page = list.find(t => t.type === 'page');
  return page.webSocketDebuggerUrl;
}
const wsUrl = await getWs();
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(`[${msg.params.type}] ` + msg.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    logs.push(`[EXCEPTION] ${d.text} ${d.exception?.description || ''}`);
  }
  if (msg.method === 'Log.entryAdded') {
    logs.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`);
  }
});
await new Promise(r => ws.addEventListener('open', r));
function send(method, params = {}) {
  return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
}
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(+waitMs);
const ev = await send('Runtime.evaluate', {
  expression: `JSON.stringify({title:document.title, ready:document.body.className, loading:document.getElementById('loading')?.className, tip:document.getElementById('ldTip')?.textContent, stats:document.getElementById('stats')?.innerText?.slice(0,300), canvases:document.querySelectorAll('canvas').length})`,
  returnByValue: true
});
console.log('PAGE:', ev.result?.value || JSON.stringify(ev));
console.log('--- console ---');
console.log(logs.slice(0, 40).join('\n') || '(empty)');
ws.close();
proc.kill();
process.exit(0);
