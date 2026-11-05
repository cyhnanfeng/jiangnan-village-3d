/* =========================================================================
 * models/hall.js —— 宗祠 / 厅堂（全村等级最高的公共建筑）
 * 三开间两进 · 须弥座台基三出陛 · 前廊檐柱 · 一圈斗拱 · 硬山瓦顶带翼角 · 匾额 · 石狮
 * 原点在台基中心地面（y=0），正面朝 +Z
 * ========================================================================= */
(function () {
  'use strict';
  var JN = window.JN;
  var PI = Math.PI;

  JN.models['hall'] = function (ctx) {
    var rng = ctx.rng;
    var g = new THREE.Group();

    /* ---------------- 尺寸基准 ---------------- */
    var BW = 7.2, BD = 5.4;            // 面宽 / 进深（柱轴线）
    var HW = BW / 2, HD = BD / 2;
    var PW = 8.2, PD = 6.6;            // 台基
    var PT = 0.77;                     // 台基高
    var ZF = 2.55;                     // 檐柱线
    var ZD = 0.95;                     // 金柱 / 门线
    var ZK = -2.68;                    // 后檐墙
    var XS = [-3.6, -1.6, 1.6, 3.6];   // 三开间柱位（中 bay 3.2，次间 2.0）
    var COLH = 4.02;                   // 柱高
    var YEF = 4.60;                    // 斗拱顶 / 檐口木作
    var ROVER = 0.95;                  // 出檐
    var RH = 1.50, RC = 0.30, RL = 0.55;   // 屋面高 / 举折 / 翼角起翘
    var RW = HW + ROVER, RD = HD + ROVER;  // 屋面半宽 / 半深
    var ROOF_Y = 4.90;                 // 屋面组（脊线原点）标高

    /* ---------------- 小工具 ---------------- */
    function bx(w, h, d, m, x, y, z) { return ctx.box(w, h, d, m, x, y, z); }
    function uvb(w, h, d, m, su, sv) { return ctx.uvBox(w, h, d, m, su, sv); }
    function jit(v, p) { return v * (1 + (rng() - 0.5) * 2 * (p === undefined ? 0.045 : p)); }

    function meshFrom(pos, uvs, idx, m) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      var me = new THREE.Mesh(geo, ctx.mat(m));
      me.castShadow = true; me.receiveShadow = true;
      return me;
    }

    /* 屋面高度函数（与 kit.roofGable 完全一致） */
    function slopeY(t, x) {
      var yy = t * RH - Math.sin((1 - t) * PI * 0.5) * RC * (1 - t) * 0.6;
      yy += RL * Math.pow(Math.min(1, Math.abs(x) / RW), 4.2) * Math.pow(1 - t, 2.2);
      return yy;
    }

    /* ==================================================================
     * 1. 须弥座台基（圭角 → 下枋 → 下枭 → 束腰 → 上枭 → 上枋）
     * ================================================================== */
    g.add(uvb(PW, 0.30, PD, 'stoneDark', 0.65, 0.65).translateY(0.15));
    g.add(uvb(PW + 0.06, 0.10, PD + 0.06, 'stoneLight', 0.65, 0.65).translateY(0.35));
    g.add(uvb(PW + 0.18, 0.10, PD + 0.18, 'stoneDark', 0.65, 0.65).translateY(0.45));
    g.add(uvb(PW - 0.12, 0.12, PD - 0.12, 'stoneDark', 0.65, 0.65).translateY(0.56));
    g.add(uvb(PW + 0.18, 0.10, PD + 0.18, 'stoneLight', 0.65, 0.65).translateY(0.67));
    g.add(uvb(PW + 0.26, 0.05, PD + 0.26, 'stoneLight', 0.8, 0.8).translateY(0.745));

    /* ---------------- 三出陛：中御路石 + 两侧石阶 ---------------- */
    var NST = 5, RISE = PT / NST, RUN = 0.30;
    var STEP_Z0 = PD / 2 + NST * RUN;   // 台阶组原点（最低一级外端）
    var STEP_MID = PD / 2 + NST * RUN / 2;
    for (var s = 0; s < 2; s++) {
      var sg = s === 0 ? -1 : 1;
      var st = ctx.steps({ w: 1.5, n: NST, rise: RISE, run: RUN, mat: 'stoneLight' });
      st.position.set(sg * 1.85, 0, STEP_Z0);
      g.add(st);
      // 垂带石（台阶两侧斜栏）
      var band = uvb(0.16, 0.20, Math.sqrt(Math.pow(NST * RUN, 2) + PT * PT), 'stoneDark', 0.6, 0.6);
      band.rotation.x = Math.atan2(PT, NST * RUN);
      band.position.set(sg * 2.55, PT / 2 + 0.06, STEP_MID);
      g.add(band);
    }
    // 御路石（整块斜铺，上刻云纹线脚）
    var rampAng = Math.atan2(PT, NST * RUN);
    var rampLen = Math.sqrt(Math.pow(NST * RUN, 2) + PT * PT);
    var ramp = uvb(1.9, 0.14, rampLen, 'stoneLight', 0.7, 0.7);
    ramp.rotation.x = rampAng;
    ramp.position.set(0, PT / 2 - 0.01, STEP_MID);
    g.add(ramp);
    for (var rb = -1; rb <= 1; rb++) {
      var carve = bx(0.10, 0.028, rampLen * 0.86, 'stoneDark', rb * 0.52, PT / 2 + 0.068, STEP_MID);
      carve.rotation.x = rampAng;
      g.add(carve);
    }
    // 御路两侧垂带
    for (var rc = 0; rc < 2; rc++) {
      var sg2 = rc === 0 ? -1 : 1;
      var curb = uvb(0.18, 0.22, rampLen, 'stoneDark', 0.6, 0.6);
      curb.rotation.x = rampAng;
      curb.position.set(sg2 * 1.03, PT / 2 + 0.08, STEP_MID);
      g.add(curb);
    }

    /* ---------------- 台基边沿石栏杆 ---------------- */
    function rail(len, x, z, ry) {
      var r = ctx.railing({ len: len, h: 0.60, mat: 'stoneLight', spacing: 1.9 });
      r.position.set(x, PT, z);
      if (ry) r.rotation.y = ry;
      g.add(r);
    }
    rail(PW - 0.30, 0, -PD / 2 + 0.14, 0);
    rail(PD - 0.60, PW / 2 - 0.16, 0, PI / 2);
    rail(PD - 0.60, -(PW / 2 - 0.16), 0, PI / 2);
    rail(1.30, 3.42, PD / 2 - 0.14, 0);
    rail(1.30, -3.42, PD / 2 - 0.14, 0);

    /* ==================================================================
     * 2. 主体（全部相对台基面）
     * ================================================================== */
    var B = new THREE.Group();
    B.position.y = PT;
    g.add(B);

    /* ---------------- 檐柱 + 覆盆柱础 ---------------- */
    function pillar(x, z) {
      var pr = new THREE.Group();
      pr.add(ctx.lathe([[0, 0], [0.30, 0], [0.345, 0.05], [0.35, 0.13],
        [0.315, 0.21], [0.265, 0.27], [0.243, 0.30], [0, 0.30]], 12, 'stoneLight'));
      pr.add(ctx.lathe([[0, 0], [0.212, 0], [0.224, 0.12], [0.216, 1.15], [0.206, 2.35],
        [0.196, 3.30], [0.184, 3.86], [0.176, COLH], [0, COLH]], 10, 'woodRed'));
      pr.position.set(x, 0, z);
      return pr;
    }
    var c;
    for (c = 0; c < XS.length; c++) {
      B.add(pillar(XS[c], ZF));           // 前廊檐柱
      B.add(pillar(XS[c], ZD));           // 金柱（门两侧）
    }

    /* ---------------- 额枋 / 平板枋 ---------------- */
    function beamRun(x, z, len, alongZ) {
      var w = alongZ ? 0.22 : len, d = alongZ ? len : 0.22;
      B.add(bx(w, 0.40, d, 'woodRed', x, COLH - 0.22, z));
      var w2 = alongZ ? 0.30 : len, d2 = alongZ ? len : 0.30;
      B.add(bx(w2, 0.14, d2, 'woodRed', x, COLH + 0.05, z));
    }
    for (var bi = 0; bi < 3; bi++) {
      var xa = XS[bi], xb = XS[bi + 1], bwd = xb - xa;
      B.add(bx(bwd - 0.30, 0.40, 0.22, 'woodRed', (xa + xb) / 2, COLH - 0.22, ZF));
      B.add(bx(bwd - 0.26, 0.14, 0.30, 'woodRed', (xa + xb) / 2, COLH + 0.05, ZF));
      B.add(bx(bwd - 0.30, 0.34, 0.20, 'woodRed', (xa + xb) / 2, COLH - 0.19, ZD));
    }
    beamRun(HW - 0.02, (ZF + ZK) / 2, ZF - ZK, true);       // 两侧檐枋
    beamRun(-(HW - 0.02), (ZF + ZK) / 2, ZF - ZK, true);
    beamRun(0, ZK, BW, false);                              // 后檐枋

    /* ---------------- 雀替（柱头两侧的卷草托木） ---------------- */
    function queti(x, z, dir) {
      var q = new THREE.Group();
      q.add(bx(0.44, 0.11, 0.17, 'woodRed', dir * 0.22, 0, 0));
      q.add(bx(0.32, 0.11, 0.15, 'woodRed', dir * 0.30, -0.11, 0));
      q.add(bx(0.19, 0.10, 0.13, 'woodRed', dir * 0.35, -0.22, 0));
      q.add(bx(0.09, 0.09, 0.11, 'woodRed', dir * 0.38, -0.31, 0));
      q.position.set(x, COLH - 0.40, z);
      return q;
    }
    for (var qi = 0; qi < 3; qi++) {
      var q0 = XS[qi], q1 = XS[qi + 1];
      B.add(queti(q0 + 0.16, ZF, 1));
      B.add(queti(q1 - 0.16, ZF, -1));
      B.add(queti(q0 + 0.16, ZD, 1));
      B.add(queti(q1 - 0.16, ZD, -1));
    }

    /* ---------------- 挂落（廊下花板） ---------------- */
    for (var gi = 0; gi < 3; gi++) {
      var gx0 = XS[gi], gx1 = XS[gi + 1], gw = gx1 - gx0 - 0.42;
      var gcx = (gx0 + gx1) / 2;
      B.add(bx(gw, 0.07, 0.06, 'woodDark', gcx, COLH - 0.44, ZF));
      B.add(bx(gw, 0.05, 0.05, 'woodDark', gcx, COLH - 0.96, ZF));
      var nb = Math.round(gw / 0.19);
      for (var ni = 1; ni < nb; ni++) {
        var nw = 0.032, nh = 0.52 - ((ni * 37) % 3) * 0.06;
        B.add(bx(nw, nh, 0.045, 'woodDark', gx0 + 0.21 + gw * ni / nb, COLH - 0.97 + nh / 2, ZF));
      }
      for (var di = 0; di < 2; di++) {
        var dd = bx(gw * 0.30, 0.030, 0.045, 'woodDark', gcx + (di ? -1 : 1) * gw * 0.25, COLH - 0.72, ZF);
        dd.rotation.z = (di ? 1 : -1) * 0.55;
        B.add(dd);
      }
    }

    /* ==================================================================
     * 3. 斗拱一圈（平板枋上，间距 ≈ 1.0）
     * ================================================================== */
    function bracketAt(x, z, ry) {
      var br = ctx.bracket({ s: 0.72, mat: 'woodRed' });
      br.position.set(x, COLH + 0.12, z);
      br.rotation.y = ry || 0;
      B.add(br);
    }
    var nX = 7, nZ = 6, j;
    for (j = 0; j < nX; j++) {
      var bxp = -HW + (2 * HW) * j / (nX - 1);
      bracketAt(bxp, ZF + 0.03, 0);
      bracketAt(bxp, ZK - 0.03, PI);
    }
    for (j = 1; j < nZ - 1; j++) {
      var bzp = ZK + (ZF - ZK) * j / (nZ - 1);
      bracketAt(HW + 0.03, bzp, PI / 2);
      bracketAt(-(HW + 0.03), bzp, -PI / 2);
    }
    // 挑檐枋（斗拱上的通长枋）
    B.add(bx(BW + 0.20, 0.16, 0.24, 'woodRed', 0, YEF, ZF + 0.03));
    B.add(bx(BW + 0.20, 0.16, 0.24, 'woodRed', 0, YEF, ZK - 0.03));
    B.add(bx(0.24, 0.16, BD + 0.34, 'woodRed', HW + 0.03, YEF, (ZF + ZK) / 2));
    B.add(bx(0.24, 0.16, BD + 0.34, 'woodRed', -(HW + 0.03), YEF, (ZF + ZK) / 2));

    /* ==================================================================
     * 4. 屋面（硬山出山 · 举折 · 翼角起翘 · 瓦垄 · 正脊宝顶）
     * ================================================================== */
    var roof = ctx.roofGable({
      w: BW, d: BD, h: RH, over: ROVER, curve: RC, lift: RL,
      tileRows: 0, ridge: true, mat: 'tile'
    });
    roof.position.y = ROOF_Y;
    B.add(roof);

    // 正脊宝顶（圆锥 + 球）
    var orn = new THREE.Group();
    orn.add(ctx.lathe([[0.02, 0], [0.20, 0], [0.23, 0.06], [0.15, 0.14], [0.19, 0.20],
      [0.12, 0.30], [0.02, 0.34]], 10, 'ridge'));
    var orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), ctx.mat('ridge'));
    orb.position.y = 0.40; orb.castShadow = true; orb.receiveShadow = true;
    orn.add(orb);
    var spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.30, 6), ctx.mat('ridge'));
    spike.position.y = 0.60; spike.castShadow = true; spike.receiveShadow = true;
    orn.add(spike);
    orn.position.set(0, RH + 0.20, 0);
    roof.add(orn);

    // 瓦垄（自建合并几何：深瓦色，沿举折曲线）
    (function tileRidges() {
      var rows = 15, segs = 7, pos = [], uvs = [], idx = [], hw = 0.065;
      for (var r = 0; r < rows; r++) {
        var rx = -RW + (r + 0.5) * (2 * RW / rows);
        for (var sd = 0; sd < 2; sd++) {
          var sg = sd === 0 ? 1 : -1;
          var base = pos.length / 3;
          for (var i = 0; i <= segs; i++) {
            var t = Math.max(0.015, i / segs);
            var y = slopeY(t, rx), z = sg * t * RD;
            pos.push(rx - hw, y - 0.012, z, rx, y + 0.05, z, rx + hw, y - 0.012, z);
            uvs.push(0, t * 2, 0.5, t * 2, 1, t * 2);
          }
          for (var i2 = 0; i2 < segs; i2++) {
            var a = base + i2 * 3;
            if (sg > 0) {
              idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
            } else {
              idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
            }
          }
        }
      }
      roof.add(meshFrom(pos, uvs, idx, 'tileDark'));
    })();

    // 檐下暗部（屋面底衬，避免仰视透空）
    (function soffit() {
      var N = 6, pos = [], uvs = [], idx = [];
      for (var sd = 0; sd < 2; sd++) {
        var sg = sd === 0 ? 1 : -1, base = pos.length / 3;
        for (var i = 0; i <= N; i++) {
          for (var jj = 0; jj <= N; jj++) {
            var t = i / N, u = jj / N;
            var x = (u - 0.5) * 2 * RW * 0.99;
            pos.push(x, slopeY(t, x) - 0.09, sg * t * RD);
            uvs.push(u * 4, t * 3);
          }
        }
        for (i = 0; i < N; i++) {
          for (jj = 0; jj < N; jj++) {
            var a2 = base + i * (N + 1) + jj, b2 = a2 + 1, c2 = a2 + N + 1, d2 = c2 + 1;
            if (sg > 0) idx.push(a2, b2, c2, b2, d2, c2);
            else idx.push(a2, c2, b2, b2, c2, d2);
          }
        }
      }
      B.add(meshFrom(pos, uvs, idx, 'woodDark'));
    })();

    /* ---------------- 山墙（随屋面举折升起） ---------------- */
    function gableWall(sg) {
      var sh = new THREE.Shape();
      var half = HD + 0.28, yBase = COLH - 0.04;
      sh.moveTo(-half, yBase);
      sh.lineTo(half, yBase);
      var N = 12;
      for (var i = 0; i <= N; i++) {
        var z = half - (2 * half) * (i / N);
        var t = Math.min(1, Math.abs(z) / RD);
        var yTop = ROOF_Y + slopeY(t, HW) - 0.03;
        sh.lineTo(z, Math.max(yTop, yBase + 0.06));
      }
      sh.lineTo(-half, yBase);
      var geo = new THREE.ExtrudeGeometry(sh, { depth: 0.20, bevelEnabled: false });
      geo.rotateY(-PI / 2);
      var me = new THREE.Mesh(geo, ctx.mat('plasterGrey'));
      me.position.set(sg * (HW + 0.10), 0, 0);
      me.castShadow = true; me.receiveShadow = true;
      return me;
    }
    B.add(gableWall(1));
    B.add(gableWall(-1));

    /* ==================================================================
     * 5. 墙体（勒脚 + 白墙 + 后檐墙）
     * ================================================================== */
    var wallH = COLH - 0.04;
    // 两侧山墙下段
    for (var wsd = 0; wsd < 2; wsd++) {
      var wsg = wsd === 0 ? 1 : -1;
      B.add(uvb(0.22, wallH, ZD - ZK, 'plaster', 0.6, 0.6).translateX(wsg * (HW - 0.10)).translateZ((ZD + ZK) / 2).translateY(wallH / 2));
      B.add(uvb(0.30, 0.46, ZD - ZK, 'stoneDark', 0.6, 0.6).translateX(wsg * (HW - 0.08)).translateZ((ZD + ZK) / 2).translateY(0.23));
    }
    // 后檐墙
    B.add(uvb(BW + 0.20, wallH, 0.24, 'plasterGrey', 0.6, 0.6).translateZ(ZK).translateY(wallH / 2));
    B.add(uvb(BW + 0.24, 0.46, 0.32, 'stoneDark', 0.6, 0.6).translateZ(ZK).translateY(0.23));

    /* ---------------- 前廊两端：槛墙 + 花窗 ---------------- */
    for (var psd = 0; psd < 2; psd++) {
      var psg = psd === 0 ? 1 : -1;
      var pz = (ZF + ZD) / 2, plen = ZF - ZD;
      // 槛墙
      B.add(uvb(0.22, 0.36, plen, 'stoneDark', 0.6, 0.6).translateX(psg * (HW - 0.10)).translateZ(pz).translateY(0.18));
      B.add(uvb(0.20, 0.62, plen, 'plaster', 0.6, 0.6).translateX(psg * (HW - 0.10)).translateZ(pz).translateY(0.67));
      B.add(uvb(0.26, 0.07, plen, 'stoneLight', 0.6, 0.6).translateX(psg * (HW - 0.10)).translateZ(pz).translateY(1.00));
      // 花窗（冰裂）
      var win = ctx.lattice({ w: plen - 0.16, h: 1.16, cols: 4, rows: 3, style: 'ice', paper: 'paper', frame: 'woodDark', rng: rng });
      win.rotation.y = psg * PI / 2;
      win.position.set(psg * (HW - 0.10), 1.68, pz);
      B.add(win);
      // 窗上走马板
      B.add(uvb(0.20, wallH - 2.34, plen, 'plaster', 0.6, 0.6).translateX(psg * (HW - 0.10)).translateZ(pz).translateY(2.34 + (wallH - 2.34) / 2));
    }

    /* ==================================================================
     * 6. 隔扇门（三开间通排 8 扇，中间两扇向内敞开）
     * ================================================================== */
    var DOOR_H = 2.98;
    function leafPanel(w, h) {
      var lf = new THREE.Group();
      var st = 0.065;
      lf.add(bx(st, h, 0.075, 'woodRed', st / 2, h / 2, 0));
      lf.add(bx(st, h, 0.075, 'woodRed', w - st / 2, h / 2, 0));
      lf.add(bx(w - 2 * st, 0.075, 0.075, 'woodRed', w / 2, h - 0.038, 0));
      lf.add(bx(w - 2 * st, 0.10, 0.075, 'woodRed', w / 2, 0.05, 0));
      var gw = w - 2 * st - 0.03;
      var lat = ctx.lattice({
        w: gw, h: h * 0.36, cols: 2, rows: 3, style: 'step',
        paper: 'paper', frame: 'woodDark', rng: rng
      });
      lat.position.set(w / 2, h * 0.755, 0.012);
      lf.add(lat);
      // 绦环板
      lf.add(bx(gw, 0.17, 0.06, 'woodDark', w / 2, h * 0.535, 0.008));
      // 裙板（朱漆 + 深色边框）
      lf.add(bx(gw, h * 0.36, 0.055, 'woodDark', w / 2, h * 0.30, 0.006));
      lf.add(bx(gw - 0.10, h * 0.30, 0.05, 'woodRed', w / 2, h * 0.30, 0.03));
      return lf;
    }
    function leaf(w, hingeX, open) {
      var grp = new THREE.Group();
      var lf = leafPanel(w, DOOR_H);
      grp.add(lf);
      grp.position.set(hingeX, 0.06, ZD);
      if (open) grp.rotation.y = open;
      return grp;
    }
    // 中 bay 4 扇 (0.8)，两次间各 2 扇 (1.0)
    B.add(leaf(0.80, -1.60, 0));
    B.add(leaf(0.80, -0.80, 1.18));      // 敞开
    B.add(leaf(0.80, 0.80, -1.18));      // 敞开
    B.add(leaf(0.80, 0.80, 0));
    B.add(leaf(1.00, -3.60, 0));
    B.add(leaf(1.00, -2.60, 0));
    B.add(leaf(1.00, 1.60, 0));
    B.add(leaf(1.00, 2.60, 0));
    // 上槛 + 横披
    for (var dm = 0; dm < 3; dm++) {
      var dmx = XS[dm], dmw = XS[dm + 1] - XS[dm];
      B.add(bx(dmw - 0.24, 0.13, 0.20, 'woodDark', (dmx + XS[dm + 1]) / 2, DOOR_H + 0.13, ZD));
      B.add(bx(dmw - 0.30, 0.44, 0.07, 'woodDark', (dmx + XS[dm + 1]) / 2, DOOR_H + 0.42, ZD));
      for (var tr = 1; tr <= 3; tr++) {
        B.add(bx(0.035, 0.44, 0.05, 'woodRed', dmx + 0.12 + (dmw - 0.24) * tr / 4, DOOR_H + 0.42, ZD + 0.02));
      }
    }
    // 门槛
    B.add(uvb(3.2, 0.10, 0.22, 'stoneDark', 0.6, 0.6).translateY(0.05).translateZ(ZD + 0.02));

    /* ---------------- 匾额 ---------------- */
    var names = ['敦本堂', '余庆堂', '叙伦堂', '世德堂'];
    var plq = ctx.plaque({ text: names[Math.floor(rng() * names.length) % names.length], w: 2.3, h: 0.56, frame: 'woodBlack' });
    plq.position.set(0, COLH - 0.62, ZD + 0.30);
    B.add(plq);

    /* ==================================================================
     * 7. 门内：暗部背板 + 供桌 + 香炉 + 牌位
     * ================================================================== */
    B.add(uvb(6.6, 3.3, 0.10, 'woodBlack', 0.9, 0.9).translateZ(ZK + 0.22).translateY(1.65));
    // 太师壁横枋
    B.add(bx(6.4, 0.14, 0.16, 'woodDark', 0, 3.36, ZK + 0.24));
    // 长条案
    B.add(bx(3.0, 0.10, 0.62, 'woodDark', 0, 0.93, -1.78));
    B.add(bx(2.9, 0.13, 0.07, 'woodDark', 0, 0.80, -1.50));
    for (var lg = 0; lg < 4; lg++) {
      B.add(bx(0.10, 0.88, 0.10, 'woodDark', (lg < 2 ? -1 : 1) * 1.34, 0.44, (lg % 2 ? -1 : 1) * 0.22 - 1.78));
    }
    // 香炉
    var burner = ctx.lathe([[0, 0], [0.15, 0], [0.20, 0.07], [0.212, 0.16],
      [0.17, 0.24], [0.105, 0.28], [0.115, 0.33], [0, 0.33]], 12, 'stoneDark');
    burner.position.set(0, 0.98, -1.72);
    B.add(burner);
    for (var inc = 0; inc < 3; inc++) {
      B.add(bx(0.014, 0.30, 0.014, 'woodRed', (inc - 1) * 0.07, 1.38, -1.72 + (inc % 2) * 0.04));
    }
    // 牌位
    for (var pa = 0; pa < 5; pa++) {
      var px = (pa - 2) * 0.34;
      B.add(bx(0.22, 0.06, 0.16, 'woodDark', px, 1.01, -2.16));
      B.add(bx(0.155, 0.38, 0.055, 'woodRed', px, 1.23, -2.16));
    }

    /* ==================================================================
     * 8. 灯笼一对（纸罩 + 黑漆盖，无点光）
     * ================================================================== */
    function hangLantern(x, z) {
      var L = new THREE.Group();
      L.add(ctx.cyl(0.012, 0.012, 0.40, 4, 'woodBlack', 0, -0.20, 0));
      L.add(ctx.cyl(0.085, 0.085, 0.05, 8, 'woodBlack', 0, -0.42, 0));
      L.add(ctx.lathe([[0.02, 0], [0.075, -0.01], [0.155, -0.09], [0.20, -0.20],
        [0.185, -0.30], [0.125, -0.37], [0.03, -0.41]], 12, 'paper'));
      L.add(ctx.cyl(0.07, 0.07, 0.045, 8, 'woodBlack', 0, -0.635, 0));
      L.add(ctx.cyl(0.016, 0.016, 0.20, 4, 'woodRed', 0, -0.75, 0));
      L.position.set(x, COLH - 0.46, z);
      return L;
    }
    B.add(hangLantern(2.15, ZF - 0.10));
    B.add(hangLantern(-2.15, ZF - 0.10));

    /* ==================================================================
     * 9. 门前：石狮一对（略内八）+ 抱鼓石
     * ================================================================== */
    for (var ls = 0; ls < 2; ls++) {
      var lsg = ls === 0 ? -1 : 1;
      var lion = ctx.lion({ s: 0.85, mat: 'stoneLight' });
      lion.position.set(lsg * 3.15, 0, 4.58);
      lion.rotation.y = -lsg * 0.20;
      g.add(lion);
      // 抱鼓石
      var dg = new THREE.Group();
      dg.add(uvb(0.42, 0.16, 0.72, 'stoneDark', 0.6, 0.6).translateY(0.08));
      var drum = ctx.lathe([[0, 0], [0.07, 0], [0.20, 0.04], [0.27, 0.14], [0.25, 0.27],
        [0.10, 0.35], [0, 0.36]], 12, 'stoneLight');
      drum.rotation.z = -PI / 2;
      drum.position.set(-0.02, 0.49, 0);
      dg.add(drum);
      dg.add(uvb(0.20, 0.34, 0.30, 'stoneDark', 0.6, 0.6).translateY(0.31).translateZ(0.0));
      dg.position.set(lsg * 2.98, PT, PD / 2 + 0.02);
      g.add(dg);
    }

    /* ---------------- 完成 ---------------- */
    g.userData = { w: 9.1, d: 8.7, h: 7.8, door: { x: 0, z: 4.4 }, kind: 'hall' };
    return g;
  };
})();
