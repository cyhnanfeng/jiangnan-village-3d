/* models/pagoda.js —— 七层八角楼阁式宝塔（江南古村制高点：慈云塔 / 文峰塔 / 聚星塔） */
(function () {
  'use strict';
  var JN = window.JN;

  JN.models['pagoda'] = function (ctx) {
    var rng = ctx.rng;
    var g = new THREE.Group();

    var FACE = Math.PI / 4;      // 45°，八角每面
    var HALF = Math.PI / 8;      // 22.5°
    var COS = Math.cos(HALF);
    var TAN = Math.tan(HALF);

    /* ---------------- 材质（全部取自共享材质库） ---------------- */
    var M = {
      plaster: ctx.mat('plaster'),
      tile: ctx.mat('tile'),
      ridge: ctx.mat('ridge'),
      wood: ctx.mat('woodDark'),
      red: ctx.mat('woodRed'),
      black: ctx.mat('woodBlack'),
      stone: ctx.mat('stoneDark'),
      stoneL: ctx.mat('stoneLight'),
      gold: ctx.mat('gold'),
      bronze: ctx.mat('bronze'),
      paper: ctx.mat('paper')
    };

    function rnd(a, b) { return a + rng() * (b - a); }
    function jit(v, k) { return v * (1 + (rng() - 0.5) * (k === undefined ? 0.05 : k)); }

    /* 八角棱柱：面心正对 k*45°（k=0 即 +Z 正面） */
    function oct(rt, rb, h, mat, y) {
      var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 8, 1, false), mat);
      m.rotation.y = HALF;
      m.position.y = y + h / 2;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    }

    /* 把子构件挂到某一面的朝外坐标系（+Z 为法向） */
    function faceGroup(k, ap, y) {
      var a = k * FACE;
      var grp = new THREE.Group();
      grp.position.set(Math.sin(a) * ap, y, Math.cos(a) * ap);
      grp.rotation.y = a;
      return grp;
    }

    /* ----------------------------------------------------------------
     * 八角放样屋面（腰檐 / 攒尖）：沿八条直边取点，转角可起翘
     * rInAp/rOutAp 为「内/外接圆」的边心距（apothem）
     * ----------------------------------------------------------------- */
    function octRoof(rInAp, rOutAp, yIn, drop, lift, nz, nf, mat) {
      var NX = 8 * nf;
      var mesh = ctx.surface(NX, nz, function (u, v) {
        var fu = u * 8;
        var f = Math.floor(fu);
        if (f > 7) f = 7;
        var t = fu - f;
        var local = (t - 0.5) * FACE;
        var ap = rInAp + (rOutAp - rInAp) * Math.pow(v, 0.94);
        var r = ap / Math.cos(local);
        var yy = yIn - drop * Math.pow(v, 1.45);
        var ed = Math.pow(Math.abs(t - 0.5) * 2, 6.5);
        yy += lift * ed * Math.pow(v, 2.2);
        yy += (rng() - 0.5) * 0.006 * v;          // 瓦面微起伏
        var ang = f * FACE + local;
        return [Math.sin(ang) * r, yy, Math.cos(ang) * r, u * 9, v * 3.2];
      }, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    }

    /* 两端点之间的细杆（链条、刹杆斜撑） */
    function strut(x1, y1, z1, x2, y2, z2, r, mat, seg) {
      var dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 5), mat);
      m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    }

    /* 檐角铜铃（含挂杆，整体一次车削） */
    function bell(x, y, z, s) {
      var b = ctx.lathe([
        [0.012, 0.26], [0.016, 0.16], [0.030, 0.13], [0.075, 0.05],
        [0.098, -0.02], [0.100, -0.08], [0.082, -0.12], [0.040, -0.15], [0.026, -0.17]
      ], 10, M.bronze);
      b.position.set(x, y, z);
      b.scale.setScalar(s);
      g.add(b);
      return b;
    }

    /* ================= 尺寸表 ================= */
    var TIER_H = [1.72, 1.58, 1.46, 1.38, 1.32, 1.26, 1.20];
    var R0 = 2.15;
    var SHRINK = 0.92;
    var BAND = 0.66;
    var BASE_TOP = 0.98;
    var plaqueText = ['慈云塔', '文峰塔', '聚星塔'][Math.floor(rng() * 3) % 3];

    function tierR(i) { return R0 * Math.pow(SHRINK, i); }

    /* ================= 须弥座 / 台基 ================= */
    function buildBase() {
      var sec = [
        [2.70, 0.14, M.stone, 0.00],
        [2.58, 0.16, M.stoneL, 0.14],
        [2.42, 0.30, M.stone, 0.30],
        [2.58, 0.16, M.stoneL, 0.60],
        [2.72, 0.14, M.stone, 0.76],
        [2.60, 0.08, M.stoneL, 0.90]
      ];
      for (var i = 0; i < sec.length; i++) {
        oct(sec[i][0], sec[i][0] * (1 + (i === 2 ? 0.02 : 0)), sec[i][1], sec[i][2], sec[i][3]);
      }
      // 台面压边线脚
      oct(2.66, 2.70, 0.06, M.stoneL, 0.92);

      // 石栏杆（正面 k=0 留口做踏跺）
      for (var k = 1; k < 8; k++) {
        var grp = faceGroup(k, 2.42, 0);
        var len = 2 * 2.42 * TAN;
        grp.add(ctx.box(len * 0.97, 0.09, 0.13, M.stoneL, 0, BASE_TOP + 0.42, 0));
        grp.add(ctx.box(len * 0.95, 0.30, 0.07, M.stoneL, 0, BASE_TOP + 0.19, 0));
        g.add(grp);
      }
      // 抱鼓望柱（台阶两侧）
      for (var s = -1; s <= 1; s += 2) {
        var px = s * 0.92, pz = 2.28;
        g.add(ctx.box(0.16, 0.62, 0.16, M.stoneL, px, BASE_TOP + 0.31, pz));
        var cap = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), M.stoneL);
        cap.position.set(px, BASE_TOP + 0.64, pz);
        cap.castShadow = true;
        cap.receiveShadow = true;
        g.add(cap);
      }
      // 正面三级踏跺
      var stp = [[1.62, 0.94, 2.34], [1.50, 0.66, 2.68], [1.38, 0.38, 3.02]];
      for (var t = 0; t < 3; t++) {
        g.add(ctx.uvBox(stp[t][0], stp[t][1], 0.36, M.stone, 0.5, 0.5)
          .translateY(stp[t][1] / 2)
          .translateZ(stp[t][2]));
      }
    }

    /* ================= 每层墙面 / 壸门 / 假窗 ================= */
    function buildFace(k, r, H, i) {
      var ap = r * COS;
      var grp = faceGroup(k, ap, 0);
      var w = Math.min(0.74, r * 0.32);
      var hh = Math.min(H * 0.66, 1.00);
      var cy = H * 0.45;
      var front = (i === 0 && k === 0);

      // 门洞/窗洞暗面
      grp.add(ctx.box(w, hh, 0.13, M.black, 0, cy, -0.035));

      if (front) {
        // 双扇朱漆板门
        grp.add(ctx.box(w * 0.46, hh * 0.92, 0.06, M.red, -w * 0.235, cy, 0.02));
        grp.add(ctx.box(w * 0.46, hh * 0.92, 0.06, M.red, w * 0.235, cy, 0.02));
        grp.add(ctx.box(0.05, hh * 0.92, 0.075, M.black, 0, cy, 0.03));
      } else if (i <= 2) {
        // 假窗：糊纸 + 竖棂
        grp.add(ctx.box(w * 0.84, hh * 0.84, 0.03, M.paper, 0, cy, 0.025));
        grp.add(ctx.box(0.028, hh * 0.82, 0.05, M.wood, -w * 0.16, cy, 0.045));
        grp.add(ctx.box(0.028, hh * 0.82, 0.05, M.wood, w * 0.16, cy, 0.045));
        grp.add(ctx.box(w * 0.84, 0.028, 0.05, M.wood, 0, cy, 0.045));
      }

      // 门/窗框（上下槛）
      grp.add(ctx.box(w + 0.16, 0.07, 0.15, M.wood, 0, cy + hh / 2 + 0.04, 0.02));
      grp.add(ctx.box(w + 0.16, 0.055, 0.15, M.wood, 0, cy - hh / 2 - 0.03, 0.02));
      if (i <= 1) {
        grp.add(ctx.box(0.055, hh + 0.16, 0.13, M.wood, -w / 2 - 0.08, cy, 0.02));
        grp.add(ctx.box(0.055, hh + 0.16, 0.13, M.wood, w / 2 + 0.08, cy, 0.02));
      }
      g.add(grp);
    }

    /* ================= 一层塔身 ================= */
    function buildTier(i, r, y) {
      var H = TIER_H[i];
      var ap = r * COS;

      // 八角墙体（略收分）
      oct(r * 0.978, r, H, M.plaster, y);

      // 转角倚柱
      for (var k = 0; k < 8; k++) {
        var a = k * FACE + HALF;
        var rr = r * jit(0.962, 0.012);
        var ch = H * 0.995;
        g.add(ctx.cyl(0.070 * jit(1, 0.1), 0.080 * jit(1, 0.1), ch, 10, M.wood,
          Math.sin(a) * rr, y + ch / 2, Math.cos(a) * rr));
        if (i <= 2) {
          g.add(ctx.box(0.17, 0.07, 0.17, M.wood, Math.sin(a) * rr, y + ch, Math.cos(a) * rr));
        }
      }

      // 地栿（底层石脚）
      if (i === 0) oct(r * 1.012, r * 1.012, 0.10, M.stoneL, y);
      // 柱头阑额
      oct(r * 1.018, r * 1.018, 0.11, M.wood, y + H - 0.15);

      // 八面门窗
      for (var f = 0; f < 8; f++) buildFace(f, r, H, i);

      return H;
    }

    /* ================= 腰檐 + 斗拱 + 平座 ================= */
    function buildEave(i, r, yTop, rNext) {
      var ap = r * COS;

      // 檐下暗层（补齐墙顶至檐口的空隙）
      oct(r * 1.0, r * 1.0, 0.34, M.wood, yTop);
      // 普拍枋
      oct(r * 1.06, r * 1.06, 0.085, M.red, yTop + 0.30);

      // 斗拱：每面 1 攒（下两层每面 2 攒）
      var n = (i < 2) ? 2 : 1;
      for (var k = 0; k < 8; k++) {
        var a = k * FACE;
        for (var j = 0; j < n; j++) {
          var off = (n === 1) ? 0 : (j - 0.5) * 0.46;
          var px = Math.sin(a) * (ap + 0.10) + Math.cos(a) * off;
          var pz = Math.cos(a) * (ap + 0.10) - Math.sin(a) * off;
          var bg = new THREE.Group();
          bg.position.set(px, yTop + 0.05, pz);
          bg.rotation.y = a;
          bg.add(ctx.box(0.42, 0.095, 0.26, M.red, 0, 0.215, 0.01));
          bg.add(ctx.box(0.22, 0.15, 0.22, M.red, 0, 0.075, 0.01));
          g.add(bg);
        }
      }

      // 腰檐（八角攒尖小瓦顶）
      var outAp = ap + 0.94;
      var yIn = yTop + 0.36;
      var yOut = yTop - 0.28;
      var lift = 0.30;
      octRoof(ap * 0.99, outAp, yIn, yIn - yOut, lift, 12, 8, M.tile);

      // 翼角起翘 + 檐角铜铃
      var corR = outAp / COS;
      var corY = yOut + lift;
      for (var c = 0; c < 8; c++) {
        var ca = c * FACE + HALF;
        var cx = Math.sin(ca) * corR, cz = Math.cos(ca) * corR;
        var horn = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.34, 5), M.ridge);
        horn.position.set(cx * 0.995, corY + 0.10, cz * 0.995);
        horn.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(Math.sin(ca) * 0.85, 0.9, Math.cos(ca) * 0.85).normalize()
        );
        horn.castShadow = true;
        g.add(horn);
        if (i <= 3) bell(cx * 0.93, corY - 0.34, cz * 0.93, 1.0);
      }

      // 平座（八角楼板）
      var yd = yTop + BAND;
      var rApD = rNext * COS + 0.46;
      oct(rApD / COS, rApD / COS, 0.13, M.wood, yd - 0.13);
      // 平座细柱木栏杆
      for (var k2 = 0; k2 < 8; k2++) {
        var grp = faceGroup(k2, rApD, 0);
        var len = 2 * rApD * TAN;
        grp.add(ctx.box(len * 0.99, 0.055, 0.09, M.red, 0, yd + 0.45, 0));
        grp.add(ctx.box(len * 0.96, 0.30, 0.045, M.red, 0, yd + 0.21, 0));
        g.add(grp);
      }
      return yd;
    }

    /* ================= 塔刹 ================= */
    function buildSpire(apexY, outAp) {
      // 覆钵
      var bowl = ctx.lathe([
        [0.03, 0.00], [0.28, 0.02], [0.34, 0.11], [0.31, 0.22],
        [0.20, 0.32], [0.115, 0.40], [0.085, 0.46]
      ], 16, M.bronze);
      bowl.position.y = apexY;
      g.add(bowl);

      // 刹杆
      var poleH = 2.30;
      g.add(ctx.cyl(0.048, 0.062, poleH, 8, M.bronze, 0, apexY + 0.28 + poleH / 2, 0));

      // 相轮 7 圈
      for (var i = 0; i < 7; i++) {
        var t = i / 6;
        var rr = 0.255 - 0.115 * t;
        var ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.030, 5, 22), M.gold);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = apexY + 0.72 + i * 0.225;
        ring.castShadow = true;
        ring.receiveShadow = true;
        g.add(ring);
      }

      // 宝盖
      var canopy = ctx.lathe([
        [0.30, 0.00], [0.33, 0.045], [0.24, 0.11], [0.10, 0.16], [0.05, 0.20]
      ], 16, M.gold);
      canopy.position.y = apexY + 2.14;
      g.add(canopy);

      // 宝珠
      var pearl = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), M.gold);
      pearl.position.y = apexY + 2.46;
      pearl.castShadow = true;
      pearl.receiveShadow = true;
      g.add(pearl);

      // 刹顶小尖
      g.add(ctx.cyl(0.005, 0.045, 0.16, 6, M.gold, 0, apexY + 2.62, 0));

      // 四条铁链：宝盖 → 顶层檐角
      var eaveY = apexY - 1.10 + 0.26;
      for (var c = 0; c < 4; c++) {
        var a = Math.PI / 4 + c * Math.PI / 2;
        var ex = Math.sin(a) * outAp, ez = Math.cos(a) * outAp;
        strut(Math.sin(a) * 0.24, apexY + 2.12, Math.cos(a) * 0.24, ex, eaveY, ez, 0.018, M.bronze, 4);
      }
    }

    /* ================= 屋顶收头（攒尖 + 塔刹） ================= */
    function buildCrown(r, yTop) {
      var ap = r * COS;

      oct(r * 1.0, r * 1.0, 0.30, M.wood, yTop);
      oct(r * 1.07, r * 1.07, 0.085, M.red, yTop + 0.26);

      // 顶层斗拱一圈
      for (var k = 0; k < 8; k++) {
        var a = k * FACE;
        var bg = new THREE.Group();
        bg.position.set(Math.sin(a) * (ap + 0.10), yTop + 0.04, Math.cos(a) * (ap + 0.10));
        bg.rotation.y = a;
        bg.add(ctx.box(0.40, 0.09, 0.25, M.red, 0, 0.20, 0.01));
        bg.add(ctx.box(0.21, 0.14, 0.21, M.red, 0, 0.07, 0.01));
        g.add(bg);
      }

      var apexY = yTop + 1.15;
      var outAp = ap + 0.88;
      octRoof(0.12, outAp, apexY, 1.10, 0.26, 12, 8, M.tile);

      // 顶层翼角
      var corR = outAp / COS;
      var corY = apexY - 1.10 + 0.26;
      for (var c = 0; c < 8; c++) {
        var ca = c * FACE + HALF;
        var horn = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.32, 5), M.ridge);
        horn.position.set(Math.sin(ca) * corR * 0.995, corY + 0.10, Math.cos(ca) * corR * 0.995);
        horn.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(Math.sin(ca) * 0.85, 0.9, Math.cos(ca) * 0.85).normalize()
        );
        horn.castShadow = true;
        g.add(horn);
      }

      buildSpire(apexY, outAp);
    }

    /* ================= 组装 ================= */
    buildBase();

    var y = BASE_TOP;
    var i, r;
    for (i = 0; i < 7; i++) {
      r = tierR(i);
      var H = buildTier(i, r, y);
      var yTop = y + H;
      if (i < 6) {
        y = buildEave(i, r, yTop, tierR(i + 1));
      } else {
        buildCrown(r, yTop);
      }
    }

    /* 底层正面匾额 */
    var plaque = ctx.plaque({ text: plaqueText, w: 0.98, h: 0.36, frame: 'woodBlack' });
    plaque.position.set(0, BASE_TOP + TIER_H[0] * 0.80, R0 * COS + 0.10);
    g.add(plaque);

    g.userData = {
      w: 5.6,
      d: 5.6,
      h: 19,
      door: { x: 0, z: 2.9 },
      kind: 'pagoda',
      name: plaqueText
    };
    return g;
  };
})();
