/* models/bridge.js —— 单孔石拱桥
 * 通行方向沿本地 X 轴，桥宽沿 Z；y=0 为水面标高，桥台底贴 0，拱从 0 起拱
 */
(function () {
  'use strict';
  var JN = window.JN;

  JN.models['bridge'] = function (ctx) {
    var rng = ctx.rng;
    var g = new THREE.Group();

    var span = rng.range(4.4, 6.6);
    var deckW = rng.range(1.9, 2.5);
    var rise = rng.range(1.5, 2.1);
    var deckTop = rise + rng.range(0.6, 0.9);
    var R = rise;
    var ringThick = rng.range(0.3, 0.38);
    var sideOver = rng.range(0.6, 0.9);
    var totalLen = span + sideOver * 2;
    var deckHalf = totalLen / 2;

    function deckY(x) {
      var t = Math.min(1, Math.abs(x) / deckHalf);
      return deckTop - (deckTop - 0.42) * Math.pow(t, 1.75);
    }

    /* ---------------- 拱券 ---------------- */
    var nStone = rng.int(15, 21);
    for (var s = 0; s < nStone; s++) {
      var a0 = Math.PI * (s / nStone), a1 = Math.PI * ((s + 1) / nStone);
      var am = (a0 + a1) / 2;
      var segL = (R + ringThick / 2) * (a1 - a0) * 0.92;
      var stone = ctx.uvBox(ringThick, segL, deckW + 0.16, s % 2 ? 'stone' : 'stoneLight', 0.6, 0.6);
      stone.position.set(Math.cos(am) * (R + ringThick / 2), Math.sin(am) * (R + ringThick / 2), 0);
      stone.rotation.z = am - Math.PI / 2;
      g.add(stone);
    }
    // 券脸石（两侧各一圈，略外凸）
    for (var f = -1; f <= 1; f += 2) {
      for (var s2 = 0; s2 < nStone; s2++) {
        var a0c = Math.PI * (s2 / nStone), a1c = Math.PI * ((s2 + 1) / nStone);
        var amc = (a0c + a1c) / 2;
        var segL2 = (R + ringThick) * (a1c - a0c) * 0.9;
        var face = ctx.uvBox(0.1, segL2, 0.08, 'stoneLight', 0.4, 0.4);
        face.position.set(Math.cos(amc) * (R + ringThick * 0.55), Math.sin(amc) * (R + ringThick * 0.55), f * (deckW / 2 + 0.1));
        face.rotation.z = amc - Math.PI / 2;
        g.add(face);
      }
    }

    /* ---------------- 桥台（拱脚外侧的实心石砌体，顶面贴合桥面） ---------------- */
    for (var side = -1; side <= 1; side += 2) {
      var xIn = side * (R + ringThick);       // 内侧起点
      var xOut = side * deckHalf;             // 外侧桥头
      var abutW = Math.abs(xOut - xIn);
      var xMid = (xIn + xOut) / 2;
      // 分 6 层错缝条石，层高按桥面高度递减
      for (var lay = 0; lay < 6; lay++) {
        var lh = deckTop / 6;
        var y0 = lay * lh;
        var topY = Math.min(deckY(xMid) - 0.1, deckTop);
        var blkH = Math.min(lh * 0.94, topY - y0);
        if (blkH < 0.04) continue;
        var bw = abutW * (0.99 - lay * 0.005);
        var ab = ctx.uvBox(bw, blkH, deckW + 0.14, lay % 2 ? 'stoneDark' : 'stone', 0.55, 0.55);
        ab.position.set(xMid, y0 + blkH / 2, 0);
        g.add(ab);
      }
      // 桥头护墙（岸台），从桥面斜落到地面
      var headH = deckY(deckHalf - 0.2);
      var head = ctx.uvBox(sideOver + 0.3, headH, deckW + 0.3, 'stone', 0.55, 0.55);
      head.position.set(side * (deckHalf - sideOver / 2), headH / 2, 0);
      g.add(head);
      // 分水尖（迎水三角墩，落在拱脚处）
      var noseH = Math.min(0.9, rise * 0.6);
      var nose = new THREE.Mesh(new THREE.ConeGeometry(deckW * 0.4, 1.0, 4), ctx.mat('stoneDark'));
      nose.position.set(side * (R + ringThick + 0.15), noseH / 2 - 0.1, 0);
      nose.rotation.y = Math.PI / 4;
      nose.scale.y = noseH;
      nose.scale.z = 0.85;
      g.add(nose);
      var cap = ctx.uvBox(0.5, 0.12, 0.5, 'stoneLight', 0.5, 0.5);
      cap.position.set(side * (R + ringThick + 0.15), noseH - 0.02, 0);
      g.add(cap);
    }

    /* ---------------- 桥面（放样曲面 + 逐块石板） ---------------- */
    var deckMesh = ctx.surface(30, 4, function (u, v) {
      var x = (u - 0.5) * totalLen;
      var z = (v - 0.5) * deckW;
      return [x, deckY(x) - 0.05, z, u * totalLen * 1.2, v * deckW * 1.2];
    }, 'stone');
    g.add(deckMesh);

    var nSlab = Math.max(12, Math.round(totalLen / 0.40));
    for (var sl = 0; sl < nSlab; sl++) {
      var sx = -deckHalf + (sl + 0.5) * (totalLen / nSlab);
      var sw = totalLen / nSlab * 0.92;
      var sy = deckY(sx);
      var slab = ctx.uvBox(sw, 0.1, deckW, sl % 3 === 0 ? 'stoneLight' : 'stone', 0.5, 0.5);
      slab.position.set(sx, sy - 0.02, 0);
      var slope = (deckY(sx + 0.1) - deckY(sx - 0.1)) / 0.2;
      slab.rotation.z = Math.atan(slope);
      g.add(slab);
    }
    // 桥心石
    var heart = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16), ctx.mat('stoneLight'));
    heart.position.set(0, deckTop + 0.04, 0);
    g.add(heart);
    var ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.028, 6, 20), ctx.mat('stoneDark'));
    ring2.position.set(0, deckTop + 0.085, 0);
    ring2.rotation.x = -Math.PI / 2;
    g.add(ring2);

    /* ---------------- 栏杆（沿桥面曲线逐段贴合） ---------------- */
    for (var rz = -1; rz <= 1; rz += 2) {
      var zPos = rz * (deckW / 2 - 0.05);
      var nPost = Math.max(8, Math.round(totalLen / 0.75));
      for (var p = 0; p <= nPost; p++) {
        var px = -deckHalf + 0.15 + (totalLen - 0.3) * p / nPost;
        var py = deckY(px);
        var post = ctx.uvBox(0.1, 0.72, 0.1, 'stoneLight', 0.4, 0.4);
        post.position.set(px, py + 0.36, zPos);
        g.add(post);
        // 柱头
        var capHead = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), ctx.mat('stoneLight'));
        capHead.position.set(px, py + 0.72, zPos);
        g.add(capHead);
        // 栏板（连接下一根）
        if (p < nPost) {
          var nx = -deckHalf + 0.15 + (totalLen - 0.3) * (p + 1) / nPost;
          var ny = deckY(nx);
          var plen = Math.hypot(nx - px, ny - py);
          var panel = ctx.uvBox(plen - 0.06, 0.44, 0.06, 'stoneLight', 0.4, 0.4);
          panel.position.set((px + nx) / 2, (py + ny) / 2 + 0.42, zPos);
          panel.rotation.z = Math.atan2(ny - py, nx - px);
          g.add(panel);
        }
      }
      // 端头抱鼓石
      for (var e = -1; e <= 1; e += 2) {
        var ex = e * (deckHalf - 0.25);
        var ey = deckY(ex);
        var drum = ctx.cyl(0.17, 0.2, 0.28, 10, 'stoneLight', ex, ey + 0.1, zPos);
        drum.rotation.z = Math.PI / 2;
        g.add(drum);
      }
    }

    /* ---------------- 细节 ---------------- */
    for (var m = 0; m < 5; m++) {
      var moss = ctx.box(rng.range(0.25, 0.5), 0.02, rng.range(0.08, 0.16), 'hedge',
        rng.range(-R, R), rng.range(0.2, 0.8), (rng.chance(0.5) ? 1 : -1) * (deckW / 2 + 0.08));
      g.add(moss);
    }
    var wet = ctx.box(R * 1.5, 0.3, 0.03, 'stoneWet', 0, 0.16, deckW / 2 + 0.09);
    g.add(wet);
    var wet2 = wet.clone(); wet2.position.z = -deckW / 2 - 0.09; g.add(wet2);

    for (var q = 0; q < 3; q++) {
      var tuft = ctx.grass({ n: 5, h: rng.range(0.18, 0.32), mat: rng.pick(['leafLight', 'hedge']), seed: q });
      tuft.position.set((q - 1) * rng.range(1.4, 2.4), 0.02, rng.pick([-1, 1]) * (deckW / 2 + rng.range(0.3, 0.7)));
      g.add(tuft);
    }
    for (var rq = 0; rq < 2; rq++) {
      var rock = ctx.rock({ r: rng.range(0.16, 0.28), seed: rq * 3 + 1, mat: 'stoneDark' });
      rock.position.set(rng.pick([-1, 1]) * rng.range(R + 0.3, R + 0.9), 0.03, rng.range(-deckW, deckW));
      g.add(rock);
    }

    g.userData = {
      w: totalLen,
      d: deckW + 0.3,
      h: deckTop + 0.85,
      kind: 'bridge',
      axis: 'x'
    };
    return g;
  };
})();
