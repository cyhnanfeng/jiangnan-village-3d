/* models/house.js —— 江南民居
 * 单层 / 两层、白墙黛瓦、马头墙、石库门、花窗、檐廊
 * 原点在占地中心、y=0 地面，大门朝 +Z
 */
(function () {
  'use strict';
  var JN = window.JN;

  JN.models['house'] = function (ctx) {
    var rng = ctx.rng;
    var TAU = Math.PI * 2;
    var g = new THREE.Group();

    /* ---------------- 尺寸 ---------------- */
    var opts = ctx.opts || {};
    var w = opts.w ? Math.max(3.0, Math.min(5.0, opts.w)) : rng.pick([3.2, 3.6, 3.8, 4.2, 4.6]);
    var d = opts.d ? Math.max(2.8, Math.min(4.4, opts.d)) : rng.pick([3.0, 3.2, 3.4, 3.8]);
    var twoStory = rng.chance(0.28);
    var wallH = twoStory ? rng.range(4.6, 5.4) : rng.range(2.9, 3.5);
    var t = 0.22;                       // 墙厚
    var plinthH = rng.range(0.34, 0.48); // 石勒脚
    var roofH = rng.range(0.95, 1.35);
    var over = rng.range(0.40, 0.55);
    var doorW = 1.12, doorH = 2.08;
    var wallMat = rng.pick(['plaster', 'plaster', 'plasterWarm', 'plasterGrey']);
    var roofMat = rng.pick(['tile', 'tile', 'tileDark']);
    var stepsN = rng.int(2, 3);

    /* ---------------- 台基 ---------------- */
    var base = ctx.uvBox(w + 0.5, plinthH, d + 0.5, 'stoneDark', 0.55, 0.55);
    base.position.y = plinthH / 2;
    g.add(base);
    var baseTop = ctx.uvBox(w + 0.58, 0.06, d + 0.58, 'stoneLight', 0.6, 0.6);
    baseTop.position.y = plinthH + 0.02;
    g.add(baseTop);

    var floorY = plinthH + 0.05;
    var innerW = w - t * 2, innerD = d - t * 2;

    /* ---------------- 墙体 ---------------- */
    // 后墙
    var back = ctx.uvBox(w, wallH, t, wallMat, 0.42, 0.42);
    back.position.set(0, floorY + wallH / 2, -d / 2 + t / 2);
    g.add(back);
    // 两侧山墙（略收分：上窄 1.5%）
    for (var s = -1; s <= 1; s += 2) {
      var side = ctx.uvBox(t, wallH, d, wallMat, 0.42, 0.42);
      side.position.set(s * (w / 2 - t / 2), floorY + wallH / 2, 0);
      side.scale.z = 1;
      g.add(side);
      // 墙脚泛碱（深色薄片）
      var stain = ctx.box(0.02, wallH * 0.28, d * 0.98, 'stoneWet', s * (w / 2 + 0.005), floorY + wallH * 0.14, 0);
      g.add(stain);
    }
    // 前墙：门洞两侧 + 门楣
    var frontZ = d / 2 - t / 2;
    var sidePanelW = (w - doorW) / 2;
    for (var p = -1; p <= 1; p += 2) {
      var pnl = ctx.uvBox(sidePanelW, wallH, t, wallMat, 0.42, 0.42);
      pnl.position.set(p * (doorW / 2 + sidePanelW / 2), floorY + wallH / 2, frontZ);
      g.add(pnl);
    }
    var lintelH = wallH - doorH;
    if (lintelH > 0.05) {
      var lintel = ctx.uvBox(doorW + 0.1, lintelH, t, wallMat, 0.42, 0.42);
      lintel.position.set(0, floorY + doorH + lintelH / 2, frontZ);
      g.add(lintel);
    }

    // 二层腰檐分隔（若两层）
    if (twoStory) {
      var band = ctx.uvBox(w + 0.14, 0.14, d + 0.14, 'woodDark', 0.5, 0.5);
      band.position.set(0, floorY + wallH * 0.48, 0);
      g.add(band);
    }

    /* ---------------- 马头墙（两侧山墙，阶梯式） ---------------- */
    var mwH = wallH + roofH + rng.range(0.55, 0.9);
    for (var m = -1; m <= 1; m += 2) {
      var mw = ctx.horseWall({
        len: d + 0.5,
        height: mwH,
        steps: rng.int(2, 3),
        thick: 0.26,
        mat: 'plasterGrey',
        drop: 0.30
      });
      mw.position.set(m * (w / 2 + 0.12), floorY, 0);
      g.add(mw);
    }

    /* ---------------- 屋面 ---------------- */
    var roof = ctx.roofGable({
      w: w + 0.7,
      d: d + 0.7,
      h: roofH,
      over: over,
      curve: 0.20,
      lift: 0.30,
      tileRows: Math.round(w / 0.36),
      ridge: true,
      ridgeOrn: rng.chance(0.5),
      mat: roofMat
    });
    roof.position.set(0, floorY + wallH, 0);
    g.add(roof);

    /* ---------------- 门 ---------------- */
    var door = ctx.door({
      w: doorW,
      h: doorH,
      double: true,
      studs: rng.chance(0.6),
      mat: rng.pick(['woodDark', 'wood', 'woodRed']),
      frame: 'stoneDark',
      canopy: rng.chance(0.75)
    });
    door.position.set(0, floorY, d / 2 - t + 0.02);
    g.add(door);

    // 门内暗部（透过门看到堂屋）
    var interior = ctx.box(innerW * 0.96, doorH * 0.9, 0.05, 'woodBlack', 0, floorY + doorH * 0.45, d / 2 - t - 0.25);
    g.add(interior);

    // 门槛石与门枕石
    var sill = ctx.uvBox(doorW + 0.3, 0.14, 0.34, 'stoneDark', 0.5, 0.5);
    sill.position.set(0, floorY + 0.07, d / 2 + 0.02);
    g.add(sill);
    for (var ds = -1; ds <= 1; ds += 2) {
      var drum = ctx.cyl(0.15, 0.17, 0.3, 8, 'stoneLight', ds * (doorW / 2 + 0.14), floorY + 0.15, d / 2 + 0.04);
      g.add(drum);
    }

    // 门前石阶
    var steps = ctx.steps({ w: doorW + 0.7, n: stepsN, rise: 0.15, run: 0.30, mat: 'stone' });
    steps.position.set(0, 0, d / 2 + 0.55);
    g.add(steps);

    /* ---------------- 花窗 ---------------- */
    var winY = floorY + wallH * (twoStory ? 0.72 : 0.56);
    // 前墙两侧各一樘
    for (var wx = -1; wx <= 1; wx += 2) {
      if (sidePanelW < 0.7) continue;
      var win = ctx.lattice({
        w: Math.min(0.95, sidePanelW * 0.62),
        h: Math.min(1.05, wallH * 0.3),
        cols: rng.int(3, 4),
        rows: rng.int(3, 4),
        style: rng.pick(['grid', 'grid', 'step']),
        paper: rng.chance(0.18) ? 'paperLit' : 'paper',
        frame: 'woodDark',
        rng: rng
      });
      win.position.set(wx * (doorW / 2 + sidePanelW / 2), winY, frontZ + t / 2 + 0.02);
      g.add(win);
      // 窗套
      var frame = ctx.uvBox(Math.min(0.95, sidePanelW * 0.62) + 0.16, 0.07, 0.14, 'stoneLight', 0.4, 0.4);
      frame.position.set(win.position.x, winY - Math.min(1.05, wallH * 0.3) / 2 - 0.06, frontZ + t / 2);
      g.add(frame);
    }
    // 侧墙小窗
    for (var sx = -1; sx <= 1; sx += 2) {
      if (!rng.chance(0.7)) continue;
      var swin = ctx.lattice({
        w: 0.8, h: 0.9, cols: 3, rows: 3,
        style: 'grid', paper: 'paper', frame: 'woodDark', rng: rng
      });
      swin.position.set(sx * (w / 2 + 0.02), winY, rng.range(-d / 4, d / 4));
      swin.rotation.y = sx * Math.PI / 2;
      g.add(swin);
    }

    /* ---------------- 檐下木作 ---------------- */
    var eaveY = floorY + wallH - 0.1;
    // 额枋
    var fang = ctx.uvBox(w + 0.5, 0.16, 0.12, 'woodDark', 0.5, 0.5);
    fang.position.set(0, eaveY - 0.28, d / 2 + 0.06);
    g.add(fang);
    // 檐柱 2~4 根
    var nCol = rng.int(2, 3);
    for (var ci = 0; ci <= nCol; ci++) {
      var cx = -w / 2 + 0.12 + (w - 0.24) * ci / nCol;
      if (Math.abs(cx) < doorW / 2 + 0.12) continue;
      var col = ctx.cyl(0.075, 0.085, wallH - 0.1, 8, 'wood', cx, floorY + (wallH - 0.1) / 2, d / 2 + 0.1);
      g.add(col);
      // 柱础
      var cb = ctx.lathe([[0.02, 0], [0.13, 0], [0.14, 0.08], [0.11, 0.14], [0.09, 0.16]], 10, 'stoneLight');
      cb.position.set(cx, floorY, d / 2 + 0.1);
      g.add(cb);
      // 雀替
      var qd = ctx.box(0.26, 0.12, 0.07, 'woodDark', cx + (cx < 0 ? 0.2 : -0.2), eaveY - 0.42, d / 2 + 0.1);
      g.add(qd);
    }
    // 挂落（檐下细木条）
    var gua = ctx.uvBox(w * 0.8, 0.06, 0.05, 'woodDark', 0.5, 0.5);
    gua.position.set(0, eaveY - 0.55, d / 2 + 0.06);
    g.add(gua);
    for (var gi = 0; gi < Math.round(w * 3); gi++) {
      var gx = -w * 0.4 + (w * 0.8) * gi / Math.max(1, Math.round(w * 3));
      var gbar = ctx.box(0.025, 0.14, 0.03, 'woodDark', gx, eaveY - 0.62, d / 2 + 0.06);
      g.add(gbar);
    }

    /* ---------------- 生活细节 ---------------- */
    // 水缸
    if (rng.chance(0.55)) {
      var jar = ctx.jar({ r: rng.range(0.24, 0.3), h: rng.range(0.5, 0.62), mat: 'woodBlack' });
      jar.position.set(rng.sign() * (w / 2 - 0.35), floorY, d / 2 + rng.range(0.18, 0.3));
      g.add(jar);
    }
    // 灯笼
    if (rng.chance(0.5)) {
      var lan = ctx.lantern({ r: 0.16, h: 0.3, mat: 'lantern', string: 0.25, light: false });
      lan.position.set(rng.sign() * (doorW / 2 + 0.2), floorY + doorH + 0.22, d / 2 + 0.18);
      g.add(lan);
    }
    // 墙根青苔与草
    for (var mi = 0; mi < rng.int(2, 4); mi++) {
      var mg = ctx.grass({ n: 4, h: rng.range(0.18, 0.3), mat: rng.pick(['leafLight', 'hedge']), seed: mi });
      mg.position.set(rng.range(-w / 2 + 0.2, w / 2 - 0.2), floorY, (rng.chance(0.5) ? 1 : -1) * (d / 2 + 0.06));
      g.add(mg);
    }
    // 墙根苔斑
    for (var ms = 0; ms < rng.int(2, 3); ms++) {
      var moss = ctx.box(rng.range(0.2, 0.5), 0.02, rng.range(0.06, 0.12), 'hedge',
        rng.range(-w / 2 + 0.3, w / 2 - 0.3), floorY + 0.01, -d / 2 + 0.08);
      g.add(moss);
    }
    // 柴堆
    if (rng.chance(0.35)) {
      var pile = new THREE.Group();
      for (var pi = 0; pi < 9; pi++) {
        var log = ctx.cyl(rng.range(0.035, 0.06), rng.range(0.04, 0.065), rng.range(0.5, 0.8), 5, 'woodDark',
          rng.range(-0.25, 0.25), 0.05 + Math.floor(pi / 3) * 0.1, rng.range(-0.1, 0.1));
        log.rotation.z = Math.PI / 2 + rng.range(-0.05, 0.05);
        pile.add(log);
      }
      pile.position.set(-w / 2 + 0.3, floorY, -d / 2 - 0.25);
      g.add(pile);
    }

    /* ---------------- userData ---------------- */
    g.userData = {
      w: w + 0.5,
      d: d + 0.5,
      h: floorY + wallH + roofH,
      door: { x: 0, z: d / 2 },
      kind: 'house',
      twoStory: twoStory
    };
    return g;
  };
})();
