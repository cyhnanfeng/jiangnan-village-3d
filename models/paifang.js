/* =========================================================================
 * models/paifang.js —— 四柱三间三楼石牌坊（村口门面）
 * 通行方向沿本地 X 轴（道路沿 X），牌坊面宽沿 Z；y = 0 为地面。
 * ========================================================================= */
(function () {
  'use strict';
  var JN = window.JN;
  var PI = Math.PI, TAU = PI * 2;
  var S2 = Math.SQRT2;

  JN.models['paifang'] = function (ctx) {
    var rng = ctx.rng;
    var g = new THREE.Group();
    function M(n) { return ctx.mat(n); }

    /* ==================================================================
     * 0. 石材块料（细分 + 凿琢起伏 + 平面 UV）
     * ================================================================== */
    var DENS = 1.35;

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

    function segFor(w, h, d) {
      var m = Math.max(w, h, d);
      return m > 0.50 ? 6 : (m > 0.18 ? 4 : 3);
    }

    function blockGeo(w, h, d, amp, seg) {
      var geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
      if (amp > 0) {
        var p = geo.attributes.position;
        for (var i = 0; i < p.count; i++) {
          var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          var k = Math.sin(x * 6.1 + 0.7) * Math.cos(y * 8.3 + 1.4) * Math.sin(z * 7.7 + 2.1)
                + 0.42 * Math.sin(x * 13.7 + z * 11.3 + 0.9);
          p.setXYZ(i, x * (1 + amp * k), y, z * (1 + amp * k));
        }
        p.needsUpdate = true;
        geo.computeVertexNormals();
      }
      planarUV(geo, DENS);
      return geo;
    }

    function blk(w, h, d, mat, amp, seg) {
      var s = Math.min(8, (seg || segFor(w, h, d)) + 2);
      var m = new THREE.Mesh(blockGeo(w, h, d, amp === undefined ? 0.014 : amp, s), M(mat));
      m.castShadow = true; m.receiveShadow = true;
      return m;
    }

    function put(w, h, d, mat, x, y, z, amp, seg) {
      var m = blk(w, h, d, mat, amp, seg);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    }

    function arc(r, tube, len, mat) {
      var m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 4, 10, len), M(mat));
      m.castShadow = true; m.receiveShadow = true;
      return m;
    }

    /* ==================================================================
     * 1. 尺度
     * ================================================================== */
    var tilt   = 0.01745;                                  // 柱身内倾 1°
    var colWc  = 0.28, colWo = 0.24;                       // 中柱 / 边柱 截面
    var baseH  = 0.36;                                     // 柱础顶
    var c1     = 1.40 + rng.range(-0.012, 0.012);          // 中柱 |z|
    var sideCl = rng.range(1.46, 1.56);                    // 次间净宽
    var c2     = c1 + 0.14 + 0.12 + sideCl;                // 边柱 |z|
    var clearC = 2 * c1 - colWc;                           // 明间净宽 ≈ 2.5
    var Hc     = 5.19 + rng.range(-0.02, 0.02);            // 中柱顶
    var Hs     = 4.13;                                     // 边柱顶
    var zc2    = (c1 + c2) / 2;                            // 次间中心

    var yDow = 3.80, hDow = 0.24;                          // 明间下额枋
    var yUp  = 4.92, hUp  = 0.26;                          // 明间上额枋
    var yPl  = 5.15, hPl  = 0.20;                          // 明间平板枋
    var yPlS = 4.13, hPlS = 0.16;                          // 次间平板枋
    var roofY = 5.66, roofYS = 4.55;                       // 檐口（屋面底）
    var hb   = 0.30;                                       // 额枋厚（X）

    function tiltZ(zc, y) { return zc - tilt * (y - baseH); }

    /* ==================================================================
     * 2. 柱础：台明 + 须弥座
     * ================================================================== */
    function buildPlinth(zc, cw) {
      put(cw * 3.00, 0.10, cw * 3.00, 'stoneDark', 0, 0.050, zc, 0.016, 3);
      put(cw * 2.12, 0.09, cw * 2.12, 'stone', 0, 0.145, zc, 0.014, 3);
      put(cw * 1.76, 0.10, cw * 1.76, 'stoneDark', 0, 0.240, zc, 0.012, 2);
      put(cw * 1.96, 0.07, cw * 1.96, 'stoneLight', 0, 0.325, zc, 0.012, 3);
      // 束腰卷云（前后各一）
      for (var i = 0; i < 2; i++) {
        var sz = i === 0 ? 1 : -1;
        var cc = put(0.075, 0.058, 0.070, 'stoneLight', 0, 0.245, zc + sz * cw * 1.02, 0.01, 2);
        cc.rotation.x = sz * 0.35;
      }
    }

    /* ==================================================================
     * 3. 抱鼓石（扁圆鼓 + 卷云小方块）—— 每柱向外一对，鼓面朝面宽方向
     * ================================================================== */
    function buildDrum(zc, cw) {
      var dir = zc >= 0 ? 1 : -1;
      var dz = zc + dir * (cw * 0.5 + 0.21);
      var pts = [
        [0.000, -0.058], [0.115, -0.058], [0.168, -0.044], [0.194, -0.020],
        [0.200, 0.000], [0.194, 0.020], [0.168, 0.044], [0.115, 0.058], [0.000, 0.058]
      ];
      put(0.34, 0.10, 0.34, 'stoneDark', 0, 0.150, dz, 0.016, 3);
      put(0.27, 0.06, 0.27, 'stone', 0, 0.230, dz, 0.012, 3);
      var drum = ctx.lathe(pts, 12, 'stoneLight');
      drum.rotation.x = PI / 2;
      drum.position.set(0, 0.410, dz);
      g.add(drum);
      // 鼓面卷云（扁圆上的凸起云头，正面朝面宽方向）
      for (var k = 0; k < 2; k++) {
        var sg = k === 0 ? 1 : -1;
        var cl = put(0.058, 0.075, 0.032, 'stoneLight',
          sg * 0.105, 0.475, dz + dir * 0.050, 0.008, 2);
        cl.rotation.z = sg * 0.55;
        var cl2 = put(0.052, 0.060, 0.030, 'stoneLight',
          sg * 0.132, 0.395, dz + dir * 0.050, 0.008, 2);
        cl2.rotation.z = -sg * 0.45;
      }
      var ring = arc(0.150, 0.018, PI * 1.02, 'stone');
      ring.rotation.z = -PI * 0.51;
      ring.position.set(0, 0.410, dz + dir * 0.055);
      g.add(ring);
    }

    /* ==================================================================
     * 4. 柱身（四棱收分 + 内倾 + 柱联 + 石缝）
     * ================================================================== */
    function buildColumn(zc, H, wb, wt, coupletBack) {
      var sgn = zc >= 0 ? 1 : -1;
      var h = H - baseH;
      var grp = new THREE.Group();
      grp.position.set(0, baseH, zc);
      grp.rotation.x = -sgn * tilt;
      g.add(grp);

      var seg = 4;
      var geo = new THREE.CylinderGeometry(wt / S2, wb / S2, h, 4, seg);
      geo.rotateY(PI / 4);
      var shaft = new THREE.Mesh(geo, M('stone'));
      shaft.position.y = h / 2;
      shaft.castShadow = true; shaft.receiveShadow = true;
      grp.add(shaft);

      // 柱身横向石缝（两道，三面可见）
      for (var j = 0; j < 2; j++) {
        var jy = h * (0.30 + j * 0.34);
        var jw = (wb + (wt - wb) * (jy / h)) * 0.97;
        var seam = new THREE.Mesh(new THREE.BoxGeometry(jw, 0.011, jw), M('stoneDark'));
        seam.position.y = jy;
        seam.castShadow = false; seam.receiveShadow = true;
        grp.add(seam);
      }

      // 柱联：细长竖条 + 深色凹槽 + 联文
      var faces = coupletBack ? [1, -1] : [1];
      for (var f = 0; f < faces.length; f++) {
        var fx = faces[f];
        var wmid = (wb + wt) / 2;
        var cy = h * rng.range(0.44, 0.49);
        var chh = h * rng.range(0.36, 0.42);

        var board = new THREE.Mesh(new THREE.BoxGeometry(0.016, chh, wmid * 0.50), M('stoneDark'));
        board.position.set(fx * (wmid / 2 - 0.004), cy, 0);
        board.castShadow = false; board.receiveShadow = true;
        grp.add(board);

        for (var e = 0; e < 2; e++) {
          var ez = (e ? 1 : -1) * wmid * 0.27;
          var strip = new THREE.Mesh(new THREE.BoxGeometry(0.024, chh + 0.10, 0.026), M('stoneLight'));
          strip.position.set(fx * (wmid / 2 + 0.003), cy, ez);
          strip.castShadow = true; strip.receiveShadow = true;
          grp.add(strip);
        }
        var nCh = 4;
        for (var q = 0; q < nCh; q++) {
          var cyy = cy - chh / 2 + chh * (q + 0.65) / nCh;
          var ch = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.048, 0.058), M('stoneLight'));
          ch.position.set(fx * (wmid / 2 - 0.006), cyy, 0);
          ch.castShadow = false; ch.receiveShadow = true;
          grp.add(ch);
        }
      }
      return grp;
    }

    /* ==================================================================
     * 5. 额枋（线脚 + 前后浮雕）
     * ================================================================== */
    function buildBeam(y, h, zA, zB, mat) {
      var len = Math.abs(zB - zA);
      var zc = (zA + zB) / 2;
      put(hb, h, len, mat, 0, y, zc, 0.010, 4);
      put(hb + 0.07, 0.045, len + 0.09, 'stoneDark', 0, y + h / 2 + 0.020, zc, 0.008, 3);
      put(hb + 0.07, 0.040, len + 0.09, 'stoneDark', 0, y - h / 2 - 0.018, zc, 0.008, 3);

      for (var s = 0; s < 2; s++) {
        var fx = s === 0 ? 1 : -1;
        var pw = len * rng.range(0.50, 0.58);
        put(0.035, h * 0.58, pw, 'stone', fx * (hb / 2 + 0.012), y, zc, 0.010, 3);
        for (var i = 0; i < 2; i++) {
          var bz = zc + (i ? 1 : -1) * pw * 0.26;
          var bb = put(0.026, h * 0.40, 0.070, 'stoneLight',
            fx * (hb / 2 + 0.028), y + rng.range(-0.01, 0.01), bz, 0.006, 2);
          bb.rotation.x = rng.range(-0.10, 0.10);
        }
      }
      // 枋下卷草弧（两侧各一，正反通用）
      var aa = arc(0.050, 0.013, PI * 0.9, 'stoneDark');
      aa.rotation.y = PI / 2;
      aa.position.set(0, y - h / 2 - 0.048, zc + len * 0.30);
      g.add(aa);
    }

    /* ==================================================================
     * 6. 平板枋
     * ================================================================== */
    function buildPlate(y, h, zA, zB) {
      var len = Math.abs(zB - zA);
      var zc = (zA + zB) / 2;
      put(0.34, h, len + 0.10, 'stoneDark', 0, y, zc, 0.010, 3);
      put(0.42, 0.035, len + 0.14, 'stoneLight', 0, y + h / 2 - 0.016, zc, 0.006, 3);
      var n = 3;
      for (var i = 0; i <= n; i++) {
        var bz = zc - len / 2 + len * i / n;
        put(0.26, 0.075, 0.20, 'stone', 0, y + h / 2 + 0.035, bz, 0.008, 2);
      }
    }

    /* ==================================================================
     * 7. 斗拱层
     * ================================================================== */
    function buildBrackets(y, zA, zB, n, s) {
      var len = Math.abs(zB - zA);
      var zc = (zA + zB) / 2;
      for (var i = 0; i < n; i++) {
        var bz = n === 1 ? zc : zc - len / 2 + len * (i + 0.5) / n;
        var br = ctx.bracket({ s: s * rng.range(0.96, 1.04), mat: 'woodRed' });
        br.rotation.y = PI / 2;
        br.position.set(0, y, bz);
        g.add(br);
      }
      put(0.36, 0.05, len + 0.04, 'woodRed', 0, y + 0.025, zc, 0.008, 2);
    }

    /* ==================================================================
     * 8. 鸱吻（脊端卷尾）
     * ================================================================== */
    function buildChiwen(zc, y, s) {
      for (var i = 0; i < 2; i++) {
        var sg = i === 0 ? 1 : -1;
        var pz = zc + sg * s;
        put(0.13, 0.16, 0.15, 'ridge', 0, y + 0.09, pz, 0.02, 2);
        var tail = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.30, 4), M('ridge'));
        tail.position.set(0, y + 0.30, pz + sg * 0.05);
        tail.rotation.x = sg * 0.62;
        tail.rotation.y = PI / 4;
        tail.scale.z = 0.62;
        tail.castShadow = true; tail.receiveShadow = true;
        g.add(tail);
      }
    }

    /* ==================================================================
     * 9. 四柱
     * ================================================================== */
    var zcs = [c1, -c1, c2, -c2];
    for (var ci = 0; ci < 4; ci++) {
      var zc = zcs[ci];
      var isC = Math.abs(zc) < c1 + 0.01;
      var cw = isC ? colWc : colWo;
      buildPlinth(zc, cw);
      buildColumn(zc, isC ? Hc : Hs, cw * 1.07, cw * 0.93, isC);
      buildDrum(zc, cw);
    }

    /* ==================================================================
     * 10. 明间：额枋 / 匾额 / 平板枋
     * ================================================================== */
    var zLo = tiltZ(c1, yDow) + 0.10;
    var ySh = yDow + hDow / 2;          // 3.92
    var ySh2 = yUp - hUp / 2;           // 4.79
    var pcy = (ySh + ySh2) / 2;         // 4.355

    buildBeam(yDow, hDow, -zLo, zLo, 'stoneLight');
    buildBeam(yUp, hUp, -tiltZ(c1, yUp) - 0.10, tiltZ(c1, yUp) + 0.10, 'stoneLight');

    // 字板四周边框（雕花：细密小方块 + 圆弧）
    var pbw = (zLo - 0.10) * 2;
    var pbh = ySh2 - ySh;
    for (var pby = 0; pby < 2; pby++) {
      var pfy = pby === 0 ? ySh2 - 0.028 : ySh + 0.028;
      put(0.11, 0.056, pbw, 'stoneDark', 0, pfy, 0, 0.006, 3);
    }
    for (var pbz = 0; pbz < 2; pbz++) {
      var pzz = (pbz ? 1 : -1) * (pbw / 2 - 0.035);
      put(0.11, pbh, 0.07, 'stoneDark', 0, pcy, pzz, 0.006, 3);
    }
    // 边框上的雕花小方块
    for (var pd = 0; pd < 6; pd++) {
      var pdz = -pbw * 0.40 + pbw * 0.80 * (pd / 5);
      put(0.115, 0.032, 0.045, 'stoneLight', 0, ySh2 - 0.028, pdz, 0.005, 2);
      put(0.115, 0.032, 0.045, 'stoneLight', 0, ySh + 0.028, pdz, 0.005, 2);
    }
    var pArc = arc(0.075, 0.016, PI * 0.7, 'stoneLight');
    pArc.rotation.y = PI / 2;
    pArc.position.set(0, pcy + 0.02, pbw * 0.5 - 0.075);
    g.add(pArc);

    // ---- 匾额（正反两面）----
    var texts = ['进士第', '贞节坊', '世德流芳', '圣旨', '恩荣'];
    var plqText = texts[rng.int(0, texts.length - 1)];
    for (var ps = 0; ps < 2; ps++) {
      var psg = ps === 0 ? 1 : -1;
      var plq = ctx.plaque({
        text: plqText, w: 1.44, h: 0.58,
        bg: '#241f19', fg: '#d8b45a', frame: 'woodRed'
      });
      plq.rotation.y = psg * PI / 2;
      plq.position.set(psg * 0.048, pcy, 0);
      g.add(plq);
    }
    // 金边（横竖压条 + 细密小方块 + 四角圆弧）
    var pHW = 0.72, pHH = 0.29;
    put(0.075, 0.05, pHW * 2 + 0.18, 'gold', 0, pcy + pHH + 0.10, 0, 0.006, 3);
    put(0.075, 0.05, pHW * 2 + 0.18, 'gold', 0, pcy - pHH - 0.10, 0, 0.006, 3);
    for (var gs = 0; gs < 2; gs++) {
      var gz = (gs ? 1 : -1) * (pHW + 0.075);
      put(0.075, pHH * 2 + 0.24, 0.05, 'gold', 0, pcy, gz, 0.006, 3);
    }
    for (var gc = 0; gc < 5; gc++) {
      var gx2 = -pHW + pHW * 2 * (gc / 4);
      put(0.062, 0.055, 0.050, 'gold', 0, pcy + pHH + 0.10, gx2, 0.006, 2);
      put(0.062, 0.055, 0.050, 'gold', 0, pcy - pHH - 0.10, gx2, 0.006, 2);
    }
    for (var ga = 0; ga < 2; ga++) {
      var gsg = ga === 0 ? 1 : -1;
      var ga2 = arc(0.10, 0.024, PI * 0.75, 'gold');
      ga2.rotation.y = PI / 2;
      ga2.rotation.x = gsg * 0.2;
      ga2.position.set(0, pcy + gsg * (pHH + 0.10), pHW + 0.02);
      g.add(ga2);
    }

    buildPlate(yPl, hPl, -tiltZ(c1, yPl) - 0.16, tiltZ(c1, yPl) + 0.16);

    /* ==================================================================
     * 11. 次间：下额枋（贯通）+ 花板 + 平板枋
     * ================================================================== */
    for (var sb = 0; sb < 2; sb++) {
      var sgz = sb === 0 ? 1 : -1;
      var zIn = tiltZ(c1, yDow), zOut = tiltZ(c2, yDow);
      buildBeam(yDow, 0.20, sgz * zIn, sgz * zOut, 'stoneLight');

      var zA2 = tiltZ(c1, 4.06), zB2 = tiltZ(c2, 4.06);
      var pzc = sgz * (zA2 + zB2) / 2;
      var plen = Math.abs(zB2 - zA2) - 0.20;
      put(0.07, 0.26, plen, 'stone', 0, 4.06, pzc, 0.008, 3);
      for (var p2 = 0; p2 < 2; p2++) {
        put(0.11, 0.030, plen, 'stoneDark', 0, p2 ? 4.175 : 3.945, pzc, 0.006, 3);
      }
      // 透雕小孔
      for (var h2 = 0; h2 < 3; h2++) {
        put(0.085, 0.06, 0.075, 'stoneDark', 0,
          4.06 + (h2 % 2 ? 0.055 : -0.055),
          pzc - plen * 0.30 + plen * 0.30 * h2, 0.006, 2);
      }
      buildPlate(yPlS, hPlS, sgz * tiltZ(c1, yPlS), sgz * tiltZ(c2, yPlS));
    }

    /* ==================================================================
     * 12. 雀替
     * ================================================================== */
    for (var qi = 0; qi < 4; qi++) {
      var qz = zcs[qi];
      var isCq = Math.abs(qz) < c1 + 0.01;
      var qy = isCq ? ySh + 0.02 : yDow - 0.11;
      for (var qs = 0; qs < 2; qs++) {
        var qsg = qs === 0 ? 1 : -1;
        var q = put(0.38, 0.12, 0.26, 'stoneLight', 0, qy - 0.06, qz - qsg * 0.15, 0.014, 3);
        q.rotation.x = qsg * 0.22;
      }
    }

    /* ==================================================================
     * 13. 斗拱 + 屋顶
     * ================================================================== */
    buildBrackets(yPl + hPl / 2, -tiltZ(c1, yPl) - 0.12, tiltZ(c1, yPl) + 0.12, rng.int(5, 7), 0.40);
    var mainRoof = ctx.roofGable({
      w: 2.90, d: 0.85, h: 1.00, over: 0.30,
      curve: 0.30, lift: 0.42, tileRows: 9, mat: 'tile', ridge: true
    });
    mainRoof.rotation.y = PI / 2;
    mainRoof.position.set(0, roofY, 0);
    g.add(mainRoof);
    buildChiwen(0, roofY + 1.00 + 0.10, 1.72);

    for (var rb = 0; rb < 2; rb++) {
      var rgz = rb === 0 ? 1 : -1;
      buildBrackets(yPlS + hPlS / 2, rgz * tiltZ(c1, yPlS), rgz * tiltZ(c2, yPlS), rng.int(3, 4), 0.32);
      var rf2 = ctx.roofGable({
        w: (c2 - c1) + 0.14, d: 0.78, h: 0.58, over: 0.30,
        curve: 0.24, lift: 0.30, tileRows: 5, mat: 'tile', ridge: true
      });
      rf2.rotation.y = PI / 2;
      rf2.position.set(0, roofYS, rgz * zc2);
      g.add(rf2);
      buildChiwen(rgz * zc2, roofYS + 0.58 + 0.10, ((c2 - c1) + 0.14) / 2 + 0.22);
    }

    /* ==================================================================
     * 14. 石狮（成对，面向来路 +X）
     * ================================================================== */
    for (var li = 0; li < 2; li++) {
      var lgz = li === 0 ? 1 : -1;
      var lion = ctx.lion({ s: 0.72, mat: 'stoneLight' });
      lion.position.set(0.34, 0.07, lgz * (c2 + 0.18));
      lion.rotation.y = PI / 2 + rng.range(-0.05, 0.05);
      lion.scale.setScalar(rng.range(0.97, 1.03));
      g.add(lion);
      put(0.72, 0.08, 0.78, 'stoneDark', 0.34, 0.040, lgz * (c2 + 0.18), 0.012, 3);
    }

    /* ==================================================================
     * 15. 柱脚青苔杂草
     * ================================================================== */
    function tuft(x, y, z, hh, n) {
      var t = ctx.grass({ n: n || 4, h: hh, mat: 'leafSpring', seed: rng.range(0, 6) });
      t.position.set(x, y, z);
      var sc = rng.range(0.72, 1.02);
      t.scale.set(sc * 0.85, sc, sc * 0.85);
      t.rotation.y = rng.range(0, TAU);
      t.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      g.add(t);
    }

    for (var mi = 0; mi < 4; mi++) {
      var mz = zcs[mi];
      var mcw = Math.abs(mz) < c1 + 0.01 ? colWc : colWo;
      var ma = rng.range(0, TAU);
      put(rng.range(0.11, 0.20), 0.016, rng.range(0.09, 0.16), 'leafSpring',
        Math.cos(ma) * mcw * 1.5, 0.104, mz + Math.sin(ma) * mcw * 1.5, 0.02, 2);
      put(rng.range(0.08, 0.16), 0.014, rng.range(0.07, 0.14), 'leafSpring',
        Math.cos(ma + 1.2) * mcw * 1.9, 0.008, mz + Math.sin(ma + 1.2) * mcw * 1.9, 0.02, 2);
      tuft(Math.cos(ma + 2.1) * mcw * 1.8, 0.10, mz + Math.sin(ma + 2.1) * mcw * 1.8,
        rng.range(0.14, 0.24), rng.int(3, 4));
    }

    /* ==================================================================
     * 16. 报出尺寸
     * ================================================================== */
    g.updateMatrixWorld(true);
    var bb = new THREE.Box3().setFromObject(g);
    var size = bb.getSize(new THREE.Vector3());

    g.userData = {
      w: +size.x.toFixed(2),
      d: +size.z.toFixed(2),
      h: +size.y.toFixed(2),
      kind: 'paifang',
      axis: 'x',
      passWidth: +clearC.toFixed(2)
    };
    return g;
  };
})();
