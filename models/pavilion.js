/* models/pavilion.js —— 路亭 / 水榭（随机二选一）
 * pavilion  : 四柱攒尖路亭（台基 + 踏步 + 三面美人靠 + 石桌石凳 + 匾额灯笼 + 翼角起翘）
 * waterside : 三面开敞水榭（白墙门洞格窗 + 木地板 + 屏风条案琴桌 + 临水石阶 + 竹帘盆栽）
 * 原点在占地中心、y=0 地面，正面朝 +Z。材质 11 种，全部来自 ctx.mat。
 */
(function () {
  'use strict';
  var JN = window.JN;
  var PI = Math.PI;

  JN.models['pavilion'] = function (ctx) {
    var rng = ctx.rng;
    var g = new THREE.Group();

    var type = (ctx.opts && ctx.opts.type) || rng.pick(['pavilion', 'waterside']);
    if (type !== 'waterside' && type !== 'pavilion') type = 'pavilion';

    /* ---------------- 通用小工具 ---------------- */
    function put(o, x, y, z, ry) {
      if (!o) return o;
      if (x !== undefined) o.position.set(x, y, z);
      if (ry) o.rotation.y = ry;
      g.add(o);
      return o;
    }
    function bx(w, h, d, m, x, y, z) { return put(ctx.box(w, h, d, m, x, y, z)); }
    function uvb(w, h, d, m, su, sv) { return ctx.uvBox(w, h, d, m, su, sv); }

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

    /* 一批小盒子合成单个网格（降 mesh 数，保留细节） */
    function batch(items, m) {
      var pos = [], uvs = [], idx = [], off = 0;
      var mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      var one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var geo = new THREE.BoxGeometry(it[0], it[1], it[2]);
        e.set(it[6] || 0, it[7] || 0, it[8] || 0);
        q.setFromEuler(e);
        v.set(it[3], it[4], it[5]);
        mat4.compose(v, q, one);
        geo.applyMatrix4(mat4);
        var p = geo.attributes.position, u = geo.attributes.uv, ix = geo.index;
        for (var k = 0; k < p.count; k++) {
          pos.push(p.getX(k), p.getY(k), p.getZ(k));
          uvs.push(u.getX(k), u.getY(k));
        }
        for (var j = 0; j < ix.count; j++) idx.push(ix.getX(j) + off);
        off += p.count;
        geo.dispose();
      }
      return meshFrom(pos, uvs, idx, m);
    }

    /* 柱：覆盆柱础（车削）+ 带收分柱身 */
    function pillar(x, z, h) {
      var pr = new THREE.Group();
      pr.add(ctx.lathe([[0, 0], [0.205, 0], [0.214, 0.03], [0.198, 0.07],
        [0.178, 0.12], [0.168, 0.16], [0, 0.16]], 16, 'stone'));
      var sh = h - 0.16;
      var col = ctx.lathe([[0, 0], [0.152, 0], [0.159, 0.04], [0.151, 0.10],
        [0.143, sh * 0.26], [0.135, sh * 0.52], [0.127, sh * 0.78],
        [0.118, sh], [0, sh]], 12, 'woodLight');
      col.position.y = 0.16;
      pr.add(col);
      pr.position.set(x, 0, z);
      return pr;
    }

    /* 挂落（檐下花板）：上枋 + 下枋 + 细竖条 + 垂花头（合并成 1 个网格） */
    function guaLuo(len, x, y, z, ry) {
      var items = [[len, 0.055, 0.07, 0, 0, 0],
                   [len - 0.02, 0.030, 0.05, 0, -0.34, 0],
                   [0.07, 0.13, 0.06, 0, -0.40, 0]];
      var n = Math.max(7, Math.round(len / 0.13));
      for (var i = 1; i < n; i++) {
        var px = -len / 2 + len * i / n;
        var hh = 0.24 + ((i * 7) % 3) * 0.028;
        items.push([0.028, hh, 0.04, px, -0.34 + hh / 2, 0]);
      }
      var me = batch(items, 'woodDark');
      me.position.set(x, y, z);
      me.rotation.y = ry || 0;
      g.add(me);
      return me;
    }

    /* 美人靠：座板 + 斜靠背 + 支腿 + 靠背小柱（合并成 2 个网格） */
    function meiRen(len, x, y, z, ry) {
      var grp = new THREE.Group();
      var n = Math.max(4, Math.round(len / 0.40));
      var wItems = [[len, 0.065, 0.34, 0, 0.42, 0.03]];
      grp.add(batch(wItems, 'woodLight'));
      var dItems = [[len, 0.042, 0.05, 0, 0.355, 0.15]];
      for (var i = 0; i <= n; i++) {
        var px = -len / 2 + len * i / n;
        dItems.push([0.055, 0.34, 0.055, px, 0.20, 0.15]);
      }
      for (var j = 1; j < n; j++) {
        var qx = -len / 2 + len * j / n;
        dItems.push([0.042, 0.18, 0.042, qx, 0.52, -0.185]);
      }
      dItems.push([len, 0.055, 0.075, 0, 0.845, -0.225, -0.36, 0, 0]);
      dItems.push([len, 0.42, 0.05, 0, 0.64, -0.15, -0.36, 0, 0]);
      grp.add(batch(dItems, 'woodDark'));
      grp.position.set(x, y, z);
      grp.rotation.y = ry || 0;
      g.add(grp);
      return grp;
    }

    /* 檐下椽条（四边，合并成 1 个网格） */
    function rafters(hx, hz, y, n, mat, depth) {
      var dep = depth || 0.30;
      var items = [];
      for (var i = 0; i < n; i++) {
        var p = -hx + 2 * hx * i / (n - 1);
        items.push([0.05, 0.06, dep, p, y, hz - dep / 2]);
        items.push([0.05, 0.06, dep, p, y, -(hz - dep / 2)]);
      }
      for (var j = 1; j < n - 1; j++) {
        var q = -hz + 2 * hz * j / (n - 1);
        items.push([dep, 0.06, 0.05, hx - dep / 2, y, q]);
        items.push([dep, 0.06, 0.05, -(hx - dep / 2), y, q]);
      }
      g.add(batch(items, mat));
    }

    /* 封檐板（四边，1 个网格） */
    function eaveBoard(half, y, mat) {
      g.add(batch([
        [2 * half + 0.1, 0.05, 0.10, 0, y, half],
        [2 * half + 0.1, 0.05, 0.10, 0, y, -half],
        [0.10, 0.05, 2 * half + 0.1, half, y, 0],
        [0.10, 0.05, 2 * half + 0.1, -half, y, 0]
      ], mat));
    }

    /* 灯笼（自建：灯身 + 上下托 + 挑绳，不引入多余材质） */
    function lanternAt(x, y, z, r, h) {
      var grp = new THREE.Group();
      grp.add(ctx.cyl(0.008, 0.008, 0.20, 5, 'woodDark', 0, h / 2 + 0.11, 0));
      grp.add(ctx.cyl(0.045, 0.055, 0.03, 8, 'woodDark', 0, h / 2 + 0.005, 0));
      grp.add(ctx.lathe([[0, 0], [r * 0.55, 0], [r * 0.94, h * 0.20], [r, h * 0.5],
        [r * 0.94, h * 0.80], [r * 0.55, h], [0, h]], 14, 'woodRed'));
      grp.add(ctx.cyl(0.05, 0.045, 0.03, 8, 'woodDark', 0, -0.005, 0));
      grp.add(ctx.cyl(0.014, 0.02, 0.12, 6, 'woodDark', 0, -0.07, 0));
      grp.position.set(x, y, z);
      g.add(grp);
      return grp;
    }

    /* ==================================================================
     * 攒尖顶（自建）：四面坡 + 举折 + 翼角起翘 + 瓦垄 + 垂脊 + 瓦当 + 宝顶
     * ================================================================== */
    function pyramidRoof(HW, h, lift) {
      var grp = new THREE.Group();
      var M = 40, N = 16, K = 30, TOPR = 0.05;
      function kAt(tt) { return (1 - tt) + TOPR * tt; }
      function yAt(tt, u) {
        var yy = h * (tt - 0.22 * Math.sin(PI * tt) * (1 - tt));
        yy += lift * Math.pow(Math.abs(u), 5) * Math.pow(1 - tt, 2.4);
        return yy;
      }
      function faceMesh(up) {
        var pos = [], uvs = [], idx = [];
        for (var i = 0; i <= N; i++) {
          var tt = i / N, k = kAt(tt);
          for (var j = 0; j <= M; j++) {
            var u = -1 + 2 * j / M;
            pos.push(u * HW * k, yAt(tt, u), HW * k);
            uvs.push(j / M * 5, tt * 3);
          }
        }
        for (var i2 = 0; i2 < N; i2++) {
          for (var j2 = 0; j2 < M; j2++) {
            var a = i2 * (M + 1) + j2, b = a + 1, c = a + M + 1, d = c + 1;
            if (up) idx.push(a, b, c, b, d, c);
            else idx.push(a, c, b, b, c, d);
          }
        }
        return meshFrom(pos, uvs, idx, up ? 'tile' : 'woodDark');
      }
      var fg = new THREE.Group();
      fg.add(faceMesh(true));
      var soff = faceMesh(false);
      soff.position.y = -0.085;
      fg.add(soff);

      /* 瓦垄（沿举折曲线的凸棱） */
      var tp = [], tu = [], ti = [];
      for (var r = 0; r < K; r++) {
        var uu = -0.955 + 1.91 * (r + 0.5) / K;
        var hw = (1.91 / K) * 0.44;
        var base = tp.length / 3;
        for (var i3 = 0; i3 <= N; i3++) {
          var tt3 = i3 / N, k3 = kAt(tt3);
          var u0 = uu - hw, u2 = uu + hw;
          tp.push(u0 * HW * k3, yAt(tt3, u0) + 0.004, HW * k3,
            uu * HW * k3, yAt(tt3, uu) + 0.050, HW * k3,
            u2 * HW * k3, yAt(tt3, u2) + 0.004, HW * k3);
          tu.push(0, tt3 * 4, 0.5, tt3 * 4, 1, tt3 * 4);
        }
        for (var i4 = 0; i4 < N; i4++) {
          var aa = base + i4 * 3;
          ti.push(aa, aa + 3, aa + 1, aa + 1, aa + 3, aa + 4,
            aa + 1, aa + 4, aa + 2, aa + 2, aa + 4, aa + 5);
        }
      }
      fg.add(meshFrom(tp, tu, ti, 'tileDark'));

      /* 檐口瓦当 + 滴水（合并成 1 个网格） */
      var nE = 15, eItems = [];
      for (var e = 0; e < nE; e++) {
        var ue = -0.92 + 1.84 * e / (nE - 1);
        eItems.push([0.09, 0.09, 0.085, ue * HW, yAt(0, ue) + 0.028, HW + 0.02, PI / 2, 0, 0]);
        if (e % 3 === 1) {
          eItems.push([0.09, 0.018, 0.12, ue * HW, yAt(0, ue) - 0.012, HW + 0.032, 0.32, 0, 0]);
        }
      }
      fg.add(batch(eItems, 'tileDark'));

      for (var s = 0; s < 4; s++) {
        var cp = s === 0 ? fg : fg.clone();
        cp.rotation.y = s * PI / 2;
        grp.add(cp);
      }

      /* 垂脊（四条，沿举折曲线，角端起翘外挑） */
      for (var ci = 0; ci < 4; ci++) {
        var sx = ci < 2 ? 1 : -1, sz = (ci % 2) === 0 ? 1 : -1;
        var hp = [], hu = [], hi = [], hwid = 0.11;
        var perpX = sz * 0.7071, perpZ = -sx * 0.7071;
        for (var t2 = 0; t2 <= N; t2++) {
          var tt4 = t2 / N, k4 = kAt(tt4);
          var cx4 = sx * HW * k4, cz4 = sz * HW * k4, cy4 = yAt(tt4, 1) + 0.03;
          hp.push(cx4 + perpX * hwid / 2, cy4, cz4 + perpZ * hwid / 2,
            cx4, cy4 + 0.08, cz4,
            cx4 - perpX * hwid / 2, cy4, cz4 - perpZ * hwid / 2);
          hu.push(0, tt4 * 3, 0.5, tt4 * 3, 1, tt4 * 3);
        }
        for (var t3 = 0; t3 < N; t3++) {
          var ha = t3 * 3;
          hi.push(ha, ha + 3, ha + 1, ha + 1, ha + 3, ha + 4,
            ha + 1, ha + 4, ha + 2, ha + 2, ha + 4, ha + 5);
        }
        grp.add(meshFrom(hp, hu, hi, 'tileDark'));
        var tip = ctx.box(0.10, 0.10, 0.10, 'tileDark', sx * (HW + 0.055), lift + 0.055, sz * (HW + 0.055));
        tip.rotation.z = sx * 0.42;
        tip.rotation.x = -sz * 0.42;
        grp.add(tip);
      }

      /* 宝顶 */
      var bd = ctx.lathe([[0, 0], [0.20, 0], [0.226, 0.05], [0.145, 0.11],
        [0.19, 0.19], [0.125, 0.28], [0.16, 0.36], [0.08, 0.44], [0, 0.48]], 12, 'tileDark');
      bd.position.y = h - 0.02;
      grp.add(bd);
      return grp;
    }

    /* ==================================================================
     * 形态一：路亭（四柱攒尖）
     * ================================================================== */
    function buildPavilion() {
      var PW = 3.9, PD = 3.9, PT = 0.30;
      var CX = 1.15;
      var COLH = 2.55;
      var COLTOP = PT + COLH;
      var BY = COLTOP - 0.13;
      var EAVE = COLTOP + 0.40;
      var HW = 1.98, RH = 1.38, LIFT = 0.40;

      /* 台基 + 台面石板铺装 */
      put(ctx.plinth({ w: PW, d: PD, h: 0.24, mat: 'stone' }));
      var nT = 4, tw = (PW - 0.26) / nT, sItems = [];
      for (var ix = 0; ix < nT; ix++) {
        for (var iz = 0; iz < nT; iz++) {
          sItems.push([tw - 0.05, 0.045, tw - 0.05,
            -((nT - 1) * tw) / 2 + ix * tw, PT - 0.023, -((nT - 1) * tw) / 2 + iz * tw]);
        }
      }
      g.add(batch(sItems, 'stone'));
      var wearItems = [], mossItems = [];
      for (var wm = 0; wm < 9; wm++) {
        wearItems.push([rng.range(0.22, 0.5), 0.010, rng.range(0.05, 0.12),
          rng.range(-1.4, 1.4), PT + 0.005, rng.range(-1.4, 1.4), 0, rng.range(-0.5, 0.5), 0]);
      }
      for (var mo = 0; mo < 10; mo++) {
        mossItems.push([rng.range(0.18, 0.44), 0.012, rng.range(0.05, 0.10),
          rng.range(-1.9, 1.9), 0.010, (mo % 2 === 0 ? 1 : -1) * rng.range(1.82, 2.06), 0, rng.range(-0.4, 0.4), 0]);
      }
      g.add(batch(wearItems, 'stoneDark'));
      g.add(batch(mossItems, 'stoneDark'));

      /* 踏步 + 垂带 */
      var st = ctx.steps({ w: 1.6, n: 3, rise: 0.10, run: 0.26, mat: 'stone' });
      st.position.set(0, 0, PD / 2 + 0.78);
      g.add(st);
      var bItems = [];
      for (var sd = -1; sd <= 1; sd += 2) {
        for (var sb = 0; sb < 3; sb++) {
          var bh = 0.10 * (sb + 1);
          bItems.push([0.16, bh, 0.26, sd * 0.88, bh / 2, PD / 2 + 0.13 + sb * 0.26]);
        }
      }
      g.add(batch(bItems, 'stoneDark'));

      /* 四柱 */
      var PXs = [-CX, CX];
      for (var pi = 0; pi < 4; pi++) {
        var pr = pillar(PXs[pi & 1], PXs[pi >> 1], COLH);
        pr.position.y = PT;
        g.add(pr);
      }

      /* 额枋 / 平板枋 / 雀替 */
      var redItems = [], darkItems = [];
      for (var bi = 0; bi < 2; bi++) {
        var sg = bi === 0 ? 1 : -1;
        redItems.push([2.06, 0.18, 0.16, 0, BY, sg * CX]);
        redItems.push([2.26, 0.085, 0.22, 0, COLTOP + 0.01, sg * CX]);
        redItems.push([0.16, 0.18, 2.06, sg * CX, BY, 0]);
        redItems.push([0.22, 0.085, 2.26, sg * CX, COLTOP + 0.01, 0]);
      }
      for (var qi = 0; qi < 4; qi++) {
        var qx = PXs[qi & 1], qz = PXs[qi >> 1];
        var dx = qx > 0 ? -1 : 1, dz = qz > 0 ? -1 : 1;
        darkItems.push([0.40, 0.085, 0.13, qx + dx * 0.21, BY - 0.135, qz]);
        darkItems.push([0.13, 0.085, 0.40, qx, BY - 0.135, qz + dz * 0.21]);
        darkItems.push([0.26, 0.07, 0.10, qx + dx * 0.33, BY - 0.245, qz]);
        darkItems.push([0.10, 0.07, 0.26, qx, BY - 0.245, qz + dz * 0.33]);
      }
      g.add(batch(redItems, 'woodRed'));
      g.add(batch(darkItems, 'woodDark'));

      /* 斗拱（四柱头） */
      for (var bj = 0; bj < 4; bj++) {
        var br = ctx.bracket({ s: 0.42, mat: 'woodRed' });
        br.position.set(PXs[bj & 1], COLTOP + 0.03, PXs[bj >> 1]);
        g.add(br);
      }

      /* 挂落（四侧） */
      guaLuo(2.0, 0, BY - 0.10, CX, 0);
      guaLuo(2.0, 0, BY - 0.10, -CX, PI);
      guaLuo(2.0, CX, BY - 0.10, 0, PI / 2);
      guaLuo(2.0, -CX, BY - 0.10, 0, -PI / 2);

      /* 美人靠（三面，正面留踏步） */
      meiRen(2.14, 0, PT, -1.0, 0);
      meiRen(1.70, 1.0, PT, 0, -PI / 2);
      meiRen(1.70, -1.0, PT, 0, PI / 2);

      /* 檐下椽条 + 封檐板 */
      rafters(1.50, 1.50, EAVE - 0.115, 9, 'woodDark', 0.30);
      eaveBoard(1.52, EAVE - 0.075, 'woodDark');

      /* 石桌 + 四石凳 */
      var tbl = new THREE.Group();
      tbl.add(ctx.lathe([[0, 0], [0.26, 0], [0.28, 0.06], [0.20, 0.14],
        [0.17, 0.24], [0.22, 0.36], [0.30, 0.46], [0.32, 0.52], [0, 0.52]], 16, 'stone'));
      tbl.add(ctx.cyl(0.47, 0.45, 0.09, 20, 'stone', 0, 0.565, 0));
      tbl.add(ctx.cyl(0.49, 0.49, 0.028, 20, 'stoneDark', 0, 0.515, 0));
      tbl.position.y = PT;
      g.add(tbl);
      put(ctx.box(0.48, 0.010, 0.14, 'stoneDark', rng.range(-0.1, 0.1), PT + 0.615, rng.range(-0.1, 0.1)));
      var stItems = [];
      for (var si = 0; si < 4; si++) {
        var sax = si === 0 ? 0.84 : (si === 1 ? -0.84 : 0);
        var saz = si === 2 ? 0.84 : (si === 3 ? -0.84 : 0);
        var st1 = ctx.cyl(0.15, 0.17, 0.38, 12, 'stone', sax, PT + 0.19, saz);
        st1.castShadow = true; st1.receiveShadow = true;
        g.add(st1);
        var st2 = ctx.cyl(0.17, 0.17, 0.045, 12, 'stone', sax, PT + 0.40, saz);
        st2.castShadow = true; st2.receiveShadow = true;
        g.add(st2);
      }

      /* 匾额 + 灯笼 2 只 */
      var plq = ctx.plaque({
        text: '听雨',
        w: 1.0, h: 0.34, bg: 'woodDark', fg: 'stone', frame: 'woodDark'
      });
      plq.position.set(0, BY - 0.02, CX + 0.14);
      g.add(plq);
      var lanItems = [];
      for (var li = 0; li < 2; li++) {
        var lx = li === 0 ? 1.00 : -1.00;
        lanItems.push([0.045, 0.045, 0.34, lx, BY + 0.02, CX + 0.18]);
        lanternAt(lx, BY - 0.16, CX + 0.36, 0.14, 0.32);
      }
      g.add(batch(lanItems, 'woodDark'));

      /* 攒尖顶 */
      var roof = pyramidRoof(HW, RH, LIFT);
      roof.position.y = EAVE;
      g.add(roof);

      /* 地面：草、落叶、苔 */
      for (var gi = 0; gi < 5; gi++) {
        var gt = ctx.grass({
          n: rng.int(3, 5), h: rng.range(0.20, 0.34),
          mat: 'leafLight', seed: rng.range(0, 6)
        });
        gt.position.set(rng.range(-2.35, 2.35), 0, rng.range(-2.35, 2.35));
        g.add(gt);
      }
      var leafItems = [];
      for (var lf = 0; lf < 22; lf++) {
        var lfx = rng.range(-2.25, 2.25), lfz = rng.range(-2.25, 2.25);
        var inBase = Math.abs(lfx) < 1.9 && Math.abs(lfz) < 1.9;
        leafItems.push([rng.range(0.12, 0.20), 0.012, rng.range(0.07, 0.12),
          lfx, inBase ? PT + 0.012 : 0.014, lfz, 0, rng() * PI, 0]);
      }
      g.add(batch(leafItems, 'woodDark'));
      var limeItems = [];
      for (var mp = 0; mp < 8; mp++) {
        limeItems.push([rng.range(0.10, 0.22), 0.010, rng.range(0.06, 0.14),
          rng.range(-1.7, 1.7), PT + 0.008, rng.range(-1.7, 1.7), 0, rng.range(-0.6, 0.6), 0]);
      }
      g.add(batch(limeItems, 'leafLight'));

      g.userData = {
        w: 4.2, d: 4.9, h: EAVE + RH + 0.46,
        door: { x: 0, z: PD / 2 + 0.6 },
        kind: 'pavilion', type: 'pavilion', columns: 4
      };
    }

    /* ==================================================================
     * 形态二：水榭（三面开敞 · 一面白墙）
     * ================================================================== */
    function buildWaterside() {
      var PW = 4.4, PD = 3.4, PT = 0.32;
      var CX = 1.72, CZF = 1.20, CZB = -1.05;
      var COLH = 2.85;
      var TOP = PT + COLH;
      var BY = TOP - 0.14;
      var EAVE = TOP + 0.04;
      var WW = PW - 0.34;
      var doorW = 1.05, doorH = 2.08;
      var sideW = (WW - doorW) / 2;
      var WZ = CZB - 0.16;

      /* 台基 + 木地板铺装 */
      put(ctx.plinth({ w: PW, d: PD, h: 0.26, mat: 'stone' }));
      var nP = 10, pw = (PW - 0.26) / nP;
      for (var pk = 0; pk < nP; pk++) {
        put(uvb(pw - 0.016, 0.055, 2.92, (pk % 3 === 1) ? 'woodLight' : 'woodDark', 0.45, 2.6)
          .translateX(-((nP - 1) * pw) / 2 + pk * pw).translateY(PT + 0.02).translateZ(-0.10));
      }
      bx(PW - 0.24, 0.045, 0.08, 'woodDark', 0, PT + 0.062, 1.36);
      bx(PW - 0.24, 0.045, 0.08, 'woodDark', 0, PT + 0.062, -1.50);

      /* 临水石阶（+Z 逐级入水）+ 驳岸 */
      for (var si = 0; si < 4; si++) {
        var sy = 0.28 - si * 0.066;
        var sz = PD / 2 + 0.15 + si * 0.24;
        bx(1.45, sy, 0.25, 'stone', 0, sy / 2, sz);
        bx(1.50, 0.035, 0.26, 'stoneDark', 0, sy + 0.012, sz);
      }
      var bItems2 = [];
      for (var sd = -1; sd <= 1; sd += 2) {
        for (var sb2 = 0; sb2 < 4; sb2++) {
          var bh2 = 0.28 - sb2 * 0.066;
          bItems2.push([0.15, bh2, 0.25, sd * 0.80, bh2 / 2, PD / 2 + 0.15 + sb2 * 0.24]);
        }
      }
      bItems2.push([1.9, 0.12, 0.22, 0, 0.06, PD / 2 + 0.02]);
      g.add(batch(bItems2, 'stoneDark'));

      /* 六柱 */
      var colsX = [-CX, 0, CX];
      for (var ci2 = 0; ci2 < 3; ci2++) {
        var p1 = pillar(colsX[ci2], CZF, COLH);
        p1.position.y = PT; g.add(p1);
        var p2 = pillar(colsX[ci2], CZB, COLH);
        p2.position.y = PT; g.add(p2);
      }

      /* 额枋 / 平板枋 / 雀替 */
      var dkItems = [];
      for (var bi = 0; bi < 2; bi++) {
        var bz = bi === 0 ? CZF : CZB;
        dkItems.push([PW - 0.36, 0.18, 0.16, 0, BY, bz]);
        dkItems.push([PW - 0.16, 0.08, 0.22, 0, TOP + 0.01, bz]);
      }
      for (var sb3 = 0; sb3 < 2; sb3++) {
        var sbx = sb3 === 0 ? -CX : CX;
        dkItems.push([0.16, 0.18, CZF - CZB, sbx, BY, (CZF + CZB) / 2]);
        dkItems.push([0.22, 0.08, CZF - CZB + 0.2, sbx, TOP + 0.01, (CZF + CZB) / 2]);
      }
      for (var qi2 = 0; qi2 < 3; qi2++) {
        var qx2 = colsX[qi2];
        if (qi2 < 2) {
          dkItems.push([0.34, 0.08, 0.12, qx2 + 0.19, BY - 0.13, CZF]);
          dkItems.push([0.34, 0.08, 0.12, qx2 + 0.19, BY - 0.13, CZB]);
        }
        if (qi2 > 0) {
          dkItems.push([0.34, 0.08, 0.12, qx2 - 0.19, BY - 0.13, CZF]);
          dkItems.push([0.34, 0.08, 0.12, qx2 - 0.19, BY - 0.13, CZB]);
        }
      }
      g.add(batch(dkItems, 'woodDark'));

      /* 斗拱（前后檐各三朵） */
      for (var bj2 = 0; bj2 < 3; bj2++) {
        for (var bf = 0; bf < 2; bf++) {
          var brw = ctx.bracket({ s: 0.46, mat: 'woodDark' });
          brw.position.set(colsX[bj2], TOP + 0.06, bf === 0 ? CZF : CZB);
          if (bf === 1) brw.rotation.y = PI;
          g.add(brw);
        }
      }

      /* 挂落（正面 + 两侧） */
      guaLuo(3.30, 0, BY - 0.10, CZF, 0);
      guaLuo(2.40, CX, BY - 0.10, (CZF + CZB) / 2, PI / 2);
      guaLuo(2.40, -CX, BY - 0.10, (CZF + CZB) / 2, -PI / 2);

      /* 木栏杆（正面中段留口，两侧满设） */
      function rail(len, x, z, ry) {
        var r = ctx.woodRailing({ len: len, h: 0.62, mat: 'woodLight' });
        r.position.set(x, PT, z);
        if (ry) r.rotation.y = ry;
        g.add(r);
      }
      rail(1.10, -1.20, CZF, 0);
      rail(1.10, 1.20, CZF, 0);
      rail(2.30, CX, (CZF + CZB) / 2, PI / 2);
      rail(2.30, -CX, (CZF + CZB) / 2, PI / 2);

      /* 后墙：勒脚 + 白墙 + 门洞 + 格窗 */
      for (var wp = -1; wp <= 1; wp += 2) {
        put(uvb(sideW, 0.52, 0.24, 'stoneDark', 0.6, 0.6)
          .translateX(wp * (doorW / 2 + sideW / 2)).translateY(PT + 0.26).translateZ(WZ));
        put(uvb(sideW, COLH - 0.52, 0.20, 'plaster', 0.55, 1.8)
          .translateX(wp * (doorW / 2 + sideW / 2)).translateY(PT + 0.52 + (COLH - 0.52) / 2).translateZ(WZ));
      }
      put(uvb(doorW + 0.10, COLH - doorH, 0.20, 'plaster', 0.55, 0.55)
        .translateY(PT + doorH + (COLH - doorH) / 2).translateZ(WZ));
      bx(WW + 0.18, 0.06, 0.30, 'tileDark', 0, PT + COLH + 0.02, WZ);
      bx(WW + 0.06, 0.10, 0.22, 'tile', 0, PT + COLH + 0.08, WZ);

      /* 双扇板门（自建：门框 + 门板 + 门环） */
      var dgrp = new THREE.Group();
      dgrp.add(batch([
        [doorW + 0.16, 0.10, 0.30, 0, doorH + 0.05, 0],
        [0.09, doorH, 0.26, -(doorW / 2 + 0.03), doorH / 2, 0],
        [0.09, doorH, 0.26, doorW / 2 + 0.03, doorH / 2, 0]
      ], 'woodDark'));
      var doorPlanks = [];
      for (var dl = -1; dl <= 1; dl += 2) {
        var dx0 = dl * (doorW / 4 + 0.01);
        doorPlanks.push([doorW / 2 - 0.04, doorH - 0.04, 0.07, dx0, doorH / 2, 0.02]);
        for (var dp2 = 0; dp2 < 3; dp2++) {
          doorPlanks.push([doorW / 2 - 0.10, 0.05, 0.03, dx0, 0.42 + dp2 * 0.62, 0.06]);
        }
        doorPlanks.push([0.11, 0.11, 0.03, dl * 0.20, 1.18, 0.07]);
      }
      dgrp.add(batch(doorPlanks, 'woodLight'));
      dgrp.position.set(0, PT, WZ + 0.10);
      g.add(dgrp);
      bx(doorW + 0.34, 0.12, 0.34, 'stone', 0, PT + 0.06, WZ + 0.16);
      for (var ds = -1; ds <= 1; ds += 2) {
        var dr2 = ctx.cyl(0.13, 0.15, 0.28, 10, 'stone', ds * (doorW / 2 + 0.14), PT + 0.14, WZ + 0.18);
        dr2.castShadow = true; dr2.receiveShadow = true;
        g.add(dr2);
      }

      /* 格窗（两樘，窗纸用 plaster 以免多一材质） */
      for (var wi = -1; wi <= 1; wi += 2) {
        var lat = ctx.lattice({
          w: 1.00, h: 1.08, cols: 5, rows: 5,
          style: wi < 0 ? 'grid' : 'step',
          paper: 'plaster', frame: 'woodDark', rng: rng
        });
        lat.position.set(wi * (doorW / 2 + sideW / 2), PT + 1.56, WZ + 0.13);
        g.add(lat);
        bx(1.12, 0.06, 0.14, 'stone', wi * (doorW / 2 + sideW / 2), PT + 0.99, WZ + 0.13);
        bx(1.12, 0.06, 0.14, 'stone', wi * (doorW / 2 + sideW / 2), PT + 2.13, WZ + 0.13);
      }

      /* 内部：四扇屏风（画心白绢） */
      var scr = new THREE.Group();
      for (var sp = 0; sp < 5; sp++) {
        var spx = -1.00 + sp * 0.50;
        scr.add(ctx.box(0.46, 1.80, 0.055, 'woodDark', spx, 0.90, 0));
        scr.add(ctx.box(0.34, 1.50, 0.018, 'plaster', spx, 0.92, 0.032));
        scr.add(ctx.box(0.46, 0.05, 0.07, 'woodDark', spx, 0.06, 0));
        scr.add(ctx.box(0.46, 0.05, 0.07, 'woodDark', spx, 1.74, 0));
        scr.add(ctx.box(0.05, 1.80, 0.07, 'woodLight', spx + 0.235, 0.90, 0));
      }
      scr.position.set(-0.55, PT, -0.55);
      scr.rotation.y = 0.07;
      g.add(scr);

      /* 条案 + 案上供瓶香炉 */
      var cst = new THREE.Group();
      cst.add(ctx.box(2.0, 0.075, 0.42, 'woodDark', 0, 0.78, 0));
      cst.add(ctx.box(1.9, 0.05, 0.32, 'woodLight', 0, 0.70, 0));
      for (var cl = -1; cl <= 1; cl += 2) {
        cst.add(ctx.box(0.07, 0.76, 0.07, 'woodDark', cl * 0.88, 0.38, 0.13));
        cst.add(ctx.box(0.07, 0.76, 0.07, 'woodDark', cl * 0.88, 0.38, -0.13));
      }
      cst.add(ctx.box(1.82, 0.04, 0.05, 'woodDark', 0, 0.14, 0));
      cst.position.set(-0.60, PT, -1.00);
      g.add(cst);
      put(ctx.jar({ r: 0.10, h: 0.24, mat: 'stone' }), -1.18, PT + 0.82, -1.00);
      put(ctx.cyl(0.075, 0.085, 0.10, 10, 'woodDark', -0.60, PT + 0.82, -1.00));
      put(ctx.cyl(0.055, 0.075, 0.06, 10, 'woodDark', -0.60, PT + 0.90, -1.00));

      /* 琴桌 + 琴 */
      var qin = new THREE.Group();
      qin.add(ctx.box(1.12, 0.05, 0.50, 'woodLight', 0, 0.72, 0));
      qin.add(ctx.box(1.02, 0.04, 0.42, 'woodDark', 0, 0.68, 0));
      for (var ql = -1; ql <= 1; ql += 2) {
        qin.add(ctx.box(0.06, 0.70, 0.06, 'woodDark', ql * 0.48, 0.35, 0.18));
        qin.add(ctx.box(0.06, 0.70, 0.06, 'woodDark', ql * 0.48, 0.35, -0.18));
      }
      qin.add(ctx.box(0.98, 0.045, 0.06, 'woodDark', 0, 0.16, 0.18));
      qin.position.set(1.25, PT, 0.12);
      g.add(qin);
      bx(0.90, 0.035, 0.15, 'woodDark', 1.25, PT + 0.765, 0.12);

      /* 石凳 2 张 */
      for (var sbi = 0; sbi < 2; sbi++) {
        var sbx2 = sbi === 0 ? 0.82 : -1.50;
        var s1 = ctx.cyl(0.15, 0.17, 0.38, 12, 'stone', sbx2, PT + 0.19, 0.70);
        s1.castShadow = true; s1.receiveShadow = true; g.add(s1);
        var s2 = ctx.cyl(0.17, 0.17, 0.045, 12, 'stoneDark', sbx2, PT + 0.40, 0.70);
        s2.castShadow = true; s2.receiveShadow = true; g.add(s2);
      }

      /* 匾额 */
      var plq2 = ctx.plaque({
        text: '听雨',
        w: 1.45, h: 0.38, bg: 'woodDark', fg: 'stone', frame: 'woodDark'
      });
      plq2.position.set(0, BY - 0.02, CZF + 0.14);
      g.add(plq2);

      /* 灯笼 2 只 */
      var lanItems2 = [];
      for (var lj = 0; lj < 2; lj++) {
        var lx2 = lj === 0 ? 1.36 : -1.36;
        lanItems2.push([0.045, 0.045, 0.34, lx2, BY + 0.02, CZF + 0.19]);
        lanternAt(lx2, BY - 0.16, CZF + 0.36, 0.15, 0.34);
      }
      g.add(batch(lanItems2, 'woodDark'));

      /* 竹帘（檐下，薄面片 + 细竹条） */
      for (var bl = 0; bl < 2; bl++) {
        var blx = bl === 0 ? -0.90 : 0.90;
        bx(0.84, 0.70, 0.018, 'woodLight', blx, BY - 0.43, CZF + 0.05);
        var bItems3 = [];
        for (var bs = 0; bs < 13; bs++) {
          bItems3.push([0.84, 0.014, 0.026, blx, BY - 0.14 - bs * 0.070, CZF + 0.05]);
        }
        bItems3.push([0.90, 0.045, 0.05, blx, BY - 0.07, CZF + 0.05]);
        g.add(batch(bItems3, 'woodDark'));
      }

      /* 盆栽（陶罐 + 叶团） */
      for (var pj = 0; pj < 2; pj++) {
        var pjx = pj === 0 ? 1.86 : -1.86;
        var pjz = pj === 0 ? 1.00 : -0.96;
        put(ctx.jar({ r: 0.18, h: 0.28, mat: 'stoneDark' }), pjx, PT, pjz);
        put(ctx.cyl(0.04, 0.05, 0.22, 6, 'woodDark', pjx, PT + 0.34, pjz));
        var blb = ctx.blob({ r: 0.28, mat: 'leafLight', seed: rng.range(0, 8), amp: 0.35, detail: 2, flatY: 0.8 });
        blb.position.set(pjx, PT + 0.52, pjz);
        g.add(blb);
      }

      /* 屋面（自建双坡：举折 + 翼角起翘 + 瓦垄 + 正脊 + 垂脊 + 山花） */
      (function gableRoof() {
        var RH2 = 1.34, ROVER = 0.66, RC = 0.26, RL = 0.26;
        var RW2 = PW / 2 + ROVER, RD2 = PD / 2 + ROVER;
        var NX = 46, NZ = 24;
        var rg = new THREE.Group();
        /* u: 0 = 正脊, 1 = 檐口 */
        function yAt(u, x) {
          var yy = (1 - u) * RH2 - Math.sin(u * PI * 0.5) * RC * u * 0.6;
          yy += RL * Math.pow(Math.min(1, Math.abs(x) / RW2), 4.2) * Math.pow(u, 2.2);
          return yy;
        }
        function faceMesh(up) {
          var pos = [], uvs = [], idx = [];
          for (var s2 = 0; s2 < 2; s2++) {
            var sg = s2 === 0 ? 1 : -1;
            var base = pos.length / 3;
            for (var iz = 0; iz <= NZ; iz++) {
              var u = Math.max(0.004, iz / NZ);
              for (var ix = 0; ix <= NX; ix++) {
                var x = -RW2 + 2 * RW2 * ix / NX;
                pos.push(x, yAt(u, x), sg * u * RD2);
                uvs.push(ix / NX * 6, u * 3);
              }
            }
            for (var iz2 = 0; iz2 < NZ; iz2++) {
              for (var ix2 = 0; ix2 < NX; ix2++) {
                var a = base + iz2 * (NX + 1) + ix2, b = a + 1, c = a + NX + 1, d = c + 1;
                if (sg > 0) { if (up) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
                else { if (up) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
              }
            }
          }
          return meshFrom(pos, uvs, idx, up ? 'tile' : 'woodDark');
        }
        rg.add(faceMesh(true));
        var soff = faceMesh(false);
        soff.position.y = -0.07;
        rg.add(soff);

        /* 瓦垄（沿举折曲线，深瓦色） */
        var rows = 44, segs = 18, pos2 = [], uvs2 = [], idx2 = [], hw = 0.030;
        for (var r = 0; r < rows; r++) {
          var rx = -RW2 + (r + 0.5) * (2 * RW2 / rows);
          for (var sd2 = 0; sd2 < 2; sd2++) {
            var sg2 = sd2 === 0 ? 1 : -1;
            var b0 = pos2.length / 3;
            for (var i5 = 0; i5 <= segs; i5++) {
              var u5 = Math.max(0.02, i5 / segs);
              var y5 = yAt(u5, rx), z5 = sg2 * u5 * RD2;
              pos2.push(rx - hw, y5 - 0.008, z5, rx, y5 + 0.040, z5, rx + hw, y5 - 0.008, z5);
              uvs2.push(0, u5 * 3, 0.5, u5 * 3, 1, u5 * 3);
            }
            for (var i6 = 0; i6 < segs; i6++) {
              var a6 = b0 + i6 * 3;
              if (sg2 > 0) idx2.push(a6, a6 + 3, a6 + 1, a6 + 1, a6 + 3, a6 + 4, a6 + 1, a6 + 4, a6 + 2, a6 + 2, a6 + 4, a6 + 5);
              else idx2.push(a6, a6 + 1, a6 + 3, a6 + 1, a6 + 4, a6 + 3, a6 + 1, a6 + 2, a6 + 4, a6 + 2, a6 + 5, a6 + 4);
            }
          }
        }
        rg.add(meshFrom(pos2, uvs2, idx2, 'tileDark'));

        /* 正脊（沿 X 通长，两端脊头起翘） */
        var rItems = [[PW + 0.30, 0.15, 0.22, 0, RH2 + 0.03, 0],
                      [PW + 0.40, 0.05, 0.28, 0, RH2 + 0.12, 0]];
        for (var rj = -1; rj <= 1; rj += 2) {
          rItems.push([0.14, 0.22, 0.26, rj * (PW / 2 + 0.18), RH2 + 0.15, 0, 0, 0, rj * 0.44]);
        }
        var rm = batch(rItems, 'tileDark');
        rm.position.y = EAVE;
        g.add(rm);

        /* 檐口瓦当（两坡，随翼角起翘） */
        var eItems = [], nE = 19;
        for (var e3 = 0; e3 < nE; e3++) {
          var ex3 = -(RW2 - 0.30) + 2 * (RW2 - 0.30) * e3 / (nE - 1);
          var liftE = RL * Math.pow(Math.min(1, Math.abs(ex3) / RW2), 4.2);
          for (var es = -1; es <= 1; es += 2) {
            eItems.push([0.085, 0.085, 0.08, ex3, EAVE + liftE + 0.02, es * RD2, PI / 2, 0, 0]);
          }
        }
        g.add(batch(eItems, 'tileDark'));

        /* 山花板（随坡面，封住两端） + 沿坡垂脊 */
        for (var gb = -1; gb <= 1; gb += 2) {
          var GX = PW / 2 + 0.10;
          var gp = [], gu = [], gi = [], NS = 16;
          for (var i7 = 0; i7 <= NS; i7++) {
            var zz = -RD2 + 2 * RD2 * i7 / NS;
            var ty = yAt(Math.abs(zz) / RD2, GX);
            gp.push(gb * GX, 0.10, zz, gb * GX, ty, zz);
            gu.push(0, i7 / NS * 2, 1, i7 / NS * 2);
          }
          for (var i8 = 0; i8 < NS; i8++) {
            var a8 = i8 * 2;
            if (gb > 0) gi.push(a8, a8 + 1, a8 + 2, a8 + 1, a8 + 3, a8 + 2);
            else gi.push(a8, a8 + 2, a8 + 1, a8 + 1, a8 + 2, a8 + 3);
          }
          var gm = meshFrom(gp, gu, gi, 'woodDark');
          gm.position.y = EAVE;
          g.add(gm);

          /* 垂脊（两条） */
          var vp = [], vu = [], vi = [];
          for (var sd3 = -1; sd3 <= 1; sd3 += 2) {
            var b3 = vp.length / 3;
            for (var i9 = 0; i9 <= NS; i9++) {
              var zz2 = sd3 * RD2 * i9 / NS;
              var yy2 = yAt(Math.abs(zz2) / RD2, GX) + 0.012;
              vp.push(gb * GX - 0.065, yy2, zz2, gb * GX, yy2 + 0.09, zz2, gb * GX + 0.065, yy2, zz2);
              vu.push(0, i9 / NS * 2, 0.5, i9 / NS * 2, 1, i9 / NS * 2);
            }
            for (var i10 = 0; i10 < NS; i10++) {
              var a10 = b3 + i10 * 3;
              if (sd3 > 0) vi.push(a10, a10 + 3, a10 + 1, a10 + 1, a10 + 3, a10 + 4, a10 + 1, a10 + 4, a10 + 2, a10 + 2, a10 + 4, a10 + 5);
              else vi.push(a10, a10 + 1, a10 + 3, a10 + 1, a10 + 4, a10 + 3, a10 + 1, a10 + 2, a10 + 4, a10 + 2, a10 + 5, a10 + 4);
            }
          }
          var vm = meshFrom(vp, vu, vi, 'tileDark');
          vm.position.y = EAVE;
          g.add(vm);
        }

        /* 檐下椽条 */
        rafters(PW / 2 + 0.14, PD / 2 + 0.14, EAVE - 0.11, 11, 'woodDark', 0.30);

        rg.position.y = EAVE;
        g.add(rg);
      })();

      /* 地面落叶与苔 */
      var leafItems2 = [];
      for (var lf2 = 0; lf2 < 16; lf2++) {
        leafItems2.push([rng.range(0.10, 0.18), 0.010, rng.range(0.06, 0.11),
          rng.range(-2.0, 2.0), PT + 0.072, rng.range(-1.5, 1.5), 0, rng() * PI, 0]);
      }
      g.add(batch(leafItems2, 'woodDark'));
      var mossItems2 = [];
      for (var mo2 = 0; mo2 < 9; mo2++) {
        mossItems2.push([rng.range(0.16, 0.38), 0.012, rng.range(0.05, 0.09),
          rng.range(-2.0, 2.0), PT + 0.072, (mo2 % 2 === 0 ? 1 : -1) * rng.range(1.10, 1.52), 0, rng.range(-0.4, 0.4), 0]);
      }
      g.add(batch(mossItems2, 'stoneDark'));
      for (var gs2 = 0; gs2 < 4; gs2++) {
        var gtp = ctx.grass({ n: rng.int(3, 5), h: rng.range(0.18, 0.3), mat: 'leafLight', seed: rng.range(0, 6) });
        gtp.position.set(rng.range(-2.4, 2.4), 0, rng.range(-1.9, 2.6));
        g.add(gtp);
      }

      g.userData = {
        w: 5.5, d: 4.9, h: EAVE + 1.32 + 0.26,
        door: { x: 0, z: PD / 2 + 0.6 },
        kind: 'pavilion', type: 'waterside', columns: 6
      };
    }

    if (type === 'waterside') buildWaterside();
    else buildPavilion();

    return g;
  };
})();
