/* models/props.js —— 江南村落小道具合集
 * 7 种类型：well 水井 / mill 石磨 / woodpile 柴堆 / drying 晾晒架
 *          jars 陶坛堆 / lanternPole 灯笼杆 / shrine 小石龛
 * 原点在地面中心，y=0 为地面，正面朝 +Z。
 */
(function () {
  'use strict';
  var JN = window.JN;

  /* ---------------- 通用小工具 ---------------- */
  function rot(m, rx, ry, rz) {
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    return m;
  }

  function put(m, x, y, z, rx, ry, rz) {
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    return m;
  }

  function sph(ctx, r, mat, seg) {
    seg = seg || 10;
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 4)), ctx.mat(mat));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  function ring(ctx, r, tube, seg, mat) {
    var m = ctx.kit.ring(r, tube, seg || 12, mat);
    return m;
  }

  /* 带微弯的双面布料 */
  function clothMesh(ctx, w, h, mat, bend, phase, sw, sh) {
    var g = new THREE.Group();
    var geo = new THREE.PlaneGeometry(w, h, sw || 6, sh || 6);
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i);
      var t = (h * 0.5 - y) / h;                 // 0 顶 1 底
      var z = Math.sin(x * 3.4 / w + phase) * bend * (0.4 + 0.6 * t) + bend * 0.8 * t * t;
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    var f = new THREE.Mesh(geo, ctx.mat(mat));
    f.castShadow = true; f.receiveShadow = true;
    var back = geo.clone();
    var idx = back.index.array;
    for (var k = 0; k < idx.length; k += 3) {
      var tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp;
    }
    back.index.needsUpdate = true;
    var b = new THREE.Mesh(back, ctx.mat(mat));
    b.castShadow = true; b.receiveShadow = true;
    b.position.z = -0.004;
    g.add(f); g.add(b);
    return g;
  }

  /* 青苔斑 + 小草 */
  function mossPatch(ctx, g, x, z, r, sd) {
    var m = ctx.cyl(r, r * 0.9, 0.02, 9, 'leafDeep', x, 0.012, z);
    m.rotation.y = sd;
    g.add(m);
    var tuft = ctx.grass({ n: 3, h: 0.13, mat: 'leafDeep', seed: sd });
    tuft.position.set(x, 0, z);
    g.add(tuft);
  }

  /* 散落枯叶 */
  function fallenLeaves(ctx, g, n, rad, sd, mat) {
    for (var i = 0; i < n; i++) {
      var a = sd + i * 2.3999;
      var rr = rad * (0.25 + 0.75 * ((i * 7 % 11) / 11));
      var m = ctx.box(0.07, 0.01, 0.04, mat || 'thatch', Math.cos(a) * rr, 0.009, Math.sin(a) * rr);
      m.rotation.y = a * 1.7 + 0.3;
      m.rotation.z = 0.05 * ((i % 3) - 1);
      g.add(m);
    }
  }

  /* 一堆小碎石 */
  function stoneCluster(ctx, g, x, z, n, rad, sd) {
    for (var i = 0; i < n; i++) {
      var a = sd + i * 2.1;
      var rr = rad * (0.35 + 0.75 * ((i * 5 % 7) / 7));
      var r0 = 0.07 + 0.06 * ((i * 3 % 5) / 5);
      var s = ctx.rock({ r: r0, seed: sd + i * 1.7, mat: i % 3 ? 'stone' : 'stoneDark' });
      s.position.set(x + Math.cos(a) * rr, r0 * 0.98, z + Math.sin(a) * rr);
      s.rotation.y = a * 1.3;
      g.add(s);
    }
  }

  /* 卵石滩：细节级圆石，贴地 */
  function gravel(ctx, g, x, z, n, rad, sd) {
    for (var i = 0; i < n; i++) {
      var a = sd + i * 2.37;
      var rr = rad * (0.25 + 0.75 * ((i * 3 % 5) / 5));
      var r0 = 0.05 + 0.045 * ((i * 7 % 4) / 4);
      var s = ctx.rock({ r: r0, seed: sd + i * 2.3, mat: i % 2 ? 'stone' : 'stoneLight', detail: 2 });
      s.position.set(x + Math.cos(a) * rr, r0 * 0.9, z + Math.sin(a) * rr);
      s.rotation.y = a * 1.1;
      g.add(s);
    }
  }

  /* 草丛：多丛随机散布 */
  function grassPatch(ctx, g, x, z, n, rad, sd, mat) {
    for (var i = 0; i < n; i++) {
      var a = sd + i * 1.93;
      var rr = rad * (0.2 + 0.8 * ((i * 5 % 6) / 6));
      var t = ctx.grass({ n: 4, h: 0.16 + 0.1 * ((i % 3) / 2), mat: mat || 'leafDeep', seed: sd + i });
      t.position.set(x + Math.cos(a) * rr, 0, z + Math.sin(a) * rr);
      g.add(t);
    }
  }

  /* =====================================================================
   * 1. 水井 well
   * =================================================================== */
  function buildWell(ctx, g) {
    var rng = ctx.rng;
    var ph = 0.18, OUT = 0.9, IN = 0.6;

    /* ---- 方形井台石（四块拼出方孔） ---- */
    g.add(put(ctx.uvBox(OUT * 2, ph, OUT - IN, 'stoneLight', 0.7, 0.5), 0, ph / 2, (OUT + IN) / 2));
    g.add(put(ctx.uvBox(OUT * 2, ph, OUT - IN, 'stoneLight', 0.7, 0.5), 0, ph / 2, -(OUT + IN) / 2));
    g.add(put(ctx.uvBox(OUT - IN, ph, IN * 2, 'stone', 0.6, 0.5), (OUT + IN) / 2, ph / 2, 0));
    g.add(put(ctx.uvBox(OUT - IN, ph, IN * 2, 'stone', 0.6, 0.5), -(OUT + IN) / 2, ph / 2, 0));
    /* 台角压边石 */
    for (var c = 0; c < 4; c++) {
      var cx = (c < 2 ? 1 : -1) * 0.78, cz = (c % 2 ? 1 : -1) * 0.78;
      g.add(put(ctx.uvBox(0.3, 0.06, 0.3, 'stoneDark', 0.5, 0.5), cx, ph + 0.03, cz, 0, c * 0.12, 0));
    }
    /* 井底暗石 + 水面 */
    g.add(ctx.uvBox(IN * 2 - 0.02, 0.06, IN * 2 - 0.02, 'stoneDark', 0.5, 0.5).translateY(0.03));
    g.add(ctx.cyl(0.44, 0.44, 0.03, 16, 'stoneWet', 0, 0.075, 0));
    /* 内壁（翻转法线，从井口可见） */
    var inner = ctx.cyl(0.5, 0.5, 0.6, 14, 'stoneDark', 0, 0.37, 0, true);
    inner.scale.set(1, 1, -1);
    g.add(inner);

    /* ---- 八角井圈 ---- */
    var rc = 0.55, cw = 0.44, ct = 0.16, chh = 0.52;
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      var seg = put(ctx.uvBox(cw, chh, ct, i % 3 === 1 ? 'stoneDark' : 'stone', 0.6, 0.5),
        Math.sin(a) * rc, ph + chh / 2, Math.cos(a) * rc);
      seg.rotation.y = a;
      g.add(seg);
      var cap = put(ctx.uvBox(cw * 0.96, 0.05, ct * 1.18, 'stoneLight', 0.5, 0.5),
        Math.sin(a) * rc, ph + chh + 0.025, Math.cos(a) * rc);
      cap.rotation.y = a;
      g.add(cap);
    }
    /* 井圈上磨损/苔痕 */
    g.add(put(ctx.uvBox(0.26, 0.02, 0.1, 'stoneWet', 0.5, 0.5), 0.16, ph + chh + 0.06, 0.5, 0, 0.4, 0));

    /* ---- 木架（2 柱 + 横梁） ---- */
    for (var sd = -1; sd <= 1; sd += 2) {
      g.add(put(ctx.uvBox(0.22, 0.1, 0.22, 'stoneDark', 0.5, 0.5), sd * 0.78, ph + 0.05, 0));
      g.add(ctx.cyl(0.07, 0.085, 2.05, 8, 'wood', sd * 0.78, ph + 1.025, 0));
      g.add(ctx.cyl(0.02, 0.02, 0.12, 4, 'woodDark', sd * 0.78, ph + 0.16, 0.06));
    }
    g.add(rot(ctx.cyl(0.07, 0.07, 1.8, 8, 'woodDark', 0, ph + 2.0, 0), 0, 0, Math.PI / 2));
    /* 横梁端头出挑 */
    for (var e = -1; e <= 1; e += 2) {
      g.add(ctx.box(0.14, 0.08, 0.16, 'woodDark', e * 0.86, ph + 2.0, 0));
    }

    /* ---- 辘轳 ---- */
    var drumY = ph + 1.67;
    g.add(rot(ctx.cyl(0.15, 0.15, 1.02, 14, 'wood', 0, drumY, 0), 0, 0, Math.PI / 2));
    /* 吊挂件 */
    for (var hg = -1; hg <= 1; hg += 2) {
      g.add(ctx.box(0.05, 0.2, 0.05, 'woodDark', hg * 0.45, ph + 1.87, 0));
    }
    /* 绳圈 */
    for (var rr = -2; rr <= 2; rr++) {
      var coil = ring(ctx, 0.158, 0.019, 14, 'clothUmber');
      coil.rotation.y = Math.PI / 2;
      coil.position.set(rr * 0.19, drumY, 0);
      g.add(coil);
    }
    /* 摇柄 */
    g.add(rot(ctx.cyl(0.022, 0.022, 0.26, 5, 'woodDark', 0.64, drumY, 0), 0, 0, Math.PI / 2));
    g.add(ctx.cyl(0.02, 0.02, 0.3, 5, 'woodDark', 0.77, drumY - 0.15, 0));
    g.add(rot(ctx.cyl(0.026, 0.026, 0.18, 5, 'woodLight', 0.77, drumY - 0.3, 0.07), Math.PI / 2, 0, 0));

    /* ---- 绳 + 木桶 ---- */
    g.add(ctx.cyl(0.012, 0.012, 0.66, 4, 'clothUmber', 0.08, drumY - 0.4, 0));
    var bucketY = 0.92;
    g.add(ctx.cyl(0.13, 0.11, 0.26, 12, 'wood', 0.08, bucketY, 0));
    for (var bho = -1; bho <= 1; bho += 2) {
      var hoop = ring(ctx, 0.128, 0.012, 12, 'woodDark');
      hoop.rotation.x = Math.PI / 2;
      hoop.position.set(0.08, bucketY + bho * 0.09, 0);
      g.add(hoop);
    }
    g.add(rot(ctx.cyl(0.008, 0.008, 0.26, 4, 'woodDark', 0.08, bucketY + 0.13, 0), 0, 0, Math.PI / 2));
    /* 桶里水 */
    g.add(ctx.cyl(0.115, 0.115, 0.02, 12, 'stoneWet', 0.08, bucketY + 0.115, 0));

    /* ---- 草顶小棚 ---- */
    var roofY = ph + 2.1;
    g.add(put(ctx.uvBox(1.98, 0.05, 0.66, 'thatch', 1, 0.6), 0, roofY + 0.145, 0.31, 0.5, 0, 0));
    g.add(put(ctx.uvBox(1.98, 0.05, 0.66, 'thatch', 1, 0.6), 0, roofY + 0.145, -0.31, -0.5, 0, 0));
    g.add(ctx.uvBox(2.06, 0.1, 0.15, 'thatch', 1, 0.5).translateY(roofY + 0.29));
    for (var rf = -1; rf <= 1; rf += 2) {
      g.add(rot(ctx.cyl(0.025, 0.025, 1.2, 5, 'woodDark', rf * 0.5, roofY + 0.12, 0), Math.PI / 2, 0, 0));
    }

    /* ---- 石槽 + 水瓢 ---- */
    var tx = -0.7, tz = 0.9;
    var tg = new THREE.Group();
    tg.add(put(ctx.uvBox(0.74, 0.06, 0.42, 'stoneDark', 0.5, 0.5), 0, 0.03, 0));
    tg.add(put(ctx.uvBox(0.74, 0.2, 0.07, 'stoneDark', 0.5, 0.5), 0, 0.13, 0.175));
    tg.add(put(ctx.uvBox(0.74, 0.2, 0.07, 'stoneDark', 0.5, 0.5), 0, 0.13, -0.175));
    tg.add(put(ctx.uvBox(0.07, 0.2, 0.28, 'stoneDark', 0.5, 0.5), 0.335, 0.13, 0));
    tg.add(put(ctx.uvBox(0.07, 0.2, 0.28, 'stoneDark', 0.5, 0.5), -0.335, 0.13, 0));
    tg.add(put(ctx.uvBox(0.58, 0.03, 0.27, 'stoneWet', 0.5, 0.5), 0, 0.13, 0));
    tg.position.set(tx, 0.0, tz);
    tg.rotation.y = 0.24;
    g.add(tg);

    /* 水瓢（浮在槽里） */
    var dipper = ctx.lathe([[0, 0], [0.06, 0.004], [0.09, 0.03], [0.1, 0.075]], 10, 'woodLight');
    dipper.position.set(tx + 0.1, 0.15, tz + 0.02);
    dipper.rotation.z = 0.18;
    g.add(dipper);
    g.add(rot(ctx.box(0.2, 0.018, 0.03, 'woodLight', tx + 0.2, 0.2, tz + 0.02), 0, 0.1, 0.12));

    /* ---- 生活痕迹 ---- */
    stoneCluster(ctx, g, 0.86, -0.5, 5, 0.3, 1.3);
    stoneCluster(ctx, g, -0.95, -0.4, 4, 0.3, 4.1);
    gravel(ctx, g, 0.6, -0.72, 9, 0.36, 2.1);
    gravel(ctx, g, -0.72, 0.6, 7, 0.3, 4.4);
    grassPatch(ctx, g, 0.8, 0.72, 4, 0.2, 3.2);
    grassPatch(ctx, g, -0.82, -0.62, 3, 0.18, 6.1);
    mossPatch(ctx, g, -0.72, 0.5, 0.16, 2.2);
    mossPatch(ctx, g, 0.82, 0.6, 0.12, 5.0);
    mossPatch(ctx, g, 0.2, -0.78, 0.13, 0.7);
    fallenLeaves(ctx, g, 10, 1.0, 0.6, 'thatch');
    /* 地上绳圈 */
    for (var cr = 0; cr < 3; cr++) {
      var crr = ring(ctx, 0.14 - cr * 0.02, 0.014, 12, 'clothUmber');
      crr.rotation.x = Math.PI / 2;
      crr.position.set(-0.95, 0.02 + cr * 0.02, -0.15);
      g.add(crr);
    }
    /* 水渍 */
    g.add(ctx.cyl(0.28, 0.22, 0.012, 12, 'stoneWet', -0.7, 0.008, 0.55));

    return { w: 2.35, d: 2.26, h: 2.65 };
  }

  /* =====================================================================
   * 2. 石磨 mill
   * =================================================================== */
  function buildMill(ctx, g) {
    var rng = ctx.rng;

    /* ---- 环形石槽 ---- */
    g.add(ctx.cyl(0.94, 0.96, 0.06, 22, 'stone', 0, 0.03, 0));
    var trough = ring(ctx, 0.9, 0.085, 22, 'stoneDark');
    trough.rotation.x = Math.PI / 2;
    trough.position.y = 0.1;
    g.add(trough);
    var lip = ring(ctx, 0.55, 0.05, 18, 'stoneLight');
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.09;
    g.add(lip);
    /* 槽口沿的磨损块 */
    for (var mk = 0; mk < 6; mk++) {
      var ma = mk * 1.05 + 0.3;
      g.add(put(ctx.uvBox(0.18, 0.05, 0.1, 'stoneWet', 0.5, 0.5),
        Math.sin(ma) * 0.9, 0.155, Math.cos(ma) * 0.9, 0, ma, 0));
    }

    /* ---- 木支架 ---- */
    for (var lx = -1; lx <= 1; lx += 2) {
      for (var lz = -1; lz <= 1; lz += 2) {
        g.add(ctx.box(0.12, 0.46, 0.12, 'woodDark', lx * 0.5, 0.25, lz * 0.5));
      }
    }
    g.add(ctx.box(1.16, 0.09, 0.12, 'woodDark', 0, 0.47, 0.5));
    g.add(ctx.box(1.16, 0.09, 0.12, 'woodDark', 0, 0.47, -0.5));
    g.add(ctx.box(0.12, 0.09, 1.12, 'woodDark', 0.5, 0.47, 0));
    g.add(ctx.box(0.12, 0.09, 1.12, 'woodDark', -0.5, 0.47, 0));

    /* ---- 下扇磨盘 ---- */
    g.add(ctx.cyl(0.6, 0.64, 0.2, 24, 'stone', 0, 0.62, 0));
    /* ---- 上扇磨盘 ---- */
    g.add(ctx.cyl(0.54, 0.58, 0.18, 24, 'stoneLight', 0, 0.81, 0));
    /* 磨盘刻槽 */
    for (var gv = 0; gv < 8; gv++) {
      var ga = gv * Math.PI / 4;
      g.add(rot(ctx.box(0.42, 0.012, 0.035, 'stoneDark', Math.cos(ga) * 0.28, 0.905, Math.sin(ga) * 0.28), 0, -ga, 0));
    }
    /* 进料孔 */
    g.add(ctx.cyl(0.15, 0.19, 0.14, 14, 'stoneDark', 0, 0.97, 0));
    g.add(ctx.cyl(0.1, 0.1, 0.06, 12, 'stoneLight', 0, 1.05, 0));
    /* 木料斗 */
    g.add(ctx.box(0.3, 0.12, 0.3, 'wood', 0, 1.1, 0));
    g.add(ctx.box(0.24, 0.16, 0.24, 'wood', 0, 1.22, 0));

    /* ---- 推柄（斜杆 + 握把） ---- */
    var push = ctx.cyl(0.035, 0.04, 1.02, 7, 'wood', 0.62, 1.12, 0.16);
    push.rotation.z = -0.95;
    push.rotation.y = -0.35;
    g.add(push);
    g.add(rot(ctx.cyl(0.028, 0.028, 0.2, 6, 'woodLight', 1.02, 1.34, 0.28), 0.35, 0, 0));
    /* 柄与磨盘的连接栓 */
    g.add(ctx.box(0.1, 0.1, 0.06, 'woodDark', 0.52, 0.94, 0.06));

    /* ---- 草棚 ---- */
    for (var pz = -1; pz <= 1; pz += 2) {
      g.add(ctx.cyl(0.055, 0.07, 1.85, 7, 'wood', -0.72 + (pz > 0 ? 0 : 0), 0.925, pz * 0.62));
      g.add(ctx.cyl(0.055, 0.07, 1.85, 7, 'wood', 0.72, 0.925, pz * 0.62));
    }
    g.add(rot(ctx.cyl(0.05, 0.05, 1.62, 6, 'woodDark', 0, 1.82, 0.62), 0, 0, Math.PI / 2));
    g.add(rot(ctx.cyl(0.05, 0.05, 1.62, 6, 'woodDark', 0, 1.82, -0.62), 0, 0, Math.PI / 2));
    var shed = ctx.shedRoof({ w: 2.0, d: 1.55, h: 0.3, mat: 'thatch', lift: 0.16 });
    shed.position.set(0, 1.85, -0.75);
    g.add(shed);

    /* ---- 麻袋 ---- */
    var sack = ctx.blob({ r: 0.29, mat: 'clothUmber', seed: 2.3, detail: 2 });
    sack.position.set(-0.9, 0.33, 0.58);
    sack.scale.set(1, 0.95, 1);
    g.add(sack);
    g.add(ctx.cyl(0.09, 0.13, 0.12, 8, 'clothUmber', -0.9, 0.6, 0.58));
    /* 倒出的谷子 */
    g.add(ctx.cyl(0.2, 0.26, 0.03, 12, 'riceGold', -0.82, 0.016, 0.42));
    for (var gr = 0; gr < 6; gr++) {
      g.add(ctx.box(0.03, 0.012, 0.02, 'riceGold', -0.78 + rng.range(-0.1, 0.1), 0.02, 0.3 + rng.range(-0.12, 0.12)));
    }

    /* ---- 扫帚 ---- */
    var broomHandle = ctx.cyl(0.022, 0.026, 1.0, 5, 'bamboo', 0.86, 0.5, -0.66);
    broomHandle.rotation.z = 0.22;
    broomHandle.rotation.x = -0.18;
    g.add(broomHandle);
    var bristle = ctx.cyl(0.11, 0.03, 0.28, 8, 'thatch', 0.96, 0.14, -0.56);
    bristle.rotation.z = 0.22;
    g.add(bristle);

    /* ---- 痕迹 ---- */
    g.add(ctx.cyl(0.42, 0.36, 0.014, 14, 'stoneWet', 0.2, 0.007, -0.15));
    stoneCluster(ctx, g, -0.9, -0.75, 4, 0.3, 3.4);
    gravel(ctx, g, -0.86, 0.82, 8, 0.4, 1.9);
    gravel(ctx, g, 0.9, -0.86, 6, 0.36, 5.3);
    grassPatch(ctx, g, -0.94, 0.32, 3, 0.24, 2.6);
    grassPatch(ctx, g, 0.88, 0.72, 3, 0.22, 4.8);
    mossPatch(ctx, g, 0.82, -0.8, 0.14, 1.1);
    mossPatch(ctx, g, -0.5, 0.85, 0.12, 4.3);
    fallenLeaves(ctx, g, 8, 0.9, 2.1, 'thatch');

    return { w: 2.45, d: 2.1, h: 2.18 };
  }

  /* =====================================================================
   * 3. 柴堆 woodpile
   * =================================================================== */
  function buildWoodpile(ctx, g) {
    var rng = ctx.rng;
    var r0 = 0.088;
    var rows = [16, 14, 11, 8, 5];
    var mats = ['wood', 'woodDark', 'wood', 'woodLight'];

    /* ---- 底层垫石 ---- */
    g.add(put(ctx.uvBox(1.7, 0.07, 0.34, 'stoneDark', 0.5, 0.5), 0, 0.035, 0.42));
    g.add(put(ctx.uvBox(1.7, 0.07, 0.34, 'stoneDark', 0.5, 0.5), 0, 0.035, -0.42));
    g.add(put(ctx.uvBox(0.3, 0.09, 0.3, 'stone', 0.5, 0.5), -0.92, 0.045, 0.0));
    g.add(put(ctx.uvBox(0.3, 0.09, 0.3, 'stone', 0.5, 0.5), 0.92, 0.045, 0.0));

    /* ---- 圆木堆（端面朝 ±Z） ---- */
    for (var ri = 0; ri < rows.length; ri++) {
      var n = rows[ri];
      var span = 1.06 - ri * 0.13;
      var y = 0.075 + ri * 2 * r0 * 0.93;
      for (var i = 0; i < n; i++) {
        var x = -span + (i + 0.5) * (2 * span / n);
        var len = rng.range(0.56, 0.95);
        var zoff = rng.range(-0.05, 0.05);
        var rad = r0 * rng.range(0.86, 1.12);
        var mat = mats[(i + ri * 3) % 4];
        var log = ctx.cyl(rad, rad * rng.range(0.94, 1.04), len, 8, mat, x, y + rng.range(-0.008, 0.008), zoff);
        log.rotation.x = Math.PI / 2;
        log.rotation.z = rng.range(-0.03, 0.03);
        g.add(log);
        /* 端面木纹（朝外一侧） */
        if (ri < 3 || i % 2 === 0) {
          var capz = zoff + (i % 2 === 0 ? len / 2 : -len / 2);
          var cap = ctx.cyl(rad * 0.94, rad * 0.94, 0.012, 7, 'woodLight', x, y, capz);
          cap.rotation.x = Math.PI / 2;
          g.add(cap);
        }
      }
    }

    /* ---- 顶部草席 ---- */
    var topY = 0.075 + (rows.length - 1) * 2 * r0 * 0.93 + 0.14;
    g.add(put(ctx.uvBox(1.62, 0.05, 0.92, 'thatch', 1, 0.7), 0, topY + 0.02, 0, 0.06, 0.02, 0));
    g.add(put(ctx.uvBox(0.14, 0.07, 1.0, 'woodDark', 0.0, topY + 0.08, 0), 0, 0.02, 0));
    /* 压席石块 */
    g.add(ctx.rock({ r: 0.12, seed: 3.7, mat: 'stone' }).translateX(-0.6).translateY(topY + 0.12).translateZ(0.1));
    g.add(ctx.rock({ r: 0.1, seed: 6.1, mat: 'stoneDark' }).translateX(0.62).translateY(topY + 0.11).translateZ(-0.08));

    /* ---- 树桩 ---- */
    var stx = 1.08, stz = 0.36;
    g.add(ctx.cyl(0.27, 0.32, 0.3, 12, 'woodDark', stx, 0.15, stz));
    g.add(ctx.cyl(0.26, 0.26, 0.02, 12, 'woodLight', stx, 0.31, stz));
    g.add(ctx.cyl(0.16, 0.16, 0.012, 10, 'wood', stx, 0.325, stz));
    /* 树桩裂缝 */
    g.add(put(ctx.box(0.03, 0.02, 0.3, 'woodBlack', stx, 0.325, stz), 0, 0.6, 0));

    /* ---- 斧头 ---- */
    var axeG = new THREE.Group();
    axeG.add(ctx.cyl(0.024, 0.03, 0.56, 6, 'wood', 0, 0.3, 0));
    var blade = ctx.box(0.055, 0.2, 0.26, 'iron', 0.05, 0.5, 0);
    blade.rotation.z = 0.12;
    axeG.add(blade);
    var edge = ctx.box(0.02, 0.22, 0.28, 'iron', 0.09, 0.5, 0);
    edge.rotation.z = 0.12;
    axeG.add(edge);
    axeG.position.set(stx - 0.16, 0.0, stz + 0.16);
    axeG.rotation.set(-0.16, 0.5, 0.28);
    g.add(axeG);

    /* ---- 劈好的散柴 ---- */
    for (var sp = 0; sp < 6; sp++) {
      var spx = -1.0 + sp * 0.16 + rng.range(-0.03, 0.03);
      var spz = -0.72 + rng.range(-0.1, 0.1);
      var piece = ctx.box(0.1, 0.09, 0.5, sp % 2 ? 'woodLight' : 'wood', spx, 0.045, spz);
      piece.rotation.y = rng.range(-0.5, 0.5);
      piece.rotation.z = 0.06 * (sp % 3 - 1);
      g.add(piece);
    }

    /* ---- 痕迹 ---- */
    mossPatch(ctx, g, -1.05, -0.3, 0.14, 2.6);
    mossPatch(ctx, g, 0.95, -0.55, 0.12, 5.2);
    fallenLeaves(ctx, g, 9, 1.2, 1.4, 'thatch');
    stoneCluster(ctx, g, -1.15, 0.5, 3, 0.25, 0.9);
    gravel(ctx, g, 1.05, -0.7, 7, 0.4, 2.8);
    grassPatch(ctx, g, -1.12, -0.6, 3, 0.26, 4.1);
    grassPatch(ctx, g, 1.1, 0.55, 3, 0.22, 1.5);
    fallenLeaves(ctx, g, 6, 0.9, 3.9, 'thatch');

    return { w: 2.75, d: 1.85, h: 1.2 };
  }

  /* =====================================================================
   * 4. 晾晒架 drying
   * =================================================================== */
  function buildDrying(ctx, g) {
    var rng = ctx.rng;
    var topY = 1.86;

    /* ---- 两组门形竹架 ---- */
    for (var fx = -1; fx <= 1; fx += 2) {
      for (var fz = -1; fz <= 1; fz += 2) {
        g.add(ctx.cyl(0.042, 0.05, topY, 7, 'bamboo', fx * 1.16, topY / 2, fz * 0.56));
        /* 竹节 */
        for (var nd = 1; nd <= 2; nd++) {
          var node = ring(ctx, 0.05, 0.008, 10, 'bamboo');
          node.rotation.x = Math.PI / 2;
          node.position.set(fx * 1.16, topY * (nd / 3), fz * 0.56);
          g.add(node);
        }
        /* 柱脚垫石 */
        g.add(put(ctx.uvBox(0.14, 0.06, 0.14, 'stone', 0.5, 0.5), fx * 1.16, 0.03, fz * 0.56));
      }
      /* 门形横杆 */
      g.add(rot(ctx.cyl(0.045, 0.045, 1.24, 8, 'bamboo', fx * 1.16, topY, 0), Math.PI / 2, 0, 0));
    }

    /* ---- 两根长横杆 ---- */
    g.add(rot(ctx.cyl(0.045, 0.045, 2.5, 8, 'bamboo', 0, topY - 0.02, 0.16), 0, 0, Math.PI / 2));
    g.add(rot(ctx.cyl(0.04, 0.04, 2.5, 8, 'bamboo', 0, topY - 0.52, -0.22), 0, 0, Math.PI / 2));
    /* 斜撑 */
    for (var sx = -1; sx <= 1; sx += 2) {
      var brace = ctx.cyl(0.028, 0.028, 1.0, 5, 'bamboo', sx * 0.72, 1.2, 0.42);
      brace.rotation.x = 0.5;
      brace.rotation.z = sx * 0.12;
      g.add(brace);
    }

    /* ---- 挂晾衣物 ---- */
    var clothDefs = [
      { x: -0.88, w: 0.62, h: 0.8, mat: 'clothIndigo', y: topY - 0.02, z: 0.16, ph: 0.4 },
      { x: -0.12, w: 0.56, h: 0.72, mat: 'clothWhite', y: topY - 0.02, z: 0.16, ph: 1.9 },
      { x: 0.62, w: 0.66, h: 0.86, mat: 'clothIndigo', y: topY - 0.02, z: 0.16, ph: 3.1 },
      { x: -0.5, w: 0.58, h: 0.66, mat: 'clothRed', y: topY - 0.52, z: -0.22, ph: 4.4 },
      { x: 0.36, w: 0.7, h: 0.7, mat: 'clothWhite', y: topY - 0.52, z: -0.22, ph: 0.9 }
    ];
    for (var ci = 0; ci < clothDefs.length; ci++) {
      var cd = clothDefs[ci];
      var cl = clothMesh(ctx, cd.w, cd.h, cd.mat, 0.045, cd.ph, 6, 6);
      cl.position.set(cd.x, cd.y - cd.h / 2, cd.z);
      cl.rotation.y = 0.02 * (ci % 2 ? 1 : -1);
      g.add(cl);
      /* 搭在杆上的褶 */
      g.add(ctx.box(cd.w * 0.92, 0.03, 0.09, cd.mat, cd.x, cd.y + 0.03, cd.z));
    }
    /* 木夹子 */
    for (var pc = 0; pc < 5; pc++) {
      var px = -1.0 + pc * 0.48;
      g.add(ctx.box(0.05, 0.12, 0.03, 'woodLight', px, topY - 0.05, 0.2));
    }

    /* ---- 竹匾晒谷 ---- */
    var tray = ctx.cyl(0.56, 0.5, 0.06, 18, 'bamboo', 0.18, 0.1, 0.78);
    g.add(tray);
    g.add(ctx.cyl(0.5, 0.5, 0.025, 18, 'riceGold', 0.18, 0.14, 0.78));
    /* 谷粒 */
    for (var gr = 0; gr < 8; gr++) {
      var ga = gr * 0.78;
      g.add(ctx.box(0.035, 0.012, 0.022, 'riceGold',
        0.18 + Math.cos(ga) * 0.3 * rng.range(0.3, 1), 0.158, 0.78 + Math.sin(ga) * 0.3 * rng.range(0.3, 1)));
    }
    /* 匾架 */
    g.add(ctx.cyl(0.1, 0.14, 0.1, 8, 'bamboo', 0.18, 0.045, 0.78));

    /* ---- 石铺地面 ---- */
    for (var sl = 0; sl < 5; sl++) {
      g.add(put(ctx.uvBox(0.7, 0.06, 0.5, sl % 2 ? 'stone' : 'stoneLight', 0.6, 0.5),
        -1.0 + sl * 0.52, 0.03, -0.82 + (sl % 2) * 0.12, 0, 0.06 * (sl % 3 - 1), 0));
    }
    /* 石阶/踏脚 */
    g.add(put(ctx.uvBox(0.9, 0.1, 0.3, 'stoneDark', 0.5, 0.5), 0, 0.05, 1.12));

    /* ---- 痕迹 ---- */
    mossPatch(ctx, g, -1.22, 0.72, 0.13, 1.7);
    mossPatch(ctx, g, 0.95, 0.4, 0.1, 4.8);
    fallenLeaves(ctx, g, 7, 1.1, 3.3, 'thatch');
    gravel(ctx, g, 1.18, -0.62, 8, 0.42, 2.3);
    gravel(ctx, g, -1.16, -0.5, 6, 0.38, 5.9);
    grassPatch(ctx, g, -1.24, 0.28, 3, 0.26, 3.7);
    grassPatch(ctx, g, 1.22, 0.6, 3, 0.24, 0.9);
    /* 掉落的一只鞋/布片 */
    g.add(put(ctx.box(0.18, 0.03, 0.09, 'clothIndigo', -0.66, 0.02, 0.5), 0, 0.6, 0));

    return { w: 2.82, d: 2.4, h: 1.96 };
  }


  /* =====================================================================
   * 5. 陶坛堆 jars
   * =================================================================== */
  function buildJars(ctx, g) {
    var rng = ctx.rng;
    var defs = [
      { x: -0.72, z: 0.24, r: 0.28, h: 0.66, m: 'woodBlack', tip: 0, ry: 0.3 },
      { x: -0.24, z: 0.56, r: 0.2, h: 0.46, m: 'wood', tip: 0, ry: 1.1 },
      { x: 0.24, z: 0.42, r: 0.24, h: 0.56, m: 'woodBlack', tip: 0, ry: 2.2 },
      { x: 0.74, z: 0.1, r: 0.17, h: 0.4, m: 'wood', tip: 1, ry: 0.8 },
      { x: -0.44, z: -0.3, r: 0.22, h: 0.5, m: 'woodBlack', tip: 0, ry: 4.0 },
      { x: 0.16, z: -0.42, r: 0.3, h: 0.7, m: 'wood', tip: 0, ry: 2.8 },
      { x: 0.86, z: -0.52, r: 0.19, h: 0.42, m: 'woodBlack', tip: 2, ry: 5.1 }
    ];

    /* 垫石台 */
    g.add(put(ctx.uvBox(2.1, 0.1, 1.5, 'stoneDark', 0.6, 0.5), 0, 0.05, 0.06));
    g.add(put(ctx.uvBox(2.16, 0.05, 0.2, 'stone', 0.6, 0.5), 0, 0.125, 0.72));

    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      var y0 = 0.1;
      if (d.tip === 0) {
        var jar = ctx.jar({ r: d.r, h: d.h, mat: d.m });
        jar.position.set(d.x, y0, d.z);
        jar.rotation.y = d.ry;
        g.add(jar);
        /* 坛口红布 + 绳圈 */
        var seal = ctx.cyl(d.r * 0.5, d.r * 0.58, 0.035, 10, 'clothRed', d.x, y0 + d.h * 0.95, d.z);
        seal.rotation.y = d.ry;
        g.add(seal);
        var knot = sph(ctx, d.r * 0.16, 'clothRed', 7);
        knot.position.set(d.x, y0 + d.h * 0.99, d.z);
        knot.scale.y = 0.7;
        g.add(knot);
        var rope = ring(ctx, d.r * 0.56, 0.014, 12, 'clothUmber');
        rope.rotation.x = Math.PI / 2;
        rope.position.set(d.x, y0 + d.h * 0.88, d.z);
        g.add(rope);
        /* 坛肩上的釉痕 */
        if (i % 2 === 0) {
          g.add(put(ctx.uvBox(0.16, 0.02, 0.1, 'stoneWet', 0.5, 0.5), d.x + d.r * 0.5, y0 + d.h * 0.55, d.z, 0, d.ry, 0));
        }
      } else {
        /* 歪倒的坛子 */
        var tj = ctx.jar({ r: d.r, h: d.h, mat: d.m });
        tj.rotation.z = Math.PI / 2 * 0.94;
        tj.rotation.y = d.ry;
        tj.position.set(d.x, y0 + d.r * 0.95, d.z);
        g.add(tj);
        /* 流出的谷子 */
        g.add(ctx.cyl(0.16, 0.22, 0.025, 10, 'riceGold', d.x + 0.3, y0 + 0.012, d.z));
        var seal2 = ctx.cyl(d.r * 0.5, d.r * 0.55, 0.03, 8, 'clothRed', d.x - 0.3, y0 + d.r * 0.6, d.z);
        seal2.rotation.z = 1.2;
        g.add(seal2);
      }
    }

    /* ---- 麻袋 ---- */
    var sack1 = ctx.blob({ r: 0.3, mat: 'clothUmber', seed: 1.9, detail: 2 });
    sack1.position.set(-1.05, 0.38, -0.62);
    sack1.scale.set(1, 0.9, 0.95);
    g.add(sack1);
    g.add(ctx.cyl(0.1, 0.14, 0.13, 8, 'clothUmber', -1.05, 0.66, -0.62));
    var sack2 = ctx.blob({ r: 0.24, mat: 'clothUmber', seed: 4.6, detail: 2 });
    sack2.position.set(-1.02, 0.3, 0.02);
    sack2.scale.set(1, 0.86, 1);
    sack2.rotation.z = 0.24;
    g.add(sack2);

    /* ---- 木箱 ---- */
    var bx = 1.02, bz = 0.72;
    g.add(ctx.box(0.56, 0.4, 0.44, 'wood', bx, 0.3, bz));
    for (var bx2 = -1; bx2 <= 1; bx2 += 2) {
      g.add(ctx.box(0.58, 0.045, 0.46, 'woodDark', bx, 0.3 + bx2 * 0.16, bz));
    }
    g.add(ctx.box(0.045, 0.42, 0.46, 'woodDark', bx - 0.26, 0.3, bz));
    g.add(ctx.box(0.045, 0.42, 0.46, 'woodDark', bx + 0.26, 0.3, bz));
    g.add(rot(ctx.box(0.6, 0.04, 0.46, 'woodLight', bx, 0.52, bz), 0, 0.06, 0));
    /* 箱上小坛 */
    g.add(ctx.jar({ r: 0.13, h: 0.3, mat: 'woodBlack' }).translateX(bx).translateY(0.55).translateZ(bz));

    /* ---- 竹筐 ---- */
    var bk = ctx.lathe([[0, 0], [0.16, 0], [0.2, 0.08], [0.26, 0.24], [0.27, 0.3]], 12, 'bamboo');
    bk.position.set(-0.34, 0.1, 0.92);
    g.add(bk);
    g.add(ctx.cyl(0.25, 0.25, 0.02, 12, 'riceGold', -0.34, 0.39, 0.92));
    g.add(rot(ctx.cyl(0.02, 0.02, 0.3, 4, 'bamboo', -0.34, 0.5, 0.92), Math.PI / 2, 0, 0));
    var bk2 = ctx.lathe([[0, 0], [0.13, 0], [0.17, 0.07], [0.22, 0.2], [0.23, 0.25]], 12, 'bamboo');
    bk2.position.set(0.52, 0.1, 0.98);
    g.add(bk2);

    /* ---- 油纸伞 ---- */
    var upx = 1.06, upz = -0.8;
    g.add(ctx.cyl(0.018, 0.022, 0.86, 5, 'bamboo', upx, 0.43, upz));
    var canopy = ctx.lathe([[0, 0.34], [0.06, 0.3], [0.16, 0.16], [0.26, 0.04], [0.3, 0.0], [0.3, -0.02]], 12, 'clothWhite');
    canopy.position.set(upx, 0.72, upz);
    g.add(canopy);
    g.add(ctx.cyl(0.03, 0.03, 0.05, 6, 'woodDark', upx, 1.06, upz));

    /* ---- 痕迹 ---- */
    g.add(ctx.cyl(0.24, 0.2, 0.012, 12, 'stoneWet', 0.66, 0.006, -0.5));
    stoneCluster(ctx, g, -0.95, 0.9, 3, 0.24, 2.2);
    gravel(ctx, g, 0.94, 0.36, 7, 0.36, 1.4);
    gravel(ctx, g, -0.7, -0.62, 6, 0.34, 4.7);
    grassPatch(ctx, g, -1.06, -0.44, 3, 0.26, 3.4);
    grassPatch(ctx, g, 0.9, 0.94, 3, 0.22, 0.7);
    mossPatch(ctx, g, 0.9, 0.9, 0.12, 3.6);
    mossPatch(ctx, g, -0.9, -0.2, 0.1, 0.5);
    fallenLeaves(ctx, g, 8, 1.2, 4.2, 'thatch');

    return { w: 2.7, d: 2.3, h: 1.15 };
  }

  /* =====================================================================
   * 6. 灯笼杆 lanternPole
   * =================================================================== */
  function buildLanternPole(ctx, g) {
    var rng = ctx.rng;
    var H = 4.25;

    /* ---- 石基座 ---- */
    g.add(put(ctx.uvBox(0.86, 0.14, 0.86, 'stoneDark', 0.6, 0.5), 0, 0.07, 0));
    g.add(put(ctx.uvBox(0.62, 0.16, 0.62, 'stone', 0.6, 0.5), 0, 0.22, 0));
    g.add(put(ctx.uvBox(0.44, 0.18, 0.44, 'stoneLight', 0.5, 0.5), 0, 0.38, 0));
    /* 基座四角压石 */
    for (var c = 0; c < 4; c++) {
      var cxx = (c < 2 ? 1 : -1) * 0.32, czz = (c % 2 ? 1 : -1) * 0.32;
      g.add(put(ctx.uvBox(0.2, 0.07, 0.2, 'stone', 0.5, 0.5), cxx, 0.33, czz, 0, c * 0.4, 0));
    }

    /* ---- 木杆 ---- */
    var poleBase = 0.4;
    g.add(ctx.cyl(0.085, 0.12, H, 9, 'wood', 0, poleBase + H / 2, 0));
    /* 杆身箍 */
    for (var bi = 0; bi < 3; bi++) {
      var band = ring(ctx, 0.1 - bi * 0.008, 0.012, 10, 'woodDark');
      band.rotation.x = Math.PI / 2;
      band.position.set(0, poleBase + 1.0 + bi * 1.2, 0);
      g.add(band);
    }
    /* 杆顶宝顶 */
    g.add(ctx.cyl(0.06, 0.1, 0.1, 8, 'woodDark', 0, poleBase + H + 0.04, 0));
    var finial = ctx.lathe([[0, 0], [0.07, 0.02], [0.09, 0.08], [0.05, 0.16], [0.02, 0.22], [0, 0.26]], 10, 'bronze');
    finial.position.set(0, poleBase + H + 0.09, 0);
    g.add(finial);

    /* ---- 斜撑 ---- */
    var brace = ctx.cyl(0.05, 0.06, 1.5, 6, 'wood', 0, 1.6, -0.52);
    brace.rotation.x = 0.62;
    g.add(brace);
    g.add(put(ctx.uvBox(0.16, 0.1, 0.16, 'stoneDark', 0.5, 0.5), 0, 0.05, -1.06));
    var brace2 = ctx.cyl(0.045, 0.055, 1.2, 6, 'wood', 0.4, 1.3, 0.3);
    brace2.rotation.z = 0.5;
    brace2.rotation.x = 0.4;
    g.add(brace2);

    /* ---- 横挑杆（前后两根） ---- */
    var armY = poleBase + 3.55;
    g.add(rot(ctx.cyl(0.05, 0.06, 1.15, 7, 'woodDark', 0, armY, 0.5), Math.PI / 2, 0, 0));
    g.add(rot(ctx.cyl(0.05, 0.06, 1.15, 7, 'woodDark', 0, armY - 0.55, -0.5), Math.PI / 2, 0, 0));
    /* 斜挑撑木 */
    for (var sa = -1; sa <= 1; sa += 2) {
      var tb = ctx.cyl(0.028, 0.032, 0.66, 5, 'wood', 0, armY - 0.26, sa * 0.34);
      tb.rotation.x = sa * 0.9;
      g.add(tb);
    }

    /* ---- 两只红灯笼 ---- */
    var lampA = ctx.lantern({ r: 0.2, h: 0.38, mat: 'lantern', string: 0.5, light: false });
    lampA.position.set(0.52, armY - 0.2, 0.86);
    g.add(lampA);
    var lampB = ctx.lantern({ r: 0.18, h: 0.34, mat: 'lantern', string: 0.42, light: false });
    lampB.position.set(-0.5, armY - 0.75, -0.86);
    g.add(lampB);

    /* ---- 绳索 ---- */
    /* 灯笼到横杆的斜绳 */
    g.add(rot(ctx.cyl(0.009, 0.009, 0.5, 4, 'clothUmber', 0.56, armY + 0.12, 0.86), 0, 0, 0.6));
    g.add(rot(ctx.cyl(0.009, 0.009, 0.46, 4, 'clothUmber', -0.54, armY - 0.44, -0.86), 0, 0, -0.55));
    /* 杆身缠绕的绳结 */
    for (var rk = 0; rk < 4; rk++) {
      var knotR = ring(ctx, 0.115, 0.016, 10, 'clothUmber');
      knotR.rotation.x = Math.PI / 2;
      knotR.position.set(0, poleBase + 0.5 + rk * 0.28, 0);
      g.add(knotR);
    }
    /* 垂下的绳头 */
    var tail = ctx.cyl(0.012, 0.012, 0.9, 4, 'clothUmber', 0.06, poleBase + 0.2, 0.16);
    tail.rotation.x = 0.14;
    g.add(tail);
    var tail2 = ctx.cyl(0.01, 0.01, 0.5, 4, 'clothUmber', -0.06, poleBase + 0.16, -0.14);
    tail2.rotation.x = -0.2;
    g.add(tail2);

    /* ---- 杆下小品 ---- */
    var pot = ctx.jar({ r: 0.16, h: 0.28, mat: 'woodBlack' });
    pot.position.set(0.44, 0.0, 0.36);
    g.add(pot);
    g.add(ctx.grass({ n: 5, h: 0.24, mat: 'leafDeep', seed: 2.4 }).translateX(0.44).translateY(0.26).translateZ(0.36));
    /* 香炉小供 */
    g.add(ctx.cyl(0.08, 0.1, 0.1, 8, 'bronze', -0.4, 0.05, 0.3));
    stoneCluster(ctx, g, -0.5, -0.5, 4, 0.3, 1.1);
    gravel(ctx, g, 0.56, -0.62, 8, 0.4, 2.4);
    gravel(ctx, g, -0.62, 0.5, 6, 0.36, 5.2);
    grassPatch(ctx, g, -0.56, -0.66, 3, 0.24, 3.9);
    grassPatch(ctx, g, 0.62, 0.58, 3, 0.22, 1.3);

    /* ---- 痕迹 ---- */
    mossPatch(ctx, g, 0.4, -0.42, 0.14, 3.1);
    mossPatch(ctx, g, -0.38, 0.44, 0.11, 0.8);
    fallenLeaves(ctx, g, 8, 0.7, 2.9, 'thatch');
    /* 石基旁小水洼 */
    g.add(ctx.cyl(0.2, 0.16, 0.01, 12, 'stoneWet', 0.36, 0.006, -0.32));

    return { w: 1.76, d: 2.22, h: 5.03 };
  }

  /* =====================================================================
   * 7. 小石龛 shrine
   * =================================================================== */
  function buildShrine(ctx, g) {
    var rng = ctx.rng;
    var baseH = 0.14, wallH = 0.98, t = 0.15;
    var zBack = -0.36;

    /* ---- 台基 ---- */
    g.add(put(ctx.uvBox(0.94, baseH, 0.94, 'stoneDark', 0.6, 0.5), 0, baseH / 2, 0));
    g.add(put(ctx.uvBox(0.86, 0.05, 0.86, 'stone', 0.6, 0.5), 0, baseH + 0.025, 0));
    /* 前沿踏石 */
    g.add(put(ctx.uvBox(0.7, 0.08, 0.24, 'stone', 0.5, 0.5), 0, 0.04, 0.56));
    g.add(put(ctx.uvBox(0.6, 0.06, 0.16, 'stoneLight', 0.5, 0.5), 0, 0.03, 0.72));

    /* ---- 三面墙 ---- */
    var wy = baseH + 0.05 + wallH / 2;
    g.add(put(ctx.uvBox(0.9, wallH, t, 'stone', 0.6, 0.5), 0, wy, zBack));
    for (var sx = -1; sx <= 1; sx += 2) {
      g.add(put(ctx.uvBox(t, wallH, 0.86, 'stone', 0.6, 0.5), sx * 0.375, wy, 0.02));
      /* 墙头压顶石 */
      g.add(put(ctx.uvBox(t * 1.3, 0.06, 0.92, 'stoneLight', 0.5, 0.5), sx * 0.375, baseH + 0.05 + wallH + 0.03, 0.02));
      /* 侧壁缝隙苔痕 */
      g.add(put(ctx.uvBox(0.02, 0.3, 0.1, 'stoneWet', 0.5, 0.5), sx * (0.375 + t * 0.52), baseH + 0.28, 0.22, 0, 0, 0.06));
    }
    /* 后墙壁压顶 */
    g.add(put(ctx.uvBox(0.92, 0.06, t * 1.3, 'stoneLight', 0.5, 0.5), 0, baseH + 0.05 + wallH + 0.03, zBack));

    /* ---- 小瓦顶 ---- */
    var roofY = baseH + 0.05 + wallH + 0.06;
    var rf = ctx.roofGable({ w: 0.98, d: 0.9, h: 0.24, over: 0.1, curve: 0.1, lift: 0.05, tileRows: 6, mat: 'tile' });
    rf.position.set(0, roofY, 0.0);
    g.add(rf);
    /* 脊饰 */
    g.add(ctx.cyl(0.05, 0.06, 0.12, 6, 'ridge', 0, roofY + 0.3, 0));
    g.add(ctx.cyl(0.03, 0.045, 0.08, 6, 'ridge', 0, roofY + 0.4, 0));

    /* ---- 龛内神像剪影 ---- */
    var idolY = baseH + 0.06;
    var body = ctx.box(0.3, 0.42, 0.22, 'woodBlack', 0, idolY + 0.21, -0.16);
    g.add(body);
    g.add(ctx.box(0.34, 0.08, 0.26, 'woodBlack', 0, idolY + 0.03, -0.16));
    var head = sph(ctx, 0.115, 'woodBlack', 10);
    head.position.set(0, idolY + 0.5, -0.16);
    head.scale.set(1, 1.1, 0.95);
    g.add(head);
    /* 肩/臂 */
    for (var arm = -1; arm <= 1; arm += 2) {
      g.add(rot(ctx.cyl(0.045, 0.05, 0.32, 6, 'woodBlack', arm * 0.16, idolY + 0.24, -0.13), 0, 0, arm * 0.16));
    }
    /* 背光（暗金圆环） */
    var halo = ring(ctx, 0.17, 0.022, 14, 'bronze');
    halo.position.set(0, idolY + 0.5, -0.28);
    g.add(halo);
    /* 龛内小供桌 */
    g.add(ctx.box(0.5, 0.05, 0.2, 'woodDark', 0, idolY + 0.36, 0.14));
    for (var lg = -1; lg <= 1; lg += 2) {
      g.add(ctx.box(0.05, 0.34, 0.05, 'woodDark', lg * 0.2, idolY + 0.17, 0.14));
    }

    /* ---- 香炉 ---- */
    var cx = 0.0, cz = 0.42;
    g.add(ctx.cyl(0.09, 0.11, 0.11, 10, 'bronze', cx, baseH + 0.055, cz));
    g.add(ctx.cyl(0.105, 0.1, 0.02, 10, 'bronze', cx, baseH + 0.115, cz));
    for (var el = -1; el <= 1; el += 2) {
      g.add(ctx.cyl(0.016, 0.016, 0.1, 6, 'bronze', cx + el * 0.1, baseH + 0.11, cz));
    }
    /* 香灰 */
    g.add(ctx.cyl(0.088, 0.088, 0.012, 10, 'stoneLight', cx, baseH + 0.104, cz));
    /* 三支香 */
    for (var inc = 0; inc < 3; inc++) {
      var ix = cx + (inc - 1) * 0.045;
      var iz = cz + (inc % 2 ? 0.02 : -0.02);
      g.add(ctx.cyl(0.006, 0.006, 0.24, 4, 'bamboo', ix, baseH + 0.22, iz));
      var tip = sph(ctx, 0.011, 'clothRed', 6);
      tip.position.set(ix, baseH + 0.34, iz);
      g.add(tip);
    }
    /* 香烟细丝 */
    g.add(rot(ctx.cyl(0.004, 0.006, 0.2, 3, 'clothWhite', cx, baseH + 0.45, cz), 0.12, 0, 0.1));

    /* ---- 供果 ---- */
    g.add(ctx.cyl(0.11, 0.09, 0.02, 10, 'bronze', -0.26, baseH + 0.06, 0.44));
    for (var fr = 0; fr < 3; fr++) {
      var fa = fr * 2.1;
      var fruit = sph(ctx, 0.045, fr % 2 ? 'riceGold' : 'clothRed', 8);
      fruit.position.set(-0.26 + Math.cos(fa) * 0.035, baseH + 0.11, 0.44 + Math.sin(fa) * 0.035);
      g.add(fruit);
    }
    /* 烛台 */
    for (var cd = -1; cd <= 1; cd += 2) {
      g.add(ctx.cyl(0.05, 0.06, 0.05, 8, 'bronze', cd * 0.3, baseH + 0.075, 0.28));
      g.add(ctx.cyl(0.035, 0.035, 0.2, 8, 'clothRed', cd * 0.3, baseH + 0.2, 0.28));
      var flame = sph(ctx, 0.022, 'bronze', 6);
      flame.position.set(cd * 0.3, baseH + 0.33, 0.28);
      flame.scale.y = 1.8;
      g.add(flame);
    }

    /* ---- 蒲团 ---- */
    g.add(put(ctx.uvBox(0.36, 0.1, 0.34, 'clothUmber', 0.5, 0.5), 0, 0.05, 0.66, 0, 0.12, 0));
    g.add(put(ctx.uvBox(0.3, 0.03, 0.28, 'clothRed', 0.5, 0.5), 0, 0.11, 0.66, 0, 0.12, 0));
    g.add(rot(ctx.cyl(0.02, 0.02, 0.22, 4, 'woodDark', 0, 0.16, 0.66), Math.PI / 2, 0.4, 0));

    /* ---- 旁边小香筒 / 竹签 ---- */
    g.add(ctx.cyl(0.06, 0.07, 0.22, 8, 'bamboo', 0.42, 0.11, 0.5));
    for (var st = 0; st < 4; st++) {
      g.add(rot(ctx.cyl(0.005, 0.005, 0.34, 3, 'woodLight', 0.42 + (st - 1.5) * 0.02, 0.24, 0.5 + (st % 2) * 0.02), (st - 1.5) * 0.12, 0, (st - 1.5) * 0.1));
    }

    /* ---- 杂草 / 青苔 ---- */
    g.add(ctx.grass({ n: 6, h: 0.3, mat: 'leafDeep', seed: 3.3 }).translateX(-0.5).translateY(0.0).translateZ(0.2));
    g.add(ctx.grass({ n: 4, h: 0.22, mat: 'leafDeep', seed: 6.4 }).translateX(0.5).translateY(0.0).translateZ(-0.2));
    g.add(ctx.grass({ n: 5, h: 0.26, mat: 'leafDeep', seed: 1.2 }).translateX(0.2).translateY(0.0).translateZ(-0.62));
    mossPatch(ctx, g, -0.44, -0.44, 0.14, 2.7);
    mossPatch(ctx, g, 0.4, 0.34, 0.12, 5.6);
    mossPatch(ctx, g, -0.1, -0.5, 0.1, 0.9);
    /* 墙根苔带 */
    for (var mb = -2; mb <= 2; mb++) {
      g.add(put(ctx.uvBox(0.14, 0.02, 0.1, 'leafDeep', 0.5, 0.5), mb * 0.18, 0.2, -0.28));
    }
    fallenLeaves(ctx, g, 9, 0.8, 1.8, 'thatch');
    stoneCluster(ctx, g, 0.6, -0.5, 3, 0.22, 3.2);
    gravel(ctx, g, -0.56, 0.5, 8, 0.34, 1.6);
    gravel(ctx, g, 0.52, 0.44, 6, 0.3, 4.9);
    grassPatch(ctx, g, -0.6, -0.2, 3, 0.22, 2.9);
    grassPatch(ctx, g, 0.58, -0.34, 3, 0.2, 6.3);
    fallenLeaves(ctx, g, 6, 0.7, 4.6, 'thatch');
    /* 掉落的果 */
    g.add(sph(ctx, 0.04, 'riceGold', 6).translateX(0.24).translateY(0.045).translateZ(0.7));

    return { w: 1.74, d: 1.66, h: 2.06 };
  }

  /* =====================================================================
   * 分发
   * =================================================================== */
  JN.models['props'] = function (ctx) {
    var types = ['well', 'mill', 'woodpile', 'drying', 'jars', 'lanternPole', 'shrine'];
    var t = (ctx.opts && ctx.opts.type) || ctx.rng.pick(types);
    if (types.indexOf(t) < 0) t = 'shrine';
    var g = new THREE.Group();
    var dim;
    if (t === 'well') dim = buildWell(ctx, g);
    else if (t === 'mill') dim = buildMill(ctx, g);
    else if (t === 'woodpile') dim = buildWoodpile(ctx, g);
    else if (t === 'drying') dim = buildDrying(ctx, g);
    else if (t === 'jars') dim = buildJars(ctx, g);
    else if (t === 'lanternPole') dim = buildLanternPole(ctx, g);
    else dim = buildShrine(ctx, g);
    g.userData = { w: dim.w, d: dim.d, h: dim.h, kind: 'props', type: t };
    return g;
  };
})();
