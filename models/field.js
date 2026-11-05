/* models/field.js —— 江南农田（水田 / 菜畦 / 油菜 / 桑田）
 * 本地 X-Z 矩形铺开，原点在占地中心；田埂顶面 y=0.18，埂脚贴地 y=0，
 * 田面相对埂顶下沉 0.12（水田为浅水 + 泥底）。严格 |x| ≤ w/2、|z| ≤ d/2。
 * 材质仅 7 种：earth / water / rice / leafLight / hedge / riceGold / woodDark
 */
(function () {
  'use strict';
  var JN = window.JN;

  /* ---------------- 通用小工具（不新建材质） ---------------- */
  function strut(g, x1, y1, z1, x2, y2, z2, r, mat, seg) {
    var dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (!(len > 0.0001)) return null;
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r, len, seg || 4, 1), JN.kit.mat(mat));
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  }

  // 细长叶面片（稻叶、菜叶、桑叶），带轻微弯曲与收尖
  function bladeMesh(w, h, mat, x, y, z, rx, ry, rz, curve, segH) {
    var geo = new THREE.PlaneGeometry(w, h, 1, segH || 1);
    geo.translate(0, h / 2, 0);
    var pos = geo.attributes.position;
    var cv = curve === undefined ? 0.10 : curve;
    for (var i = 0; i < pos.count; i++) {
      var yy = pos.getY(i) / h;
      pos.setZ(i, yy * yy * cv * h);
      pos.setX(i, pos.getX(i) * (1 - yy * 0.55));
    }
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, JN.kit.mat(mat));
    m.position.set(x, y, z);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  /* 按材质烘焙合并：网格数 = 材质数，便于生成器整体合并 */
  function bakeByMaterial(g) {
    g.updateMatrixWorld(true);
    var list = [];
    g.traverse(function (o) { if (o.isMesh && o.geometry) list.push(o); });
    var buckets = new Map();
    list.forEach(function (o) {
      var src = o.geometry;
      var ng = src.index ? src.toNonIndexed() : src.clone();
      ng.applyMatrix4(o.matrixWorld);
      if (!ng.attributes.normal) ng.computeVertexNormals();
      var key = o.material.uuid;
      var b = buckets.get(key);
      if (!b) { b = { mat: o.material, pos: [], nor: [], uv: [], cast: false, rec: false }; buckets.set(key, b); }
      b.pos.push(ng.attributes.position.array);
      b.nor.push(ng.attributes.normal.array);
      var uv = ng.attributes.uv;
      b.uv.push(uv ? uv.array : new Float32Array(ng.attributes.position.count * 2));
      b.cast = b.cast || !!o.castShadow;
      b.rec = b.rec || !!o.receiveShadow;
      ng.dispose();
    });
    var out = new THREE.Group();
    var idx = 0;
    buckets.forEach(function (b) {
      var total = 0;
      for (var i = 0; i < b.pos.length; i++) total += b.pos[i].length;
      var pos = new Float32Array(total), nor = new Float32Array(total), uv = new Float32Array(total / 3 * 2);
      var po = 0, uo = 0;
      for (var j = 0; j < b.pos.length; j++) {
        pos.set(b.pos[j], po); nor.set(b.nor[j], po);
        var c = b.pos[j].length / 3;
        var src = b.uv[j];
        uv.set(src.subarray(0, Math.min(src.length, c * 2)), uo);
        po += b.pos[j].length; uo += c * 2;
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      var m = new THREE.Mesh(geo, b.mat);
      m.castShadow = b.cast; m.receiveShadow = b.rec;
      m.name = 'field-part-' + idx++;
      out.add(m);
    });
    list.forEach(function (o) { if (o.geometry) o.geometry.dispose(); });
    return out;
  }

  JN.models['field'] = function (ctx) {
    var K = ctx.kit;
    var rng = ctx.rng;
    var w = Math.min(10, Math.max(3, (ctx.opts && ctx.opts.w) || 6));
    var d = Math.min(10, Math.max(3, (ctx.opts && ctx.opts.d) || 5));
    var crop = (ctx.opts && ctx.opts.crop) || rng.pick(['rice', 'veg', 'rapeseed', 'mulberry']);
    var g = new THREE.Group();
    g.name = 'field-' + crop;

    var HW = w / 2, HD = d / 2;
    var TOP = 0.18;                            // 田埂顶面
    var BW = 0.35;                             // 田埂宽
    var ex = HW - 0.07, ez = HD - 0.07;        // 埂外缘（留白，不越界）
    var ix = ex - BW, iz = ez - BW;            // 田面内缘
    var bedY = TOP - 0.12;                     // 田面（相对埂顶下沉 0.12）
    var add = function (o) { if (o) g.add(o); return o; };

    /* ---------------- 田埂：四边夯土 + 一处放水口 ---------------- */
    var gateSide = rng.int(0, 3);
    function dike(len, x, z, rotY, notch) {
      var grp = new THREE.Group();
      if (!notch) {
        grp.add(K.box(len, TOP, BW, 'earth', 0, TOP / 2, 0));
        grp.add(K.box(len * 0.98, 0.05, BW * 0.84, 'earth', 0, TOP + 0.02, 0));
      } else {
        var gap = 0.32, at = rng.range(-0.22, 0.22);
        var l1 = len / 2 + at - gap / 2, l2 = len / 2 - at - gap / 2;
        grp.add(K.box(Math.max(0.16, l1), TOP, BW, 'earth', -(len / 2 - l1 / 2), TOP / 2, 0));
        grp.add(K.box(Math.max(0.16, l2), TOP, BW, 'earth', (len / 2 - l2 / 2), TOP / 2, 0));
        // 放水口：木闸板 + 小水槽（低于田面）
        grp.add(K.box(0.06, TOP + 0.05, BW * 1.06, 'woodDark', at - gap / 2, TOP / 2, 0));
        grp.add(K.box(0.06, TOP + 0.05, BW * 1.06, 'woodDark', at + gap / 2, TOP / 2, 0));
        grp.add(K.box(gap, 0.07, BW * 0.94, 'woodDark', at, bedY - 0.02, 0));
      }
      grp.position.set(x, 0, z);
      grp.rotation.y = rotY;
      return grp;
    }
    add(dike(w, 0, ez - BW / 2, 0, gateSide === 0));
    add(dike(w, 0, -(ez - BW / 2), 0, gateSide === 1));
    add(dike(d - BW * 2, ex - BW / 2, 0, Math.PI / 2, gateSide === 2));
    add(dike(d - BW * 2, -(ex - BW / 2), 0, Math.PI / 2, gateSide === 3));

    /* ---------------- 田面底 ---------------- */
    if (crop === 'rice') {
      // 泥底（下沉 0.12）
      add(ctx.surface(6, 5, function (u, v) {
        return [-ix + u * ix * 2, bedY + Math.sin(u * 9.1 + 1.3) * Math.cos(v * 7.7) * 0.012, -iz + v * iz * 2];
      }, 'earth'));
      // 浅水薄面（半透，略高于泥底）
      var wat = ctx.surface(5, 4, function (u, v) {
        return [-ix + 0.03 + u * (ix - 0.03) * 2, bedY + 0.035 + Math.sin(u * 5 + 2) * 0.005, -iz + 0.03 + v * (iz - 0.03) * 2];
      }, 'water');
      wat.castShadow = false;
      add(wat);
    } else {
      add(ctx.surface(6, 5, function (u, v) {
        return [-ix + u * ix * 2, bedY + 0.02 + Math.sin(u * 8 + 0.6) * Math.cos(v * 6.2 + 1) * 0.02, -iz + v * iz * 2];
      }, 'earth'));
    }

    /* ---------------- 一、水田 rice ---------------- */
    if (crop === 'rice') {
      var rowGap = 0.5, plantGap = 0.35;
      var rows = Math.max(2, Math.floor((iz * 2 - 0.26) / rowGap));
      var cols = Math.max(2, Math.floor((ix * 2 - 0.26) / plantGap));
      var cells = rows * cols;
      if (cells > 130) {                       // 控制三角面
        var f = Math.sqrt(cells / 130);
        rowGap *= f; plantGap *= f;
        rows = Math.max(2, Math.floor((iz * 2 - 0.26) / rowGap));
        cols = Math.max(2, Math.floor((ix * 2 - 0.26) / plantGap));
      }
      var z0 = -(rows - 1) * rowGap / 2, x0 = -(cols - 1) * plantGap / 2;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var px = x0 + c * plantGap + rng.range(-0.05, 0.05);
          var pz = z0 + r * rowGap + rng.range(-0.05, 0.05);
          var edge = Math.max(Math.abs(px) / ix, Math.abs(pz) / iz);
          if (edge > 0.80 && rng.chance(0.55)) continue;   // 中间密、靠边稀
          var hgt = rng.range(0.34, 0.52) * (1 - edge * 0.22);
          var nl = rng.int(5, 9);
          var baseY = bedY + 0.045 + rng.range(-0.008, 0.012);
          for (var q = 0; q < nl; q++) {
            var a = (q / nl) * Math.PI * 2 + rng.range(-0.3, 0.3);
            var lean = rng.range(0.14, 0.40);
            add(bladeMesh(rng.range(0.034, 0.052), hgt * rng.range(0.72, 1.0),
              rng.chance(0.55) ? 'rice' : 'leafLight',
              px + Math.cos(a) * 0.03, baseY, pz + Math.sin(a) * 0.03,
              Math.sin(a) * lean, a, -Math.cos(a) * lean, 0.16, 3));
          }
        }
      }
    }

    /* ---------------- 二、菜畦 veg ---------------- */
    if (crop === 'veg') {
      var nBed = rng.int(4, 8);
      // 窄田时减少畦数，保证每畦 ≥ 0.3 宽
      var maxBed = Math.max(3, Math.floor(((ix * 2 / 0.30) - 0.55) / 1.55));
      nBed = Math.min(nBed, maxBed);
      var bedW = (ix * 2) / (nBed * 1.55 + 0.55);
      var bedGap = bedW * 0.55;
      var bedLen = iz * 2 - 0.22;
      var bx0 = -((nBed * bedW + (nBed - 1) * bedGap) / 2);
      var emptyBed = rng.int(0, nBed - 1);
      // 整块田的菜株总数预算（按面积，控三角面）
      var vegBudget = Math.max(80, Math.min(300, Math.floor(ix * iz * 32)));
      var bedBudget = Math.max(12, Math.min(48, Math.floor(vegBudget / Math.max(1, nBed - 1))));
      for (var b = 0; b < nBed; b++) {
        var bx = bx0 + b * (bedW + bedGap) + bedW / 2;
        // 南北向半圆拱畦（拱高 0.14，与沟形成明暗分层）
        add(ctx.surface(6, 2, function (u, v) {
          return [bx - bedW / 2 + u * bedW, bedY + 0.01 + 0.14 * Math.pow(Math.sin(Math.PI * u), 0.62), -bedLen / 2 + v * bedLen];
        }, 'earth'));
        if (b < nBed - 1) {   // 畦间沟（压暗，强化畦条）
          add(K.box(bedGap * 0.94, 0.10, bedLen * 0.98, 'earth', bx + bedW / 2 + bedGap / 2, bedY - 0.055, 0));
        }
        if (b === emptyBed) continue;   // 个别畦空着
        var perRow = Math.max(3, Math.floor((bedLen - 0.26) / 0.36));
        var rowN = Math.max(2, Math.round(bedW / 0.20));
        var totalP = perRow * rowN;
        // 三角面预算：整块田菜株总数上限
        if (totalP > bedBudget) {
          var f2 = Math.sqrt(bedBudget / totalP);
          perRow = Math.max(2, Math.floor(perRow * f2));
          rowN = Math.max(2, Math.floor(rowN * f2));
        }
        for (var rr = 0; rr < perRow; rr++) {
          var rz = -bedLen / 2 + 0.22 + rr * (bedLen - 0.44) / Math.max(1, perRow - 1);
          for (var cc = 0; cc < rowN; cc++) {
            var cxp = bx - bedW / 2 + 0.13 + cc * (bedW - 0.26) / Math.max(1, rowN - 1);
            var sz = rng.range(0.10, 0.15);
            var topY = bedY + 0.01 + 0.10 * Math.pow(Math.sin(Math.PI * (cxp - bx + bedW / 2) / bedW), 0.72);
            var veg;
            if (rng.chance(0.55)) {
              veg = new THREE.Mesh(new THREE.SphereGeometry(sz, 6, 4), ctx.mat(rng.chance(0.55) ? 'hedge' : 'leafLight'));
              veg.scale.set(1, 0.86, 1);
            } else {
              veg = new THREE.Mesh(new THREE.ConeGeometry(sz * 0.86, sz * 1.9, 5), ctx.mat(rng.chance(0.6) ? 'leafLight' : 'hedge'));
            }
            veg.position.set(cxp + rng.range(-0.03, 0.03), topY + sz * 0.55, rz + rng.range(-0.03, 0.03));
            veg.castShadow = true; veg.receiveShadow = true;
            add(veg);
            if (rng.chance(0.45)) {   // 外叶
              for (var lv = 0; lv < 2; lv++) {
                var la = rng.range(0, Math.PI * 2);
                add(bladeMesh(rng.range(0.07, 0.12), rng.range(0.09, 0.15), rng.chance(0.6) ? 'leafLight' : 'hedge',
                  cxp + Math.cos(la) * sz * 0.7, topY + 0.01, rz + Math.sin(la) * sz * 0.7,
                  0.9, la, 0, 0.05, 1));
              }
            }
          }
        }
      }
    }

    /* ---------------- 三、油菜 rapeseed ---------------- */
    if (crop === 'rapeseed') {
      // 绿叶底（略高于土面，避免穿插露土）
      add(ctx.surface(7, 6, function (u, v) {
        return [-ix + 0.10 + u * (ix - 0.10) * 2, bedY + 0.075 + Math.sin(u * 12 + 3) * Math.cos(v * 9 + 1) * 0.02, -iz + 0.10 + v * (iz - 0.10) * 2];
      }, 'hedge'));
      // 成片金黄小球花
      var gn = Math.min(230, Math.max(90, Math.floor(ix * iz * 34)));
      for (var fl = 0; fl < gn; fl++) {
        var fx = rng.range(-ix + 0.16, ix - 0.16);
        var fz = rng.range(-iz + 0.16, iz - 0.16);
        var fh = rng.range(0.22, 0.42);
        var by = bedY + 0.075;
        strut(g, fx, by, fz, fx + rng.range(-0.04, 0.04), by + fh, fz + rng.range(-0.04, 0.04), 0.012, 'leafLight', 3);
        var fr = rng.range(0.055, 0.10);
        var f1 = new THREE.Mesh(new THREE.SphereGeometry(fr, 5, 4), ctx.mat('riceGold'));
        f1.position.set(fx + rng.range(-0.03, 0.03), by + fh + fr * 0.3, fz + rng.range(-0.03, 0.03));
        f1.scale.set(1, 0.82, 1);
        f1.castShadow = true; f1.receiveShadow = true;
        add(f1);
        if (rng.chance(0.4)) {
          var f2 = new THREE.Mesh(new THREE.SphereGeometry(fr * 0.6, 4, 3), ctx.mat('riceGold'));
          f2.position.set(f1.position.x + rng.range(-0.09, 0.09), by + fh - 0.04, f1.position.z + rng.range(-0.09, 0.09));
          f2.castShadow = true;
          add(f2);
        }
      }
      // 边缘杂草
      for (var e = 0; e < 8; e++) {
        var t = rng.range(0, 1), gx = ix - 0.18, gz = -iz + t * iz * 2;
        if (rng.chance(0.5)) { gx = -ix + t * ix * 2; gz = (rng.chance(0.5) ? 1 : -1) * (iz - 0.18); }
        else gx = (rng.chance(0.5) ? 1 : -1) * gx;
        var gt = ctx.grass({ n: rng.int(3, 5), h: rng.range(0.3, 0.5), mat: rng.chance(0.6) ? 'leafLight' : 'hedge', seed: rng.range(0, 6) });
        gt.position.set(gx, bedY + 0.03, gz);
        add(gt);
      }
      // 埂上 2~3 稻草人 / 竹架
      var nSc = rng.int(2, 3);
      for (var s = 0; s < nSc; s++) {
        var side = rng.int(0, 3), scx, scz, ang = 0;
        if (side === 0) { scx = rng.range(-ex + 0.45, ex - 0.45); scz = ez - BW / 2; }
        else if (side === 1) { scx = rng.range(-ex + 0.45, ex - 0.45); scz = -(ez - BW / 2); }
        else if (side === 2) { scx = ex - BW / 2; scz = rng.range(-ez + 0.45, ez - 0.45); ang = Math.PI / 2; }
        else { scx = -(ex - BW / 2); scz = rng.range(-ez + 0.45, ez - 0.45); ang = Math.PI / 2; }
        var sg = new THREE.Group();
        var sh = rng.range(0.80, 1.05);
        sg.add(K.cyl(0.026, 0.036, sh * 1.2, 4, 'woodDark', 0, sh * 0.6, 0));
        var arm = K.cyl(0.020, 0.020, sh * 0.72, 4, 'woodDark', 0, sh * 0.76, 0);
        arm.rotation.z = Math.PI / 2; arm.rotation.y = 0.22;
        sg.add(arm);
        sg.add(K.cyl(0.12, 0.19, sh * 0.40, 6, 'riceGold', 0, sh * 0.54, 0));   // 草束身
        sg.add(K.cyl(0.012, 0.23, 0.11, 7, 'riceGold', 0, sh * 0.90, 0));      // 草帽
        sg.position.set(scx, TOP, scz);
        sg.rotation.y = ang + rng.range(-0.3, 0.3);
        add(sg);
      }
    }

    /* ---------------- 四、桑田 mulberry ---------------- */
    if (crop === 'mulberry') {
      var sizeF = Math.max(0.55, Math.min(1, Math.min(ix, iz) / 1.9));
      var rowsM = Math.max(2, Math.round((iz * 2) / 0.95) + 1);
      var zStep = Math.max(0.7, (iz * 2 - 0.66) / Math.max(1, rowsM - 1));
      var zStart = -((rowsM - 1) * zStep) / 2;
      var perRowM = Math.max(2, Math.floor((ix * 2 - 0.4) / 0.75));
      var xStepM = (ix * 2 - 0.4) / Math.max(1, perRowM - 1);
      var xStartM = -((perRowM - 1) * xStepM) / 2;
      var plantCount = 0;
      var maxPlant = 30;
      var perRowCap = Math.max(2, Math.min(perRowM, Math.ceil(maxPlant / rowsM)));
      for (var mr = 0; mr < rowsM; mr++) {
        // 行间裸土带
        add(K.box(ix * 2 - 0.14, 0.045, 0.40, 'earth', 0, bedY + 0.02, zStart + mr * zStep));
        for (var mc = 0; mc < perRowCap; mc++) {
          var mci = mc + Math.floor((perRowM - perRowCap) / 2);
          if (plantCount >= maxPlant) break;
          var mx = xStartM + mci * xStepM + rng.range(-0.05, 0.05);
          var mz = zStart + mr * zStep + rng.range(-0.05, 0.05);
          if (Math.abs(mx) > ix - 0.30 || Math.abs(mz) > iz - 0.30) continue;
          plantCount++;
          var mh = rng.range(0.80, 1.20) * sizeF;
          var mg = new THREE.Group();
          mg.add(ctx.trunk({ h: mh * 0.62, r: 0.042 * sizeF, rTip: 0.024 * sizeF, bend: rng.range(0.02, 0.09), seg: 3, sides: 5, mat: 'woodDark', wave: 1.0, rootFlare: 0.4 }));
          var nb = rng.int(4, 6);
          for (var bq = 0; bq < nb; bq++) {
            var ba = (bq / nb) * Math.PI * 2 + rng.range(-0.4, 0.4);
            var by = mh * rng.range(0.42, 0.72);
            var br = rng.range(0.24, 0.40) * sizeF;
            var bx2 = Math.cos(ba) * br, bz2 = Math.sin(ba) * br;
            var by2 = by + rng.range(0.18, 0.34) * sizeF;
            strut(mg, 0, by, 0, bx2, by2, bz2, 0.021 * sizeF, 'woodDark', 4);
            var lr = rng.range(0.12, 0.19) * sizeF;
            var lb = new THREE.Mesh(new THREE.SphereGeometry(lr, 6, 5), ctx.mat(rng.chance(0.55) ? 'leafLight' : 'hedge'));
            lb.position.set(bx2, by2 + lr * 0.35, bz2);
            lb.scale.set(1.15, 0.9, 1.15);
            lb.castShadow = true; lb.receiveShadow = true;
            mg.add(lb);
            for (var lf = 0; lf < 2; lf++) {   // 圆叶
              var la2 = rng.range(0, Math.PI * 2);
              mg.add(bladeMesh(rng.range(0.07, 0.12) * sizeF, rng.range(0.09, 0.14) * sizeF,
                rng.chance(0.5) ? 'leafLight' : 'hedge',
                bx2 + Math.cos(la2) * lr * 0.85, by2 + rng.range(-0.04, 0.10) * sizeF, bz2 + Math.sin(la2) * lr * 0.85,
                0.75, la2, 0, 0.04, 1));
            }
          }
          var top = new THREE.Mesh(new THREE.SphereGeometry(rng.range(0.15, 0.22) * sizeF, 6, 5), ctx.mat('hedge'));
          top.position.set(0, mh * 0.80 + 0.10 * sizeF, 0);
          top.scale.set(1.1, 0.85, 1.1);
          top.castShadow = true; top.receiveShadow = true;
          mg.add(top);
          mg.position.set(mx, bedY + 0.02, mz);
          mg.rotation.y = rng.range(0, Math.PI * 2);
          add(mg);
        }
      }
    }

    /* ---------------- 共同：埂上草簇 + 田角土石 + 水口 ---------------- */
    var nGrass = rng.int(4, 8);
    for (var gi = 0; gi < nGrass; gi++) {
      var sideG = rng.int(0, 3), gx2, gz2;
      if (sideG === 0) { gx2 = rng.range(-ex + 0.25, ex - 0.25); gz2 = ez - BW / 2; }
      else if (sideG === 1) { gx2 = rng.range(-ex + 0.25, ex - 0.25); gz2 = -(ez - BW / 2); }
      else if (sideG === 2) { gx2 = ex - BW / 2; gz2 = rng.range(-ez + 0.25, ez - 0.25); }
      else { gx2 = -(ex - BW / 2); gz2 = rng.range(-ez + 0.25, ez - 0.25); }
      var tg = ctx.grass({ n: rng.int(3, 5), h: rng.range(0.22, 0.38), mat: rng.chance(0.5) ? 'leafLight' : 'hedge', seed: rng.range(0, 6) });
      tg.position.set(gx2, TOP, gz2);
      add(tg);
    }
    // 田角土石 1~2 块
    var nRock = rng.int(1, 2);
    for (var ri = 0; ri < nRock; ri++) {
      var cx = rng.chance(0.5) ? 1 : -1, cz = rng.chance(0.5) ? 1 : -1;
      var rk = ctx.rock({ r: rng.range(0.13, 0.19), detail: 0, seed: rng.range(0, 9), sy: 0.62, mat: 'earth' });
      rk.position.set(cx * (ex - 0.28), TOP - 0.01, cz * (ez - 0.28));
      add(rk);
    }
    // 田角水渠口
    var chx = (gateSide >= 2 ? 1 : -1) * (ex - 0.30);
    var chz = gateSide === 0 ? ez - 0.30 : (gateSide === 1 ? -(ez - 0.30) : 0);
    add(K.box(0.36, 0.10, 0.36, 'woodDark', chx, TOP - 0.05, chz));

    g.userData = { w: w, d: d, h: 0.6, kind: 'field', crop: crop, door: { x: 0, z: d / 2 } };
    var out = bakeByMaterial(g);
    out.name = 'field-' + crop;
    out.userData = g.userData;
    return out;
  };
})();
