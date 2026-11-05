/* =========================================================================
 * models/bridgeFlat.js —— 平桥 / 石板桥（江南水乡低矮贴水小桥，与拱桥互补）
 * 通行方向沿本地 X 轴，桥宽沿 Z；y = 0 为水面标高，桥墩底面亦为 0。
 * ========================================================================= */
(function () {
  'use strict';
  var JN = window.JN;
  var PI = Math.PI;
  var TAU = Math.PI * 2;

  JN.models['bridgeFlat'] = function (ctx) {
    var rng = ctx.rng;
    var g = new THREE.Group();

    function M(n) { return ctx.mat(n); }

    /* ==================================================================
     * 0. 石作几何工具
     * ================================================================== */
    var DENS = 1.15;

    function planarUV(geo, dens) {
      var p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
      if (!uv || !n) return;
      for (var i = 0; i < p.count; i++) {
        var ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        var u, v;
        if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
        else if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
        else { u = p.getX(i); v = p.getY(i); }
        uv.setXY(i, u * dens, v * dens);
      }
      uv.needsUpdate = true;
    }

    function autoSeg(w, h, d) {
      var m = Math.max(w, h, d);
      return m > 1.1 ? 5 : (m > 0.55 ? 4 : (m > 0.20 ? 3 : 2));
    }

    /* 带凿琢感的块料：侧面顶点沿 XZ 微起伏，上下表面保持平齐 */
    function blockGeo(w, h, d, amp, seg) {
      seg = seg || autoSeg(w, h, d);
      var geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
      if (amp > 0) {
        var p = geo.attributes.position;
        for (var i = 0; i < p.count; i++) {
          var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          var k = Math.sin(x * 6.3 + 1.1) * Math.cos(y * 8.7 + 0.6) * Math.sin(z * 7.1 + 2.3)
                + 0.45 * Math.sin(x * 14.1 + z * 11.7);
          p.setXYZ(i, x * (1 + amp * k), y, z * (1 + amp * k));
        }
        p.needsUpdate = true;
        geo.computeVertexNormals();
      }
      planarUV(geo, DENS);
      return geo;
    }

    function block(w, h, d, mat, amp, seg) {
      var m = new THREE.Mesh(blockGeo(w, h, d, amp === undefined ? 0.03 : amp, seg), M(mat));
      m.castShadow = true; m.receiveShadow = true;
      return m;
    }

    function put(m, x, y, z) { m.position.set(x, y, z); g.add(m); return m; }

    /* 分水尖楔石：后端方正贴墩，前端收成钝尖（鼻端留 4% 平头，避免退化面） */
    function wedgeGeo(w, h, l) {
      var geo = new THREE.BoxGeometry(w, h, l, 2, 2, 2);
      var p = geo.attributes.position;
      var zm = l / 2 - 1e-4;
      for (var i = 0; i < p.count; i++) {
        if (p.getZ(i) > zm) p.setX(i, p.getX(i) * 0.04);
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
      planarUV(geo, DENS);
      return geo;
    }

    function wedge(w, h, l, mat, x, y, z, flip) {
      var m = new THREE.Mesh(wedgeGeo(w, h, l), M(mat));
      // 楔尖朝 +Z；flip 时整体绕 Y 转 180°，朝 -Z
      m.position.set(x, y, z);
      if (flip) m.rotation.y = PI;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      return m;
    }

    /* 小丛草（桥面石缝、墩根）：自动上抬，使叶尖不穿出地面 */
    function tuft(x, y, z, hgt, n, mat) {
      var t = ctx.grass({ n: n || 5, h: hgt, mat: mat || 'leafLight', seed: rng.range(0, 6) });
      t.position.set(x, y, z);
      var sc = rng.range(0.75, 1.05);
      t.scale.set(sc * 0.8, sc, sc * 0.8);
      t.rotation.y = rng.range(0, TAU);
      t.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      t.updateMatrixWorld(true);
      var tb = new THREE.Box3().setFromObject(t);
      if (tb.min.y < 0) t.position.y += -tb.min.y;
      g.add(t);
    }

    /* ==================================================================
     * 1. 尺寸
     * ================================================================== */
    var span      = rng.range(3.5, 4.6);              // 桥面沿 X 净跨度
    var deckW     = rng.range(1.80, 2.42);            // 桥宽（Z）
    var deckTop   = rng.range(0.52, 0.69);            // 桥面标高
    var nPiers    = rng.chance(0.6) ? 3 : 2;
    var railStyle = rng.chance(0.5) ? 'stone' : 'wood';
    var waterY    = rng.range(0.10, 0.15);            // 水线（相对墩底）

    var slabT   = 0.115;
    var beamH   = rng.range(0.10, 0.14);
    var beamTop = deckTop - slabT;
    var pierH   = beamTop - beamH;

    var nSteps   = rng.int(1, 2);
    var stepRun  = rng.range(0.22, 0.27);
    var stepRise = rng.range(0.085, 0.125);
    var runTot   = nSteps * stepRun;
    var landLen  = rng.range(0.46, 0.62);             // 岸台进深
    var headX    = span / 2 + runTot;                 // 石阶外缘（= 岸台内缘）

    /* ==================================================================
     * 2. 桥墩：方形条石错缝砌筑 + 上下游分水尖 + 水下湿石
     * ================================================================== */
    var capH = 0.055;
    var pierXs = nPiers === 3
      ? [-span * 0.30, 0, span * 0.30]
      : [-span * 0.315, span * 0.315];

    function buildPier(px) {
      var pw = rng.range(0.36, 0.48);                 // X 向厚度
      var pd = deckW * rng.range(0.58, 0.68);         // Z 向长度（给分水尖留出余量）
      var bodyH = pierH - capH;

      // 砌缝暗芯
      put(block(pw * 0.94, bodyH, pd * 0.94, 'stoneDark', 0.006, 3), px, bodyH / 2, 0);

      // 条石层：浸水层 stoneWet，上部错缝分块并逐层微收分
      var courses = rng.int(3, 4);
      var ch = bodyH / courses;
      for (var i = 0; i < courses; i++) {
        var y0 = i * ch;
        var hi = (i === courses - 1) ? (bodyH - y0) : ch - 0.012;
        if (hi < 0.03) hi = 0.03;
        var wet = (y0 + hi * 0.5) < waterY;
        var mat = wet ? 'stoneWet' : 'stone';
        var ww = pw * (1 - 0.026 * i);
        var dd = pd * (1 - 0.026 * i);
        var split = wet ? 1 : rng.int(2, 3);
        var segLen = dd / split;
        for (var s = 0; s < split; s++) {
          var len = split > 1 ? segLen - 0.014 : dd;
          var zc = split > 1 ? (-dd / 2 + segLen * (s + 0.5) + (i % 2 === 0 ? 0.016 : -0.016)) : 0;
          put(block(ww, hi, len, mat, 0.024, 3), px, y0 + hi / 2, zc);
        }
      }

      // 墩帽石
      put(block(pw + 0.05, capH, pd + 0.05, 'stoneLight', 0.02, 3), px, bodyH + capH / 2, 0);

      // 分水尖：上下游各一（湿石下段 / 干石上段 / 尖顶压石），楔尖朝外
      // 前伸长度受限，保证 pd/2 + noseL <= deckW/2 - 0.02，不越出桥宽
      var noseMax = Math.max(0.08, deckW / 2 - pd / 2 - 0.02);
      for (var dz = 0; dz < 2; dz++) {
        var flip = dz === 1;
        var a = pw * 0.80;                            // 根部宽
        var noseL = Math.min(noseMax, pw * rng.range(0.85, 1.15));
        var noseTop = bodyH * rng.range(0.82, 0.95);
        var lowerH = Math.min(noseTop, waterY + 0.02);
        var upH = noseTop - lowerH;
        var rz = (pd / 2 + noseL / 2 - 0.012) * (flip ? -1 : 1);
        wedge(a, lowerH, noseL, 'stoneWet', px, lowerH / 2, rz, flip);
        if (upH > 0.02) wedge(a, upH, noseL * 0.94, 'stone', px, lowerH + upH / 2, rz, flip);
        var tip = block(a * 0.72, 0.075, noseL * 0.62, 'stoneLight', 0.015, 3);
        put(tip, px, noseTop + 0.037, rz);
      }

      // 水线湿痕带（薄片贴面）+ 垂流痕
      var bandH = rng.range(0.05, 0.072);
      put(block(pw + 0.014, bandH, pd + 0.014, 'stoneWet', 0.004, 3), px, waterY + bandH / 2, 0);
      for (var d2 = 0; d2 < 3; d2++) {
        var dripH = rng.range(0.03, 0.085);
        put(block(rng.range(0.03, 0.07), dripH, 0.009, 'stoneWet', 0.002, 1),
          px + rng.range(-pw * 0.28, pw * 0.28), waterY - dripH / 2,
          (d2 % 2 === 0 ? 1 : -1) * (pd / 2 + 0.007));
      }

      // 墩根水草
      if (rng.chance(0.8)) {
        tuft(px + rng.range(-pw * 0.35, pw * 0.35), 0.01,
          (rng.chance(0.5) ? 1 : -1) * (pd / 2 + rng.range(0.03, 0.09)),
          rng.range(0.13, 0.22), 4, 'leafLight');
      }

      // 系船石（墩边小石 + 木环）
      if (rng.chance(0.72)) {
        var sx2 = px + pw * 0.20;
        put(block(0.15, 0.16, 0.10, 'stoneLight', 0.02, 2), sx2, waterY + 0.09, pd / 2 + 0.045);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 12), M('woodDark'));
        ring.position.set(sx2, waterY + 0.05, pd / 2 + 0.098);
        ring.castShadow = true; ring.receiveShadow = true;
        g.add(ring);
      }
    }

    /* ==================================================================
     * 3. 纵向石梁（4~6 根，架在墩帽上）
     * ================================================================== */
    var nBeams = rng.int(4, 6);
    var beamUsable = deckW * 0.38;
    for (var bi = 0; bi < nBeams; bi++) {
      var bz = -beamUsable + (2 * beamUsable) * (bi / (nBeams - 1));
      var blen = span + rng.range(0.18, 0.42);
      var bw = rng.range(0.12, 0.17);
      put(block(blen, beamH, bw, 'stoneDark', 0.02, 4),
        rng.range(-0.02, 0.02), beamTop - beamH / 2, bz + rng.range(-0.01, 0.01));
    }

    for (var pi = 0; pi < pierXs.length; pi++) buildPier(pierXs[pi]);

    /* ==================================================================
     * 4. 桥面石板（逐块建模、0.02 缝、厚度不一、桥心石略高且磨光）
     * ================================================================== */
    var gapV = 0.02;
    var nSlabs = Math.max(8, Math.round(span / 0.34));
    var sw = (span - gapV * (nSlabs - 1)) / nSlabs;
    var heartIdx = Math.floor(nSlabs / 2);
    var slabTop = [];

    for (var si = 0; si < nSlabs; si++) {
      var cx = -span / 2 + si * (sw + gapV) + sw / 2;
      var isHeart = (si === heartIdx);
      var th = slabT + rng.range(-0.021, 0.021) + (isHeart ? 0.035 : 0);
      var top = beamTop + th;
      var mat = isHeart ? 'stoneLight' : (rng.chance(0.42) ? 'stone' : 'stoneLight');
      var sl = block(sw - rng.range(0, 0.012), th, deckW - 0.10, mat, 0.014, 5);
      sl.position.set(cx, top - th / 2, rng.range(-0.01, 0.01));
      sl.rotation.y = rng.range(-0.004, 0.004);
      sl.rotation.x = isHeart ? 0 : rng.range(-0.009, 0.009);
      g.add(sl);
      var recTop = top;

      if (isHeart) {
        // 桥心石：磨光顶板 + 线脚边框 + 细凿痕
        var fw2 = sw * 0.86, fd2 = deckW * 0.62;
        put(block(fw2, 0.022, fd2, 'stoneLight', 0.006, 4), cx, top + 0.006, 0);
        var bars = [
          [fw2 + 0.030, 0.014, 0.024, 0, fd2 / 2],
          [fw2 + 0.030, 0.014, 0.024, 0, -fd2 / 2],
          [0.024, 0.014, fd2, fw2 / 2, 0],
          [0.024, 0.014, fd2, -fw2 / 2, 0]
        ];
        for (var fi = 0; fi < bars.length; fi++) {
          put(block(bars[fi][0], bars[fi][1], bars[fi][2], 'stone', 0.004, 2),
            cx + bars[fi][3], top + 0.018, bars[fi][4]);
        }
        for (var kc = 0; kc < 5; kc++) {
          var cz2 = -fd2 * 0.34 + (fd2 * 0.68) * (kc / 4);
          put(block(fw2 * 0.72, 0.005, 0.018, 'stone', 0.003, 1), cx, top + 0.017, cz2);
        }
        recTop = top + 0.024;
      }
      slabTop.push(recTop);
    }

    // 桥面板两端封边石
    for (var ee = 0; ee < 2; ee++) {
      put(block(0.09, 0.145, deckW - 0.06, 'stoneDark', 0.02, 4),
        (ee ? 1 : -1) * (span / 2 + 0.03), deckTop - 0.058, 0);
    }

    /* ==================================================================
     * 5. 压边石（地栿）：分段条石 + 桥额石
     * ================================================================== */
    var curbTop = deckTop + 0.018;
    var curbZ = deckW / 2 - 0.085;
    var curbLen = span + rng.range(0.12, 0.24);
    var nCurb = Math.max(4, Math.round(curbLen / 0.62));
    var cw = (curbLen - 0.016 * (nCurb - 1)) / nCurb;

    for (var cz = 0; cz < 2; cz++) {
      var zSide = (cz ? 1 : -1) * curbZ;
      for (var ci = 0; ci < nCurb; ci++) {
        put(block(cw, 0.10, 0.125, 'stoneDark', 0.02, 3),
          -curbLen / 2 + ci * (cw + 0.016) + cw / 2, curbTop - 0.05, zSide);
      }
      // 桥额石（刻字）：下游侧，嵌在压边石外脸以内
      if (cz === 1) {
        var nameZ = zSide + 0.048;
        put(block(0.52, 0.088, 0.026, 'stoneLight', 0.006, 3), 0, curbTop - 0.048, nameZ);
        for (var ch3 = 0; ch3 < 3; ch3++) {
          put(block(0.052, 0.052, 0.010, 'stoneDark', 0.002, 1),
            (ch3 - 1) * 0.135, curbTop - 0.048, nameZ + 0.011);
        }
      }
    }

    /* ==================================================================
     * 6. 栏杆：(a) 矮石栏（栏板 + 短望柱） / (b) 木栏（斜撑 + 风化色差）
     * ================================================================== */
    var railZ = deckW / 2 - 0.072;
    var railLen = span + 0.10;

    function stoneRailing(side) {
      var z = side * railZ;
      var nBay = Math.max(3, Math.round(railLen / 1.0));
      var bay = railLen / nBay;
      var postH = rng.range(0.30, 0.37);
      for (var i = 0; i <= nBay; i++) {
        var px = -railLen / 2 + bay * i;
        put(block(0.150, 0.035, 0.150, 'stone', 0.012, 3), px, curbTop + 0.017, z);
        put(block(0.105, postH, 0.105, 'stoneLight', 0.02, 3), px, curbTop + 0.035 + postH / 2, z);
        var cap = new THREE.Mesh(new THREE.SphereGeometry(0.074, 12, 7, 0, TAU, 0, PI / 2), M('stoneLight'));
        cap.position.set(px, curbTop + 0.035 + postH, z);
        cap.scale.y = 1.2;
        cap.castShadow = true; cap.receiveShadow = true;
        g.add(cap);
        if (i < nBay) {
          var pw2 = bay - 0.135;
          var mid = px + bay / 2;
          // 栏板（下实上薄）
          put(block(pw2, 0.115, 0.062, 'stoneLight', 0.02, 3), mid, curbTop + 0.093, z);
          put(block(pw2 - 0.02, 0.075, 0.074, 'stone', 0.012, 3), mid, curbTop + 0.180, z);
          // 栏板浮雕框
          put(block(pw2 * 0.60, 0.042, 0.084, 'stoneLight', 0.01, 3), mid, curbTop + 0.180, z);
          // 下沿小漏空（两处）
          for (var ho = 0; ho < 2; ho++) {
            put(block(0.060, 0.042, 0.020, 'stoneDark', 0.002, 1),
              mid + (ho ? 1 : -1) * pw2 * 0.22, curbTop + 0.094, z + 0.034);
          }
        }
      }
    }

    function woodRailing(side) {
      var z = side * railZ;
      var h = rng.range(0.42, 0.50);
      var grp = ctx.woodRailing({ len: railLen, h: h, mat: 'wood' });
      grp.position.set(0, curbTop + 0.008, z);

      // 风化色差：逐构件换色
      var balusters = [];
      for (var i = 0; i < grp.children.length; i++) {
        var c = grp.children[i];
        if (!c.isMesh) continue;
        if (i % 5 === 1) c.material = M('woodLight');
        else if (i % 7 === 3 || i % 4 === 2) c.material = M('woodDark');
        var par = c.geometry && c.geometry.parameters;
        if (par && par.width === 0.05 && par.depth === 0.05) balusters.push(c);
      }
      // 扶手压条（日晒发白）
      var hand = block(railLen, 0.05, 0.105, 'woodLight', 0.02, 4);
      hand.position.set(0, h + 0.02, 0);
      grp.add(hand);
      // 立柱脚下础石
      for (var f = 0; f < balusters.length; f++) {
        var foot = block(0.085, 0.030, 0.085, 'stoneDark', 0.01, 2);
        foot.position.set(balusters[f].position.x, 0.012, 0);
        grp.add(foot);
      }
      // 端柱 / 压顶 / 斜撑 / 铁箍
      for (var e = 0; e < 2; e++) {
        var ex = (e ? 1 : -1) * railLen / 2;
        var endPost = block(0.095, h + 0.10, 0.095, 'woodDark', 0.02, 3);
        endPost.position.set(ex, (h + 0.10) / 2, 0);
        grp.add(endPost);
        var capB = block(0.128, 0.036, 0.128, 'woodDark', 0.01, 3);
        capB.position.set(ex, h + 0.118, 0);
        grp.add(capB);
        var brace = block(0.40, 0.045, 0.045, 'woodDark', 0.02, 2);
        brace.position.set(ex - (e ? 1 : -1) * 0.155, h * 0.42, 0);
        brace.rotation.z = (e ? 1 : -1) * 0.86;
        grp.add(brace);
        var band = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.011, 5, 10), M('woodDark'));
        band.rotation.x = PI / 2;
        band.position.set(ex, h * 0.30, 0);
        band.castShadow = true; band.receiveShadow = true;
        grp.add(band);
      }
      // 中段斜撑
      var brace2 = block(0.34, 0.042, 0.042, 'woodDark', 0.02, 2);
      brace2.position.set(rng.range(-0.2, 0.2), h * 0.44, 0);
      brace2.rotation.z = rng.chance(0.5) ? 0.62 : -0.62;
      grp.add(brace2);
      g.add(grp);
    }

    if (railStyle === 'stone') {
      stoneRailing(1);
      stoneRailing(-1);
    } else if (rng.chance(0.55)) {
      woodRailing(rng.chance(0.5) ? 1 : -1);
    } else {
      woodRailing(1);
      woodRailing(-1);
    }

    /* ==================================================================
     * 7. 桥头：石阶（分块条石）、垂带、抱鼓石 / 石墩、乱石
     * ================================================================== */
    var stairW = deckW * 0.88;

    function headStairs(sx) {
      var nStone = 3;
      var stW = (stairW - 0.016 * (nStone - 1)) / nStone;

      for (var i = 0; i < nSteps; i++) {
        var x0 = span / 2 + i * stepRun;
        var x1 = span / 2 + (i + 1) * stepRun;
        var top = deckTop - slabT * 0.2 - (i + 1) * stepRise;
        for (var s2 = 0; s2 < nStone; s2++) {
          put(block(x1 - x0 + 0.015, top, stW, 'stone', 0.02, 4),
            sx * (x0 + x1) / 2, top / 2, -stairW / 2 + s2 * (stW + 0.016) + stW / 2);
        }
      }

      // 阶前垫石
      put(block(0.44, 0.075, stairW * 0.96, 'stoneDark', 0.02, 4), sx * (headX + 0.10), 0.0375, 0);

      // 垂带石（两侧斜石，分两段）
      var riseTot = nSteps * stepRise;
      var slope = Math.atan2(riseTot, runTot);
      var slLen = Math.sqrt(runTot * runTot + riseTot * riseTot) + 0.10;
      var midY = deckTop - slabT * 0.2 - riseTot / 2 + 0.028;
      for (var s = 0; s < 2; s++) {
        var sz = (s ? 1 : -1) * Math.min(stairW / 2 + 0.035, deckW / 2 - 0.045);
        for (var seg = 0; seg < 2; seg++) {
          var off = (seg - 0.5) * (slLen / 2 - 0.012);
          var cheek = block(slLen / 2 - 0.010, 0.085, 0.085, 'stoneLight', 0.02, 3);
          cheek.position.set(
            sx * (span / 2 + runTot / 2 + off * Math.cos(slope)),
            midY + off * Math.sin(slope),
            sz
          );
          cheek.rotation.z = -sx * slope;
          g.add(cheek);
        }
      }

      // 抱鼓石 / 石墩（收在桥宽以内）
      var headZ = Math.min(stairW / 2 + 0.085, deckW / 2 - 0.115);
      for (var d3 = 0; d3 < 2; d3++) {
        var dzz = (d3 ? 1 : -1) * headZ;
        var dx = sx * (headX - 0.03);
        if (rng.chance(0.5)) {
          put(block(0.30, 0.095, 0.21, 'stoneLight', 0.02, 3), dx, 0.0475, dzz);
          var drum = ctx.lathe([
            [0.0, -0.085], [0.095, -0.088], [0.140, -0.072], [0.155, -0.030],
            [0.155, 0.030], [0.140, 0.072], [0.095, 0.088], [0.0, 0.085]
          ], 16, 'stoneLight');
          drum.rotation.x = PI / 2;
          drum.position.set(dx, 0.245, dzz);
          g.add(drum);
          put(block(0.10, 0.10, 0.024, 'stone', 0.01, 2), dx, 0.245, dzz + (d3 ? 1 : -1) * 0.090);
        } else {
          var bl = ctx.post({ h: rng.range(0.24, 0.32), r: 0.072, mat: 'stoneLight' });
          bl.position.set(dx, 0, dzz);
          bl.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          g.add(bl);
          var ringTop = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.013, 6, 12), M('woodDark'));
          ringTop.rotation.y = PI / 2;
          ringTop.position.set(dx, 0.20, dzz);
          ringTop.castShadow = true; ringTop.receiveShadow = true;
          g.add(ringTop);
        }
      }

      // 桥头乱石 2~3 块（贴着阶前斜堆，Z 向不越出桥宽）
      var nRock = rng.int(2, 3);
      for (var r2 = 0; r2 < nRock; r2++) {
        var rr = rng.range(0.13, 0.22);
        var rk = ctx.rock({
          r: rr, mat: 'stoneDark', seed: rng.range(0.5, 40),
          detail: rr > 0.185 ? 3 : 2,
          sy: rng.range(0.55, 0.78), sx: rng.range(0.9, 1.15)
        });
        rk.geometry.computeBoundingBox();
        var rbb = rk.geometry.boundingBox;
        // 任意绕 Y 旋转，用水平方向最大半径做保守约束
        var rHalf = Math.max(
          Math.abs(rbb.min.x), Math.abs(rbb.max.x),
          Math.abs(rbb.min.z), Math.abs(rbb.max.z)
        );
        var zLim = Math.max(0, deckW / 2 - rHalf - 0.015);
        var rz = rng.range(stairW * 0.26, stairW * 0.46);
        rk.position.set(
          sx * (headX + rng.range(-0.14, 0.05)),
          -rbb.min.y + 0.002,
          (rng.chance(0.5) ? 1 : -1) * Math.min(rz, zLim)
        );
        rk.rotation.y = rng.range(0, TAU);
        g.add(rk);
      }
    }

    headStairs(1);
    headStairs(-1);

    /* ==================================================================
     * 8. 细节：桥面石缝长草 / 苔痕、缆桩
     * ================================================================== */
    for (var gi = 1; gi < nSlabs; gi++) {
      if (!rng.chance(0.5)) continue;
      var gx = -span / 2 + gi * (sw + gapV) - gapV / 2;
      var base = slabTop[gi] || deckTop;
      tuft(gx, base - 0.035, rng.range(-deckW * 0.36, deckW * 0.36), rng.range(0.10, 0.19), 5);
      if (rng.chance(0.35)) {
        tuft(gx + rng.range(-0.05, 0.05), base - 0.035,
          rng.range(-deckW * 0.42, deckW * 0.42), rng.range(0.07, 0.13), 4);
      }
      if (rng.chance(0.6)) {
        put(block(rng.range(0.04, 0.09), 0.006, rng.range(0.05, 0.12), 'leafLight', 0.006, 1),
          gx + rng.range(-0.02, 0.02), base - 0.012, rng.range(-deckW * 0.3, deckW * 0.3));
      }
    }

    // 台阶石缝草
    for (var hj = 0; hj < 2; hj++) {
      if (!rng.chance(0.8)) continue;
      var hsx = hj ? 1 : -1;
      tuft(hsx * (span / 2 + stepRun * 0.5),
        deckTop - stepRise - slabT * 0.2 + 0.012,
        rng.range(-stairW * 0.42, stairW * 0.42), rng.range(0.09, 0.15), 5);
    }

    // 缆桩（墩边，木桩 + 缆绳圈）
    for (var mb = 0; mb < pierXs.length; mb++) {
      if (!rng.chance(0.55)) continue;
      var mx = pierXs[mb] + rng.range(-0.10, 0.10);
      var mz = (rng.chance(0.5) ? 1 : -1) * (deckW / 2 - 0.10);
      var mh = rng.range(0.24, 0.34);
      var pile = ctx.cyl(0.048, 0.062, mh, 8, 'woodDark', mx, mh / 2, mz);
      pile.rotation.y = rng.range(0, TAU);
      g.add(pile);
      var rope = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.015, 6, 12), M('woodLight'));
      rope.rotation.x = PI / 2;
      rope.position.set(mx, mh * 0.62, mz);
      rope.castShadow = true; rope.receiveShadow = true;
      g.add(rope);
    }

    /* ==================================================================
     * 9. 报出尺寸（w 含桥头，d 为桥宽，h 为桥面标高）
     * ================================================================== */
    g.updateMatrixWorld(true);
    var bb = new THREE.Box3().setFromObject(g);
    var size = bb.getSize(new THREE.Vector3());

    g.userData = {
      w: +size.x.toFixed(2),
      d: +deckW.toFixed(2),
      h: +deckTop.toFixed(2),
      kind: 'bridgeFlat',
      axis: 'x'
    };
    return g;
  };
})();
