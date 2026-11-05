/**
 * models/_smoke.js — 工具库冒烟测试（正式构建会排除以 _ 开头的文件）
 */
(function () {
  'use strict';
  var JN = window.JN;
  JN.models['_smoke'] = function (ctx) {
    var g = new THREE.Group();
    var h = ctx.roofGable({ w: 4, d: 4, h: 1.4 });
    h.position.y = 3.2;
    g.add(h);
    var hip = ctx.roofHip({ w: 3, d: 3, h: 1.2 });
    hip.position.set(6, 3, 0);
    g.add(hip);
    var mw = ctx.horseWall({ len: 6, height: 4.4, steps: 3 });
    mw.position.set(-6, 0, 0);
    g.add(mw);
    var lat = ctx.lattice({ w: 1.2, h: 1.4, style: 'ice' });
    lat.position.set(0, 2, 2);
    g.add(lat);
    var d = ctx.door({ w: 1.1, h: 2.1, studs: true });
    d.position.set(0, 0, 2);
    g.add(d);
    var l = ctx.lantern({ r: 0.22 });
    l.position.set(-3, 2.6, 0);
    g.add(l);
    var t = ctx.trunk({ h: 3, r: 0.2, bend: 0.3 });
    t.position.set(3, 0, -3);
    g.add(t);
    var b = ctx.blob({ r: 0.9 });
    b.position.set(3, 3, -3);
    g.add(b);
    var p = ctx.plinth({ w: 3, d: 3, h: 0.4 });
    p.position.y = 0;
    g.add(p);
    g.userData = { w: 8, d: 8, h: 4 };
    return g;
  };
})();
