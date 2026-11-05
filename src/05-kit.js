/* =========================================================================
 * 05-kit.js — 江南古村 · 材质库与共用构件（瓦作 / 木作 / 石作 / 植被）
 * 所有模型统一通过 ctx.mat(name) 取材质，保证同材质合并与整体风格一致。
 * ========================================================================= */
(function () {
  'use strict';
  var JN = window.JN;
  var HAS_DOM = typeof document !== 'undefined' && !!document.createElement;

  /* ------------------------------------------------------------------
   * 程序化贴图（无 DOM 环境自动跳过，仅用纯色）
   * ------------------------------------------------------------------ */
  function canvasTex(size, draw, opts) {
    if (!HAS_DOM) return null;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    draw(g, size);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (THREE.SRGBColorSpace !== undefined && !(opts && opts.data)) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }

  function noise(g, size, amount, alpha) {
    var img = g.getImageData(0, 0, size, size), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * amount;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
      if (alpha !== undefined) d[i + 3] = alpha;
    }
    g.putImageData(img, 0, 0);
  }

  function blotches(g, size, n, color, rMin, rMax, alpha) {
    for (var i = 0; i < n; i++) {
      var x = Math.random() * size, y = Math.random() * size;
      var r = rMin + Math.random() * (rMax - rMin);
      var grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
      grd.addColorStop(1, 'rgba(' + color + ',0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }

  function texPlaster(warm) {
    return canvasTex(256, function (g, s) {
      g.fillStyle = warm ? '#e7dfcd' : '#e4e1d8';
      g.fillRect(0, 0, s, s);
      blotches(g, s, 46, '122,114,98', 8, 44, 0.05);
      blotches(g, s, 20, '255,252,240', 10, 52, 0.16);
      // 雨水垂痕
      for (var i = 0; i < 26; i++) {
        var x = Math.random() * s, len = 20 + Math.random() * 90;
        var grd = g.createLinearGradient(0, 0, 0, len);
        grd.addColorStop(0, 'rgba(96,90,78,0.10)');
        grd.addColorStop(1, 'rgba(96,90,78,0)');
        g.fillStyle = grd;
        g.fillRect(x, Math.random() * s, 1 + Math.random() * 2, len);
      }
      // 墙脚泛碱
      var foot = g.createLinearGradient(0, s, 0, s * 0.68);
      foot.addColorStop(0, 'rgba(74,70,60,0.28)');
      foot.addColorStop(1, 'rgba(74,70,60,0)');
      g.fillStyle = foot; g.fillRect(0, s * 0.68, s, s * 0.32);
      noise(g, s, 12);
    });
  }

  function texTiles() {
    return canvasTex(256, function (g, s) {
      g.fillStyle = '#5b636c'; g.fillRect(0, 0, s, s);
      var rows = 8, h = s / rows;
      for (var r = 0; r < rows; r++) {
        var y = r * h;
        // 每垄瓦：竖向圆弧明暗
        for (var c = 0; c < 8; c++) {
          var x = c * (s / 8);
          var grd = g.createLinearGradient(x, 0, x + s / 8, 0);
          grd.addColorStop(0, 'rgba(24,29,34,0.55)');
          grd.addColorStop(0.35, 'rgba(112,122,132,0.35)');
          grd.addColorStop(0.6, 'rgba(140,150,158,0.30)');
          grd.addColorStop(1, 'rgba(22,27,32,0.60)');
          g.fillStyle = grd;
          g.fillRect(x, y, s / 8, h);
        }
        g.strokeStyle = 'rgba(18,22,26,0.55)';
        g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(0, y + h - 1); g.lineTo(s, y + h - 1); g.stroke();
        g.strokeStyle = 'rgba(190,198,204,0.15)';
        g.beginPath(); g.moveTo(0, y + 1); g.lineTo(s, y + 1); g.stroke();
      }
      blotches(g, s, 18, '168,178,150', 6, 24, 0.10); // 苔痕
      noise(g, s, 10);
    });
  }

  function texStone() {
    return canvasTex(256, function (g, s) {
      g.fillStyle = '#9a9f9e'; g.fillRect(0, 0, s, s);
      blotches(g, s, 60, '60,66,64', 4, 26, 0.10);
      blotches(g, s, 40, '226,228,222', 3, 18, 0.14);
      for (var i = 0; i < 120; i++) {
        g.fillStyle = 'rgba(48,52,50,' + (0.05 + Math.random() * 0.12) + ')';
        g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 2);
      }
      noise(g, s, 16);
    });
  }

  function texSlab() {
    return canvasTex(256, function (g, s) {
      g.fillStyle = '#8b8f8c'; g.fillRect(0, 0, s, s);
      var n = 4, w = s / n;
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var v = 128 + Math.random() * 26;
        g.fillStyle = 'rgb(' + (v - 20) + ',' + (v - 16) + ',' + (v - 22) + ')';
        g.fillRect(x * w + 1.5, y * w + 1.5, w - 3, w - 3);
      }
      g.strokeStyle = 'rgba(28,32,30,0.55)'; g.lineWidth = 2.4;
      for (var i = 0; i <= n; i++) {
        g.beginPath(); g.moveTo(i * w, 0); g.lineTo(i * w, s); g.stroke();
        g.beginPath(); g.moveTo(0, i * w); g.lineTo(s, i * w); g.stroke();
      }
      blotches(g, s, 30, '54,62,56', 4, 20, 0.12);
      noise(g, s, 14);
    });
  }

  function texWood() {
    return canvasTex(256, function (g, s) {
      g.fillStyle = '#6b4a34'; g.fillRect(0, 0, s, s);
      for (var i = 0; i < 90; i++) {
        var x = Math.random() * s;
        g.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '38,26,18' : '150,116,82') + ',' + (0.05 + Math.random() * 0.2) + ')';
        g.lineWidth = 0.6 + Math.random() * 2.2;
        g.beginPath(); g.moveTo(x, 0);
        for (var y = 0; y < s; y += 16) g.lineTo(x + Math.sin(y * 0.05 + i) * 2.2, y);
        g.stroke();
      }
      noise(g, s, 10);
    });
  }

  function texPaper() {
    return canvasTex(128, function (g, s) {
      g.fillStyle = '#f3e7c6'; g.fillRect(0, 0, s, s);
      blotches(g, s, 25, '190,164,118', 6, 30, 0.18);
      for (var i = 0; i < 40; i++) {
        g.strokeStyle = 'rgba(180,158,112,0.10)';
        g.beginPath();
        var y = Math.random() * s;
        g.moveTo(0, y); g.lineTo(s, y + (Math.random() - 0.5) * 4); g.stroke();
      }
    });
  }

  function texWaterNormal() {
    if (!HAS_DOM) return null;
    var size = 256;
    var c = document.createElement('canvas'); c.width = c.height = size;
    var g = c.getContext('2d');
    var img = g.createImageData(size, size), d = img.data;
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var i = (y * size + x) * 4;
      var u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
      var dx = Math.cos(u * 3 + Math.sin(v * 2)) * 0.5 + Math.cos(v * 5 - u) * 0.25;
      var dy = Math.cos(v * 4 + Math.sin(u * 3)) * 0.5 + Math.cos(u * 6 + v * 2) * 0.25;
      d[i] = 128 + dx * 40; d[i + 1] = 128 + dy * 40; d[i + 2] = 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.LinearSRGBColorSpace !== undefined) t.colorSpace = THREE.LinearSRGBColorSpace;
    return t;
  }

  function texThatch() {
    return canvasTex(256, function (g, s) {
      g.fillStyle = '#b39a63'; g.fillRect(0, 0, s, s);
      for (var i = 0; i < 600; i++) {
        var y = Math.random() * s;
        g.strokeStyle = 'rgba(' + (Math.random() < 0.5 ? '90,72,40' : '224,205,155') + ',' + (0.08 + Math.random() * 0.25) + ')';
        g.lineWidth = 0.8 + Math.random() * 1.6;
        g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + (Math.random() - 0.5) * 3); g.stroke();
      }
      noise(g, s, 12);
    });
  }

  /* 草地/泥土噪声（可平铺），用作地面 multiply 贴图 */
  function texGround() {
    return canvasTex(256, function (g, s) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
      blotches(g, s, 90, '70,84,52', 4, 26, 0.10);
      blotches(g, s, 60, '196,205,160', 3, 18, 0.12);
      for (var i = 0; i < 900; i++) {
        g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '58,70,44' : '206,214,178') + ',' + (0.04 + Math.random() * 0.10) + ')';
        g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 3);
      }
      noise(g, s, 8);
    });
  }

  /* ------------------------------------------------------------------
   * 材质库
   * ------------------------------------------------------------------ */
  var PALETTE = {
    plaster:     { color: 0xf7f3e8, rough: 0.94, tex: 'plaster' },
    plasterWarm: { color: 0xfbf5e4, rough: 0.95, tex: 'plasterWarm' },
    plasterGrey: { color: 0xdfddd4, rough: 0.95, tex: 'plaster' },
    tile:        { color: 0xd6dbe2, rough: 0.78, tex: 'tiles' },
    tileDark:    { color: 0xb9c0c8, rough: 0.72, tex: 'tiles' },
    ridge:       { color: 0x4a525b, rough: 0.7 },
    ridgeLight:  { color: 0x5d666f, rough: 0.68 },
    wood:        { color: 0xd8ba93, rough: 0.82, tex: 'wood' },
    woodDark:    { color: 0x9c7c5d, rough: 0.8, tex: 'wood' },
    woodLight:   { color: 0xf0d5ac, rough: 0.8, tex: 'wood' },
    woodRed:     { color: 0x7c3128, rough: 0.62 },
    woodRedDark: { color: 0x5a241e, rough: 0.6 },
    woodBlack:   { color: 0x2f2a26, rough: 0.66 },
    bamboo:      { color: 0x9aa45c, rough: 0.7 },
    stone:       { color: 0xe2e6e1, rough: 0.92, tex: 'stone' },
    stoneLight:  { color: 0xf2f4ef, rough: 0.9, tex: 'stone' },
    stoneDark:   { color: 0xc0c5c1, rough: 0.9, tex: 'stone' },
    stoneWet:    { color: 0x99a4a2, rough: 0.62, tex: 'stone' },
    slab:        { color: 0xe6e8e4, rough: 0.9, tex: 'slab' },
    slabDark:    { color: 0xced2ce, rough: 0.9, tex: 'slab' },
    brick:       { color: 0xd7d7cf, rough: 0.9, tex: 'stone' },
    thatch:      { color: 0xefdfb7, rough: 0.96, tex: 'thatch' },
    paper:       { color: 0xf5ebd2, rough: 0.85, tex: 'paper', emissive: 0x2a2418, ei: 0.35 },
    paperLit:    { color: 0xffe6b0, rough: 0.8, emissive: 0xffb550, ei: 0.9 },
    clothRed:    { color: 0xb03a2e, rough: 0.9 },
    clothDeep:   { color: 0x87291f, rough: 0.9 },
    clothIndigo: { color: 0x2e4a63, rough: 0.9 },
    clothWhite:  { color: 0xd9d3c4, rough: 0.95 },
    clothUmber:  { color: 0x7d6244, rough: 0.95 },
    gold:        { color: 0xd0a648, rough: 0.34, metal: 0.85 },
    bronze:      { color: 0x8b7248, rough: 0.42, metal: 0.7 },
    iron:        { color: 0x3c3f40, rough: 0.55, metal: 0.6 },
    lacquerRed:  { color: 0x9c3b2c, rough: 0.4 },
    leafSpring:  { color: 0x5f7f3f, rough: 0.9 },
    leafDeep:    { color: 0x3d5a30, rough: 0.9 },
    leafLight:   { color: 0x86a355, rough: 0.9 },
    leafWillow:  { color: 0x93b061, rough: 0.88 },
    leafPine:    { color: 0x36523f, rough: 0.9 },
    leafMaple:   { color: 0xa84a30, rough: 0.9 },
    leafBlossom: { color: 0xe7bccb, rough: 0.9 },
    leafPlum:    { color: 0xc9556b, rough: 0.9 },
    hedge:       { color: 0x4c6b3a, rough: 0.95 },
    rice:        { color: 0x9ab55b, rough: 0.95 },
    riceGold:    { color: 0xc8b060, rough: 0.95 },
    earth:       { color: 0x6f6353, rough: 1.0 },
    mud:         { color: 0x59503f, rough: 1.0 },
    water:       { color: 0x2c4d59, rough: 0.12, metal: 0.08, water: true },
    farHill:     { color: 0x7d8b8f, rough: 1.0, flat: true },
    farHillDeep: { color: 0x63737a, rough: 1.0, flat: true },
    mist:        { color: 0xd7dedd, rough: 1.0, transparent: true, opacity: 0.28, depthWrite: false },
    lantern:     { color: 0xc63a2c, rough: 0.65, emissive: 0xff5a2a, ei: 0.55 },
    lanternGlow: { color: 0xffd08a, emissive: 0xffb045, ei: 1.2 }
  };

  var Materials = {
    cache: Object.create(null),
    textures: null,
    init: function () {
      if (this.textures) return this;
      this.textures = {
        plaster: texPlaster(false),
        plasterWarm: texPlaster(true),
        tiles: texTiles(),
        stone: texStone(),
        slab: texSlab(),
        wood: texWood(),
        paper: texPaper(),
        thatch: texThatch(),
        ground: texGround(),
        waterN: texWaterNormal()
      };
      return this;
    },
    get: function (name) {
      // 容错：允许直接传 THREE.Material 对象（部分模型会这样写）
      if (name && typeof name === 'object' && name.isMaterial) return name;
      if (name === 'whitewash') name = 'plaster';
      if (name === 'white') name = 'plaster';
      if (name === 'woodPaint') name = 'woodRed';
      var m = this.cache[name];
      if (m) return m;
      var def = PALETTE[name];
      if (!def) {
        console.warn('[kit] 未定义材质：' + name + '，回退 plaster');
        def = PALETTE.plaster; name = 'plaster';
      }
      this.init();
      var mat = new THREE.MeshStandardMaterial({
        color: def.color,
        roughness: def.rough !== undefined ? def.rough : 0.9,
        metalness: def.metal || 0,
        flatShading: !!def.flat
      });
      if (def.tex) {
        var t = this.textures[def.tex];
        if (t) {
          var tx = t.clone();
          tx.needsUpdate = true;
          tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
          tx.repeat.set(1, 1);
          tx.anisotropy = 8;
          mat.map = tx;
        }
      }
      if (def.emissive) { mat.emissive = new THREE.Color(def.emissive); mat.emissiveIntensity = def.ei || 0.4; }
      if (def.transparent) { mat.transparent = true; mat.opacity = def.opacity; }
      if (def.depthWrite === false) mat.depthWrite = false;
      if (def.water) {
        var nrm = this.textures.waterN;
        if (nrm) { mat.normalMap = nrm; mat.normalScale = new THREE.Vector2(0.35, 0.35); }
        mat.transparent = true;
        mat.opacity = 0.88;
        mat.side = THREE.DoubleSide;
        mat.envMapIntensity = 1.2;
      }
      if (name === 'mist') mat.side = THREE.DoubleSide;
      this.cache[name] = mat;
      return mat;
    },
    has: function (n) { return !!PALETTE[n]; },
    names: function () { return Object.keys(PALETTE); },
    /* 一次性给所有贴图设定平铺密度（世界单位） */
    uvDensity: 1.0
  };

  /* ------------------------------------------------------------------
   * 几何小工具
   * ------------------------------------------------------------------ */
  var K = (JN.kit = {});

  K.materials = Materials;
  K.mat = function (n) { return Materials.get(n); };

  K.box = function (w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof mat === 'string' ? Materials.get(mat) : mat);
    if (x !== undefined) m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  K.cyl = function (rt, rb, h, seg, mat, x, y, z, open) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10, 1, !!open), typeof mat === 'string' ? Materials.get(mat) : mat);
    if (x !== undefined) m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  K.ring = function (r, tube, seg, mat) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, seg || 20), typeof mat === 'string' ? Materials.get(mat) : mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* 车削：柱础、宝顶、石鼓等 */
  K.lathe = function (pts, seg, mat) {
    var v = pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var g = new THREE.LatheGeometry(v, seg || 16);
    var m = new THREE.Mesh(g, typeof mat === 'string' ? Materials.get(mat) : mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* 多边形棱柱：石栏杆望柱、斗拱等 */
  K.prism = function (rTop, rBot, h, sides, mat) {
    var g = new THREE.CylinderGeometry(rTop, rBot, h, sides, 1);
    var m = new THREE.Mesh(g, typeof mat === 'string' ? Materials.get(mat) : mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* 通用放样面：rows × cols 顶点网格 → 三角面，自动校正为 +Y 朝上 */
  K.surface = function (nx, nz, fn, mat) {
    var pos = [], uv = [], idx = [];
    for (var j = 0; j <= nz; j++) {
      for (var i = 0; i <= nx; i++) {
        var p = fn(i / nx, j / nz);
        pos.push(p[0], p[1], p[2]);
        uv.push(p[3] === undefined ? i / nx : p[3], p[4] === undefined ? j / nz : p[4]);
      }
    }
    for (var jj = 0; jj < nz; jj++) {
      for (var ii = 0; ii < nx; ii++) {
        var a = jj * (nx + 1) + ii, b = a + 1, c = a + nx + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // 校正整体朝向：法线 y 分量为负则翻转索引
    var n = g.attributes.normal, sum = 0;
    for (var k = 0; k < n.count; k++) sum += n.getY(k);
    if (sum < 0) {
      var arr = g.index.array;
      for (var t = 0; t < arr.length; t += 3) { var tmp = arr[t + 1]; arr[t + 1] = arr[t + 2]; arr[t + 2] = tmp; }
      g.index.needsUpdate = true;
      g.computeVertexNormals();
    }
    var m = new THREE.Mesh(g, typeof mat === 'string' ? Materials.get(mat) : mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* 双面片（叶、旗、纸）——复制一份背面，避免材质双面导致的合并问题 */
  K.panel = function (w, h, mat, segW, segH) {
    var g = new THREE.Group();
    var geo = new THREE.PlaneGeometry(w, h, segW || 1, segH || 1);
    var m1 = new THREE.Mesh(geo, typeof mat === 'string' ? Materials.get(mat) : mat);
    var m2 = m1.clone();
    m2.rotation.y = Math.PI;
    g.add(m1); g.add(m2);
    m1.castShadow = true; m2.castShadow = false;
    m1.receiveShadow = true; m2.receiveShadow = true;
    return g;
  };

  /* 平铺 UV 的盒子（石阶、墙面、路面） */
  K.uvBox = function (w, h, d, mat, su, sv) {
    var g = new THREE.BoxGeometry(w, h, d);
    var uv = g.attributes.uv;
    su = su || 1; sv = sv || su;
    for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su * Math.max(1, w), uv.getY(i) * sv * Math.max(1, h));
    var m = new THREE.Mesh(g, typeof mat === 'string' ? Materials.get(mat) : mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* ------------------------------------------------------------------
   * 瓦作：硬山 / 悬山 双坡屋面（带举折、翼角起翘、瓦垄、正脊）
   * opts: w 开间宽, d 进深, h 屋面高, over 出檐, curve 举折, lift 翼角,
   *       tileRows 瓦垄密度, ridge 是否加正脊, gable 端头封山, mat
   * ------------------------------------------------------------------ */
  K.roofGable = function (o) {
    o = o || {};
    var w = o.w || 4, d = o.d || 4, h = o.h || 1.1;
    var over = o.over === undefined ? 0.45 : o.over;
    var curve = o.curve === undefined ? 0.22 : o.curve;
    var lift = o.lift === undefined ? 0.30 : o.lift;
    var W = w / 2 + over, D = d / 2 + over;
    var segX = Math.max(6, Math.round(W * 5));
    var segZ = Math.max(6, Math.round(D * 4));
    var group = new THREE.Group();
    var mat = o.mat || 'tile';
    var roofMat = typeof mat === 'string' ? Materials.get(mat) : mat;
    // 单个坡面的高度函数（t: 0=檐口 1=屋脊）
    function slopeY(t, x) {
      var yy = h * Math.pow(Math.max(0, t), 1.28);
      yy += lift * Math.pow(Math.min(1, Math.abs(x) / W), 4.2) * Math.pow(1 - t, 2.2);
      return yy;
    }
    for (var side = 0; side < 2; side++) {
      var sgn = side === 0 ? 1 : -1;
      var mesh = K.surface(segX, segZ, function (u, v) {
        var x = (u - 0.5) * W * 2;
        var t = 1 - v;                 // v=0 → 屋脊, v=1 → 檐口
        return [x, slopeY(t, x), sgn * (1 - t) * D, u * 2.4, t * D * 2.4];
      }, roofMat);
      group.add(mesh);
    }

    // 瓦垄（沿坡向的细圆脊）
    var rows = o.tileRows || Math.round(w / 0.42);
    if (o.tileRows !== 0) {
      for (var r = 0; r < rows; r++) {
        var rx = -W + (r + 0.5) * (W * 2 / rows);
        for (var sd = 0; sd < 2; sd++) {
          var sg = sd === 0 ? 1 : -1;
          var ridgeGeo = new THREE.CylinderGeometry(0.055, 0.075, 1, 5, 1, true);
          ridgeGeo.rotateX(Math.PI / 2);
          var rp = ridgeGeo.attributes.position;
          for (var k = 0; k < rp.count; k++) {
            var zz = rp.getZ(k) + 0.5;      // 0=脊 1=檐
            var yyy = h * Math.pow(Math.max(0, 1 - zz), 1.28)
              + lift * Math.pow(Math.abs(rx) / W, 4.2) * Math.pow(zz, 2.2);
            rp.setY(k, rp.getY(k) + yyy + 0.035);
            rp.setZ(k, sg * (0.06 + zz * (D - 0.10)));
            rp.setX(k, rp.getX(k) + rx);
          }
          ridgeGeo.computeVertexNormals();
          var rm = new THREE.Mesh(ridgeGeo, Materials.get('ridgeLight'));
          rm.castShadow = false; rm.receiveShadow = true;
          group.add(rm);
        }
      }
    }

    // 檐口瓦当
    for (var sd2 = 0; sd2 < 2; sd2++) {
      var sg2 = sd2 === 0 ? 1 : -1;
      var n = Math.round(W * 2 / 0.30);
      for (var q = 0; q < n; q++) {
        var xq = -W + (q + 0.5) * (W * 2 / n);
        var tile = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 6, 1, false), Materials.get('ridge'));
        tile.rotation.x = Math.PI / 2;
        tile.position.set(xq, lift * Math.pow(Math.abs(xq) / W, 4.2) + 0.06, sg2 * (D - 0.05));
        tile.castShadow = false; tile.receiveShadow = true;
        group.add(tile);
      }
    }

    // 正脊
    if (o.ridge !== false) {
      var rw = W * 2 + 0.1;
      var ridgeBox = K.box(rw, 0.24, 0.3, 'ridge', 0, h + 0.08, 0);
      ridgeBox.castShadow = true;
      group.add(ridgeBox);
      // 脊两端起翘（燕尾）
      for (var e = 0; e < 2; e++) {
        var sx = e === 0 ? -1 : 1;
        var tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 4), Materials.get('ridge'));
        tail.position.set(sx * (rw / 2 - 0.05), h + 0.26, 0);
        tail.rotation.z = sx * -0.5;
        tail.rotation.y = Math.PI / 4;
        tail.castShadow = true;
        tail.scale.z = 0.55;
        group.add(tail);
      }
      if (o.ridgeOrn) {
        var orn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), Materials.get('ridge'));
        orn.position.set(0, h + 0.3, 0);
        group.add(orn);
      }
    }
    group.userData.roof = { w: w, d: d, h: h, over: over };
    return group;
  };

  /* ------------------------------------------------------------------
   * 庑殿顶（宝塔、殿宇）：四坡屋面无正脊
   * ------------------------------------------------------------------ */
  K.roofHip = function (o) {
    o = o || {};
    var w = o.w || 4, d = o.d || 4, h = o.h || 1.2;
    var over = o.over === undefined ? 0.7 : o.over;
    var W = w / 2 + over, D = d / 2 + over;
    var mat = o.mat || 'tile';
    var group = new THREE.Group();
    var matObj = typeof mat === 'string' ? Materials.get(mat) : mat;
    var lift = o.lift === undefined ? 0.35 : o.lift;
    // 四坡：从屋脊（中心）向四边檐口放样；v=0 脊, v=1 檐
    for (var i = 0; i < 4; i++) {
      (function (dir) {
        var mesh = K.surface(12, 8, function (u, v) {
          var x, z, yy = v * h;
          if (dir < 2) {
            var sgn = dir === 0 ? 1 : -1;
            x = (u - 0.5) * 2 * W;
            z = sgn * v * D;
          } else {
            var sgn2 = dir === 2 ? 1 : -1;
            x = sgn2 * v * W;
            z = (u - 0.5) * 2 * D;
          }
          var ex = Math.min(1, Math.abs(u - 0.5) * 2);
          yy += lift * Math.pow(ex, 5) * Math.pow(1 - v, 2);
          return [x, yy, z, u * W * 2.4, v * D * 2.0];
        }, matObj);
        group.add(mesh);
      })(i);
    }
    // 四条垂脊
    for (var c = 0; c < 4; c++) {
      var cx = (c < 2 ? 1 : -1) * W, cz = (c % 2 ? 1 : -1) * D;
      var ridgeLen = Math.sqrt(W * W + D * D);
      var beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, ridgeLen), Materials.get('ridge'));
      var dx = cx, dz = cz;
      var diag = Math.hypot(dx, dz);
      beam.position.set(dx * 0.5, h * 0.5 + 0.06, dz * 0.5);
      beam.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(dx, h, dz).normalize()
      ));
      beam.scale.z = Math.hypot(dx, h, dz) / (diag * ridgeLen * 0 + ridgeLen);
      beam.castShadow = true;
      group.add(beam);
      // 翼角起翘
      var horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 4), Materials.get('ridge'));
      horn.position.set(dx, lift * 0.9 + 0.12, dz);
      horn.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx * 0.6, 1, dz * 0.6).normalize()));
      horn.castShadow = true;
      group.add(horn);
    }
    // 宝顶 / 脊饰
    if (o.finial !== false) {
      var fin = new THREE.Group();
      fin.add(K.lathe([[0.02, 0], [0.2, 0.02], [0.22, 0.1], [0.15, 0.26], [0.1, 0.34], [0.13, 0.42], [0.07, 0.56], [0.02, 0.68]], 12, 'gold'));
      fin.position.y = h - 0.02;
      group.add(fin);
    }
    group.userData.roof = { w: w, d: d, h: h, hip: true };
    return group;
  };

  /* ------------------------------------------------------------------
   * 马头墙（阶梯式山墙）—— 江南民居的灵魂
   * opts: len 进深方向长度, height, steps, mat, top 压顶
   * ------------------------------------------------------------------ */
  K.horseWall = function (o) {
    o = o || {};
    var len = o.len || 6, h = o.height || 4.2;
    var steps = Math.max(1, o.steps || 3);
    var thick = o.thick || 0.24;
    var mat = o.mat || 'plasterGrey';
    var capMat = Materials.get('ridge');
    var g = new THREE.Group();
    var stepLen = len / steps;
    // 高度：中间最高，向两端阶梯跌落
    function tierH(idx) {
      var c = (steps - 1) / 2;
      var d = Math.abs(idx - c) / Math.max(0.5, c);
      return h * (1 - d * (o.drop === undefined ? 0.40 : o.drop));
    }
    for (var s = 0; s < steps; s++) {
      var sh = tierH(s);
      var z = -len / 2 + stepLen * (s + 0.5);
      var wall = K.uvBox(thick, sh, stepLen + 0.02, mat, 0.55, 0.55);
      wall.position.set(0, sh / 2, z);
      g.add(wall);
      // 墙头压顶：中间高、两侧低的双坡小瓦顶
      var capU = new THREE.Mesh(new THREE.BoxGeometry(thick + 0.16, 0.11, stepLen + 0.10), Materials.get('tileDark'));
      capU.position.set(0, sh + 0.055, z);
      capU.castShadow = true;
      g.add(capU);
      for (var e2 = 0; e2 < 2; e2++) {
        var sg2 = e2 === 0 ? 1 : -1;
        var sl = new THREE.Mesh(new THREE.BoxGeometry(thick * 0.62, 0.075, stepLen + 0.06), capMat);
        sl.position.set(sg2 * thick * 0.26, sh + 0.13, z);
        sl.rotation.z = sg2 * -0.48;
        sl.castShadow = true;
        g.add(sl);
      }
      // 墀头（每级两端的翘角瓦）
      for (var e = 0; e < 2; e++) {
        var sg = e === 0 ? 1 : -1;
        var dz = sg * (stepLen / 2 - 0.05);
        var horn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.4, 4), capMat);
        horn.position.set(0, sh + 0.26, z + dz);
        horn.rotation.x = sg * 1.0;
        horn.rotation.y = Math.PI / 4;
        horn.scale.z = 0.7;
        horn.castShadow = true;
        g.add(horn);
      }
      // 墙面横向砖缝暗线
      for (var ln = 0; ln < 3; ln++) {
        var line = K.box(thick + 0.006, 0.012, stepLen * 0.92, 'plaster', 0, sh * (0.28 + ln * 0.24), z);
        g.add(line);
      }
    }
    return g;
  };

  /* ------------------------------------------------------------------
   * 木格窗（花窗）：外框 + 冰裂纹/步步锦棂条 + 窗纸
   * opts: w,h, cols, rows, paper, frame, style('grid'|'ice'|'step'|'round')
   * ------------------------------------------------------------------ */
  K.lattice = function (o) {
    o = o || {};
    var w = o.w || 1.2, h = o.h || 1.4;
    var cols = o.cols || 4, rows = o.rows || 4;
    var mat = o.frame || 'woodDark';
    var g = new THREE.Group();
    var frame = typeof mat === 'string' ? Materials.get(mat) : mat;
    var t = o.bar || 0.05;
    // 窗纸（内凹）
    var paper = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), Materials.get(o.paper || 'paper'));
    paper.position.z = -0.02;
    paper.receiveShadow = true;
    g.add(paper);
    // 外框
    var fw = 0.08;
    g.add(K.box(w, fw, 0.09, frame, 0, h / 2 - fw / 2, 0.015));
    g.add(K.box(w, fw, 0.09, frame, 0, -h / 2 + fw / 2, 0.015));
    g.add(K.box(fw, h, 0.09, frame, -w / 2 + fw / 2, 0, 0.015));
    g.add(K.box(fw, h, 0.09, frame, w / 2 - fw / 2, 0, 0.015));
    // 棂条
    var style = o.style || 'grid';
    if (style === 'grid') {
      for (var c = 1; c < cols; c++) {
        var x = -w / 2 + (w / cols) * c;
        g.add(K.box(t, h - fw * 2, 0.055, frame, x, 0, 0.02));
      }
      for (var r = 1; r < rows; r++) {
        var y = -h / 2 + (h / rows) * r;
        g.add(K.box(w - fw * 2, t, 0.055, frame, 0, y, 0.02));
      }
    } else if (style === 'ice') {
      var rng = o.rng || Math.random;
      var nn = cols * rows;
      for (var i = 0; i < nn; i++) {
        var x0 = -w / 2 + (w / cols) * (i % cols), y0 = -h / 2 + (h / rows) * Math.floor(i / cols);
        var x1 = x0 + w / cols, y1 = y0 + h / rows;
        var seg = 2;
        for (var k = 0; k < seg; k++) {
          var ax = x0 + (x1 - x0) * rng(), ay = y0 + (y1 - y0) * rng();
          var bx = x0 + (x1 - x0) * rng(), by = y0 + (y1 - y0) * rng();
          var len = Math.hypot(bx - ax, by - ay);
          var bar = K.box(len, t, 0.05, frame, (ax + bx) / 2, (ay + by) / 2, 0.02);
          bar.rotation.z = Math.atan2(by - ay, bx - ax);
          g.add(bar);
        }
      }
    } else if (style === 'step') {
      for (var cc = 1; cc < cols; cc++) {
        var xx = -w / 2 + (w / cols) * cc;
        g.add(K.box(t, h - fw * 2, 0.055, frame, xx, 0, 0.02));
      }
      for (var rr = 1; rr < rows; rr++) {
        var yy = -h / 2 + (h / rows) * rr;
        g.add(K.box(w - fw * 2, t, 0.055, frame, 0, yy, 0.02));
      }
      // 步步锦短棂
      for (var a = 0; a < cols; a++) {
        for (var b = 0; b < rows; b++) {
          if ((a + b) % 2) continue;
          var cx = -w / 2 + (w / cols) * (a + 0.5), cy = -h / 2 + (h / rows) * (b + 0.5);
          g.add(K.box(w / cols * 0.55, t * 0.9, 0.05, frame, cx, cy, 0.03));
          g.add(K.box(t * 0.9, h / rows * 0.55, 0.05, frame, cx, cy, 0.03));
        }
      }
    } else if (style === 'round') {
      var ring = K.ring(w * 0.36, t * 0.9, 16, frame);
      ring.position.z = 0.03;
      g.add(ring);
      g.add(K.box(w - fw * 2, t, 0.05, frame, 0, 0, 0.03));
      g.add(K.box(t, h - fw * 2, 0.05, frame, 0, 0, 0.03));
    }
    return g;
  };

  /* ------------------------------------------------------------------
   * 木门：门框、门槛、门钉、门环、门簪
   * opts: w,h, double, studs, mat, step
   * ------------------------------------------------------------------ */
  K.door = function (o) {
    o = o || {};
    var w = o.w || 1.1, h = o.h || 2.1;
    var matName = o.mat || 'woodDark';
    var mat = typeof matName === 'string' ? Materials.get(matName) : matName;
    var g = new THREE.Group();
    var t = 0.12;
    // 门洞内暗部
    var dark = new THREE.Mesh(new THREE.PlaneGeometry(w - t, h - t), Materials.get('woodBlack'));
    dark.position.set(0, h / 2, -0.06);
    g.add(dark);
    if (o.double !== false) {
      for (var s = 0; s < 2; s++) {
        var sg = s === 0 ? -1 : 1;
        var leaf = K.box(w / 2 - t * 0.7, h - t, 0.08, mat, sg * (w / 4 - t * 0.2), h / 2, 0.01);
        g.add(leaf);
        // 门钉
        if (o.studs) {
          for (var r = 0; r < 4; r++) for (var c = 0; c < 2; c++) {
            var stud = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), Materials.get('bronze'));
            stud.position.set(sg * (w / 4 - t * 0.2) + (c - 0.5) * w * 0.18, h * 0.35 + r * h * 0.13, 0.07);
            g.add(stud);
          }
        }
        // 门环
        var knocker = K.ring(0.1, 0.018, 10, 'bronze');
        knocker.position.set(sg * 0.1, h * 0.52, 0.09);
        knocker.rotation.x = 0;
        g.add(knocker);
      }
    } else {
      g.add(K.box(w - t, h - t, 0.08, mat, 0, h / 2, 0.01));
    }
    // 门框
    var frameMat = Materials.get(o.frame || 'stoneDark');
    g.add(K.box(t, h + 0.1, 0.16, frameMat, -w / 2, (h + 0.1) / 2, 0.03));
    g.add(K.box(t, h + 0.1, 0.16, frameMat, w / 2, (h + 0.1) / 2, 0.03));
    g.add(K.box(w + t, 0.18, 0.16, frameMat, 0, h + 0.05, 0.03));
    // 门槛
    g.add(K.box(w, 0.12, 0.3, 'stoneDark', 0, 0.06, 0.06));
    // 门簪
    for (var q = 0; q < 2; q++) {
      var zp = K.cyl(0.06, 0.06, 0.12, 8, 'woodRed', (q ? 1 : -1) * 0.26, h + 0.16, 0.02);
      zp.rotation.x = Math.PI / 2;
      g.add(zp);
    }
    if (o.canopy !== false) {
      // 门罩小披檐
      var canopy = K.roofGable({ w: w + 0.7, d: 0.8, h: 0.28, over: 0.22, curve: 0.06, lift: 0.10, tileRows: 0, ridge: false });
      canopy.position.set(0, h + 0.34, 0.34);
      canopy.scale.z = 0.5;
      g.add(canopy);
    }
    return g;
  };

  /* ------------------------------------------------------------------
   * 石阶 / 台基
   * ------------------------------------------------------------------ */
  K.steps = function (o) {
    o = o || {};
    var w = o.w || 3, n = o.n || 3, rise = o.rise || 0.16, run = o.run || 0.32;
    var mat = o.mat || 'stone';
    var g = new THREE.Group();
    for (var i = 0; i < n; i++) {
      var st = K.uvBox(w, rise * (i + 1), run, mat, 0.5, 0.5);
      st.position.set(0, rise * (i + 1) / 2, -i * run - run / 2);
      g.add(st);
    }
    return g;
  };

  /* 台基（须弥座简化） */
  K.plinth = function (o) {
    o = o || {};
    var w = o.w || 4, d = o.d || 3, h = o.h || 0.35;
    var g = new THREE.Group();
    var base = K.uvBox(w, h, d, o.mat || 'stoneDark', 0.6, 0.6);
    base.position.y = h / 2;
    g.add(base);
    var top = K.uvBox(w + 0.08, 0.06, d + 0.08, 'stoneLight', 0.6, 0.6);
    top.position.y = h + 0.02;
    g.add(top);
    return g;
  };

  /* ------------------------------------------------------------------
   * 石栏杆：望柱 + 栏板（可沿直线或折线排布）
   * ------------------------------------------------------------------ */
  K.railing = function (o) {
    o = o || {};
    var len = o.len || 4, h = o.h || 0.85;
    var mat = o.mat || 'stoneLight';
    var g = new THREE.Group();
    var count = Math.max(2, Math.round(len / (o.spacing || 0.9)));
    for (var i = 0; i <= count; i++) {
      var x = -len / 2 + (len / count) * i;
      var post = K.box(0.12, h, 0.12, mat, x, h / 2, 0);
      g.add(post);
      var cap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), typeof mat === 'string' ? Materials.get(mat) : mat);
      cap.position.set(x, h, 0);
      g.add(cap);
      if (i < count) {
        var panel = K.uvBox(len / count - 0.16, h * 0.62, 0.07, mat, 0.5, 0.5);
        panel.position.set(x + len / count / 2, h * 0.46, 0);
        g.add(panel);
      }
    }
    return g;
  };

  /* ------------------------------------------------------------------
   * 灯笼：可挂可立，含发光纸罩与流苏
   * ------------------------------------------------------------------ */
  K.lantern = function (o) {
    o = o || {};
    var r = o.r || 0.22, hh = o.h || 0.42;
    var g = new THREE.Group();
    var body = K.lathe([[0.02, -hh * 0.55], [r * 0.55, -hh * 0.5], [r, -hh * 0.18], [r * 0.95, hh * 0.05], [r * 0.6, hh * 0.38], [0.09, hh * 0.5]], 12, o.mat || 'lantern');
    g.add(body);
    var top = K.cyl(0.10, 0.10, 0.05, 8, 'woodBlack', 0, hh * 0.52, 0);
    g.add(top);
    var bot = K.cyl(0.09, 0.09, 0.05, 8, 'woodBlack', 0, -hh * 0.55, 0);
    g.add(bot);
    var tas = K.cyl(0.012, 0.012, 0.22, 4, 'clothDeep', 0, -hh * 0.7, 0);
    g.add(tas);
    if (o.string !== false) {
      var str = K.cyl(0.008, 0.008, o.string || 0.5, 3, 'woodBlack', 0, hh * 0.5 + (o.string || 0.5) / 2, 0);
      g.add(str);
    }
    if (o.light !== false) {
      var pl = new THREE.PointLight(0xffa64d, 0.6, 6, 2);
      pl.position.y = -hh * 0.1;
      g.add(pl);
      g.userData.light = pl;
    }
    return g;
  };

  /* ------------------------------------------------------------------
   * 旗幡 / 酒旗 / 晾衣
   * ------------------------------------------------------------------ */
  K.banner = function (o) {
    o = o || {};
    var w = o.w || 0.5, h = o.h || 1.5;
    var mat = o.mat || 'clothWhite';
    var g = new THREE.Group();
    var pole = K.cyl(0.035, 0.045, o.pole || 3.2, 6, 'bamboo', w / 2 + 0.08, (o.pole || 3.2) / 2, 0);
    g.add(pole);
    var geo = new THREE.PlaneGeometry(w, h, 6, 8);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin((y / h + 0.5) * 3 + x * 2) * 0.05 * (1 - (y / h + 0.5)));
    }
    geo.computeVertexNormals();
    var flag = new THREE.Mesh(geo, Materials.get(mat));
    flag.position.set(w / 2 + 0.03 - w / 2 + 0.05, (o.pole || 3.2) - h / 2 - 0.25, 0);
    flag.material.side = THREE.DoubleSide;
    flag.castShadow = true;
    g.add(flag);
    g.userData.flag = flag;
    return g;
  };

  /* ------------------------------------------------------------------
   * 植被：树干（可弯曲）、树冠团块
   * ------------------------------------------------------------------ */
  K.trunk = function (o) {
    o = o || {};
    var h = o.h || 3, r0 = o.r || 0.18, r1 = o.rTip || r0 * 0.5;
    var bend = o.bend || 0, seg = o.seg || 7, sides = o.sides || 6;
    var mat = o.mat || 'woodDark';
    var g = new THREE.Group();
    var geo = new THREE.CylinderGeometry(r1, r0, h, sides, seg, false);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) + h / 2;
      var t = y / h;
      var bx = Math.sin(t * (o.wave || 1.2) * Math.PI) * bend;
      var bz = Math.cos(t * (o.wave || 1.2) * Math.PI * 0.7) * bend * 0.6;
      pos.setX(i, pos.getX(i) + bx);
      pos.setZ(i, pos.getZ(i) + bz);
      // 根部膨大
      var flare = t < 0.12 ? 1 + (0.12 - t) * 3.2 * (o.rootFlare || 1) : 1;
      pos.setX(i, pos.getX(i) * flare);
      pos.setZ(i, pos.getZ(i) * flare);
    }
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, Materials.get(mat));
    m.position.y = h / 2;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    g.userData.height = h;
    g.userData.bend = bend;
    return g;
  };

  /* 树冠团块：噪声扰动的 icosahedron，可按顶点着色深浅 */
  K.blob = function (o) {
    o = o || {};
    var r = o.r || 0.8, mat = o.mat || 'leafSpring';
    var geo = new THREE.IcosahedronGeometry(r, o.detail === undefined ? 2 : o.detail);
    var pos = geo.attributes.position;
    var seed = o.seed === undefined ? Math.random() * 100 : o.seed;
    var amp = o.amp === undefined ? 0.18 : o.amp;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var n = Math.sin(x * 3.1 + seed) * Math.cos(y * 2.7 - seed * 0.7) * Math.sin(z * 3.3 + seed * 1.3);
      var k = 1 + n * amp;
      pos.setXYZ(i, x * k, y * k * (o.flatY || 1), z * k);
    }
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, Materials.get(mat));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* 叶片面片（柳条、竹叶、芦苇）——用双面材质 */
  K. leaflets = function (count, opts) {
    opts = opts || {};
    var g = new THREE.Group();
    return g;
  };

  /* ------------------------------------------------------------------
   * 地面小物件：石臼、陶罐、柴堆、石磨
   * ------------------------------------------------------------------ */
  K.jar = function (o) {
    o = o || {};
    var r = o.r || 0.26, h = o.h || 0.6;
    var pts = [[0, 0], [r * 0.72, 0], [r * 0.92, h * 0.2], [r, h * 0.5], [r * 0.85, h * 0.82], [r * 0.55, h * 0.95], [0, h * 0.97]];
    var m = K.lathe(pts, 12, o.mat || 'woodBlack');
    return m;
  };

  K.crate = function (w, h, d, mat) {
    return K.box(w, h, d, mat || 'wood');
  };

  /* ------------------------------------------------------------------
   * 斗拱（简化但可辨）：栌斗 + 华拱 + 散斗
   * ------------------------------------------------------------------ */
  K.bracket = function (o) {
    o = o || {};
    var s = o.s || 0.5;
    var mat = o.mat || 'woodRed';
    var g = new THREE.Group();
    var lu = K.box(s * 0.62, s * 0.42, s * 0.62, mat, 0, s * 0.21, 0);
    g.add(lu);
    for (var i = 0; i < 2; i++) {
      var sg = i === 0 ? 1 : -1;
      var gong = K.box(s * 1.5, s * 0.3, s * 0.24, mat, 0, s * 0.52, sg * s * 0.28);
      g.add(gong);
      gong.rotation.x = 0;
      var dou = K.box(s * 0.3, s * 0.26, s * 0.3, mat, sg * s * 0.55, s * 0.62, 0);
      g.add(dou);
      var ang = K.box(s * 0.2, s * 0.9, s * 0.2, mat, sg * s * 0.72, s * 0.62, sg * s * 0.36);
      ang.rotation.x = sg * 0.55;
      g.add(ang);
    }
    return g;
  };

  /* 单坡披檐（腰檐、廊檐） */
  K.shedRoof = function (o) {
    o = o || {};
    var w = o.w || 3, d = o.d || 1.2, h = o.h || 0.35;
    var g = new THREE.Group();
    var mesh = K.surface(6, 4, function (u, v) {
      var x = (u - 0.5) * w;
      var z = v * d;
      var y = v * h + (o.lift || 0) * Math.pow(Math.abs(u - 0.5) * 2, 4) * (1 - v);
      return [x, y, z, u * w, v * d * 2];
    }, o.mat || 'tile');
    g.add(mesh);
    // 檐口瓦当
    var n = Math.round(w / 0.30);
    for (var i = 0; i < n; i++) {
      var t = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 6), Materials.get('ridge'));
      t.rotation.x = Math.PI / 2;
      t.position.set(-w / 2 + (i + 0.5) * w / n, 0.04, d - 0.06);
      t.castShadow = false; t.receiveShadow = true;
      g.add(t);
    }
    return g;
  };

  /* 木栏杆（沿 X 方向） */
  K.woodRailing = function (o) {
    o = o || {};
    var len = o.len || 3, h = o.h || 0.55;
    var mat = o.mat || 'woodDark';
    var g = new THREE.Group();
    var n = Math.max(2, Math.round(len / 0.35));
    g.add(K.box(len, 0.06, 0.08, mat, 0, h, 0));
    g.add(K.box(len, 0.04, 0.05, mat, 0, h * 0.42, 0));
    for (var i = 0; i <= n; i++) {
      g.add(K.box(0.05, h, 0.05, mat, -len / 2 + len * i / n, h / 2, 0));
    }
    return g;
  };

  /* 匾额（含文字贴图） */
  var plaqueCache = Object.create(null);
  K.plaque = function (o) {
    o = o || {};
    var text = o.text || '江南';
    var w = o.w || 1.8, h = o.h || 0.55;
    var g = new THREE.Group();
    var key = text + '|' + (o.bg || '#2a2420') + '|' + (o.fg || '#d8b45a');
    var mat = plaqueCache[key];
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
      if (HAS_DOM) {
        var c = document.createElement('canvas');
        c.width = 256; c.height = 80;
        var x2 = c.getContext('2d');
        x2.fillStyle = o.bg || '#2a2420';
        x2.fillRect(0, 0, 256, 80);
        x2.strokeStyle = o.fg || '#d8b45a';
        x2.lineWidth = 4;
        x2.strokeRect(4, 4, 248, 72);
        x2.fillStyle = o.fg || '#d8b45a';
        x2.font = 'bold 46px "Songti SC","STSong","SimSun",serif';
        x2.textAlign = 'center';
        x2.textBaseline = 'middle';
        x2.fillText(text, 128, 42);
        var t = new THREE.CanvasTexture(c);
        if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
        mat.map = t;
      }
      plaqueCache[key] = mat;
    }
    var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), mat);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    var frameMat = Materials.get(o.frame || 'woodBlack');
    var t2 = 0.07;
    g.add(K.box(w + t2 * 2, t2, 0.12, frameMat, 0, h / 2 + t2 / 2, 0));
    g.add(K.box(w + t2 * 2, t2, 0.12, frameMat, 0, -h / 2 - t2 / 2, 0));
    g.add(K.box(t2, h, 0.12, frameMat, -w / 2 - t2 / 2, 0, 0));
    g.add(K.box(t2, h, 0.12, frameMat, w / 2 + t2 / 2, 0, 0));
    return g;
  };
  /* 匾额的材质也要能被合并：注册进材质库缓存 */
  K.plaqueMaterials = plaqueCache;

  /* 太湖石 / 假山 */
  K.rock = function (o) {
    o = o || {};
    var r = o.r || 0.6;
    var geo = new THREE.IcosahedronGeometry(r, o.detail === undefined ? 1 : o.detail);
    var pos = geo.attributes.position;
    var seed = o.seed === undefined ? 1.7 : o.seed;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var n = Math.sin(x * 4.1 + seed) * Math.cos(z * 3.3 + seed * 1.7) * Math.sin(y * 2.9 - seed);
      var k = 1 + n * 0.42;
      pos.setXYZ(i, x * k * (o.sx || 1), y * k * (o.sy || 0.8) + r * 0.3, z * k * (o.sz || 1));
    }
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, Materials.get(o.mat || 'stoneDark'));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };

  /* 草丛 / 苔簇（几片交叉的叶面） */
  K.grassTuft = function (o) {
    o = o || {};
    var n = o.n || 5, h = o.h || 0.45;
    var mat = o.mat || 'leafLight';
    var g = new THREE.Group();
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + (o.seed || 0);
      var blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, h * (0.6 + 0.5 * ((i * 37 % 10) / 10)), 3), Materials.get(mat));
      blade.position.set(Math.cos(a) * 0.06, h * 0.4, Math.sin(a) * 0.06);
      blade.rotation.z = Math.cos(a) * 0.45;
      blade.rotation.x = -Math.sin(a) * 0.45;
      blade.castShadow = false;
      g.add(blade);
    }
    return g;
  };

  /* 竹篱 / 矮栅 */
  K.fence = function (o) {
    o = o || {};
    var len = o.len || 4, h = o.h || 0.9;
    var g = new THREE.Group();
    var n = Math.round(len / (o.gap || 0.22));
    for (var i = 0; i <= n; i++) {
      var p = K.cyl(0.028, 0.034, h * (0.9 + ((i * 13) % 5) / 20), 4, 'bamboo', -len / 2 + len * i / n, h / 2, 0);
      p.rotation.z = ((i * 7) % 5 - 2) * 0.02;
      g.add(p);
    }
    g.add(K.box(len, 0.045, 0.045, 'bamboo', 0, h * 0.78, 0));
    g.add(K.box(len, 0.04, 0.04, 'bamboo', 0, h * 0.36, 0));
    return g;
  };

  /* 石狮（镇宅 / 牌坊 / 桥头） */
  K.lion = function (o) {
    o = o || {};
    var s = o.s || 1;
    var mat = o.mat || 'stoneLight';
    var g = new THREE.Group();
    // 须弥座
    g.add(K.uvBox(0.72 * s, 0.34 * s, 0.9 * s, 'stoneDark', 0.6, 0.6).translateY(0.17 * s));
    // 身
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 10, 8), Materials.get(mat));
    body.scale.set(0.82, 1.05, 1.25);
    body.position.set(0, 0.62 * s, -0.05 * s);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    // 前腿
    for (var i = 0; i < 2; i++) {
      var sg = i === 0 ? 1 : -1;
      var leg = K.cyl(0.075 * s, 0.09 * s, 0.5 * s, 6, mat, sg * 0.14 * s, 0.5 * s, 0.24 * s);
      g.add(leg);
      var paw = K.box(0.16 * s, 0.1 * s, 0.2 * s, mat, sg * 0.14 * s, 0.28 * s, 0.28 * s);
      g.add(paw);
    }
    // 头
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.21 * s, 10, 8), Materials.get(mat));
    head.position.set(0, 0.98 * s, 0.1 * s);
    head.scale.set(1, 0.95, 0.95);
    head.castShadow = true; head.receiveShadow = true;
    g.add(head);
    // 鬃毛（一圈小球）
    for (var k = 0; k < 9; k++) {
      var a = (k / 9) * Math.PI * 2;
      var curl = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 6, 5), Materials.get(mat));
      curl.position.set(Math.cos(a) * 0.19 * s, 0.98 * s + Math.sin(a) * 0.16 * s, 0.02 * s);
      g.add(curl);
    }
    // 耳、眼、嘴
    for (var e = 0; e < 2; e++) {
      var sg2 = e === 0 ? 1 : -1;
      var ear = new THREE.Mesh(new THREE.ConeGeometry(0.055 * s, 0.1 * s, 4), Materials.get(mat));
      ear.position.set(sg2 * 0.13 * s, 1.12 * s, 0.06 * s);
      g.add(ear);
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 6, 5), Materials.get('woodBlack'));
      eye.position.set(sg2 * 0.08 * s, 1.02 * s, 0.26 * s);
      g.add(eye);
    }
    g.add(K.box(0.16 * s, 0.05 * s, 0.06 * s, 'woodBlack', 0, 0.9 * s, 0.28 * s));
    // 尾
    var tail = new THREE.Mesh(new THREE.ConeGeometry(0.09 * s, 0.4 * s, 5), Materials.get(mat));
    tail.position.set(0, 0.85 * s, -0.3 * s);
    tail.rotation.x = -0.5;
    g.add(tail);
    return g;
  };

  /* 拴马桩 / 石柱 */
  K.post = function (o) {
    o = o || {};
    var h = o.h || 1.2, r = o.r || 0.09;
    var g = new THREE.Group();
    g.add(K.uvBox(r * 2.6, 0.12, r * 2.6, 'stoneDark', 0.5, 0.5).translateY(0.06));
    g.add(K.cyl(r * 0.85, r, h, 8, o.mat || 'stoneLight', 0, h / 2 + 0.1, 0));
    var cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.25, 8, 6), Materials.get(o.mat || 'stoneLight'));
    cap.position.y = h + 0.1;
    g.add(cap);
    return g;
  };

  /* ------------------------------------------------------------------
   * ctx 工厂：每个模型 build 时拿到统一的构建上下文
   * ------------------------------------------------------------------ */
  K.makeCtx = function (seed) {
    var rng = JN.makeRNG(seed === undefined ? 1234 : seed);
    var ctx = {
      THREE: THREE,
      rng: rng,
      seed: seed,
      mat: function (n) { return Materials.get(n); },
      box: function (w, h, d, m, x, y, z) { return K.box(w, h, d, m, x, y, z); },
      cyl: function (a, b, c, d, e, f, g2, h) { return K.cyl(a, b, c, d, e, f, g2, h); },
      uvBox: function (w, h, d, m, su, sv) { return K.uvBox(w, h, d, m, su, sv); },
      lathe: function (p, s, m) { return K.lathe(p, s, m); },
      roofGable: K.roofGable,
      roofHip: K.roofHip,
      horseWall: K.horseWall,
      lattice: K.lattice,
      door: K.door,
      steps: K.steps,
      plinth: K.plinth,
      railing: K.railing,
      lantern: K.lantern,
      banner: K.banner,
      trunk: K.trunk,
      blob: K.blob,
      jar: K.jar,
      kit: K,
      surface: K.surface,
      panel: K.panel,
      bracket: K.bracket,
      shedRoof: K.shedRoof,
      woodRailing: K.woodRailing,
      plaque: K.plaque,
      rock: K.rock,
      grass: K.grassTuft,
      fence: K.fence,
      lion: K.lion,
      post: K.post
    };
    return ctx;
  };

  K.PALETTE = PALETTE;
  K.HAS_DOM = HAS_DOM;

  /* Node 测试环境下导出（浏览器中 JN 已在 window 上） */
  if (typeof module !== 'undefined' && module.exports) module.exports = JN;
})();
