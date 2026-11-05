/**
 * tools/boot.mjs — 无浏览器环境加载 JN 运行时（供模型自检使用）
 * 用法：
 *   import { boot, THREE } from './boot.mjs';
 *   const { JN, THREE } = boot();      // 加载 00-utils / 05-kit
 *   const ctx = JN.kit.makeCtx(1234);
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');
const require = createRequire(import.meta.url);

export function boot(extraFiles = []) {
  const g = globalThis;
  g.window = g;
  g.self = g;
  try { if (!g.navigator) g.navigator = { userAgent: 'node' }; } catch (e) { /* node 22+ 只读 */ }
  if (!g.document) {
    g.document = {
      createElement() {
        return {
          width: 0, height: 0,
          getContext() {
            return new Proxy({}, {
              get(t, k) {
                if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
                if (k === 'createRadialGradient' || k === 'createLinearGradient')
                  return () => ({ addColorStop() {} });
                if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
                return () => {};
              },
              set() { return true; }
            });
          }
        };
      },
      createElementNS() { return g.document.createElement(); },
      addEventListener() {},
      body: { appendChild() {}, style: {} },
      documentElement: { style: {} }
    };
  }
  const THREE = require(path.join(ROOT, 'three.min.js'));
  g.THREE = THREE;
  const files = ['src/00-utils.js', 'src/05-kit.js'].concat(extraFiles);
  for (const f of files) {
    const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
    if (!fs.existsSync(abs)) throw new Error('缺少文件: ' + abs);
    const code = fs.readFileSync(abs, 'utf8');
    try {
      new Function('window', 'document', 'THREE', 'module', 'exports', code)(g, g.document, THREE, undefined, undefined);
    } catch (e) {
      throw new Error('加载 ' + f + ' 失败: ' + e.message + '\n' + e.stack);
    }
  }
  return { JN: g.JN, THREE };
}
