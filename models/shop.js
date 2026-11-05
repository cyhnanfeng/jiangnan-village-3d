/* models/shop.js —— 临水商铺 / 茶楼
 * 两层：一层开敞店面 + 柜台 + 招牌；二层挑台 + 美人靠 + 格窗
 * 原点在地面中心、y=0，店门朝 +Z
 */
(function () {
  'use strict';
  var JN = window.JN;

  JN.models['shop'] = function (ctx) {
    var rng = ctx.rng;
    var g = new THREE.Group();

    var opts = ctx.opts || {};
    var w = opts.w ? Math.max(3.2, Math.min(4.8, opts.w)) : rng.pick([3.6, 4.0, 4.2, 4.6]);
    var d = opts.d ? Math.max(2.8, Math.min(4.2, opts.d)) : rng.pick([3.2, 3.4, 3.8]);
    var h1 = rng.range(2.7, 3.1);
    var h2 = rng.range(2.4, 2.8);
    var plinthH = rng.range(0.32, 0.45);
    var t = 0.20;

    /* 台基 */
    var base = ctx.uvBox(w + 0.4, plinthH, d + 0.4, 'stoneDark', 0.55, 0.55);
    base.position.y = plinthH / 2;
    g.add(base);
    var baseTop = ctx.uvBox(w + 0.5, 0.06, d + 0.5, 'stoneLight', 0.6, 0.6);
    baseTop.position.y = plinthH + 0.02;
    g.add(baseTop);
    var floorY = plinthH + 0.05;

    /* 后墙与两侧山墙（到二层顶） */
    var totalH = h1 + h2;
    var back = ctx.uvBox(w, totalH, t, 'plaster', 0.4, 0.4);
    back.position.set(0, floorY + totalH / 2, -d / 2 + t / 2);
    g.add(back);
    for (var s = -1; s <= 1; s += 2) {
      var side = ctx.uvBox(t, totalH, d, 'plasterWarm', 0.4, 0.4);
      side.position.set(s * (w / 2 - t / 2), floorY + totalH / 2, 0);
      g.add(side);
      // 马头墙
      var mw = ctx.horseWall({
        len: d + 0.4, height: totalH + rng.range(0.7, 1.1),
        steps: 3, thick: 0.24, mat: 'plasterGrey', drop: 0.3
      });
      mw.position.set(s * (w / 2 + 0.1), floorY, 0);
      g.add(mw);
    }

    /* 一层：开敞店面 */
    // 一层前檐柱
    var nCol = 3;
    for (var ci = 0; ci <= nCol; ci++) {
      var cx = -w / 2 + 0.12 + (w - 0.24) * ci / nCol;
      var col = ctx.cyl(0.09, 0.1, h1, 10, 'wood', cx, floorY + h1 / 2, d / 2 + 0.06);
      g.add(col);
      var cb = ctx.lathe([[0.02, 0], [0.16, 0], [0.17, 0.09], [0.13, 0.16], [0.1, 0.18]], 10, 'stoneLight');
      cb.position.set(cx, floorY, d / 2 + 0.06);
      g.add(cb);
    }
    // 一层额枋（承二层挑台）
    var beam1 = ctx.uvBox(w + 0.3, 0.22, 0.16, 'woodDark', 0.5, 0.5);
    beam1.position.set(0, floorY + h1 - 0.11, d / 2 + 0.06);
    g.add(beam1);

    // 排门板：部分关闭（木门板），部分敞开
    var panels = 6;
    var closed = [0, 1, 1, 0, 0, 1];
    for (var pi = 0; pi < panels; pi++) {
      var pw = (w - 0.3) / panels;
      var px = -w / 2 + 0.15 + pw * (pi + 0.5);
      if (closed[pi % closed.length]) {
        var leaf = ctx.uvBox(pw - 0.02, h1 - 0.25, 0.06, 'woodDark', 0.5, 0.5);
        leaf.position.set(px, floorY + (h1 - 0.25) / 2, d / 2 - 0.02);
        g.add(leaf);
        // 门板上的横档
        for (var r = 0; r < 3; r++) {
          var rail = ctx.box(pw - 0.06, 0.035, 0.02, 'woodBlack', px, floorY + 0.3 + r * (h1 - 0.6) / 2, d / 2 + 0.02);
          g.add(rail);
        }
      }
    }
    // 店内暗部 + 货架
    var dark = ctx.box(w - 0.4, h1 - 0.2, 0.06, 'woodBlack', 0, floorY + (h1 - 0.2) / 2, d / 2 - 0.35);
    g.add(dark);
    // 柜台
    var counter = ctx.uvBox(w * 0.62, 0.9, 0.5, 'wood', 0.5, 0.5);
    counter.position.set(-w * 0.1, floorY + 0.45, d / 2 - 0.75);
    g.add(counter);
    var counterTop = ctx.uvBox(w * 0.66, 0.08, 0.6, 'woodDark', 0.5, 0.5);
    counterTop.position.set(-w * 0.1, floorY + 0.94, d / 2 - 0.75);
    g.add(counterTop);
    // 柜台上的货品
    for (var gi = 0; gi < rng.int(3, 5); gi++) {
      var jx = -w * 0.35 + rng.range(0, w * 0.5);
      var jar = ctx.jar({ r: rng.range(0.08, 0.14), h: rng.range(0.16, 0.26), mat: rng.pick(['woodBlack', 'woodRed', 'bronze']) });
      jar.position.set(jx, floorY + 0.98, d / 2 - 0.75 + rng.range(-0.15, 0.15));
      g.add(jar);
    }
    // 货架（后墙）
    for (var sh = 0; sh < 2; sh++) {
      var shelf = ctx.box(w * 0.7, 0.05, 0.32, 'wood', 0, floorY + 0.8 + sh * 0.7, -d / 2 + 0.5);
      g.add(shelf);
    }

    /* 招牌（挑出横梁） */
    var signBeam = ctx.box(0.08, 0.08, 0.9, 'woodDark', w * 0.35, floorY + h1 + 0.15, d / 2 + 0.45);
    g.add(signBeam);
    var sign = ctx.plaque({
      text: rng.pick(['茶', '酒', '米行', '南货', '药铺', '布庄']),
      w: 0.72, h: 0.34, bg: '#2b2520', fg: '#d9b96a', frame: 'woodBlack'
    });
    sign.position.set(w * 0.35, floorY + h1 - 0.1, d / 2 + 0.85);
    g.add(sign);
    // 招牌下的幌子
    if (rng.chance(0.7)) {
      var banner = ctx.banner({ w: 0.34, h: 0.9, mat: 'clothWhite', pole: 1.2 });
      banner.position.set(w * 0.35 - 0.5, floorY + h1 - 0.05, d / 2 + 0.55);
      g.add(banner);
    }

    /* 二层挑台 */
    var deckDepth = rng.range(0.5, 0.75);
    var deck = ctx.uvBox(w + 0.1, 0.12, deckDepth, 'wood', 0.5, 0.5);
    deck.position.set(0, floorY + h1 + 0.06, d / 2 + deckDepth / 2 - 0.02);
    g.add(deck);
    // 挑台斜撑（牛腿）
    for (var bi = 0; bi < 4; bi++) {
      var bx = -w / 2 + 0.4 + (w - 0.8) * bi / 3;
      var brace = ctx.box(0.08, 0.08, 0.9, 'woodDark', bx, floorY + h1 - 0.4, d / 2 + 0.28);
      brace.rotation.x = 0.75;
      g.add(brace);
    }
    // 美人靠栏杆
    var rail = ctx.woodRailing({ len: w, h: 0.62, mat: 'woodDark' });
    rail.position.set(0, floorY + h1 + 0.12, d / 2 + deckDepth - 0.08);
    g.add(rail);
    // 靠背斜板
    var backBoard = ctx.box(w, 0.06, 0.5, 'wood', 0, floorY + h1 + 0.55, d / 2 + deckDepth - 0.3);
    backBoard.rotation.x = -0.5;
    g.add(backBoard);

    /* 二层立面：格窗（一半开一半闭） */
    var winY = floorY + h1 + h2 * 0.55;
    var nWin = 3;
    for (var wi = 0; wi < nWin; wi++) {
      var wx = -w / 2 + (w / nWin) * (wi + 0.5);
      var open = (wi % 2 === 0);
      if (open) {
        var win = ctx.lattice({
          w: w / nWin * 0.7, h: h2 * 0.52, cols: 4, rows: 4,
          style: 'grid', paper: rng.chance(0.3) ? 'paperLit' : 'paper', frame: 'woodDark', rng: rng
        });
        win.position.set(wx, winY, d / 2 + 0.02);
        g.add(win);
      } else {
        var sh2 = ctx.uvBox(w / nWin * 0.75, h2 * 0.55, 0.07, 'woodDark', 0.5, 0.5);
        sh2.position.set(wx, winY, d / 2 + 0.01);
        g.add(sh2);
      }
      // 窗下挂落
      var gua = ctx.box(w / nWin * 0.8, 0.05, 0.05, 'woodDark', wx, winY - h2 * 0.3, d / 2 + 0.06);
      g.add(gua);
    }

    /* 屋面：一层腰檐 + 主屋顶 */
    var shed = ctx.shedRoof({ w: w + 0.6, d: 0.9, h: 0.3, mat: 'tile', lift: 0.15 });
    shed.position.set(0, floorY + h1 + 0.02, d / 2 + 0.02);
    g.add(shed);

    var roof = ctx.roofGable({
      w: w + 0.75, d: d + 0.75, h: rng.range(1.0, 1.3),
      over: rng.range(0.45, 0.6), curve: 0.2, lift: 0.3,
      tileRows: Math.round(w / 0.36), ridge: true, mat: 'tile'
    });
    roof.position.set(0, floorY + totalH, 0);
    g.add(roof);

    /* 生活气 */
    // 灯笼
    for (var li = 0; li < 2; li++) {
      var lan = ctx.lantern({ r: 0.17, h: 0.32, mat: 'lantern', string: 0.22, light: false });
      lan.position.set((li ? 1 : -1) * (w / 2 - 0.35), floorY + h1 + 0.5, d / 2 + 0.35);
      g.add(lan);
    }
    // 条凳
    for (var bi2 = 0; bi2 < 2; bi2++) {
      var bench = new THREE.Group();
      var seat = ctx.box(1.0, 0.06, 0.26, 'wood', 0, 0.42, 0);
      bench.add(seat);
      for (var leg = -1; leg <= 1; leg += 2) {
        bench.add(ctx.box(0.06, 0.42, 0.2, 'woodDark', leg * 0.4, 0.21, 0));
      }
      bench.position.set((bi2 ? 1 : -1) * (w / 2 - 0.9), floorY, d / 2 + rng.range(0.5, 0.9));
      g.add(bench);
    }
    // 竹筐、水缸
    var basket = ctx.cyl(0.18, 0.14, 0.24, 10, 'bamboo', w / 2 - 0.4, floorY + 0.12, d / 2 + 0.6);
    g.add(basket);
    if (rng.chance(0.6)) {
      var jar2 = ctx.jar({ r: 0.24, h: 0.5, mat: 'woodBlack' });
      jar2.position.set(-w / 2 + 0.4, floorY, d / 2 + 0.55);
      g.add(jar2);
    }
    // 台阶
    var steps = ctx.steps({ w: w * 0.5, n: 2, rise: 0.13, run: 0.28, mat: 'stone' });
    steps.position.set(0, 0, d / 2 + 0.5);
    g.add(steps);
    // 门槛
    var sill = ctx.uvBox(w * 0.7, 0.12, 0.3, 'stoneDark', 0.5, 0.5);
    sill.position.set(0, floorY + 0.06, d / 2 + 0.04);
    g.add(sill);

    g.userData = {
      w: w + 0.5,
      d: d + 0.8,
      h: floorY + totalH + 1.2,
      door: { x: 0, z: d / 2 },
      kind: 'shop'
    };
    return g;
  };
})();
