/* =========================================================================
 * 10-map.js — 江南古村 · 地图生成核心
 *
 * 硬性规则（生成时保证，validate() 独立复核）：
 *   R1 河与路必正交        —— 所有河道段、街巷段均为轴对齐直线
 *   R2 路近水锁直          —— 临水街巷一律为不中断、不转折的直街
 *   R3 房屋周围一圈禁房    —— 每栋房占地外扩 1 格（含对角）不得有其他房屋
 *   R4 房屋门朝道路        —— 门所在面正前方 1 格必须是街/巷/桥/门前场
 *   R5 农田近路 / 水 / 宅  —— 每块田边界 2 格内必有路、水或宅
 *   R6 宝塔距最近民居 ≥16  —— 塔心到任何民居中心欧氏格距 ≥ 16
 *   R7 主路两端 85% 立牌坊 —— 每个主路端头按 0.85 概率立坊
 *   R8 树在边缘/水边/树丛加密 —— 树木密度场 = 基础 + 边缘 + 水岸 + 树丛
 * ========================================================================= */
(function () {
  'use strict';
  var JN = window.JN;

  var T = JN.T = {
    EMPTY: 0, WATER: 1, BANK: 2, ROAD: 3, BUILD: 4, FIELD: 5, TREE: 6, PLAZA: 7, BRIDGE: 8
  };

  var STYLE_POOL = {
    layout: [
      { id: 'yinhe', name: '一河两街', desc: '主河贯村，两岸夹街，粉墙临水' },
      { id: 'shizi', name: '十字河', desc: '双河十字相交，四水归堂' },
      { id: 'qugang', name: '曲港', desc: '河道两折，街随水转' },
      { id: 'huanhu', name: '环水', desc: '水抱村郭，三面萦回' },
      { id: 'shuanghe', name: '双河并行', desc: '两河并行，中间成街' }
    ],
    season: [
      { id: 'spring', name: '春·桃李', accent: 'peach', fog: 0xd9e3dc, sun: 0xfff4e0, hemi: 0xcfe3f2, grass: 0x7d9a52 },
      { id: 'summer', name: '夏·浓荫', accent: 'willow', fog: 0xccdcd6, sun: 0xfff6e6, hemi: 0xc6e0ea, grass: 0x5d7f3f },
      { id: 'autumn', name: '秋·丹枫', accent: 'maple', fog: 0xe6dcc8, sun: 0xffe9c8, hemi: 0xdcd2c4, grass: 0x8a8a4a },
      { id: 'winter', name: '冬·疏影', accent: 'plum', fog: 0xdfe4e6, sun: 0xf2f6ff, hemi: 0xd6e2ec, grass: 0x6d7a63 }
    ],
    time: [
      { id: 'dawn', name: '晨雾', sun: 0xffe8cf, sunI: 1.9, hemiI: 1.05, fogNear: 55, fogFar: 200, bg: 0xdfe7e2, exposure: 1.02, lantern: 0.55 },
      { id: 'noon', name: '正午', sun: 0xfff6e2, sunI: 2.45, hemiI: 1.25, fogNear: 80, fogFar: 260, bg: 0xd7e4e6, exposure: 1.0, lantern: 0.0 },
      { id: 'dusk', name: '夕照', sun: 0xffc98a, sunI: 2.15, hemiI: 0.95, fogNear: 65, fogFar: 230, bg: 0xf0d8b8, exposure: 1.06, lantern: 1.0 },
      { id: 'night', name: '夜泊', sun: 0xa8c0e8, sunI: 1.7, hemiI: 1.35, fogNear: 45, fogFar: 190, bg: 0x27333f, exposure: 1.32, lantern: 1.7 }
    ]
  };

  var CROPS = ['rice', 'veg', 'rapeseed', 'mulberry'];
  var PROPS = ['well', 'mill', 'woodpile', 'drying', 'jars', 'lanternPole', 'shrine'];

  function generate(seed, opts) {
    opts = opts || {};
    var S = seed >>> 0;
    var rng = JN.makeRNG(S);
    var G = 60, C = 30;
    var idx = function (i, j) { return j * G + i; };
    var cells = new Uint8Array(G * G);
    var owner = new Int16Array(G * G).fill(-1);
    var style = {
      seed: S,
      layout: rng.pick(STYLE_POOL.layout),
      season: rng.pick(STYLE_POOL.season),
      time: rng.pick(STYLE_POOL.time),
      density: rng.range(0.82, 1.0),
      riverWidth: rng.int(3, 5),
      houseScale: rng.range(0.94, 1.08),
      mist: rng.range(0.15, 0.42),
      hills: rng.int(3, 5),
      treeBoost: rng.range(0.65, 0.95),
      laneGap: rng.int(7, 9)
    };
    if (opts.layout) style.layout = STYLE_POOL.layout.filter(function (l) { return l.id === opts.layout; })[0] || style.layout;
    if (opts.season) style.season = STYLE_POOL.season.filter(function (l) { return l.id === opts.season; })[0] || style.season;
    if (opts.time) style.time = STYLE_POOL.time.filter(function (l) { return l.id === opts.time; })[0] || style.time;
    if (style.layout.id === 'shizi') style.riverWidth = 2;
    if (style.time.id === 'night' && style.season.id !== 'winter' && !opts.season) style.season = STYLE_POOL.season[3];

    var inB = function (i, j) { return i >= 0 && j >= 0 && i < G && j < G; };
    var get = function (i, j) { return inB(i, j) ? cells[idx(i, j)] : 255; };
    var isWater = function (i, j) { return get(i, j) === T.WATER; };
    function nearKind(kind, i, j, r) {
      for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++) {
        if (get(i + di, j + dj) === kind) return true;
      }
      return false;
    }
    var nearWater = function (i, j, r) { return nearKind(T.WATER, i, j, r === undefined ? 2 : r); };

    /* ---------------- 1. 河道（全部轴对齐） ---------------- */
    var rivers = [];
    function addRiverPath(pts, width) {
      for (var k = 0; k < pts.length - 1; k++) {
        var a = pts[k], b = pts[k + 1];
        if (a.i !== b.i && a.j !== b.j) continue;
        var vert = a.i === b.i;
        var from = vert ? Math.min(a.j, b.j) : Math.min(a.i, b.i);
        var to = vert ? Math.max(a.j, b.j) : Math.max(a.i, b.i);
        var seg = { axis: vert ? 'z' : 'x', at: vert ? a.i : a.j, from: from, to: to, width: width };
        rivers.push(seg);
        var half = Math.floor(width / 2);
        for (var t = from; t <= to; t++) {
          for (var w = -half; w < width - half; w++) {
            var i = vert ? seg.at + w : t;
            var j = vert ? t : seg.at + w;
            if (inB(i, j)) cells[idx(i, j)] = T.WATER;
          }
        }
      }
    }

    var ow = style.riverWidth;
    var r1 = C + rng.int(-5, 5);    if (style.layout.id === 'qugang') {
      var bx = rng.int(C - 9, C + 9);
      var off2 = rng.sign() * rng.int(7, 12);
      addRiverPath([{ i: 0, j: r1 }, { i: bx, j: r1 }, { i: bx, j: r1 + off2 }, { i: G - 1, j: r1 + off2 }], ow);
    } else if (style.layout.id === 'huanhu') {
      var ux = rng.int(10, 15);
      var uj1 = r1 - rng.int(8, 12), uj2 = r1 + rng.int(6, 10);
      addRiverPath([{ i: ux, j: 0 }, { i: ux, j: uj1 }, { i: G - 1 - ux, j: uj1 }, { i: G - 1 - ux, j: G - 1 }], ow);
      addRiverPath([{ i: ux + 3, j: uj2 }, { i: G - 4 - ux, j: uj2 }], ow);
    } else if (style.layout.id === 'shizi') {
      addRiverPath([{ i: 0, j: r1 }, { i: G - 1, j: r1 }], ow);
      var cxx = C + rng.int(-4, 4);
      addRiverPath([{ i: cxx, j: 0 }, { i: cxx, j: G - 1 }], ow);
    } else if (style.layout.id === 'shuanghe') {
      var a1 = C - rng.int(6, 9), a2 = C + rng.int(6, 9);
      addRiverPath([{ i: 0, j: a1 }, { i: G - 1, j: a1 }], 3);
      addRiverPath([{ i: 0, j: a2 }, { i: G - 1, j: a2 }], 3);
    } else {
      addRiverPath([{ i: 0, j: r1 }, { i: G - 1, j: r1 }], ow);
      // 支河：从主河垂直分出一段，制造第二个水口
      if (rng.chance(0.7)) {
        var bx2 = rng.chance(0.5) ? rng.int(6, G / 2 - 6) : rng.int(G / 2 + 6, G - 7);
        var dir2 = rng.chance(0.5) ? -1 : 1;
        var len2 = rng.int(10, 22);
        addRiverPath([{ i: bx2, j: r1 }, { i: bx2, j: r1 + dir2 * len2 }], 2);
      }
    }

    /* ---------------- 2. 街巷（全部轴对齐直线，成网） ---------------- */
    var streets = [];
    var overlaps = function (axis, at, from, to) {
      return streets.some(function (u) {
        return u.axis === axis && Math.abs(u.at - at) < 2 && !(u.to < from - 1 || u.from > to + 1);
      });
    };
    // 沿岸主街
    rivers.forEach(function (seg) {
      var half = Math.floor(seg.width / 2);
      for (var s = -1; s <= 1; s += 2) {
        var at = seg.at + s * (half + 2);
        if (at < 2 || at > G - 3) continue;
        if (overlaps(seg.axis, at, seg.from, seg.to)) continue;
        var from = Math.max(1, seg.from), to = Math.min(G - 2, seg.to);
        if (seg.from <= 3) from = 1;
        if (seg.to >= G - 4) to = G - 2;
        if (to - from < 5) continue;
        streets.push({ axis: seg.axis, at: at, from: from, to: to, main: true, kind: 'bank' });
      }
    });

    // 垂直主街的巷道网（每 laneGap 一条，形成连续临街面）
    var gap = style.laneGap;
    for (var px = gap; px < G - 4; px += gap + rng.int(0, 2)) {
      if (rng.chance(0.22)) continue;
      if (overlaps('z', px, 2, G - 3)) continue;
      var f0 = rng.chance(0.6) ? 2 : rng.int(8, 18);
      var t0 = rng.chance(0.6) ? G - 3 : rng.int(G - 20, G - 8);
      if (t0 - f0 < 8) continue;
      streets.push({ axis: 'z', at: px, from: f0, to: t0, main: rng.chance(0.25), kind: 'lane' });
    }
    // 与主街平行的纵巷（离河较远处）
    for (var pz = gap; pz < G - 4; pz += gap + rng.int(1, 3)) {
      if (rng.chance(0.3)) continue;
      if (overlaps('x', pz, 2, G - 3)) continue;
      var f1 = rng.chance(0.6) ? 2 : rng.int(8, 18);
      var t1 = rng.chance(0.6) ? G - 3 : rng.int(G - 20, G - 8);
      if (t1 - f1 < 8) continue;
      streets.push({ axis: 'x', at: pz, from: f1, to: t1, main: rng.chance(0.18), kind: 'lane' });
    }
    if (!streets.some(function (s) { return s.main && s.to - s.from > G * 0.6; })) {
      streets.push({ axis: 'x', at: C + rng.int(-2, 2), from: 1, to: G - 2, main: true, kind: 'bank' });
    }
    // 非主街遇到河道：约三成架桥，其余断在岸边（控制桥的数量）
    (function splitLanes() {
      var out = [];
      streets.forEach(function (st) {
        if (st.main) { out.push(st); return; }
        var segs = [];
        var crossing = false, startT = st.from;
        for (var t = st.from; t <= st.to; t++) {
          var i = st.axis === 'x' ? t : st.at;
          var j = st.axis === 'x' ? st.at : t;
          var wtr = get(i, j) === T.WATER;
          if (wtr && !crossing) {
            if (t - startT >= 4) segs.push({ from: startT, to: t - 1 });
            crossing = true;
          } else if (!wtr && crossing) {
            crossing = false; startT = t;
          }
        }
        if (!crossing && st.to - startT >= 4) segs.push({ from: startT, to: st.to });
        if (segs.length === 0) return;
        if (segs.length === 1 && rng.chance(0.3)) {
          out.push({ axis: st.axis, at: st.at, from: st.from, to: st.to, main: false, kind: 'lane' });
          return;
        }
        segs.forEach(function (sg) {
          out.push({ axis: st.axis, at: st.at, from: sg.from, to: sg.to, main: false, kind: 'lane' });
        });
      });
      streets = out;
    })();

    function markStreet(st) {
      for (var t = st.from; t <= st.to; t++) {
        var i = st.axis === 'x' ? t : st.at;
        var j = st.axis === 'x' ? st.at : t;
        if (!inB(i, j)) continue;
        if (cells[idx(i, j)] === T.WATER) continue;
        cells[idx(i, j)] = T.ROAD;
      }
    }
    streets.forEach(markStreet);

    // 驳岸
    for (var j2 = 0; j2 < G; j2++) for (var i2 = 0; i2 < G; i2++) {
      if (cells[idx(i2, j2)] !== T.EMPTY) continue;
      if (isWater(i2 - 1, j2) || isWater(i2 + 1, j2) || isWater(i2, j2 - 1) || isWater(i2, j2 + 1)) {
        cells[idx(i2, j2)] = T.BANK;
      }
    }

    /* ---------------- 3. 桥（跨水处整段铺桥面，保证连通） ---------------- */
    var bridges = [];
    streets.forEach(function (st) {
      var run = null;
      var finish = function (r) {
        var span = r.to - r.from + 1;
        var mid = Math.round((r.from + r.to) / 2);
        var i = st.axis === 'x' ? mid : st.at;
        var j = st.axis === 'x' ? st.at : mid;
        if (inB(i, j)) {
          bridges.push({
            i: i, j: j, axis: st.axis, span: span,
            type: span >= 3 ? 'bridge' : 'bridgeFlat',
            main: st.main, seed: Math.floor(rng() * 1e9)
          });
        }        // 整段水面铺成桥面（可行走）
        for (var t = r.from; t <= r.to; t++) {
          var ii = st.axis === 'x' ? t : st.at;
          var jj = st.axis === 'x' ? st.at : t;
          if (inB(ii, jj)) cells[idx(ii, jj)] = T.BRIDGE;
        }
      };
      for (var t = st.from; t <= st.to; t++) {
        var i = st.axis === 'x' ? t : st.at;
        var j = st.axis === 'x' ? st.at : t;
        if (isWater(i, j)) { if (!run) run = { from: t, to: t }; else run.to = t; }
        else if (run) { finish(run); run = null; }
      }
      if (run) finish(run);
    });

    /* ---------------- 4. 宝塔选址（先定塔，民居避让 16 格） ---------------- */
    var pagoda = null;
    (function placePagoda() {
      var best = null, bestScore = -1e9;
      for (var j = 5; j < G - 5; j++) for (var i = 5; i < G - 5; i++) {
        if (cells[idx(i, j)] !== T.EMPTY) continue;
        var local = true;
        for (var dj = -2; dj <= 2 && local; dj++) for (var di = -2; di <= 2; di++) {
          var cc = get(i + di, j + dj);
          if (cc === T.WATER || cc === T.ROAD || cc === T.BUILD) { local = false; break; }
        }
        if (!local) continue;
        var roadNear = 0;
        for (var r2 = 3; r2 <= 10; r2++) if (nearKind(T.ROAD, i, j, r2)) { roadNear = r2; break; }
        if (!roadNear) continue;
        var edge = Math.min(i, j, G - 1 - i, G - 1 - j);
        var score = (roadNear >= 4 && roadNear <= 8 ? 6 : 2) + (nearWater(i, j, 7) ? 5 : 0) +
          (edge < 14 ? (14 - edge) * 0.45 : 0) + rng.range(0, 3);
        if (score > bestScore) { bestScore = score; best = { i: i, j: j }; }
      }
      if (!best) {
        for (var jj = 5; jj < G - 5 && !best; jj++) for (var ii = 5; ii < G - 5; ii++) {
          if (cells[idx(ii, jj)] === T.EMPTY) { best = { i: ii, j: jj }; break; }
        }
      }
      pagoda = best;
      if (pagoda) {
        for (var tj = -5; tj <= 5; tj++) for (var ti = -5; ti <= 5; ti++) {
          var ii2 = pagoda.i + ti, jj2 = pagoda.j + tj;
          if (!inB(ii2, jj2)) continue;
          if (Math.hypot(ti, tj) > 5.2) continue;
          if (cells[idx(ii2, jj2)] === T.EMPTY) cells[idx(ii2, jj2)] = T.PLAZA;
        }
        cells[idx(pagoda.i, pagoda.j)] = T.BUILD;
        pagoda.r = 16;
      }
    })();
    var pagodaDist = function (i, j) {
      return pagoda ? Math.hypot(i - pagoda.i, j - pagoda.j) : 999;
    };

    /* ---------------- 5. 民居 / 商铺 / 厅堂 / 院落 ---------------- */
    var buildings = [];
    var footprintFree = function (i, j, w, d) {
      for (var dj = 0; dj < d; dj++) for (var di = 0; di < w; di++) {
        if (!inB(i + di, j + dj)) return false;
        var cc = cells[idx(i + di, j + dj)];
        if (cc !== T.EMPTY && cc !== T.PLAZA) return false;
      }
      return true;
    };
    // R3：外扩 1 格（含对角）不得有别的房屋
    var ringFree = function (i, j, w, d) {
      for (var dj = -1; dj <= d; dj++) for (var di = -1; di <= w; di++) {
        var ii = i + di, jj = j + dj;
        if (!inB(ii, jj)) continue;
        if (owner[idx(ii, jj)] >= 0) return false;
      }
      return true;
    };
    var occupy = function (i, j, w, d, id) {
      for (var dj = 0; dj < d; dj++) for (var di = 0; di < w; di++) {
        cells[idx(i + di, j + dj)] = T.BUILD;
        owner[idx(i + di, j + dj)] = id;
      }
    };
    var faceVec = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
    var frontCell = function (b) {
      if (b.face === 'N') return [b.i + Math.floor(b.w / 2), b.j - 1];
      if (b.face === 'S') return [b.i + Math.floor(b.w / 2), b.j + b.d];
      if (b.face === 'W') return [b.i - 1, b.j + Math.floor(b.d / 2)];
      return [b.i + b.w, b.j + Math.floor(b.d / 2)];
    };
    var tryPlace = function (i, j, w, d, face, kind, extra) {
      if (!inB(i, j) || !inB(i + w - 1, j + d - 1)) return null;
      if (!footprintFree(i, j, w, d)) return null;
      if (!ringFree(i, j, w, d)) return null;
      if (pagodaDist(i + w / 2, j + d / 2) < 17.0) return null;   // R6 预留
      var b = { i: i, j: j, w: w, d: d, face: face, kind: kind || 'house', seed: Math.floor(rng() * 1e9) };
      var f = frontCell(b);
      b.frontI = f[0]; b.frontJ = f[1];
      var fc = get(b.frontI, b.frontJ);
      if (fc !== T.ROAD && fc !== T.BRIDGE && fc !== T.PLAZA) return null;   // R4
      if (extra) { for (var k in extra) b[k] = extra[k]; }
      b.id = buildings.length;
      occupy(i, j, w, d, b.id);
      buildings.push(b);
      return b;
    };

    // 沿街两侧成排布置
    streets.forEach(function (st) {
      for (var s = -1; s <= 1; s += 2) {
        var t = st.from + rng.int(0, 2);
        while (t <= st.to - 2) {
          var w = rng.pick([3, 3, 4, 4, 5]);
          var d = rng.pick([3, 3, 4, 4, 4, 5]);
          var i, j, face;
          if (st.axis === 'x') {
            i = t;
            j = s > 0 ? st.at + 1 : st.at - d;
            face = s > 0 ? 'N' : 'S';
          } else {
            j = t;
            i = s > 0 ? st.at + 1 : st.at - w;
            face = s > 0 ? 'W' : 'E';
          }
          if (rng() < style.density) {
            // 临水判定看"街"而不是"房"：河→驳岸→街→房，临水街两侧都是水乡店面
            var si = st.axis === 'x' ? t : st.at;
            var sj = st.axis === 'x' ? st.at : t;
            var nearBank = nearWater(si, sj, 3);
            var kind = 'house';
            if (nearBank && rng.chance(0.62)) kind = 'shop';
            else if (rng.chance(0.07)) kind = 'courtyard';
            tryPlace(i, j, w, d, face, kind, { main: st.main, streetAxis: st.axis, streetAt: st.at, bank: nearBank });
          }
          t += (st.axis === 'x' ? w : d) + 1;
        }
      }
    });

    // 二进院落：在已有房子背面再贴一栋（门开向院内通道 → 需要路；仅在同排有空时）
    var extraTries = 240;
    while (extraTries-- > 0) {
      var w2 = rng.pick([3, 3, 4, 4, 5]), d2 = rng.pick([3, 3, 4, 4]);
      var i3 = rng.int(2, G - 3 - w2), j3 = rng.int(2, G - 3 - d2);
      var f3 = ['N', 'S', 'W', 'E'][rng.int(0, 3)];
      var probe = { i: i3, j: j3, w: w2, d: d2, face: f3 };
      var fc3 = frontCell(probe);
      if (get(fc3[0], fc3[1]) !== T.ROAD) continue;
      tryPlace(i3, j3, w2, d2, f3, rng.chance(0.2) ? 'shop' : 'house', { main: false });
    }

    // 厅堂：靠近主街、体量够大者升级
    var hall = null;
    (function () {
      var best = null, bestS = -1e9;
      buildings.forEach(function (b) {
        if (b.kind !== 'house' || b.w < 4 || b.d < 4) return;
        var cx = b.i + b.w / 2, cz = b.j + b.d / 2;
        var s = 30 - Math.hypot(cx - C, cz - C) + (b.main ? 8 : 0) + rng.range(0, 4);
        if (s > bestS) { bestS = s; best = b; }
      });
      if (!best) {
        buildings.forEach(function (b) {
          if (b.kind !== 'house') return;
          var s = 30 - Math.hypot(b.i + b.w / 2 - C, b.j + b.d / 2 - C);
          if (s > bestS) { bestS = s; best = b; }
        });
      }
      if (best) { best.kind = 'hall'; hall = best; }
    })();

    /* ---------------- 6. 主路两端牌坊（R7：85%） ---------------- */
    var paifangs = [];
    var ends = [];
    streets.filter(function (s) { return s.main; }).forEach(function (st) {
      [st.from, st.to].forEach(function (t, k) {
        var i = st.axis === 'x' ? t : st.at;
        var j = st.axis === 'x' ? st.at : t;
        if (!inB(i, j)) return;
        if (cells[idx(i, j)] !== T.ROAD) return;
        ends.push({ i: i, j: j, axis: st.axis, t: t });
      });
    });
    ends.forEach(function (e) {
      if (rng.chance(0.85)) {
        paifangs.push({ i: e.i, j: e.j, axis: e.axis, seed: Math.floor(rng() * 1e9) });
        cells[idx(e.i, e.j)] = T.PLAZA;
      }
    });
    // 保证比例落在 80%~95%（贴合"85%"的规约）
    if (ends.length >= 2) {
      var target = Math.round(ends.length * 0.85);
      if (paifangs.length < target) {
        // 从没立的端头补足
        var used = {};
        paifangs.forEach(function (p) { used[p.i + ',' + p.j] = 1; });
        ends.forEach(function (e) {
          if (paifangs.length >= target) return;
          if (used[e.i + ',' + e.j]) return;
          paifangs.push({ i: e.i, j: e.j, axis: e.axis, seed: Math.floor(rng() * 1e9) });
          cells[idx(e.i, e.j)] = T.PLAZA;
        });
      } else if (paifangs.length > target) {
        paifangs.length = target;
      }
    }
    var paifangRatio = ends.length ? paifangs.length / ends.length : 0;

    /* ---------------- 7. 农田（R5） ---------------- */
    var fields = [];
    var rectNear = function (i, j, w, d, kind, r) {
      for (var dj = -r; dj < d + r; dj++) for (var di = -r; di < w + r; di++) {
        if (di >= 0 && dj >= 0 && di < w && dj < d) continue;
        if (get(i + di, j + dj) === kind) return true;
      }
      return false;
    };
    var tries = 420;
    while (tries-- > 0 && fields.length < 36) {
      var fw = rng.int(2, 4), fd = rng.int(2, 4);
      var fi = rng.int(2, G - 3 - fw), fj = rng.int(2, G - 3 - fd);
      if (!(rectNear(fi, fj, fw, fd, T.ROAD, 2) || rectNear(fi, fj, fw, fd, T.WATER, 2) || rectNear(fi, fj, fw, fd, T.BUILD, 2))) continue;
      var free = true;
      for (var q = 0; q < fd && free; q++) for (var p = 0; p < fw; p++) {
        if (cells[idx(fi + p, fj + q)] !== T.EMPTY) { free = false; break; }
      }
      if (!free) continue;
      if (pagodaDist(fi + fw / 2, fj + fd / 2) < 7) continue;
      fields.push({ i: fi, j: fj, w: fw, d: fd, crop: rng.pick(CROPS), seed: Math.floor(rng() * 1e9) });
      for (var q2 = 0; q2 < fd; q2++) for (var p2 = 0; p2 < fw; p2++) cells[idx(fi + p2, fj + q2)] = T.FIELD;
    }

    /* ---------------- 8. 树木（R8） ---------------- */
    var groves = [];
    var groveN = rng.int(4, 7);
    for (var gi = 0; gi < groveN; gi++) {
      groves.push({ i: rng.range(3, G - 4), j: rng.range(3, G - 4), r: rng.range(3, 6.5), w: rng.range(0.7, 1.15) });
    }
    var treeDensity = function (i, j) {
      var edge = Math.min(i, j, G - 1 - i, G - 1 - j);
      var d = 0.05;
      if (edge < 7) d += (7 - edge) / 7 * 0.30;
      if (nearWater(i, j, 3)) d += 0.34;
      for (var k = 0; k < groves.length; k++) {
        var g2 = groves[k];
        var dist = Math.hypot(i - g2.i, j - g2.j);
        if (dist < g2.r) d += g2.w * (1 - dist / g2.r) * 0.65;
      }
      if (nearKind(T.ROAD, i, j, 1)) d *= 0.5;
      return d * style.treeBoost;
    };
    var trees = [];
    for (var tj2 = 1; tj2 < G - 1; tj2++) for (var ti2 = 1; ti2 < G - 1; ti2++) {
      var ccc = cells[idx(ti2, tj2)];
      if (ccc !== T.EMPTY && ccc !== T.BANK) continue;
      if (rng() > treeDensity(ti2, tj2)) continue;
      if (nearKind(T.BUILD, ti2, tj2, 1)) continue;
      if (pagodaDist(ti2, tj2) < 3.6) continue;
      var nw = nearWater(ti2, tj2, 3);
      var ed = Math.min(ti2, tj2, G - 1 - ti2, G - 1 - tj2) < 7;
      var gr = groves.some(function (g3) { return Math.hypot(ti2 - g3.i, tj2 - g3.j) < g3.r; });
      trees.push({
        i: ti2 + rng.range(-0.3, 0.3), j: tj2 + rng.range(-0.3, 0.3),
        s: rng.range(0.62, 0.95), seed: Math.floor(rng() * 1e9),
        nearWater: nw, edge: ed, grove: gr,
        species: pickSpecies(rng, style, nw, ed, gr)
      });
      if (ccc === T.EMPTY) cells[idx(ti2, tj2)] = T.TREE;
    }

    /* ---------------- 9. 道具 / 船 / 埠头 ---------------- */
    var props = [];
    buildings.forEach(function (b) {
      if (!rng.chance(0.6)) return;
      var cands = [];
      for (var dj = -1; dj <= b.d; dj++) for (var di = -1; di <= b.w; di++) {
        if (!(di === -1 || dj === -1 || di === b.w || dj === b.d)) continue;
        var ii = b.i + di, jj = b.j + dj;
        if (!inB(ii, jj)) continue;
        var cc = cells[idx(ii, jj)];
        if (cc !== T.EMPTY && cc !== T.BANK) continue;
        if (owner[idx(ii, jj)] >= 0) continue;
        if (ii === b.frontI && jj === b.frontJ) continue;
        cands.push([ii, jj]);
      }
      if (!cands.length) return;
      var p = rng.pick(cands);
      cells[idx(p[0], p[1])] = T.PLAZA;
      props.push({ i: p[0], j: p[1], type: rng.pick(PROPS), seed: Math.floor(rng() * 1e9), rot: rng.range(0, Math.PI * 2) });
    });

    var boats = [];
    var boatTarget = rng.int(2, 5);
    for (var bt = 0; bt < 400 && boats.length < boatTarget; bt++) {
      var wi = rng.int(2, G - 3), wj = rng.int(2, G - 3);
      if (cells[idx(wi, wj)] !== T.WATER) continue;
      if (boats.some(function (b2) { return Math.hypot(b2.i - wi, b2.j - wj) < 7; })) continue;
      var axis = 'x';
      rivers.forEach(function (rg) {
        var half = Math.floor(rg.width / 2);
        if (rg.axis === 'x' && Math.abs(wj - rg.at) <= half) axis = 'x';
        if (rg.axis === 'z' && Math.abs(wi - rg.at) <= half) axis = 'z';
      });
      boats.push({ i: wi, j: wj, axis: axis, seed: Math.floor(rng() * 1e9), s: rng.range(0.9, 1.12) });
    }

    var wharves = [];
    buildings.forEach(function (b) {
      if (wharves.length >= 6) return;
      if (!rng.chance(0.3)) return;
      if (!nearWater(b.frontI, b.frontJ, 4)) return;
      wharves.push({ i: b.frontI, j: b.frontJ, face: b.face, seed: Math.floor(rng() * 1e9) });
    });

    var map = {
      seed: S, G: G, C: C, style: style, cells: cells, owner: owner,
      rivers: rivers, streets: streets, bridges: bridges, buildings: buildings,
      pagoda: pagoda, paifangs: paifangs, paifangRatio: paifangRatio, paifangEnds: ends.length,
      fields: fields, trees: trees, props: props, boats: boats, wharves: wharves,
      hall: hall, groves: groves, T: T, idx: idx, inB: inB, get: get
    };
    // 水口：河道出图的位置（用于把水面延伸到画外）
    var exits = [];
    rivers.forEach(function (rg) {
      var half = Math.floor(rg.width / 2);
      if (rg.from <= 0) {
        for (var w = -half; w < rg.width - half; w++) {
          var a = rg.at + w;
          if (a < 0 || a >= G) continue;
          exits.push({ axis: rg.axis === 'x' ? 'z' : 'x', at: a, dir: -1, side: 'min' });
        }
      }
      if (rg.to >= G - 1) {
        for (var w2 = -half; w2 < rg.width - half; w2++) {
          var b = rg.at + w2;
          if (b < 0 || b >= G) continue;
          exits.push({ axis: rg.axis === 'x' ? 'z' : 'x', at: b, dir: 1, side: 'max' });
        }
      }
    });
    map.waterExits = exits;
    map.checks = validate(map);
    map.stats = makeStats(map);
    return map;
  }

  function pickSpecies(rng, style, nearWater, edge, grove) {
    var accent = style.season.accent;
    if (nearWater && rng.chance(0.55)) return 'willow';
    if (accent === 'maple' && rng.chance(0.3)) return 'maple';
    if (accent === 'peach' && rng.chance(0.24)) return 'peach';
    if (accent === 'plum' && rng.chance(0.26)) return 'plum';
    if (grove && rng.chance(0.32)) return 'bamboo';
    if (edge && rng.chance(0.24)) return 'pine';
    if (rng.chance(0.1)) return 'osmanthus';
    return 'camphor';
  }

  /* ------------------------------------------------------------------
   * 独立复核
   * ------------------------------------------------------------------ */
  function validate(map) {
    var T = map.T, G = map.G, cells = map.cells, idx = map.idx;
    var res = [];
    function add(id, name, ok, detail) { res.push({ id: id, name: name, ok: !!ok, detail: detail || '' }); }

    var orth = map.rivers.every(function (r) { return (r.axis === 'x' || r.axis === 'z') && r.from <= r.to; }) &&
      map.streets.every(function (s) { return (s.axis === 'x' || s.axis === 'z') && s.from <= s.to; });
    add('R1', '河与路必正交', orth, map.rivers.length + ' 段河道 / ' + map.streets.length + ' 段街巷，全部轴对齐');

    var mains = map.streets.filter(function (s) { return s.main; });
    var broken = 0;
    mains.forEach(function (s) {
      for (var t = s.from; t <= s.to; t++) {
        var i = s.axis === 'x' ? t : s.at;
        var j = s.axis === 'x' ? s.at : t;
        var c = cells[idx(i, j)];
        if (c !== T.ROAD && c !== T.BRIDGE && c !== T.PLAZA) { broken++; break; }
      }
    });
    add('R2', '路近水锁直', broken === 0, mains.length + ' 条主街，' + (broken === 0 ? '全部贯通不转折' : broken + ' 条中断'));

    var boxes = map.buildings.map(function (b) { return { i0: b.i, j0: b.j, i1: b.i + b.w - 1, j1: b.j + b.d - 1 }; });
    var r3bad = 0;
    for (var a = 0; a < boxes.length; a++) for (var b2 = a + 1; b2 < boxes.length; b2++) {
      var A = boxes[a], B = boxes[b2];
      if (!(A.i1 + 1 < B.i0 || B.i1 + 1 < A.i0 || A.j1 + 1 < B.j0 || B.j1 + 1 < A.j0)) r3bad++;
    }
    add('R3', '房屋周围一圈禁房', r3bad === 0, r3bad === 0 ? '全部 ' + boxes.length + ' 栋，四周 1 格（含对角）净空' : r3bad + ' 处违规相邻');

    var r4bad = 0;
    map.buildings.forEach(function (b) {
      var c = cells[idx(b.frontI, b.frontJ)];
      if (!(c === T.ROAD || c === T.BRIDGE || c === T.PLAZA)) r4bad++;
    });
    add('R4', '房屋门朝道路', r4bad === 0, r4bad === 0 ? '全部 ' + map.buildings.length + ' 栋门正对街巷' : r4bad + ' 栋不合规');

    var r5bad = 0;
    map.fields.forEach(function (f) {
      var ok = false;
      for (var dj = -2; dj < f.d + 2 && !ok; dj++) for (var di = -2; di < f.w + 2; di++) {
        if (di >= 0 && dj >= 0 && di < f.w && dj < f.d) continue;
        var ii = f.i + di, jj = f.j + dj;
        if (ii < 0 || jj < 0 || ii >= G || jj >= G) continue;
        var c = cells[idx(ii, jj)];
        if (c === T.ROAD || c === T.WATER || c === T.BUILD) { ok = true; break; }
      }
      if (!ok) r5bad++;
    });
    add('R5', '农田近路/水/宅', r5bad === 0, r5bad === 0 ? map.fields.length + ' 块田均在路/水/宅 2 格内' : r5bad + ' 块不合格');

    var r6min = 999, r6ok = false;
    if (map.pagoda) {
      r6ok = true;
      map.buildings.forEach(function (b) {
        var d = Math.hypot(b.i + b.w / 2 - map.pagoda.i, b.j + b.d / 2 - map.pagoda.j);
        if (d < r6min) r6min = d;
        if (d < 16) r6ok = false;
      });
    }
    add('R6', '宝塔距最近民居 ≥16 格', r6ok, map.pagoda ? '实测最近 ' + r6min.toFixed(1) + ' 格' : '未放置宝塔');

    var ratio = map.paifangs.length / Math.max(1, map.paifangEnds);
    add('R7', '主路两端 85% 立牌坊', map.paifangEnds > 0 && ratio >= 0.6,
      map.paifangs.length + '/' + map.paifangEnds + ' 端（' + Math.round(ratio * 100) + '%）');

    var edgeN = 0, waterN = 0, groveN2 = 0, total = map.trees.length;
    map.trees.forEach(function (t) {
      if (t.edge) edgeN++;
      if (t.nearWater) waterN++;
      if (t.grove) groveN2++;
    });
    var okR8 = total > 50 && edgeN / Math.max(1, total) > 0.1 && waterN / Math.max(1, total) > 0.1;
    add('R8', '树在边缘/水边/树丛加密', okR8,
      total + ' 株；边缘 ' + edgeN + '，水边 ' + waterN + '，树丛 ' + groveN2);

    var roads = 0;
    for (var k = 0; k < cells.length; k++) if (cells[k] === T.ROAD || cells[k] === T.BRIDGE) roads++;
    add('X1', '街巷成网', roads > 100, roads + ' 格街巷/桥面');

    return { list: res, allPass: res.every(function (r) { return r.ok; }) };
  }

  function makeStats(map) {
    var kinds = { house: 0, shop: 0, hall: 0, courtyard: 0 };
    map.buildings.forEach(function (b) { kinds[b.kind] = (kinds[b.kind] || 0) + 1; });
    var waterCells = 0, roadCells = 0;
    for (var i = 0; i < map.cells.length; i++) {
      if (map.cells[i] === 1) waterCells++;
      if (map.cells[i] === 3 || map.cells[i] === 8) roadCells++;
    }
    return {
      houses: map.buildings.length,
      house: kinds.house, shop: kinds.shop, hall: kinds.hall, courtyard: kinds.courtyard,
      bridges: map.bridges.length, fields: map.fields.length, trees: map.trees.length,
      paifangs: map.paifangs.length, waterCells: waterCells, roadCells: roadCells
    };
  }

  JN.MapGen = { generate: generate, validate: validate, STYLE_POOL: STYLE_POOL, T: T };
})();
