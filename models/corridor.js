/* models/corridor.js —— 沿街廊棚：跨街木廊 + 深出檐瓦顶 + 临街铺面 */
(function () {
  'use strict';
  var JN = window.JN;

  JN.models['corridor'] = function (ctx) {
    var R = ctx.rng;
    var len = (ctx.opts && ctx.opts.len) || 9;
    len = Math.max(6, Math.min(14, len));

    var g = new THREE.Group();

    /* ---------- 材质：10 种（9 共享 + 匾额文字） ---------- */
    var M = {
      plaster: ctx.mat('plaster'),
      tile: ctx.mat('tile'),
      tileDark: ctx.mat('tileDark'),
      wood: ctx.mat('wood'),
      woodDark: ctx.mat('woodDark'),
      woodLight: ctx.mat('woodLight'),
      stoneDark: ctx.mat('stoneDark'),
      slab: ctx.mat('slab'),
      lantern: ctx.mat('lantern')
    };

    function add(o) { if (o) { o.castShadow = true; o.receiveShadow = true; g.add(o); } return o; }
    function bx(w, h, d, mat, x, y, z) { return add(ctx.box(w, h, d, mat, x, y, z)); }
    function cy(rt, rb, h, seg, mat, x, y, z, open) { return add(ctx.cyl(rt, rb, h, seg, mat, x, y, z, open)); }
    function grp(o, x, y, z, ry) {
      if (!o) return o;
      o.position.set(x, y, z); if (ry) o.rotation.y = ry;
      o.traverse(function (q) { if (q.isMesh) { q.castShadow = true; q.receiveShadow = true; } });
      g.add(o); return o;
    }

    /* ---------- 竖向控制线 ---------- */
    var zFront = 1.0, zBack = -1.15, zPostB = -0.96;
    var zEave = 2.42, zRidge = -1.42;
    var roofD = zEave - zRidge;
    var yEave = 2.96, yRidge = 3.56;
    var postTop = 2.78, yBeam = 2.86;

    /* ---------- 柱网：柱距 1.6~2.0，不越过两端 ---------- */
    var nPost = Math.max(2, Math.round(len / 1.8));
    var span = len - 1.0;
    var sp = span / (nPost - 1);
    if (sp > 2.0) { nPost = Math.ceil(span / 2.0) + 1; }
    else if (sp < 1.6) { nPost = Math.floor(span / 1.6) + 1; }
    sp = span / (nPost - 1);

    var xs = [], i, k;
    for (i = 0; i < nPost; i++) xs.push(-span / 2 + i * sp);

    /* ---------- 柱础 + 木柱（车削，带收分） ---------- */
    var baseProfile = [[0.25, 0], [0.245, 0.03], [0.21, 0.08], [0.175, 0.13], [0.15, 0.17], [0.145, 0.19]];
    var colProfile = [[0.135, 0], [0.125, 0.1], [0.115, 0.5], [0.106, 1.3], [0.098, 2.1], [0.092, 2.6]];
    for (i = 0; i < nPost; i++) {
      var px = xs[i] + (R() - 0.5) * 0.02;
      grp(ctx.lathe(baseProfile, 12, M.stoneDark), px, 0, zFront);
      grp(ctx.lathe(baseProfile, 12, M.stoneDark), px, 0, zPostB);
      grp(ctx.lathe(colProfile, 12, M.wood), px, 0.19, zFront);
      grp(ctx.lathe(colProfile, 12, M.wood), px, 0.19, zPostB);
      bx(0.26, 0.09, 0.26, M.woodDark, px, postTop - 0.04, zFront);   /* 柱头斗 */
      bx(0.26, 0.09, 0.26, M.woodDark, px, postTop - 0.04, zPostB);
      bx(0.3, 0.04, 0.3, M.woodLight, px, postTop + 0.02, zFront);
      bx(0.3, 0.04, 0.3, M.woodLight, px, postTop + 0.02, zPostB);
    }

    /* ---------- 梁架 + 牛腿斜撑 ---------- */
    bx(span + 0.8, 0.16, 0.15, M.woodDark, 0, yBeam, zFront);
    bx(span + 0.8, 0.16, 0.15, M.woodDark, 0, yBeam, zPostB);
    bx(span + 0.8, 0.07, 0.19, M.woodLight, 0, yBeam + 0.11, zFront);
    for (i = 0; i < nPost; i++) {
      bx(0.11, 0.13, zFront - zPostB + 0.14, M.woodDark, xs[i], 2.72, (zFront + zPostB) / 2);
      var leg = bx(0.08, 0.86, 0.08, M.woodLight, xs[i], 2.72, 1.45);   /* 牛腿 */
      leg.rotation.x = 0.8;
      var leg2 = bx(0.08, 0.5, 0.08, M.woodLight, xs[i], 2.8, -1.18);
      leg2.rotation.x = -0.95;
    }

    /* ---------- 瓦顶：单坡，临街深出檐，举折 + 瓦垄 + 翼角 ---------- */
    function roofY(x, z) {
      var t = (z - zRidge) / roofD;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      var y = yRidge + (yEave - yRidge) * Math.pow(t, 1.35);
      y += 0.05 * Math.abs(Math.sin(x * Math.PI / 0.30));
      y += 0.07 * Math.pow(Math.abs(x) / (len * 0.5 + 0.15), 3);
      return y;
    }
    var roofW = len + 0.3;
    function slopeGeo(w, d, segX, segZ, flip, drop) {
      var geo = new THREE.PlaneGeometry(w, d, segX, segZ);
      geo.rotateX(flip ? Math.PI / 2 : -Math.PI / 2);
      var p = geo.attributes.position;
      for (var n = 0; n < p.count; n++) p.setY(n, roofY(p.getX(n), p.getZ(n)) - drop);
      geo.computeVertexNormals();
      JN.geo.scaleUV(geo, w / 1.1, d / 0.55);
      return geo;
    }
    var roofMesh = new THREE.Mesh(slopeGeo(roofW, roofD, 152, 40, false, 0), M.tile);
    roofMesh.position.set(0, 0, (zEave + zRidge) / 2);
    add(roofMesh);
    var soffitMesh = new THREE.Mesh(slopeGeo(roofW, roofD, 110, 16, true, 0.08), M.woodDark);
    soffitMesh.position.set(0, 0, (zEave + zRidge) / 2);
    add(soffitMesh);

    /* 正脊（靠墙一侧） */
    bx(roofW + 0.06, 0.14, 0.24, M.tileDark, 0, yRidge + 0.06, zRidge + 0.11);
    bx(0.18, 0.3, 0.26, M.tileDark, -(roofW / 2 - 0.05), yRidge + 0.16, zRidge + 0.11);
    bx(0.18, 0.3, 0.26, M.tileDark, (roofW / 2 - 0.05), yRidge + 0.16, zRidge + 0.11);
    bx(0.38, 0.1, 0.36, M.tileDark, 0, yRidge + 0.15, zRidge + 0.11);

    /* 垂脊（两端沿坡） */
    for (i = 0; i < 2; i++) {
      var sx = (i === 0 ? -1 : 1) * (roofW / 2 - 0.02);
      var sh = bx(0.15, 0.13, roofD * 1.02, M.tileDark, sx, (yEave + yRidge) / 2 + 0.07, (zEave + zRidge) / 2);
      sh.rotation.x = Math.atan((yRidge - yEave) / roofD);
      bx(0.2, 0.16, 0.3, M.tileDark, sx, yRidge + 0.08, zRidge + 0.05);
    }

    /* 檐口：封檐板 + 瓦当 + 滴水 */
    bx(roofW, 0.12, 0.06, M.woodDark, 0, yEave - 0.02, zEave + 0.02);
    var nDang = Math.max(12, Math.floor(roofW / 0.42));
    for (i = 0; i < nDang; i++) {
      var tx = -((nDang - 1) * 0.42) / 2 + i * 0.42;
      var wd = cy(0.062, 0.062, 0.1, 8, M.tileDark, tx, yEave - 0.02, zEave + 0.05);
      wd.rotation.x = Math.PI / 2;
      if (i % 2 === 0) bx(0.15, 0.024, 0.19, M.tileDark, tx, yEave - 0.1, zEave + 0.1);
    }
    /* 檐下椽条 + 挑檐檩 */
    var nRaf = Math.max(7, Math.floor(roofW / 0.7));
    for (i = 0; i < nRaf; i++) {
      var rx = -((nRaf - 1) * 0.7) / 2 + i * 0.7;
      var raf = bx(0.06, 0.07, 1.72, M.woodLight, rx, 2.99, 1.56);
      raf.rotation.x = 0.16;
    }
    bx(span + 0.9, 0.09, 0.11, M.woodDark, 0, 3.02, zFront + 0.02);
    bx(span + 0.9, 0.08, 0.1, M.woodDark, 0, 3.18, 1.92);

    /* 内侧墙头小披檐（短檐，自建坡面） */
    var innerGeo = new THREE.PlaneGeometry(roofW, 0.66, 36, 3);
    innerGeo.rotateX(-Math.PI / 2);
    var ip = innerGeo.attributes.position;
    for (i = 0; i < ip.count; i++) {
      var ix = ip.getX(i), iz = ip.getZ(i);
      ip.setY(i, 3.16 + 0.04 * Math.abs(Math.sin(ix * Math.PI / 0.3)) - 0.1 * ((iz + 0.33) / 0.66));
    }
    innerGeo.computeVertexNormals();
    JN.geo.scaleUV(innerGeo, roofW / 1.1, 1);
    var innerMesh = new THREE.Mesh(innerGeo, M.tile);
    innerMesh.position.set(0, 0, zBack - 0.32);
    add(innerMesh);
    for (i = 0; i < nDang; i++) {
      var tx2 = -((nDang - 1) * 0.42) / 2 + i * 0.42;
      var wd2 = cy(0.052, 0.052, 0.08, 8, M.tileDark, tx2, 3.04, zBack - 0.66);
      wd2.rotation.x = Math.PI / 2;
    }

    /* ---------- 内侧白墙（-Z，微起伏） ---------- */
    var wallGeo = new THREE.PlaneGeometry(len, 3.05, 60, 14);
    var wp = wallGeo.attributes.position;
    for (i = 0; i < wp.count; i++) {
      wp.setZ(i, 0.012 * Math.sin(wp.getX(i) * 2.6) * Math.cos(wp.getY(i) * 4.2));
    }
    wallGeo.computeVertexNormals();
    JN.geo.scaleUV(wallGeo, len / 1.4, 2.2);
    var wallMesh = new THREE.Mesh(wallGeo, M.plaster);
    wallMesh.position.set(0, 1.52, zBack + 0.11);
    add(wallMesh);
    bx(len, 3.05, 0.2, M.plaster, 0, 1.52, zBack + 0.02);
    bx(len, 0.46, 0.26, M.stoneDark, 0, 0.23, zBack + 0.03);       /* 勒脚 */
    bx(len + 0.06, 0.11, 0.28, M.tileDark, 0, 3.08, zBack + 0.02);  /* 墙头压瓦 */

    /* ---------- 门洞 1~2 个（门扇 + 石门框 + 门簪铺首） ---------- */
    var nDoor = len >= 8 ? 2 : 1;
    for (i = 0; i < nDoor; i++) {
      var dx = nDoor === 2 ? (i === 0 ? -len * 0.24 : len * 0.21) : 0;
      var dz = zBack - 0.14;
      bx(0.14, 2.2, 0.13, M.stoneDark, dx - 0.56, 1.1, dz);
      bx(0.14, 2.2, 0.13, M.stoneDark, dx + 0.56, 1.1, dz);
      bx(1.26, 0.15, 0.15, M.stoneDark, dx, 2.24, dz);
      for (k = 0; k < 2; k++) {
        var lx = dx + (k === 0 ? -0.23 : 0.23);
        bx(0.45, 2.02, 0.06, M.wood, lx, 1.01, dz + 0.04);
        bx(0.45, 0.055, 0.075, M.woodDark, lx, 0.3, dz + 0.045);
        bx(0.45, 0.055, 0.075, M.woodDark, lx, 1.74, dz + 0.045);
        bx(0.06, 0.11, 0.09, M.woodLight, dx + (k === 0 ? -0.035 : 0.035), 1.3, dz + 0.05);
        cy(0.05, 0.05, 0.025, 8, M.stoneDark, dx + (k === 0 ? -0.07 : 0.07), 1.16, dz + 0.06);
      }
      bx(1.04, 0.1, 0.17, M.stoneDark, dx, 0.05, dz + 0.05);          /* 门槛 */
    }

    /* ---------- 临街铺面（+Z）：排门板 / 格窗交替，部分关闭 ---------- */
    var bays = nPost - 1;
    var styles = ['grid', 'step', 'round', 'grid'];
    for (i = 0; i < bays; i++) {
      var cx = (xs[i] + xs[i + 1]) / 2;
      var bw = sp - 0.24;
      /* 下半截排门板（逐块竖板） */
      var nPlank = 5;
      for (k = 0; k < nPlank; k++) {
        var plx = cx - bw / 2 + (k + 0.5) * (bw / nPlank);
        bx(bw / nPlank - 0.018, 1.02, 0.06, k === 2 ? M.woodLight : M.wood, plx, 0.54, zFront + 0.04);
      }
      bx(bw + 0.04, 0.07, 0.1, M.woodDark, cx, 1.09, zFront + 0.05);
      var closed = R() < 0.4;
      if (closed) {
        for (k = 0; k < nPlank; k++) {
          var plx2 = cx - bw / 2 + (k + 0.5) * (bw / nPlank);
          bx(bw / nPlank - 0.018, 1.3, 0.055, M.wood, plx2, 1.8, zFront + 0.04);
        }
        bx(bw, 0.05, 0.09, M.woodDark, cx, 1.47, zFront + 0.06);
        bx(bw, 0.05, 0.09, M.woodDark, cx, 2.2, zFront + 0.06);
        bx(0.16, 0.05, 0.1, M.woodLight, cx, 1.84, zFront + 0.06);   /* 门环座 */
      } else {
        grp(ctx.lattice({
          w: bw, h: 1.32, cols: 4, rows: 3,
          style: styles[i % styles.length],
          paper: 'plaster', frame: 'wood', rng: R
        }), cx, 1.84, zFront + 0.05);
      }
      /* 竖框 + 挂落 */
      bx(0.075, 2.62, 0.12, M.woodDark, xs[i] + 0.12, 1.35, zFront + 0.06);
      bx(0.075, 2.62, 0.12, M.woodDark, xs[i + 1] - 0.12, 1.35, zFront + 0.06);
      bx(bw, 0.06, 0.09, M.woodLight, cx, 2.58, zFront + 0.08);
      for (k = 0; k < 3; k++) {
        bx(0.04, 0.12, 0.07, M.woodLight, cx - bw / 2 + (k + 0.5) * (bw / 3), 2.5, zFront + 0.08);
      }
    }

    /* 柜台：厚木台面挑出 + 柜上小物 */
    var ci = Math.floor(bays / 2);
    var ccx = (xs[ci] + xs[ci + 1]) / 2;
    bx(sp - 0.16, 0.14, 0.54, M.woodLight, ccx, 1.02, zFront + 0.32);
    bx(sp - 0.34, 0.86, 0.06, M.wood, ccx, 0.55, zFront + 0.55);
    bx(0.09, 0.9, 0.09, M.woodDark, ccx - 0.58, 0.45, zFront + 0.38);
    bx(0.09, 0.9, 0.09, M.woodDark, ccx + 0.58, 0.45, zFront + 0.38);
    bx(0.24, 0.22, 0.24, M.wood, ccx - 0.42, 1.2, zFront + 0.32);
    cy(0.1, 0.1, 0.22, 8, M.plaster, ccx - 0.08, 1.21, zFront + 0.3);

    /* 匾额店招 1~2 块（文字随机） */
    var words = ['茶', '酒', '米', '布', '药'];
    var word = words[Math.floor(R() * 5) % 5];
    var nPl = len >= 8 ? 2 : 1;
    for (i = 0; i < nPl; i++) {
      var pi = nPl === 2 ? (i === 0 ? Math.floor(bays / 3) : bays - 1) : ci;
      var px2 = (xs[pi] + xs[pi + 1]) / 2;
      grp(ctx.plaque({ text: word, w: 0.9, h: 0.36, frame: 'woodDark' }), px2, 2.46, zFront + 0.16);
    }

    /* 红灯笼 2~4 只（不发光，车削灯身） */
    var lanProfile = [[0, 0.14], [0.1, 0.13], [0.17, 0.08], [0.19, 0], [0.17, -0.08], [0.1, -0.13], [0, -0.14]];
    var nLan = len >= 10 ? 4 : (len >= 7 ? 3 : 2);
    for (i = 0; i < nLan; i++) {
      var lx = nLan === 1 ? 0 : (-span * 0.36 + span * 0.72 * (i / (nLan - 1)));
      var lz = zFront + 0.5;
      cy(0.014, 0.014, 0.34, 6, M.woodDark, lx, 2.7, lz);                    /* 挂绳 */
      grp(ctx.lathe(lanProfile, 10, M.lantern), lx, 2.42, lz);               /* 灯身 */
      cy(0.09, 0.09, 0.05, 8, M.woodDark, lx, 2.6, lz);                      /* 灯盖 */
      cy(0.09, 0.09, 0.05, 8, M.woodDark, lx, 2.24, lz);                     /* 灯座 */
      cy(0.035, 0.055, 0.18, 6, M.lantern, lx, 2.13, lz);                    /* 流苏 */
    }

    /* ---------- 街面：青石板 + 分缝 + 排水沟 + 沟盖石 ---------- */
    var paveW = 3.0;
    var paveGeo = new THREE.PlaneGeometry(len, paveW, 96, 30);
    paveGeo.rotateX(-Math.PI / 2);
    var pp = paveGeo.attributes.position;
    for (i = 0; i < pp.count; i++) {
      var gx = pp.getX(i), gz = pp.getZ(i);
      pp.setY(i, 0.006 + 0.004 * Math.sin(gx * 3.1) * Math.cos(gz * 2.2) + 0.002 * Math.sin(gz * 6.5));
    }
    paveGeo.computeVertexNormals();
    JN.geo.scaleUV(paveGeo, len / 1.0, paveW / 0.55);
    var paveMesh = new THREE.Mesh(paveGeo, M.slab);
    paveMesh.position.set(0, 0, 0.06);
    add(paveMesh);
    /* 错缝细条石分缝 */
    for (i = 0; i < 6; i++) {
      bx(len - 0.1, 0.01, 0.045, M.stoneDark, 0, 0.012, -1.3 + i * 0.5);
    }
    for (i = 0; i < 4; i++) {
      var gxx = -len * 0.36 + i * len * 0.24 + (R() - 0.5) * 0.1;
      bx(0.04, 0.01, 1.2, M.stoneDark, gxx, 0.012, -0.6 + (i % 2) * 0.5);
    }
    /* 排水沟（窄凹槽）+ 沟盖石 */
    bx(len, 0.06, 0.24, M.stoneDark, 0, 0.0, 1.52);
    var nCov = Math.max(5, Math.floor(len / 0.85));
    for (i = 0; i < nCov; i++) {
      var cvx = -((nCov - 1) * 0.85) / 2 + i * 0.85;
      bx(0.64, 0.055, 0.27, M.slab, cvx, 0.028, 1.52);
      bx(0.64, 0.018, 0.02, M.stoneDark, cvx, 0.05, 1.52);
    }

    /* ---------- 生活气 ---------- */
    /* 阶沿石（柱脚前的石台） */
    bx(len, 0.1, 0.34, M.stoneDark, 0, 0.05, zFront + 0.04);
    /* 条凳 2~3 张（临街一侧） */
    var nBench = len >= 9 ? 3 : 2;
    for (i = 0; i < nBench; i++) {
      var bx2 = -span * 0.38 + span * 0.76 * (i / Math.max(1, nBench - 1)) + (R() - 0.5) * 0.1;
      var bz2 = 1.28 + (R() - 0.5) * 0.08;
      var bench = new THREE.Group();
      bench.position.set(bx2, 0, bz2);
      bench.rotation.y = (R() - 0.5) * 0.12;
      bench.add(ctx.box(0.95, 0.06, 0.3, M.woodLight, 0, 0.45, 0));
      bench.add(ctx.box(0.05, 0.43, 0.05, M.woodDark, -0.36, 0.215, -0.1));
      bench.add(ctx.box(0.05, 0.43, 0.05, M.woodDark, 0.36, 0.215, -0.1));
      bench.add(ctx.box(0.05, 0.43, 0.05, M.woodDark, -0.36, 0.215, 0.1));
      bench.add(ctx.box(0.05, 0.43, 0.05, M.woodDark, 0.36, 0.215, 0.1));
      grp(bench, 0, 0, 0);
    }
    /* 竹筐 2 只 */
    for (i = 0; i < 2; i++) {
      var kx = -span * 0.28 + span * 0.56 * i + (R() - 0.5) * 0.18;
      var kz = 1.22 + (R() - 0.5) * 0.12;
      cy(0.23, 0.18, 0.3, 12, M.wood, kx, 0.16, kz, true);
      cy(0.245, 0.245, 0.03, 12, M.woodLight, kx, 0.31, kz, true);
      cy(0.18, 0.18, 0.02, 12, M.woodDark, kx, 0.015, kz);
    }
    /* 酒坛 2 只 + 坛盖 */
    for (i = 0; i < 2; i++) {
      var jx = -span * 0.2 + span * 0.4 * i + (R() - 0.5) * 0.12;
      var jz = 1.2 + (R() - 0.5) * 0.1;
      grp(ctx.jar({ r: 0.19, h: 0.4, mat: 'stoneDark' }), jx, 0, jz);
      bx(0.16, 0.025, 0.16, M.woodDark, jx, 0.4, jz);
    }
    /* 跨街晾衣绳 + 布片（街面上方） */
    var lineX = -span * 0.1 + (R() - 0.5) * 0.16;
    var line = cy(0.012, 0.012, 2.5, 6, M.woodDark, lineX, 2.34, 0.0);
    line.rotation.x = Math.PI / 2;
    for (i = 0; i < 3; i++) {
      var cl = bx(0.46, 0.58, 0.018, M.plaster, lineX, 1.98, -0.55 + i * 0.55);
      cl.rotation.y = (R() - 0.5) * 0.16;
      cl.rotation.z = (R() - 0.5) * 0.06;
    }
    /* 地上落叶 */
    for (i = 0; i < 7; i++) {
      var lf = bx(0.14, 0.01, 0.09, M.stoneDark, -len * 0.34 + R() * len * 0.68, 0.012, -1.2 + R() * 2.6);
      lf.rotation.y = R() * Math.PI;
      lf.rotation.z = (R() - 0.5) * 0.1;
    }

    g.userData = { w: len, d: 4.5, h: 3.9, kind: 'corridor', axis: 'x', door: { x: 0, z: zBack } };
    return g;
  };
})();
