/* models/tree.js —— 江南古村 · 多品种树木工厂
 * 七种形态：camphor 香樟 / willow 垂柳 / pine 松 / bamboo 竹丛 / maple 枫 /
 *            peach 桃（plum 梅）/ osmanthus 桂
 * 原点在树干底中心，y=0 为地面，正面朝 +Z。
 * 性能：单棵三角面 ≤ 22k（柳/竹 ≤ 26k），网格 < 300，材质 ≤ 8 种。
 */
(function () {
  'use strict';
  var JN = window.JN;
  if (!JN || !JN.models) return;
  var TAU = Math.PI * 2, PI = Math.PI;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }

  /* ==================================================================
   * 扫掠管：弯枝、柳条、竹竿
   * pts: [[x,y,z,r], ...]
   * ================================================================== */
  function sweepGeo(pts, sides, capTip) {
    var n = pts.length, i, j;
    if (n < 2) return null;
    var pos = [], uv = [], idx = [];
    for (i = 0; i < n; i++) {
      var p = pts[i];
      var pa = pts[i > 0 ? i - 1 : 0], pb = pts[i < n - 1 ? i + 1 : n - 1];
      var tx = pb[0] - pa[0], ty = pb[1] - pa[1], tz = pb[2] - pa[2];
      var tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (tl < 1e-6) { tx = 0; ty = 1; tz = 0; tl = 1; }
      tx /= tl; ty /= tl; tz /= tl;
      var rx = 0, ry = 1, rz = 0;
      if (Math.abs(ty) > 0.85) { rx = 1; ry = 0; rz = 0; }
      var sx = ry * tz - rz * ty, sy = rz * tx - rx * tz, sz = rx * ty - ry * tx;
      var sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      sx /= sl; sy /= sl; sz /= sl;
      var ux = ty * sz - tz * sy, uy = tz * sx - tx * sz, uz = tx * sy - ty * sx;
      var r = p[3] === undefined ? 0.05 : p[3];
      for (j = 0; j < sides; j++) {
        var a = (j / sides) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        pos.push(p[0] + (sx * ca + ux * sa) * r,
                 p[1] + (sy * ca + uy * sa) * r,
                 p[2] + (sz * ca + uz * sa) * r);
        uv.push(j / sides, i / (n - 1));
      }
    }
    for (i = 0; i < n - 1; i++) {
      for (j = 0; j < sides; j++) {
        var a0 = i * sides + j, b0 = i * sides + (j + 1) % sides;
        var c0 = (i + 1) * sides + j, d0 = (i + 1) * sides + (j + 1) % sides;
        idx.push(a0, b0, c0, b0, d0, c0);
      }
    }
    if (capTip) {
      var last = (n - 1) * sides, tip = pos.length / 3;
      pos.push(pts[n - 1][0], pts[n - 1][1], pts[n - 1][2]); uv.push(0.5, 1);
      for (j = 0; j < sides; j++) idx.push(last + j, last + (j + 1) % sides, tip);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function tubeMesh(pts, sides, mat, capTip) {
    var geo = sweepGeo(pts, sides, capTip !== false);
    if (!geo) return null;
    var m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  /* 两点之间的弯枝：bow 为中间段偏移 */
  function limb(a, b, r0, r1, sides, bow, seg, mat) {
    var pts = [], i, segs = seg || 3;
    for (i = 0; i <= segs; i++) {
      var t = i / segs, s = Math.sin(t * PI);
      pts.push([
        lerp(a[0], b[0], t) + (bow ? bow[0] * s : 0),
        lerp(a[1], b[1], t) + (bow ? bow[1] * s : 0),
        lerp(a[2], b[2], t) + (bow ? bow[2] * s : 0),
        lerp(r0, r1, t)
      ]);
    }
    return tubeMesh(pts, sides || 4, mat, true);
  }

  /* ==================================================================
   * 叶面片：合并为单网格（正反两面，避免材质双面）
   * spec: {x,y,z,w,h,yaw,pitch,roll}
   * ================================================================== */
  function leafField(specs, mat) {
    var pos = [], uv = [], i;
    if (!specs.length) return null;
    function tri(a, b, c, ua, ub, uc) {
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    }
    for (i = 0; i < specs.length; i++) {
      var s = specs[i];
      var cp = Math.cos(s.pitch || 0), sp = Math.sin(s.pitch || 0);
      var dx = Math.cos(s.yaw) * cp, dy = sp, dz = Math.sin(s.yaw) * cp;
      var rx = -Math.sin(s.yaw), ry = 0, rz = Math.cos(s.yaw);
      var ux = ry * dz - rz * dy, uy = rz * dx - rx * dz, uz = rx * dy - ry * dx;
      var roll = s.roll || 0, cr = Math.cos(roll), sr = Math.sin(roll);
      var r2x = rx * cr + ux * sr, r2y = ry * cr + uy * sr, r2z = rz * cr + uz * sr;
      var u2x = ux * cr - rx * sr, u2y = uy * cr - ry * sr, u2z = uz * cr - rz * sr;
      var hw = s.w * 0.5, hl = s.h * 0.5;
      var q = [
        [s.x - r2x * hw - u2x * hl, s.y - r2y * hw - u2y * hl, s.z - r2z * hw - u2z * hl],
        [s.x + r2x * hw - u2x * hl, s.y + r2y * hw - u2y * hl, s.z + r2z * hw - u2z * hl],
        [s.x + r2x * hw + u2x * hl, s.y + r2y * hw + u2y * hl, s.z + r2z * hw + u2z * hl],
        [s.x - r2x * hw + u2x * hl, s.y - r2y * hw + u2y * hl, s.z - r2z * hw + u2z * hl]
      ];
      var U = [[0, 0], [1, 0], [1, 1], [0, 1]];
      tri(q[0], q[1], q[2], U[0], U[1], U[2]);
      tri(q[0], q[2], q[3], U[0], U[2], U[3]);
      tri(q[2], q[1], q[0], U[2], U[1], U[0]);
      tri(q[3], q[2], q[0], U[3], U[2], U[0]);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  /* 树冠团块 */
  function blobAt(g, ctx, x, y, z, r, matName, detail, flatY, amp) {
    var b = ctx.blob({
      r: r, mat: matName, seed: ctx.rng.range(0, 80),
      amp: amp === undefined ? 0.2 : amp,
      detail: detail === undefined ? 2 : detail,
      flatY: flatY === undefined ? 1 : flatY
    });
    b.position.set(x, y, z);
    b.rotation.y = ctx.rng.range(0, TAU);
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
    return b;
  }

  /* 沿团块表面撒小叶片，破轮廓 */
  function fringe(specs, ctx, x, y, z, r, n, size, flatY) {
    for (var i = 0; i < n; i++) {
      var a = ctx.rng.range(0, TAU), b = ctx.rng.range(-0.95, 0.95);
      var cb = Math.cos(b);
      specs.push({
        x: x + Math.cos(a) * cb * r * 0.96,
        y: y + Math.sin(b) * r * (flatY || 1) * 0.96,
        z: z + Math.sin(a) * cb * r * 0.96,
        w: size * ctx.rng.range(0.55, 1.1),
        h: size * ctx.rng.range(0.9, 1.7),
        yaw: a + ctx.rng.range(-0.6, 0.6),
        pitch: b * 0.6 - 0.1,
        roll: ctx.rng.range(-0.9, 0.9)
      });
    }
  }

  /* 冠缘一圈叶簇 */
  function crownFringe(specs, ctx, cx, cy, cz, R, clusters, per, size, flatY) {
    for (var i = 0; i < clusters; i++) {
      var a = (i / clusters) * TAU + ctx.rng.range(-0.3, 0.3);
      var rad = R * ctx.rng.range(0.72, 1.0);
      fringe(specs, ctx,
        cx + Math.cos(a) * rad, cy + ctx.rng.range(-0.35, 0.5) * R * 0.5,
        cz + Math.sin(a) * rad, R * 0.4, per, size, flatY);
    }
  }

  /* ==================================================================
   * 地面：树影暗斑 + 草丛 + 石头
   * ================================================================== */
  function seat(obj) {
    obj.updateMatrixWorld(true);
    var b = new THREE.Box3().setFromObject(obj);
    if (isFinite(b.min.y)) obj.position.y += -b.min.y + 0.005;
  }

  function groundDeco(g, ctx, crownR) {
    var rng = ctx.rng, i;
    var sh = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.55, crownR * 0.95), 24), ctx.mat('mud'));
    sh.rotation.x = -PI / 2;
    sh.position.y = 0.012;
    sh.castShadow = false; sh.receiveShadow = true;
    g.add(sh);

    var nT = rng.int(2, 4);
    for (i = 0; i < nT; i++) {
      var a = rng.range(0, TAU), d = Math.max(0.5, crownR * rng.range(0.35, 0.9));
      var tuft = ctx.grass({
        n: rng.int(4, 6),
        h: rng.range(0.24, 0.44),
        mat: rng.chance(0.5) ? 'leafLight' : 'leafSpring',
        seed: rng.range(0, 6)
      });
      tuft.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      tuft.rotation.y = rng.range(0, TAU);
      tuft.traverse(function (o) {
        if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; }
      });
      g.add(tuft);
      seat(tuft);
    }

    var nR = rng.int(1, 2);
    for (i = 0; i < nR; i++) {
      var rk = ctx.rock({
        r: rng.range(0.15, 0.32), detail: 1, seed: rng.range(0, 9),
        sx: rng.range(0.9, 1.4), sy: rng.range(0.5, 0.78), sz: rng.range(0.9, 1.35)
      });
      var ba = rng.range(0, TAU), bd = Math.max(0.6, crownR * rng.range(0.32, 0.62));
      rk.position.set(Math.cos(ba) * bd, 0, Math.sin(ba) * bd);
      rk.rotation.y = rng.range(0, TAU);
      g.add(rk);
      seat(rk);
    }
  }

  /* 树干顶部（含弯曲）近似位置 */
  function trunkTop(h, bend, wave) {
    return [Math.sin((wave || 1.2) * PI) * bend, h, Math.cos((wave || 1.2) * PI * 0.7) * bend * 0.6];
  }

  /* ==================================================================
   * 1. 香樟 —— 粗干 + 3~5 主枝分叉 + 6~10 噪声团大冠
   * ================================================================== */
  function buildCamphor(ctx, g) {
    var rng = ctx.rng, mat = ctx.mat;
    var H = rng.range(6, 8.5);
    var rb = rng.range(0.32, 0.45);
    var trunkH = H * rng.range(0.46, 0.54);
    var bend = rng.range(0.18, 0.36), wave = rng.range(1.1, 1.6);
    var wood = mat('woodDark');
    g.add(ctx.trunk({
      h: trunkH, r: rb, rTip: rb * rng.range(0.5, 0.62), bend: bend,
      seg: 9, sides: 10, mat: 'woodDark', wave: wave, rootFlare: rng.range(1.0, 1.45)
    }));
    var tp = trunkTop(trunkH, bend, wave);
    var fx = tp[0] * 0.8, fz = tp[2] * 0.8;
    var R = rng.range(1.7, 2.15);          /* 冠幅 3.5~5 */
    var crownY = H - R * 0.8;
    var i, j;

    /* 主枝 3~5 根，向外分叉 */
    var nMain = rng.int(3, 5);
    var tips = [];
    for (i = 0; i < nMain; i++) {
      var a = (i / nMain) * TAU + rng.range(-0.4, 0.4);
      var rr = R * rng.range(0.5, 0.8);
      var ex = fx + Math.cos(a) * rr, ez = fz + Math.sin(a) * rr;
      var ey = crownY + R * rng.range(0.1, 0.5);
      var p1 = [ex, ey, ez];
      g.add(limb([tp[0], trunkH * 0.94, tp[2]], p1, rb * 0.55, rb * 0.16, 5,
        [Math.cos(a + 1.3) * rng.range(0.08, 0.28), rng.range(-0.05, 0.16), Math.sin(a + 1.3) * rng.range(0.08, 0.28)],
        4, wood));
      tips.push(p1);
      for (j = 0; j < 2; j++) {
        var a2 = a + rng.range(-0.9, 0.9);
        var p2 = [ex + Math.cos(a2) * R * rng.range(0.18, 0.42),
                  ey + rng.range(0.1, 0.55),
                  ez + Math.sin(a2) * R * rng.range(0.18, 0.42)];
        g.add(limb(p1, p2, rb * 0.16, rb * 0.05, 3, [0, 0.05, 0], 3, wood));
        tips.push(p2);
      }
    }

    /* 树冠 6~10 个噪声团 */
    var nB = rng.int(6, 10);
    var cols = ['leafDeep', 'leafSpring', 'leafSpring', 'leafLight', 'leafDeep', 'leafSpring'];
    var cx = fx * 0.75, cz = fz * 0.75;
    blobAt(g, ctx, cx, crownY + R * 0.28, cz, R * 0.64, 'leafDeep', 3, 0.94, 0.22);
    for (i = 0; i < nB; i++) {
      var aa = (i / nB) * TAU + rng.range(-0.42, 0.42);
      var rad = R * rng.range(0.4, 0.68);
      blobAt(g, ctx, cx + Math.cos(aa) * rad,
        crownY + rng.range(-0.4, 1.15),
        cz + Math.sin(aa) * rad,
        R * rng.range(0.36, 0.54), rng.pick(cols),
        3, rng.range(0.86, 1.08), 0.24);
      /* 团块外再叠一层小团，撑出蓬松层次 */
      var sa = aa + rng.range(-0.5, 0.5);
      blobAt(g, ctx, cx + Math.cos(sa) * rad * 1.18,
        crownY + rng.range(-0.55, 1.5),
        cz + Math.sin(sa) * rad * 1.18,
        R * rng.range(0.2, 0.3), rng.pick(cols), 2, rng.range(0.9, 1.1), 0.3);
    }
    blobAt(g, ctx, cx, crownY + R * 0.78, cz, R * 0.34, 'leafSpring', 3, 0.95, 0.26);

    /* 冠下过渡细枝 3~6 */
    var nT = rng.int(3, 6);
    for (i = 0; i < nT; i++) {
      var ta = rng.range(0, TAU), tr = R * rng.range(0.3, 0.62);
      g.add(limb([tp[0], trunkH * 0.97, tp[2]],
        [cx + Math.cos(ta) * tr, crownY - R * rng.range(0.02, 0.45), cz + Math.sin(ta) * tr],
        rb * 0.18, rb * 0.05, 3, [0, rng.range(0, 0.12), 0], 3, wood));
    }

    /* 冠缘碎叶 */
    var lf = [];
    crownFringe(lf, ctx, cx, crownY + R * 0.3, cz, R, 13, 30, 0.2, 0.94);
    var lfm = leafField(lf, mat('leafLight'));
    if (lfm) g.add(lfm);

    return { r: R * 1.1, h: H };
  }

  /* ==================================================================
   * 2. 垂柳 —— 倾斜主干 + 20~40 条垂柳条
   * ================================================================== */
  function buildWillow(ctx, g) {
    var rng = ctx.rng, mat = ctx.mat;
    var H = rng.range(4.2, 6);
    var rb = rng.range(0.24, 0.34);
    var trunkH = H * rng.range(0.44, 0.54);
    var tilt = rng.range(0.14, 0.26) * (rng.chance(0.5) ? 1 : -1);
    var bend = rng.range(0.06, 0.16), wave = rng.range(1.1, 1.5);
    var wood = mat('woodDark');
    var trunk = ctx.trunk({
      h: trunkH, r: rb, rTip: rb * 0.55, bend: bend, seg: 8, sides: 9,
      mat: 'woodDark', wave: wave, rootFlare: rng.range(1.0, 1.35)
    });
    trunk.rotation.z = tilt;
    g.add(trunk);

    var tx = -Math.sin(tilt) * trunkH, ty = Math.cos(tilt) * trunkH;
    var R = rng.range(2.0, 2.5);           /* 冠幅 4~5.5 */
    var crownY = ty + R * 0.16;
    var i, j;

    /* 主枝：从主干顶向外伸展（撑开伞形冠） */
    var nMain = rng.int(4, 6);
    var branch = [];
    for (i = 0; i < nMain; i++) {
      var a = (i / nMain) * TAU + rng.range(-0.3, 0.3);
      var rr = R * rng.range(0.62, 0.95);
      var st = [tx, ty - rng.range(0.05, 0.25), 0];
      var end = [tx + Math.cos(a) * rr, crownY + rng.range(0.1, 0.6), Math.sin(a) * rr];
      branch.push([st, end, a]);
      g.add(limb(st, end, rb * 0.44, rb * 0.1, 4,
        [Math.cos(a + 1.4) * rng.range(0.1, 0.26), rng.range(0.02, 0.2), Math.sin(a + 1.4) * rng.range(0.1, 0.26)],
        4, wood));
    }

    /* 冠：扁平的伞形叶团（垂柳冠要薄，柳条才是主体） */
    blobAt(g, ctx, tx, crownY + 0.2, 0, R * 0.48, 'leafDeep', 3, 0.42, 0.2);
    blobAt(g, ctx, tx, crownY + 0.34, 0, R * 0.4, 'leafWillow', 3, 0.4, 0.22);
    for (i = 0; i < 6; i++) {
      var ba = (i / 6) * TAU + rng.range(-0.4, 0.4);
      blobAt(g, ctx, tx + Math.cos(ba) * R * 0.46, crownY + rng.range(0.0, 0.28),
        Math.sin(ba) * R * 0.46, R * rng.range(0.24, 0.36),
        i % 2 ? 'leafSpring' : 'leafWillow', 3, 0.44, 0.24);
    }

    /* 垂柳条 20~40 */
    var nS = rng.int(24, 40);
    var blade = [];
    for (i = 0; i < nS; i++) {
      var bi = branch[i % branch.length];
      var t = rng.range(0.5, 1.0);
      var s0 = lerp(bi[0][0], bi[1][0], t);
      var s1 = lerp(bi[0][1], bi[1][1], t) + rng.range(-0.15, 0.15);
      var s2 = lerp(bi[0][2], bi[1][2], t);
      var ang = bi[2] + rng.range(-0.85, 0.85);
      var ex = s0 + Math.cos(ang) * rng.range(0.12, 0.55);
      var ez = s2 + Math.sin(ang) * rng.range(0.12, 0.55);
      var ey = rng.range(1.0, 1.6);
      var sway = rng.range(0.05, 0.2) * (rng.chance(0.5) ? 1 : -1);
      var pts = [], nSeg = 6;
      for (j = 0; j <= nSeg; j++) {
        var tt = j / nSeg;
        var ee = smooth(tt);
        pts.push([
          lerp(s0, ex, ee) + Math.cos(ang + 1.57) * sway * Math.sin(tt * PI),
          Math.max(0.72, s1 + (ey - s1) * Math.pow(tt, 0.82)),
          lerp(s2, ez, ee) + Math.sin(ang + 1.57) * sway * Math.sin(tt * PI),
          lerp(0.04, 0.008, tt)
        ]);
      }
      var rod = tubeMesh(pts, 5, mat('leafWillow'), true);
      if (rod) g.add(rod);

      var nL = rng.int(7, 10);
      for (j = 0; j < nL; j++) {
        var lt = rng.range(0.2, 0.98), le = smooth(lt);
        blade.push({
          x: lerp(s0, ex, le) + Math.cos(ang + 1.57) * 0.06,
          y: Math.max(0.6, s1 + (ey - s1) * Math.pow(lt, 0.82)),
          z: lerp(s2, ez, le) + Math.sin(ang + 1.57) * 0.06,
          w: rng.range(0.05, 0.08),
          h: rng.range(0.2, 0.34),
          yaw: ang + rng.range(-0.9, 0.9),
          pitch: rng.range(-1.35, -0.5),
          roll: rng.range(-0.5, 0.5)
        });
      }
    }
    /* 冠面细叶 */
    crownFringe(blade, ctx, tx, crownY + 0.3, 0, R * 0.8, 11, 22, 0.16, 0.42);
    var lf = leafField(blade, mat('leafWillow'));
    if (lf) g.add(lf);

    return { r: R * 1.05, h: H };
  }

  /* ==================================================================
   * 3. 松 —— 弯折主干 2~3 段 + 4~6 层扁平针叶团
   * ================================================================== */
  function buildPine(ctx, g) {
    var rng = ctx.rng, mat = ctx.mat;
    var H = rng.range(5, 7);
    var rb = rng.range(0.22, 0.31);
    var wood = mat('woodDark');
    var nSeg = rng.int(3, 4), i, j, k;
    var pts = [[0, 0, 0, rb * 1.8], [0, 0.28, 0, rb * 1.06]];
    var y = 0.28, x = 0, z = 0, r = rb, lean = rng.range(0, TAU);
    for (i = 0; i < nSeg; i++) {
      y += (H * 0.94 - 0.28) / nSeg;
      x += Math.cos(lean + i * 1.9) * rng.range(0.12, 0.42);
      z += Math.sin(lean + i * 1.9) * rng.range(0.12, 0.42);
      r *= rng.range(0.6, 0.78);
      pts.push([x, y, z, r]);
    }
    g.add(tubeMesh(pts, 8, wood, true));

    var nL = rng.int(4, 6), R = 0;
    var needle = [];
    for (i = 0; i < nL; i++) {
      var f = nL === 1 ? 0.5 : i / (nL - 1);
      var ly = H * (0.33 + 0.59 * f);
      var seg = 0;
      for (k = 0; k < pts.length - 1; k++) if (pts[k + 1][1] <= ly) seg = k;
      var t = (ly - pts[seg][1]) / Math.max(0.001, pts[seg + 1][1] - pts[seg][1]);
      var cx = lerp(pts[seg][0], pts[seg + 1][0], t);
      var cz = lerp(pts[seg][2], pts[seg + 1][2], t);
      var br = lerp(1.78, 0.66, f) * rng.range(0.92, 1.06);
      if (br > R) R = br;

      /* 横向枝 4~6 根（本层） */
      var nBr = rng.int(4, 6);
      for (j = 0; j < nBr; j++) {
        var a = (j / nBr) * TAU + rng.range(-0.4, 0.4) + i * 0.7;
        var bl = br * rng.range(0.62, 0.98);
        g.add(limb([cx, ly, cz],
          [cx + Math.cos(a) * bl, ly + rng.range(-0.2, 0.22), cz + Math.sin(a) * bl],
          r * 0.85, r * 0.22, 4,
          [Math.cos(a + 1.2) * 0.12, rng.range(-0.14, 0.04), Math.sin(a + 1.2) * 0.12], 3, wood));
        needle.push({
          x: cx + Math.cos(a) * bl * 0.92,
          y: ly + rng.range(-0.12, 0.16),
          z: cz + Math.sin(a) * bl * 0.92,
          w: rng.range(0.09, 0.14), h: rng.range(0.3, 0.5),
          yaw: a + rng.range(-0.4, 0.4),
          pitch: rng.range(-0.35, 0.15), roll: rng.range(-0.5, 0.5)
        });
      }

      /* 扁平针叶团（flatY 0.45） */
      blobAt(g, ctx, cx, ly + 0.14, cz, br, i % 2 ? 'leafPine' : 'leafDeep', 3, 0.45, 0.26);
      if (i < nL - 1) {
        blobAt(g, ctx, cx, ly + 0.32, cz, br * 0.6, 'leafPine', 2, 0.5, 0.28);
      }

      /* 放射状针叶 */
      var nN = 34;
      for (j = 0; j < nN; j++) {
        var na = (j / nN) * TAU + rng.range(-0.2, 0.2);
        var nr = br * rng.range(0.6, 1.05);
        needle.push({
          x: cx + Math.cos(na) * nr,
          y: ly + 0.14 + rng.range(-0.18, 0.2),
          z: cz + Math.sin(na) * nr,
          w: rng.range(0.07, 0.11),
          h: rng.range(0.32, 0.6),
          yaw: na + rng.range(-0.3, 0.3),
          pitch: rng.range(-0.45, 0.3),
          roll: rng.range(-0.4, 0.4)
        });
      }
    }
    blobAt(g, ctx, x, H * 0.97, z, 0.36, 'leafPine', 2, 0.7, 0.3);
    var nm = leafField(needle, mat('leafPine'));
    if (nm) g.add(nm);

    return { r: R * 1.08, h: H };
  }

  /* ==================================================================
   * 4. 竹丛 —— 10~16 根带节竹竿 + 顶部散叶
   * ================================================================== */
  function buildBamboo(ctx, g) {
    var rng = ctx.rng, mat = ctx.mat;
    var nC = rng.int(12, 16), i, j, k;
    var R = 0;
    var leafSpecs = [], fallen = [];
    var culmMat = mat('bamboo'), twigMat = mat('woodDark');
    var Hmax = rng.range(4.6, 6.4);

    for (i = 0; i < nC; i++) {
      var ang = (i / nC) * TAU + rng.range(-0.45, 0.45);
      var dist = rng.range(0.12, 1.05);
      var bx = Math.cos(ang) * dist, bz = Math.sin(ang) * dist;
      var hgt = Hmax * rng.range(0.78, 1.0) * (1 - dist * 0.14);
      var r0 = rng.range(0.052, 0.088);
      var lx = Math.cos(ang + rng.range(-0.6, 0.6)) * hgt * rng.range(0.02, 0.1);
      var lz = Math.sin(ang + rng.range(-0.6, 0.6)) * hgt * rng.range(0.02, 0.1);
      var nNode = rng.int(4, 6), nodeT = [];
      for (k = 0; k < nNode; k++) nodeT.push(0.18 + 0.76 * (k + rng.range(0.15, 0.85)) / nNode);
      var ts = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
      for (k = 0; k < nodeT.length; k++) ts.push(nodeT[k]);
      ts.sort(function (a, b) { return a - b; });
      var pts = [];
      for (k = 0; k < ts.length; k++) {
        var t = ts[k];
        if (k > 0 && Math.abs(t - ts[k - 1]) < 0.009) continue;
        var w = Math.sin(t * PI * 0.9);
        var rad = r0 * (1 - 0.55 * t);
        for (j = 0; j < nodeT.length; j++) {
          var d = Math.abs(t - nodeT[j]);
          if (d < 0.009) rad *= 1.62;
          else if (d < 0.02) rad *= 1.22;
        }
        pts.push([bx + lx * t * t + Math.cos(ang) * w * 0.1,
                  t * hgt,
                  bz + lz * t * t + Math.sin(ang) * w * 0.1, rad]);
      }
      var cu = tubeMesh(pts, 6, culmMat, true);
      if (cu) g.add(cu);

      /* 顶部分枝 + 散叶 */
      var nBr = rng.int(3, 5);
      for (j = 0; j < nBr; j++) {
        var baa = ang + (j / nBr) * TAU * 0.8 + rng.range(-0.5, 0.5);
        var sy = hgt * rng.range(0.58, 0.94);
        var start = [bx + lx * sy * sy / hgt + Math.cos(baa) * 0.05, sy,
                     bz + lz * sy * sy / hgt + Math.sin(baa) * 0.05];
        var len = rng.range(0.45, 1.05);
        var end = [start[0] + Math.cos(baa) * len, start[1] + len * rng.range(0.15, 0.7),
                   start[2] + Math.sin(baa) * len];
        g.add(limb(start, end, 0.024, 0.008, 3, [0, 0.06, 0], 3, twigMat));
        var nLf = rng.int(11, 16);
        for (k = 0; k < nLf; k++) {
          var spread = 0.16 + len * 0.32;
          leafSpecs.push({
            x: end[0] + rng.range(-spread, spread),
            y: end[1] + rng.range(-spread * 0.7, spread * 0.9),
            z: end[2] + rng.range(-spread, spread),
            w: rng.range(0.07, 0.13),
            h: rng.range(0.28, 0.5),
            yaw: rng.range(0, TAU),
            pitch: rng.range(-1.0, -0.05),
            roll: rng.range(-1.2, 1.2)
          });
        }
      }
      if (dist + 0.45 > R) R = dist + 0.45;
    }

    /* 顶部叶团：贴住竿梢，形成蓬松的竹冠（不要悬空的“大饼”） */
    var nB = rng.int(11, 14);
    for (i = 0; i < nB; i++) {
      var a2 = (i / nB) * TAU + rng.range(-0.4, 0.4);
      var rd = rng.range(0.1, 0.62);
      var hy = Hmax * rng.range(0.62, 0.99);
      blobAt(g, ctx, Math.cos(a2) * rd, hy, Math.sin(a2) * rd,
        rng.range(0.42, 0.78),
        i % 3 === 0 ? 'leafLight' : (i % 3 === 1 ? 'leafSpring' : 'leafDeep'),
        i < 7 ? 2 : 1, rng.range(0.62, 0.82), 0.34);
    }

    /* 根部落叶 */
    for (i = 0; i < 26; i++) {
      var fa = rng.range(0, TAU), fd = rng.range(0.35, 1.2);
      fallen.push({
        x: Math.cos(fa) * fd, y: 0.03 + rng.range(0, 0.02), z: Math.sin(fa) * fd,
        w: rng.range(0.07, 0.11), h: rng.range(0.24, 0.36),
        yaw: rng.range(0, TAU), pitch: -PI / 2 + rng.range(-0.22, 0.22),
        roll: rng.range(-0.6, 0.6)
      });
    }
    var lm = leafField(leafSpecs, mat('leafSpring'));
    if (lm) g.add(lm);
    var fm = leafField(fallen, mat('leafLight'));
    if (fm) g.add(fm);

    return { r: Math.max(1.25, R), h: Hmax };
  }

  /* ==================================================================
   * 5. 枫 —— 细密三级枝 + 秋红冠
   * ================================================================== */
  function buildMaple(ctx, g) {
    var rng = ctx.rng, mat = ctx.mat;
    var H = rng.range(4, 6);
    var rb = rng.range(0.2, 0.29);
    var trunkH = H * rng.range(0.4, 0.5);
    var bend = rng.range(0.16, 0.32), wave = rng.range(1.1, 1.5);
    var wood = mat('woodDark');
    g.add(ctx.trunk({
      h: trunkH, r: rb, rTip: rb * 0.5, bend: bend, seg: 8, sides: 9,
      mat: 'woodDark', wave: wave, rootFlare: rng.range(1.0, 1.35)
    }));
    var tp = trunkTop(trunkH, bend, wave);
    var R = rng.range(1.1, 1.45);          /* 冠幅 2.5~3.5 */
    var crownY = H - R * 0.9;
    var i, j, tips = [];

    /* 三级细枝：主 → 侧 → 梢 */
    var nMain = rng.int(4, 6);
    for (i = 0; i < nMain; i++) {
      var a = (i / nMain) * TAU + rng.range(-0.35, 0.35);
      var rr = R * rng.range(0.5, 0.85);
      var p1 = [tp[0] + Math.cos(a) * rr, crownY - R * rng.range(0.1, 0.35), tp[2] + Math.sin(a) * rr];
      g.add(limb([tp[0], trunkH * 0.96, tp[2]], p1, rb * 0.56, rb * 0.18, 5, [0, 0.12, 0], 4, wood));
      for (j = 0; j < 3; j++) {
        var a2 = a + rng.range(-0.9, 0.9);
        var p2 = [p1[0] + Math.cos(a2) * R * rng.range(0.2, 0.45),
                  p1[1] + rng.range(0.18, 0.6),
                  p1[2] + Math.sin(a2) * R * rng.range(0.2, 0.45)];
        g.add(limb(p1, p2, rb * 0.17, rb * 0.06, 4, [0, 0.05, 0], 3, wood));
        var p3 = [p2[0] + rng.range(-0.18, 0.18), p2[1] + rng.range(0.1, 0.34), p2[2] + rng.range(-0.18, 0.18)];
        g.add(limb(p2, p3, rb * 0.06, rb * 0.02, 3, [0, 0.03, 0], 2, wood));
        tips.push(p2); tips.push(p3);
      }
    }

    /* 树冠团 */
    var nB = rng.int(9, 12);
    var cols = ['leafMaple', 'leafMaple', 'leafDeep', 'leafMaple', 'leafSpring'];
    var cx = tp[0] * 0.55, cz = tp[2] * 0.55;
    blobAt(g, ctx, cx, crownY + R * 0.32, cz, R * 0.62, 'leafMaple', 3, 0.95, 0.24);
    for (i = 0; i < nB; i++) {
      var aa = (i / nB) * TAU + rng.range(-0.5, 0.5);
      var rad = R * rng.range(0.36, 0.64);
      blobAt(g, ctx, cx + Math.cos(aa) * rad,
        crownY + rng.range(-0.3, 0.85),
        cz + Math.sin(aa) * rad,
        R * rng.range(0.32, 0.5), rng.pick(cols), 3, rng.range(0.86, 1.06), 0.26);
      /* 外圈小团 */
      var sa = aa + rng.range(-0.5, 0.5);
      blobAt(g, ctx, cx + Math.cos(sa) * rad * 1.2,
        crownY + rng.range(-0.35, 1.05), cz + Math.sin(sa) * rad * 1.2,
        R * rng.range(0.18, 0.28), rng.pick(cols), 2, rng.range(0.9, 1.1), 0.3);
    }

    /* 过渡细枝 */
    for (i = 0; i < 5; i++) {
      var ta = rng.range(0, TAU), tr = R * rng.range(0.25, 0.55);
      g.add(limb([tp[0], trunkH * 0.98, tp[2]],
        [cx + Math.cos(ta) * tr, crownY - R * rng.range(0, 0.35), cz + Math.sin(ta) * tr],
        rb * 0.14, rb * 0.04, 3, [0, 0.06, 0], 3, wood));
    }

    /* 边缘红叶 */
    var lf = [];
    crownFringe(lf, ctx, cx, crownY + R * 0.32, cz, R, 12, 28, 0.18, 0.95);
    var lfm = leafField(lf, mat('leafMaple'));
    if (lfm) g.add(lfm);

    return { r: R * 1.12, h: H };
  }

  /* ==================================================================
   * 6. 桃 / 梅 —— 矮、虬曲 3~4 级、稀疏花团
   * ================================================================== */
  function buildPeach(ctx, g, sp) {
    var rng = ctx.rng, mat = ctx.mat;
    var isPlum = sp === 'plum';
    var H = rng.range(2.6, 3.5);
    var rb = rng.range(0.12, 0.18);
    var trunkH = H * rng.range(0.26, 0.36);
    var bend = rng.range(0.12, 0.24), wave = rng.range(1.3, 1.9);
    var wood = mat('woodDark');
    g.add(ctx.trunk({
      h: trunkH, r: rb, rTip: rb * 0.72, bend: bend, seg: 7, sides: 8,
      mat: 'woodDark', wave: wave, rootFlare: rng.range(1.15, 1.55)
    }));
    var tp = trunkTop(trunkH, bend, wave);
    var R = rng.range(1.0, 1.4);
    var bMat = isPlum ? 'leafPlum' : 'leafBlossom';
    var tips = [], i, j, k;

    /* 第 1 级 */
    var n1 = rng.int(3, 4), tips1 = [];
    for (i = 0; i < n1; i++) {
      var a = (i / n1) * TAU + rng.range(-0.42, 0.42);
      var p1 = [tp[0] + Math.cos(a) * R * rng.range(0.28, 0.5),
                trunkH + (H - trunkH) * rng.range(0.3, 0.55),
                tp[2] + Math.sin(a) * R * rng.range(0.28, 0.5)];
      g.add(limb([tp[0], trunkH * 0.9, tp[2]], p1, rb * 0.7, rb * 0.34, 5,
        [Math.cos(a + 1.3) * 0.14, rng.range(-0.08, 0.14), Math.sin(a + 1.3) * 0.14], 4, wood));
      tips1.push([p1, a]);
    }
    /* 第 2、3 级 */
    for (i = 0; i < tips1.length; i++) {
      var n2 = rng.int(2, 3);
      for (j = 0; j < n2; j++) {
        var a2 = tips1[i][1] + rng.range(-1.05, 1.05);
        var p2 = [tips1[i][0][0] + Math.cos(a2) * R * rng.range(0.22, 0.46),
                  tips1[i][0][1] + rng.range(0.16, 0.55),
                  tips1[i][0][2] + Math.sin(a2) * R * rng.range(0.22, 0.46)];
        g.add(limb(tips1[i][0], p2, rb * 0.34, rb * 0.14, 4,
          [Math.cos(a2 + 1.2) * 0.05, 0.09, Math.sin(a2 + 1.2) * 0.05], 3, wood));
        var n3 = rng.int(2, 3);
        for (k = 0; k < n3; k++) {
          var a3 = a2 + rng.range(-1.15, 1.15);
          var p3 = [p2[0] + Math.cos(a3) * rng.range(0.14, 0.38),
                    p2[1] + rng.range(0.1, 0.42),
                    p2[2] + Math.sin(a3) * rng.range(0.14, 0.38)];
          g.add(limb(p2, p3, rb * 0.14, rb * 0.035, 3, [0, 0.05, 0], 3, wood));
          tips.push(p3);
        }
      }
    }

    /* 花团 20~40：小球 + 花瓣面片（整体稀疏） */
    var petals = [];
    var nBall = rng.int(24, 38);
    for (i = 0; i < nBall; i++) {
      var base = tips.length ? tips[i % tips.length] : [tp[0], trunkH + 0.4, tp[2]];
      var px = base[0] + rng.range(-0.24, 0.24);
      var py = base[1] + rng.range(-0.16, 0.32);
      var pz = base[2] + rng.range(-0.24, 0.24);
      var big = rng.chance(0.42);
      blobAt(g, ctx, px, py, pz, big ? rng.range(0.14, 0.22) : rng.range(0.08, 0.13),
        rng.chance(0.18) ? 'leafLight' : bMat, big ? 2 : 1, rng.range(0.8, 1.0), 0.32);
      var nP = rng.int(3, 5);
      for (j = 0; j < nP; j++) {
        petals.push({
          x: px + rng.range(-0.15, 0.15), y: py + rng.range(-0.1, 0.14), z: pz + rng.range(-0.15, 0.15),
          w: rng.range(0.05, 0.09), h: rng.range(0.08, 0.15),
          yaw: rng.range(0, TAU), pitch: rng.range(-1.2, 1.2), roll: rng.range(-1.2, 1.2)
        });
      }
    }
    /* 少量嫩叶团 */
    for (i = 0; i < 3; i++) {
      var aa = rng.range(0, TAU), rd = R * rng.range(0.25, 0.6);
      blobAt(g, ctx, tp[0] + Math.cos(aa) * rd,
        trunkH + (H - trunkH) * rng.range(0.45, 0.85),
        tp[2] + Math.sin(aa) * rd, rng.range(0.18, 0.3),
        isPlum ? 'leafPlum' : 'leafSpring', 2, 0.85, 0.34);
    }
    var pm = leafField(petals, mat(bMat));
    if (pm) g.add(pm);

    return { r: R, h: H };
  }

  /* ==================================================================
   * 7. 桂 —— 球形冠、深绿叶、少量浅黄花点
   * ================================================================== */
  function buildOsmanthus(ctx, g) {
    var rng = ctx.rng, mat = ctx.mat;
    var H = rng.range(3, 4.5);
    var rb = rng.range(0.16, 0.24);
    var trunkH = H * rng.range(0.26, 0.36);
    var bend = rng.range(0.1, 0.22), wave = rng.range(1.1, 1.5);
    var wood = mat('woodDark');
    g.add(ctx.trunk({
      h: trunkH, r: rb, rTip: rb * 0.62, bend: bend, seg: 7, sides: 8,
      mat: 'woodDark', wave: wave, rootFlare: rng.range(1.0, 1.4)
    }));
    var tp = trunkTop(trunkH, bend, wave);
    var R = rng.range(1.3, 1.6);           /* 球形冠，冠幅 2.9~3.6 */
    var crownY = trunkH + (H - trunkH) * 0.48;
    var cx = tp[0] * 0.5, cz = tp[2] * 0.5;
    var i, j;

    /* 分枝：短而密，撑起球冠 */
    var nBr = rng.int(3, 5);
    for (i = 0; i < nBr; i++) {
      var a = (i / nBr) * TAU + rng.range(-0.3, 0.3);
      var rr = R * rng.range(0.45, 0.78);
      var end = [cx + Math.cos(a) * rr, crownY + rng.range(-0.1, 0.35), cz + Math.sin(a) * rr];
      g.add(limb([tp[0], trunkH * 0.9, tp[2]], end, rb * 0.55, rb * 0.16, 5,
        [Math.cos(a + 1.3) * 0.1, 0.1, Math.sin(a + 1.3) * 0.1], 4, wood));
      var n2 = rng.int(2, 3);
      for (j = 0; j < n2; j++) {
        var a2 = a + rng.range(-0.8, 0.8);
        g.add(limb(end, [end[0] + Math.cos(a2) * R * 0.3,
          end[1] + rng.range(0.1, 0.42),
          end[2] + Math.sin(a2) * R * 0.3], rb * 0.15, rb * 0.04, 3, [0, 0.05, 0], 3, wood));
      }
    }

    /* 球冠：多层团块叠球 */
    var nB = rng.int(10, 12);
    blobAt(g, ctx, cx, crownY, cz, R * 0.6, 'leafDeep', 3, 1.02, 0.22);
    for (i = 0; i < nB; i++) {
      var v = (i + 0.5) / nB;
      var phi = v * PI;
      var th = i * 2.399;
      var rr2 = R * 0.56;
      blobAt(g, ctx, cx + Math.cos(th) * Math.sin(phi) * rr2,
        crownY + Math.cos(phi) * rr2 * 0.95,
        cz + Math.sin(th) * Math.sin(phi) * rr2,
        R * rng.range(0.34, 0.46), rng.chance(0.62) ? 'leafDeep' : 'leafSpring',
        3, rng.range(0.9, 1.06), 0.2);
    }

    /* 浅黄花点小球 */
    var nF = rng.int(14, 20);
    for (i = 0; i < nF; i++) {
      var fa = rng.range(0, TAU), fb = rng.range(-0.95, 0.95);
      var fl = ctx.blob({ r: rng.range(0.06, 0.1), mat: 'gold', seed: rng.range(0, 40), amp: 0.3, detail: 0 });
      fl.position.set(cx + Math.cos(fa) * Math.cos(fb) * R * rng.range(0.8, 1.02),
        crownY + Math.sin(fb) * R * rng.range(0.55, 0.92),
        cz + Math.sin(fa) * Math.cos(fb) * R * rng.range(0.8, 1.02));
      fl.castShadow = false; fl.receiveShadow = true;
      g.add(fl);
    }

    /* 叶尖 */
    var lf = [];
    crownFringe(lf, ctx, cx, crownY, cz, R, 12, 22, 0.16, 1.0);
    var lfm = leafField(lf, mat('leafLight'));
    if (lfm) g.add(lfm);

    return { r: R * 1.08, h: H };
  }

  var BUILDERS = {
    camphor: buildCamphor,
    willow: buildWillow,
    pine: buildPine,
    bamboo: buildBamboo,
    maple: buildMaple,
    peach: buildPeach,
    plum: buildPeach,
    osmanthus: buildOsmanthus
  };

  /* ==================================================================
   * 工厂
   * ================================================================== */
  JN.models['tree'] = function (ctx) {
    if (!ctx) ctx = JN.kit.makeCtx(1);
    var rng = ctx.rng;
    var sp = (ctx.opts && ctx.opts.species) ||
      rng.pick(['camphor', 'willow', 'pine', 'bamboo', 'maple', 'peach', 'osmanthus']);
    if (!BUILDERS[sp]) sp = 'camphor';

    var g = new THREE.Group();
    var info = BUILDERS[sp](ctx, g, sp) || { r: 2, h: 5 };

    g.updateMatrixWorld(true);

    /* 树体高度校准（仅 Y，幅度 <±14%，不含地面小物） */
    var box = new THREE.Box3().setFromObject(g);
    var hh = box.max.y - box.min.y;
    if (isFinite(hh) && hh > 0.5 && info.h) {
      var k = info.h / hh;
      if (k > 0.86 && k < 1.14) {
        g.scale.y = k;
        g.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(g);
      }
    }

    groundDeco(g, ctx, info.r);
    g.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(g);

    /* 贴地校正 */
    if (isFinite(box.min.y) && Math.abs(box.min.y) > 0.002) {
      var dy = -box.min.y;
      for (var i = 0; i < g.children.length; i++) g.children[i].position.y += dy;
      g.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(g);
    }

    var size = box.getSize(new THREE.Vector3());
    g.userData = {
      w: +size.x.toFixed(2),
      d: +size.z.toFixed(2),
      h: +size.y.toFixed(2),
      r: +(Math.max(size.x, size.z) / 2).toFixed(2),
      kind: 'tree',
      species: sp
    };
    return g;
  };
})();
