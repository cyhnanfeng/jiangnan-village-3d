/* =========================================================================
 * 00-utils.js — 江南古村 · 基础工具（确定性随机、几何合并、批处理）
 * 全局命名空间：window.JN
 * ========================================================================= */
(function () {
  'use strict';
  var JN = (window.JN = window.JN || {});
  JN.models = JN.models || {};
  JN.VERSION = '1.0.0';
  JN.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  JN.lerp = function (a, b, t) { return a + (b - a) * t; };
  JN.smooth = function (t) { return t * t * (3 - 2 * t); };
  JN.TAU = Math.PI * 2;

  /* ---------------- 确定性随机 ---------------- */
  function makeRNG(seed) {
    var a = (seed >>> 0) || 0x9e3779b9;
    function rnd() {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    rnd.range = function (lo, hi) { return lo + (hi - lo) * rnd(); };
    rnd.int = function (lo, hi) { return Math.floor(lo + (hi - lo + 1) * rnd()); };
    rnd.pick = function (arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; };
    rnd.chance = function (p) { return rnd() < p; };
    rnd.sign = function () { return rnd() < 0.5 ? -1 : 1; };
    rnd.shuffle = function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    };
    rnd.fork = function () { return makeRNG(Math.floor(rnd() * 4294967296)); };
    rnd.seed = seed >>> 0;
    return rnd;
  }
  JN.makeRNG = makeRNG;

  /* 全局门面随机（仅用于场景演示，不参与可复现地图） */
  JN.rng = makeRNG(2024);

  JN.hashString = function (s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  /* ---------------- 几何工具 ---------------- */
  JN.geo = {
    /* 把 indexed 几何转成 non-indexed 并返回（不改动原几何） */
    flatten: function (g) {
      if (!g) return null;
      return g.index ? g.toNonIndexed() : g.clone();
    },
    /* 让面法线整体朝上（用于自建曲面） */
    faceUp: function (geo) {
      geo.computeVertexNormals();
      var n = geo.attributes.normal;
      if (!n) return geo;
      var sum = 0;
      for (var i = 0; i < n.count; i++) sum += n.getY(i);
      if (sum < 0) {
        var idx = geo.index;
        if (idx) {
          var arr = idx.array;
          for (var k = 0; k < arr.length; k += 3) {
            var t = arr[k + 1]; arr[k + 1] = arr[k + 2]; arr[k + 2] = t;
          }
          geo.index.needsUpdate = true;
        } else {
          var p = geo.attributes.position;
          for (var v = 0; v < p.count; v += 3) {
            var ax = p.getX(v), ay = p.getY(v), az = p.getZ(v);
            p.setXYZ(v, p.getX(v + 2), p.getY(v + 2), p.getZ(v + 2));
            p.setXYZ(v + 2, ax, ay, az);
          }
          p.needsUpdate = true;
        }
        geo.computeVertexNormals();
      }
      return geo;
    },
    /* 拉伸 UV 密度（让石材、木纹在长条上平铺） */
    scaleUV: function (geo, su, sv) {
      var uv = geo.attributes.uv;
      if (!uv) return geo;
      for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
      uv.needsUpdate = true;
      return geo;
    },
    boxUV: function (geo, su, sv) { return JN.geo.scaleUV(geo, su || 1, sv || 1); }
  };

  /* ---------------- 静态网格合并器 ----------------
   * 把整座村落每种材质合并成极少的 draw call，保持 60fps。
   * 材质必须是共享实例（materials.get 缓存），否则不会合并。
   */
  function Batch() {
    this.buckets = new Map();
    this.sourceMeshes = 0;
    this.vertices = 0;
    this.triangles = 0;
  }
  Batch.prototype.add = function (root) {
    if (!root) return this;
    root.updateWorldMatrix(true, true);
    var self = this;
    root.traverse(function (o) {
      if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) return;
      if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      if (Array.isArray(o.material)) return;
      if (o.userData && (o.userData.skipBatch || o.userData.dynamic)) return;
      if (!o.material || o.material.visible === false) return;
      self._push(o);
    });
    return this;
  };
  Batch.prototype._push = function (mesh) {
    var mat = mesh.material;
    var vc = mat.vertexColors ? 1 : 0;
    var key = mat.uuid + '|' + (mesh.castShadow ? 1 : 0) + (mesh.receiveShadow ? 1 : 0) + '|' + (mesh.renderOrder || 0) + '|' + vc;
    var b = this.buckets.get(key);
    if (!b) {
      b = { mat: mat, cast: !!mesh.castShadow, receive: !!mesh.receiveShadow, order: mesh.renderOrder || 0, pos: [], nor: [], uv: [], col: [] };
      this.buckets.set(key, b);
    }
    // 快速路径：几何克隆 + 原生矩阵变换（比逐顶点 JS 循环快得多）
    var g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    var p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, col = g.attributes.color;
    b.pos.push(new Float32Array(p.array));
    b.nor.push(new Float32Array(n.array));
    if (uv) b.uv.push(new Float32Array(uv.array));
    else b.uv.push(new Float32Array(p.count * 2));
    if (vc) {
      if (col) b.col.push(new Float32Array(col.array));
      else {
        var c = new Float32Array(p.count * 3);
        for (var i = 0; i < c.length; i += 3) { c[i] = 1; c[i + 1] = 1; c[i + 2] = 1; }
        b.col.push(c);
      }
    }
    this.sourceMeshes++;
    g.dispose();
  };

  /* ------------------------------------------------------------------
   * Instancer：模板只合并一次，实例用 InstancedMesh 批量绘制。
   * 大幅降低构建时间与内存（房屋/树/田等重复构件）。
   * ------------------------------------------------------------------ */
  function Instancer() {
    this.templates = new Map();   // key -> { parts: [{mat, geo, cast, receive}], count: 0 }
    this.matrixPool = new Map();  // key -> [Matrix4]
  }
  Instancer.prototype.addTemplate = function (key, root) {
    if (this.templates.has(key)) return this.templates.get(key);
    root.updateMatrixWorld(true);
    var byMat = new Map();
    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      if (Array.isArray(o.material)) return;
      var mat = o.material;
      var k = mat.uuid + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + (o.renderOrder || 0);
      var g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) {
        var uv = new Float32Array(g.attributes.position.count * 2);
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      }
      var part = byMat.get(k);
      if (!part) {
        byMat.set(k, { mat: mat, cast: !!o.castShadow, receive: !!o.receiveShadow, order: o.renderOrder || 0, geos: [g] });
      } else {
        part.geos.push(g);
      }
    });
    var parts = [];
    byMat.forEach(function (v) {
      var total = 0;
      v.geos.forEach(function (g) { total += g.attributes.position.count; });
      var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
      var o3 = 0, o2 = 0;
      v.geos.forEach(function (g) {
        pos.set(g.attributes.position.array, o3);
        nor.set(g.attributes.normal.array, o3);
        uv.set(g.attributes.uv.array, o2);
        o3 += g.attributes.position.array.length;
        o2 += g.attributes.uv.array.length;
        g.dispose();
      });
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      parts.push({ mat: v.mat, geo: geo, cast: v.cast, receive: v.receive, order: v.order });
    });
    var tpl = { parts: parts };
    this.templates.set(key, tpl);
    return tpl;
  };
  Instancer.prototype.add = function (key, matrix) {
    var pool = this.matrixPool.get(key);
    if (!pool) { pool = []; this.matrixPool.set(key, pool); }
    pool.push(matrix.clone());
  };
  Instancer.prototype.build = function (parent, name) {
    var group = new THREE.Group();
    group.name = name || 'instanced';
    var self = this;
    // 按材质把多个模板的实例合并到同一个 InstancedMesh（共享 geometry 不行，
    // 但可以按材质把同材质的多个模板 geometry 顶点拼接成一个"超几何"，
    // 再为每个实例选择对应模板偏移——代价过高。折中：按材质分组，
    // 同材质同模板合并；不同模板仍分开，但总量远小于原网格数。
    this.templates.forEach(function (tpl, key) {
      var mats = self.matrixPool.get(key);
      if (!mats || !mats.length) return;
      tpl.parts.forEach(function (part) {
        var im = new THREE.InstancedMesh(part.geo, part.mat, mats.length);
        im.castShadow = part.cast;
        im.receiveShadow = part.receive;
        im.renderOrder = part.order;
        for (var i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i]);
        im.instanceMatrix.needsUpdate = true;
        im.frustumCulled = true;
        im.name = key + ':' + (part.mat.name || 'mat');
        group.add(im);
      });
    });
    if (parent) parent.add(group);
    return group;
  };
  JN.Instancer = Instancer;
  Batch.prototype.build = function (parent, name) {
    var group = new THREE.Group();
    group.name = name || 'static-batch';
    var self = this;
    this.buckets.forEach(function (b) {
      var count = 0;
      for (var i = 0; i < b.pos.length; i++) count += b.pos[i].length / 3;
      var pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
      var col = b.col.length ? new Float32Array(count * 3) : null;
      var po = 0, uo = 0;
      for (var j = 0; j < b.pos.length; j++) {
        pos.set(b.pos[j], po); nor.set(b.nor[j], po);
        uv.set(b.uv[j], uo);
        if (col) col.set(b.col[j], po);
        po += b.pos[j].length; uo += b.uv[j].length;
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      var mesh = new THREE.Mesh(geo, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.renderOrder = b.order;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      self.vertices += count;
      self.triangles += count / 3;
    });
    if (parent) parent.add(group);
    this.buckets.clear();
    return group;
  };
  JN.Batch = Batch;

  /* ---------------- 轻量动画注册表 ---------------- */
  JN.anim = {
    items: [],
    add: function (fn) { this.items.push(fn); return fn; },
    clear: function () { this.items.length = 0; },
    tick: function (t, dt) {
      for (var i = 0; i < this.items.length; i++) this.items[i](t, dt);
    }
  };

  /* ---------------- 通用清理 ---------------- */
  JN.dispose = function (obj) {
    if (!obj) return;
    obj.traverse(function (o) {
      if (o.isMesh) {
        if (o.geometry && !o.userData.keepGeometry) o.geometry.dispose();
      }
    });
  };

  /* ---------------- 占位模型（模型尚未加载时） ---------------- */
  JN.fallbackModel = function (ctx) {
    var g = new THREE.Group();
    var box = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), ctx.mat('whitewash'));
    box.position.y = 1.5; box.castShadow = true; box.receiveShadow = true;
    g.add(box);
    var roof = ctx.roofGable({ w: 3.2, d: 3.2, h: 1.4, overhang: 0.4 });
    roof.position.y = 3;
    g.add(roof);
    g.userData = { w: 3, d: 3, h: 4.5, door: { x: 0, z: 1.5 }, label: '房舍' };
    return g;
  };
})();
