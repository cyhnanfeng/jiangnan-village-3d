/**
 * tools/probe.mjs — 在页面里执行任意表达式并打印结果
 * 用法：node tools/probe.mjs <html> "<js表达式>" [waitMs]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [html, expr, waitMs = '7000'] = process.argv.slice(2);
const chrome = [process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe']
  .find(p => p && fs.existsSync(p));
if (!chrome) { console.error('未找到 Chrome'); process.exit(1); }
const url = 'file:///' + path.resolve(html).replace(/\\/g, '/');
const port = 9334;
const proc = spawn(chrome, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--allow-file-access-from-files', `--remote-debugging-port=${port}`,
  '--window-size=1200,760', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(1600);
async function getWs() {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = await res.json();
  return list.find(t => t.type === 'page').webSocketDebuggerUrl;
}
const ws = new WebSocket(await getWs());
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') logs.push('[' + m.params.type + '] ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('[EXC] ' + m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
});
await new Promise(r => ws.addEventListener('open', r));
function send(method, params = {}) {
  return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
}
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(+waitMs);
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
console.log('RESULT:', JSON.stringify(r.result?.value ?? r.result?.description ?? r, null, 1).slice(0, 4000));
const shotIdx = process.argv.indexOf('--shot');
if (shotIdx >= 0) {
  const out = process.argv[shotIdx + 1];
  await sleep(400);
  const cap = await send('Page.captureScreenshot', { format: 'png' });
  if (cap.data) {
    fs.writeFileSync(out, Buffer.from(cap.data, 'base64'));
    console.log('✓ shot ' + out);
  }
}
if (logs.length) console.log('--- console ---\n' + logs.slice(0, 20).join('\n'));
ws.close(); proc.kill(); process.exit(0);
