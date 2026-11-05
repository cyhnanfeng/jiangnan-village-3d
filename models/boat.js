/* models/boat.js —— 乌篷船（江南水乡）
 * 船头朝 +X，长沿 X，宽沿 Z；y=0 为水面线（船底最低 -0.18）
 * U 形截面放样：外皮 / 内皮 / 舷沿 / 板条 / 水线；中段乌篷 + 篾条 + 橹 + 篙 + 缆桩
 */
(function () {
  'use strict';
  var JN = window.JN;

  JN.models['boat'] = function (ctx) {
    var rng = ctx.rng;
    var g = new THREE.Group();

    var L = rng.range(2.98, 3.32);      // 船长
    var W = rng.range(0.95, 1.08);      // 船宽
    var RAIL_Y = 0.283;                 // 中段舷顶高度

    /* ---------- 船体曲面参数 ---------- */
    function sinU(u) { return Math.sin(Math.PI * u); }
    function halfW(u) {
      return Math.max(0.020, W * 0.5 * Math.pow(Math.max(sinU(u), 0.0001), 0.8));
    }
    function yTop(u) { var s = sinU(u); return 0.28 + 0.10 * Math.pow(1 - s, 2); }
    function yBot(u) { var s = sinU(u); return -0.18 + 0.10 * Math.pow(1 - s, 2); }
    function uOf(x) { return Math.max(0, Math.min(1, x / L + 0.5)); }
    function secY(u) { return (yTop(u) + yBot(u)) * 0.5; }

    /* U 形截面：v=0 右舷(+Z) → 船底 → v=1 左舷(-Z) */
    function hullPt(u, v, off) {
      var hw = halfW(u), yt = yTop(u), yb = yBot(u);
      var th = Math.PI * v, ct = Math.cos(th), st = Math.sin(th);
      var z = (ct >= 0 ? 1 : -1) * hw * Math.pow(Math.abs(ct), 0.6);
      var y = yt - (yt - yb) * Math.pow(Math.max(st, 0), 1.35);
      if (off) {
        var cy = (yt + yb) * 0.5, dy = y - cy, ln = Math.sqrt(dy * dy + z * z) || 1;
        y += off * dy / ln; z += off * z / ln;
      }
      return [(u - 0.5) * L, y, z];
    }
    function innerPt(u, v) {
      var hw = Math.max(0.008, halfW(u) - 0.055);
      var yt = yTop(u) - 0.022, yb = yBot(u) + 0.05;
      var th = Math.PI * v, ct = Math.cos(th), st = Math.sin(th);
      var z = (ct >= 0 ? 1 : -1) * hw * Math.pow(Math.abs(ct), 0.6);
      var y = yt - (yt - yb) * Math.pow(Math.max(st, 0), 1.35);
      return [(u - 0.5) * L, y, z];
    }
    /* 舱内某一高度处的内壁半宽 */
    function innerHalf(u, y) {
      var hw = Math.max(0.008, halfW(u) - 0.055);
      var yt = yTop(u) - 0.022, yb = yBot(u) + 0.05;
      if (y >= yt) return hw;
      if (y <= yb) return 0;
      var f = (yt - y) / (yt - yb);
      var s = Math.pow(f, 1 / 1.35), c = Math.sqrt(Math.max(0, 1 - s * s));
      return hw * Math.pow(c, 0.6);
    }

    /* ---------- 工具 ---------- */
    /* 按期望朝向修正 surface 的绕序与法线（不依赖 kit 内部约定） */
    function orient(mesh, dirFn) {
      var geo = mesh.geometry, pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index;
      if (!pos || !nor || !idx) return mesh;
      var score = 0, t, a, b, c, ax, ay, az, bx, by, bz, cx, cy, cz,
        ux, uy, uz, vx, vy, vz, nx, ny, nz, d, i;
      for (t = 0; t < idx.count; t += 3) {
        a = idx.getX(t); b = idx.getX(t + 1); c = idx.getX(t + 2);
        ax = pos.getX(a); ay = pos.getY(a); az = pos.getZ(a);
        bx = pos.getX(b); by = pos.getY(b); bz = pos.getZ(b);
        cx = pos.getX(c); cy = pos.getY(c); cz = pos.getZ(c);
        ux = bx - ax; uy = by - ay; uz = bz - az;
        vx = cx - ax; vy = cy - ay; vz = cz - az;
        nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
        d = dirFn((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3);
        score += (nx * d[0] + ny * d[1] + nz * d[2]) > 0 ? 1 : -1;
      }
      if (score < 0) {
        for (t = 0; t < idx.count; t += 3) {
          a = idx.getX(t + 1);
          idx.setX(t + 1, idx.getX(t + 2));
          idx.setX(t + 2, a);
        }
        for (i = 0; i < nor.count; i++) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i));
        idx.needsUpdate = true; nor.needsUpdate = true;
      }
      return mesh;
    }
    function add(m) {
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      return m;
    }
    function skin(nu, nv, fn, mat, dirFn) {
      var m = ctx.surface(nu, nv, fn, mat);
      m.castShadow = true; m.receiveShadow = true;
      if (dirFn) orient(m, dirFn);
      g.add(m);
      return m;
    }
    var OUT = function (x, y, z) { var u = uOf(x); return [0, y - secY(u), z]; };
    var IN = function (x, y, z) { var u = uOf(x); return [0, secY(u) - y, -z]; };
    var UP = function () { return [0, 1, 0]; };

    /* 两点之间的圆杆 */
    function rod(ax, ay, az, bx, by, bz, r1, r2, seg, mat) {
      var dx = bx - ax, dy = by - ay, dz = bz - az;
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var m = ctx.cyl(r1, r2, len, seg, mat, (ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(dx / len, dy / len, dz / len).normalize());
      return add(m);
    }
    /* 半圆竹箍（拱） */
    function hoop(cx, y, r, tube, mat, seg) {
      var m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 4, seg || 10, Math.PI), ctx.mat(mat));
      m.rotation.y = Math.PI / 2;
      m.position.set(cx, y, 0);
      return add(m);
    }

    /* ---------- 1. 船壳 ---------- */
    skin(96, 40, function (u, v) { return hullPt(u, v, 0); }, 'wood', OUT);       // 外皮
    skin(70, 28, function (u, v) { return innerPt(u, v); }, 'woodDark', IN);      // 内皮

    /* 舷顶窄条：连接内外皮 */
    for (var side = 0; side < 2; side++) {
      (function (sg) {
        skin(60, 3, function (u, s) {
          var o = hullPt(u, sg ? 1 : 0, 0), i = innerPt(u, sg ? 1 : 0);
          return [o[0], o[1] + (i[1] - o[1]) * s, o[2] + (i[2] - o[2]) * s];
        }, 'woodDark', UP);
      })(side);
    }

    /* 板条：沿船长方向的横向薄板，分层叠在外皮上 */
    for (var pk = 0; pk < 13; pk++) {
      (function (i) {
        var v0 = 0.048 + i * 0.0705, v1 = v0 + 0.034;
        skin(62, 2, function (u, s) {
          return hullPt(u, v0 + (v1 - v0) * s, 0.010 + (i % 2) * 0.002);
        }, (i % 3 === 0) ? 'woodDark' : 'woodLight', OUT);
      })(pk);
    }

    /* 水线：船帮外侧一圈 woodBlack 深色细条 */
    skin(70, 2, function (u, s) { return hullPt(u, 0.215 + 0.050 * s, 0.016); }, 'woodBlack', OUT);
    skin(70, 2, function (u, s) { return hullPt(u, 0.735 + 0.050 * s, 0.016); }, 'woodBlack', OUT);

    /* 舷边护木：外沿一列短木条 */
    for (var rk = 0; rk < 13; rk++) {
      (function (i) {
        var u = 0.145 + i * 0.0592;
        var x = (u - 0.5) * L, hw = halfW(u), yt = yTop(u);
        var len = 0.24 * (0.7 + 0.3 * sinU(u));
        add(ctx.box(len, 0.030, 0.028, 'woodDark', x, yt - 0.008, hw + 0.013));
        add(ctx.box(len, 0.030, 0.028, 'woodDark', x, yt - 0.008, -hw - 0.013));
      })(rk);
    }

    /* 舱底木板 + 船头甲板 */
    var FLOOR_Y = -0.105;
    for (var fp = 0; fp < 8; fp++) {
      var fx = -0.70 + fp * 0.20;
      var fh = innerHalf(uOf(fx), FLOOR_Y) * 1.86;
      if (fh > 0.05) add(ctx.uvBox(0.058, 0.018, fh, 'wood', 1, 1)).position.set(fx, FLOOR_Y, 0);
    }
    var deckY = function (x) { return yTop(uOf(x)) - 0.108; };
    skin(14, 5, function (u, v) {
      var x = 0.84 + u * (L * 0.5 - 0.88);
      var hw = Math.max(0.02, innerHalf(uOf(x), deckY(x)) * 0.94);
      return [x, deckY(x), (v - 0.5) * 2 * hw];
    }, 'woodLight', UP);

    /* 横档 */
    add(ctx.box(0.070, 0.042, Math.max(0.2, innerHalf(uOf(0.9), -0.02) * 2), 'woodLight', 0.9, -0.010, 0));

    /* ---------- 2. 乌篷 ---------- */
    function canopy(cx, len, r, mat) {
      var cg = new THREE.CylinderGeometry(r, r, len, 12, 1, true, Math.PI, Math.PI);
      var cm = new THREE.Mesh(cg, ctx.mat(mat));
      cm.rotation.z = -Math.PI / 2;
      cm.position.set(cx, RAIL_Y, 0);
      add(cm);
      return r;
    }
    var cA = { x: -0.26, len: 0.80, r: 0.398 };
    var cB = { x: 0.40, len: 0.60, r: 0.372 };
    canopy(cA.x, cA.len, cA.r, 'woodBlack');
    canopy(cB.x, cB.len, cB.r, 'woodBlack');

    /* 篾条（竹箍） */
    var hoopA = [-0.64, -0.44, -0.24, -0.04, 0.13];
    for (var ha = 0; ha < hoopA.length; ha++) hoop(hoopA[ha], RAIL_Y, cA.r + 0.011, 0.010, 'bamboo');
    var hoopB = [0.11, 0.30, 0.49, 0.68];
    for (var hb = 0; hb < hoopB.length; hb++) hoop(hoopB[hb], RAIL_Y, cB.r + 0.011, 0.010, 'bamboo');

    /* 篷口木框 */
    hoop(-0.665, RAIL_Y, cA.r + 0.016, 0.021, 'woodDark', 12);
    hoop(0.135, RAIL_Y, cA.r + 0.016, 0.021, 'woodDark', 12);
    hoop(0.095, RAIL_Y, cB.r + 0.016, 0.019, 'woodDark', 12);
    hoop(0.705, RAIL_Y, cB.r + 0.016, 0.021, 'woodDark', 12);

    /* 篷面纵向竹条 */
    for (var si = 0; si < 5; si++) {
      var ang = Math.PI * (0.17 + 0.66 * si / 4);
      var yA = RAIL_Y + (cA.r + 0.008) * Math.sin(ang);
      var zA = (cA.r + 0.008) * Math.cos(ang);
      add(ctx.box(cA.len * 0.94, 0.013, 0.015, 'bamboo', cA.x, yA, zA));
      var yB = RAIL_Y + (cB.r + 0.008) * Math.sin(ang);
      var zB = (cB.r + 0.008) * Math.cos(ang);
      add(ctx.box(cB.len * 0.92, 0.012, 0.014, 'bamboo', cB.x, yB, zB));
    }

    /* 一角掀起的篷布（贴篷面，末端翘起） */
    skin(10, 7, function (u, v) {
      var lift = Math.pow(u, 2.2) * Math.pow(1 - v, 1.4) * 0.15;
      var r = cB.r + 0.012 + lift;
      var th = Math.PI * (0.15 + 0.42 * v);
      return [0.55 + u * 0.26 + lift * 0.6, RAIL_Y + r * Math.sin(th) + lift * 0.5, r * Math.cos(th)];
    }, 'clothIndigo', function (x, y, z) { return [0, y - RAIL_Y, z]; });

    /* ---------- 3. 细节 ---------- */
    /* 橹：船尾斜插，杆 + 桨叶 + 橹桩 */
    add(ctx.cyl(0.026, 0.030, 0.14, 6, 'woodDark', -1.36, 0.335, 0.05));
    rod(-1.36, 0.40, 0.06, -2.02, -0.10, 0.28, 0.016, 0.022, 6, 'woodLight');
    var bl = ctx.box(0.40, 0.020, 0.14, 'woodLight', -1.92, -0.03, 0.25);
    bl.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-0.69, -0.71, 0.10).normalize());
    add(bl);
    rod(-1.36, 0.40, 0.06, -1.44, 0.56, -0.02, 0.011, 0.011, 5, 'woodDark');

    /* 竹篙（斜搁在左舷舷边） */
    rod(-1.44, 0.34, -0.34, 1.28, 0.32, -0.29, 0.012, 0.012, 6, 'bamboo');
    rod(-1.44, 0.34, -0.34, -1.54, 0.24, -0.44, 0.010, 0.010, 5, 'bamboo');

    /* 系缆桩 2 + 缆绳 + 绳圈 */
    function bollard(x, z) {
      var by = deckY(x) - 0.02;
      add(ctx.cyl(0.040, 0.048, 0.15, 8, 'woodDark', x, by + 0.075, z));
      add(ctx.cyl(0.058, 0.058, 0.024, 8, 'woodDark', x, by + 0.152, z));
    }
    bollard(1.06, 0.16);
    bollard(1.06, -0.16);
    var by = deckY(1.06) - 0.02 + 0.152;
    rod(1.06, by, 0.16, 1.06, by, -0.16, 0.008, 0.008, 5, 'woodDark');
    rod(1.06, by, -0.16, 1.34, 0.26, -0.06, 0.008, 0.008, 5, 'woodDark');
    rod(1.34, 0.26, -0.06, 1.46, 0.02, 0.02, 0.008, 0.008, 5, 'woodDark');
    for (var tc = 0; tc < 3; tc++) {
      var tr = new THREE.Mesh(new THREE.TorusGeometry(0.062 - tc * 0.008, 0.009, 4, 10), ctx.mat('woodDark'));
      tr.rotation.x = Math.PI / 2;
      tr.position.set(0.94, deckY(0.94) + 0.012 + tc * 0.020, 0.02);
      add(tr);
    }

    /* 舱内：草席 + 竹篮 + 陶罐 */
    var matY = -0.092;
    var matHW = innerHalf(uOf(-0.34), matY) * 0.88;
    add(ctx.box(0.56, 0.014, Math.min(0.34, matHW * 2), 'bamboo', -0.34, matY, 0));
    for (var mi = 0; mi < 4; mi++) {
      add(ctx.box(0.56, 0.013, 0.018, 'woodDark', -0.34, matY + 0.008, -0.13 + mi * 0.087));
    }
    var basket = ctx.lathe([[0.015, 0], [0.095, 0.012], [0.125, 0.062], [0.130, 0.140], [0.112, 0.176], [0.120, 0.186]], 10, 'bamboo');
    basket.position.set(0.06, FLOOR_Y + 0.01, -0.11);
    add(basket);
    rod(0.06, 0.095, -0.11, 0.06, 0.215, -0.11, 0.007, 0.007, 5, 'bamboo');
    var jar = ctx.jar({ r: 0.082, h: 0.165, mat: 'stoneDark' });
    jar.position.set(0.46, FLOOR_Y + 0.012, 0.11);
    add(jar);

    /* 船头小灯笼 */
    rod(1.24, deckY(1.24) - 0.01, 0, 1.32, 0.97, 0, 0.011, 0.009, 6, 'bamboo');
    var ln = ctx.lantern({ r: 0.13, h: 0.30, mat: 'lantern', string: 0.25, light: false });
    ln.position.set(1.32, 0.61, 0);
    ln.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(ln);

    g.userData = {
      w: +(L + 0.34).toFixed(2),
      d: +(W + 0.05).toFixed(2),
      h: 1.02,
      kind: 'boat',
      axis: 'x',
      allowFloat: true
    };
    g.userData.allowFloat = true;
    return g;
  };
})();

