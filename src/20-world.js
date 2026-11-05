/* =========================================================================
 * 20-world.js — 江南古村 · 世界构建与渲染
 * 负责：地形 / 水体 / 街巷 / 建筑实例化 / 器物 / 远山雾气 / 灯光 / 相机
 * ========================================================================= */
(function () {
  'use strict';
  var JN = window.JN;
  var T = JN.T;
  var CELL = 1.0;      // 一格的边长（世界单位）
  var WATER_Y = -0.42; // 水面相对地面

  /* ------------------------------------------------------------------
   * 材质微调（季节 / 时刻）
   * ------------------------------------------------------------------ */
  function tuneMaterials(style) {
    var M = JN.kit.materials;
    var season = style.season, time = style.time;
    // 树叶换季：直接改共享材质颜色（同一时刻只存在一个世界，安全）
    var leafMap = {
      leafDeep: 1, leafSpring: 1, leafLight: 1, leafWillow: 1, leafPine: 1,
      leafMaple: 1, leafBlossom: 1, leafPlum: 1, hedge: 1
    };
    var seasons = {
      spring: { leafDeep: 0x4e6b3c, leafSpring: 0x7fa055, leafLight: 0x9fbb6d, leafWillow: 0xa8c273, leafPine: 0x3d5a44, leafMaple: 0x9c5b3a, leafBlossom: 0xecc2d0, leafPlum: 0xc85a72, hedge: 0x587a44 },
      summer: { leafDeep: 0x3d5a30, leafSpring: 0x5f7f3f, leafLight: 0x86a355, leafWillow: 0x93b061, leafPine: 0x36523f, leafMaple: 0x7f5a34, leafBlossom: 0xd9b7c4, leafPlum: 0xa85263, hedge: 0x4c6b3a },
      autumn: { leafDeep: 0x6b6b34, leafSpring: 0x8f8a44, leafLight: 0xb59a4d, leafWillow: 0xa3a05a, leafPine: 0x35503c, leafMaple: 0xa8452c, leafBlossom: 0xc98a72, leafPlum: 0x9e3f3f, hedge: 0x6a6b34 },
      winter: { leafDeep: 0x4c5a4a, leafSpring: 0x66735c, leafLight: 0x7f8a72, leafWillow: 0x6f7d5f, leafPine: 0x2f4a3a, leafMaple: 0x6b4a38, leafBlossom: 0xb04a5c, leafPlum: 0xa63a4a, hedge: 0x4f5c46 }
    };
    var pal = seasons[season.id] || seasons.summer;
    Object.keys(leafMap).forEach(function (k) {
      var m = M.get(k);
      if (m && pal[k] !== undefined) m.color.setHex(pal[k]);
    });
    // 稻作色
    var rice = M.get('rice'), riceGold = M.get('riceGold');
    if (rice) rice.color.setHex(season.id === 'autumn' ? 0xc0a44e : season.id === 'winter' ? 0x7b7f5c : 0x8fae54);
    if (riceGold) riceGold.color.setHex(season.id === 'winter' ? 0x9a9060 : 0xd0b45c);
    // 水色随时刻
    var water = M.get('water');
    if (water) {
      var col = { dawn: 0x36596a, noon: 0x2f6070, dusk: 0x4a4d63, night: 0x172636 }[time.id] || 0x2c4d59;
      water.color.setHex(col);
    }
    // 木色微调（季节湿度）
    var woods = ['wood', 'woodDark', 'woodDark', 'woodLight'];
    // 灯笼亮度
    var lant = M.get('lantern');
    if (lant) lant.emissiveIntensity = 0.35 + time.lantern * 0.5;
  }

  /* ------------------------------------------------------------------
   * 地形：整块起伏的台地（村内平坦，村外缓降），带材质混合
   * ------------------------------------------------------------------ */
  function buildTerrain(map, scene, style) {
    var G = map.G, C = map.C;
    var size = G * CELL;
    var half = size / 2;
    var PAD = 12;                    // 村落外草地边距（与地面铺装外圈对齐）
    var inner = half + PAD;

    // 1. 村外大地：环形（中间挖空，露出村内地面与水面），向外缓降
    var mat = new THREE.MeshStandardMaterial({ color: 0x94a482, roughness: 1.0 });
    var ring = new THREE.Group();
    var OUT = inner + 130;
    function slab(x0, z0, x1, z1, nx, nz) {
      var w = x1 - x0, d = z1 - z0;
      var geo = new THREE.PlaneGeometry(w, d, nx || 12, nz || 12);
      geo.rotateX(-Math.PI / 2);
      geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      var pos = geo.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), z = pos.getZ(i);
        var dx = Math.max(0, Math.abs(x) - inner);
        var dz = Math.max(0, Math.abs(z) - inner);
        var out = Math.sqrt(dx * dx + dz * dz);
        pos.setY(i, -Math.min(4.5, out * out * 0.0022) + Math.sin(x * 0.17) * Math.cos(z * 0.13) * 0.22 * Math.min(1, out / 12) - 0.02);
      }
      geo.computeVertexNormals();
      var m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      ring.add(m);
    }
    slab(-OUT, -OUT, OUT, -inner, 30, 10);   // 北
    slab(-OUT, inner, OUT, OUT, 30, 10);     // 南
    slab(-OUT, -inner, -inner, inner, 10, 14); // 西
    slab(inner, -inner, OUT, inner, 10, 14);   // 东
    ring.name = 'terrain';
    scene.add(ring);

    // 2. 村内地面 + 外圈草地：逐格铺（水格留空露出水面）
    var cells = map.cells, idx = map.idx;
    var rng = JN.makeRNG(map.seed ^ 0x77);
    var quads = [], colors = [];
    var base = new THREE.Color(style.season.grass);
    var soil = new THREE.Color(0x8a8562);
    var PAD2 = 12;
    for (var j = -PAD2; j < G + PAD2; j++) for (var ii = -PAD2; ii < G + PAD2; ii++) {
      var inside = ii >= 0 && j >= 0 && ii < G && j < G;
      var c = inside ? cells[idx(ii, j)] : T.EMPTY;
      if (c === T.WATER) continue;
      var px = (ii - G / 2 + 0.5) * CELL, pz = (j - G / 2 + 0.5) * CELL;
      var col = base.clone();
      // 田块略偏土色；其余（路、宅基）由模型覆盖，保持草色避免"花布"
      if (c === T.FIELD) col.lerp(soil, 0.42);
      col.offsetHSL(0, 0, (rng() - 0.5) * 0.012);
      var y = 0.0;
      var s = CELL / 2 + 0.006;
      quads.push(px - s, y, pz - s, px - s, y, pz + s, px + s, y, pz + s,
        px - s, y, pz - s, px + s, y, pz + s, px + s, y, pz - s);
      for (var k = 0; k < 6; k++) colors.push(col.r, col.g, col.b);
    }
    var g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(quads, 3));
    g2.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // 生成地面 UV，用于噪声贴图
    var uvs = new Float32Array(quads.length / 3 * 2);
    for (var v = 0, q = 0; v < quads.length; v += 3, q += 2) {
      uvs[q] = quads[v] * 0.35;
      uvs[q + 1] = quads[v + 2] * 0.35;
    }
    g2.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g2.computeVertexNormals();
    var gm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    var gtex = JN.kit.materials.textures && JN.kit.materials.textures.ground;
    if (gtex) {
      var gt = gtex.clone();
      gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
      gt.repeat.set(0.35, 0.35);
      gt.needsUpdate = true;
      gm.map = gt;
      gm.color = new THREE.Color(0xffffff);
    }
    var ground = new THREE.Mesh(g2, gm);
    ground.receiveShadow = true;
    ground.name = 'ground';
    scene.add(ground);

    // 3. 河床（只在河道范围内铺，避免在草地上露出深色）
    var bedQuads = [];
    for (var bj = 0; bj < G; bj++) for (var bi = 0; bi < G; bi++) {
      if (cells[idx(bi, bj)] !== T.WATER) continue;
      var bx = (bi - G / 2) * CELL, bz = (bj - G / 2) * CELL;
      bedQuads.push(bx, WATER_Y - 0.55, bz, bx, WATER_Y - 0.55, bz + CELL, bx + CELL, WATER_Y - 0.55, bz + CELL,
        bx, WATER_Y - 0.55, bz, bx + CELL, WATER_Y - 0.55, bz + CELL, bx + CELL, WATER_Y - 0.55, bz);
    }
    var bedGeo = new THREE.BufferGeometry();
    bedGeo.setAttribute('position', new THREE.Float32BufferAttribute(bedQuads, 3));
    bedGeo.computeVertexNormals();
    var bed = new THREE.Mesh(bedGeo, new THREE.MeshStandardMaterial({ color: 0x3b4139, roughness: 1 }));
    scene.add(bed);

    return { terrain: ring, ground: ground };
  }

  /* ------------------------------------------------------------------
   * 水面：单一平面 + 法线动画，边缘与河岸融合
   * ------------------------------------------------------------------ */
  function buildWater(map, scene, style) {
    var G = map.G, cells = map.cells, idx = map.idx;
    var mat = JN.kit.mat('water').clone();
    var tex = JN.kit.materials.textures && JN.kit.materials.textures.waterN;
    if (tex) {
      mat.normalMap = tex.clone();
      mat.normalMap.wrapS = mat.normalMap.wrapT = THREE.RepeatWrapping;
      mat.normalMap.repeat.set(0.28, 0.28);
      mat.normalMap.needsUpdate = true;
      mat.normalScale = new THREE.Vector2(0.35, 0.35);
    }
    mat.color = new THREE.Color({ dawn: 0x41646f, noon: 0x38606e, dusk: 0x565a6b, night: 0x1a2a38 }[style.time.id] || 0x35596a);
    mat.roughness = 0.06;
    mat.metalness = 0.25;
    mat.transparent = true;
    mat.opacity = 0.92;

    var verts = [], uvs = [];
    function quad(x0, z0, x1, z1) {
      var y = WATER_Y;
      verts.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1);
      uvs.push(x0 * 0.2, z0 * 0.2, x1 * 0.2, z0 * 0.2, x1 * 0.2, z1 * 0.2,
        x0 * 0.2, z0 * 0.2, x1 * 0.2, z1 * 0.2, x0 * 0.2, z1 * 0.2);
    }
    for (var j = 0; j < G; j++) for (var i = 0; i < G; i++) {
      if (cells[idx(i, j)] !== T.WATER) continue;
      var x = (i - G / 2) * CELL, z = (j - G / 2) * CELL;
      quad(x - 0.006, z - 0.006, x + CELL + 0.006, z + CELL + 0.006);
    }
    // 水口：河道延伸到画外（雾里消失）
    (map.waterExits || []).forEach(function (e) {
      var x, z, x2, z2;
      var EXT = 46;
      if (e.side === 'min') {
        if (e.axis === 'z') { x = (e.at - G / 2) * CELL; z = -G / 2 * CELL; x2 = x + CELL; z2 = z - EXT; }
        else { z = (e.at - G / 2) * CELL; x = -G / 2 * CELL; z2 = z + CELL; x2 = x - EXT; }
      } else {
        if (e.axis === 'z') { x = (e.at - G / 2) * CELL; z = (G / 2) * CELL; x2 = x + CELL; z2 = z + EXT; }
        else { z = (e.at - G / 2) * CELL; x = (G / 2) * CELL; z2 = z + CELL; x2 = x + EXT; }
      }
      quad(Math.min(x, x2), Math.min(z, z2), Math.max(x, x2), Math.max(z, z2));
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    var water = new THREE.Mesh(geo, mat);
    water.renderOrder = 1;
    water.name = 'water';
    scene.add(water);
    JN.anim.add(function (t) {
      if (mat.normalMap) {
        mat.normalMap.offset.x = t * 0.01;
        mat.normalMap.offset.y = t * 0.013;
      }
    });
    return water;
  }

  /* ------------------------------------------------------------------
   * 河岸：沿水边垒石驳岸
   * ------------------------------------------------------------------ */
  function buildBanks(map, scene) {
    var G = map.G, cells = map.cells, idx = map.idx;
    var batch = new JN.Batch();
    var rng = JN.makeRNG(map.seed ^ 0x5f3a);
    var stone = JN.kit.mat('stoneDark');
    var stone2 = JN.kit.mat('stone');
    for (var j = 0; j < G; j++) for (var i = 0; i < G; i++) {
      if (cells[idx(i, j)] === T.WATER) continue;
      var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (d) {
        var ii = i + d[0], jj = j + d[1];
        return ii >= 0 && jj >= 0 && ii < G && jj < G && cells[idx(ii, jj)] === T.WATER;
      });
      if (!nb.length) continue;
      var x = (i - G / 2 + 0.5) * CELL, z = (j - G / 2 + 0.5) * CELL;
      nb.forEach(function (d) {
        // 沿边堆 2~3 层错缝条石
        var along = d[0] === 0 ? 'x' : 'z';
        var bx = x + d[0] * 0.46, bz = z + d[1] * 0.46;
        var len = CELL * 1.02;
        var w = 0.22;
        var hTot = 0.95;
        for (var k = 0; k < 3; k++) {
          var hh = hTot / 3 * (0.92 + rng() * 0.16);
          var yy = -0.02 - k * (hTot / 3);
          var m = JN.kit.box(along === 'x' ? len : w, hh, along === 'x' ? w : len, k === 2 ? stone2 : stone, bx, yy, bz);
          m.rotation.y = (rng() - 0.5) * 0.02;
          batch.add(m);
        }
      });
    }
    var g = batch.build(scene, 'banks');
    return g;
  }

  /* ------------------------------------------------------------------
   * 街巷：石板路 + 路边牙石 + 排水沟
   * ------------------------------------------------------------------ */
  function buildStreets(map, scene) {
    var G = map.G, cells = map.cells, idx = map.idx;
    var batch = new JN.Batch();
    var rng = JN.makeRNG(map.seed ^ 0x1234);
    var slab = JN.kit.mat('slab');
    var slabD = JN.kit.mat('slabDark');
    for (var j = 0; j < G; j++) for (var i = 0; i < G; i++) {
      var c = cells[idx(i, j)];
      if (c !== T.ROAD && c !== T.PLAZA && c !== T.BRIDGE) continue;
      var x = (i - G / 2 + 0.5) * CELL, z = (j - G / 2 + 0.5) * CELL;
      if (c === T.BRIDGE) continue;
      // 路面：2×2 的小石板，带缝隙（石板 0.028 高，略低于门槛）
      var n = 2;
      var cellW = CELL / n;
      for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) {
        var sw = cellW * (0.90 + rng() * 0.06);
        var sd = cellW * (0.90 + rng() * 0.06);
        var m = JN.kit.box(sw, 0.05, sd, rng.chance(0.22) ? slabD : slab,
          x - CELL / 2 + cellW * (a + 0.5) + (rng() - 0.5) * 0.02,
          0.025 + rng() * 0.008,
          z - CELL / 2 + cellW * (b + 0.5) + (rng() - 0.5) * 0.02);
        m.rotation.y = (rng() - 0.5) * 0.08;
        JN.geo.scaleUV(m.geometry, 0.9, 0.9);
        batch.add(m);
      }
      if (c === T.PLAZA && rng.chance(0.10)) {
        var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 12), slabD);
        disc.position.set(x, 0.05, z);
        disc.receiveShadow = true;
        batch.add(disc);
      }
    }
    return batch.build(scene, 'streets');
  }

  /* ------------------------------------------------------------------
   * 建筑实例化
   * ------------------------------------------------------------------ */
  var rotations = { S: 0, N: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 };

  function placeBuilding(map, scene, batch, b, style) {
    var G = map.G;
    var x = (b.i + b.w / 2 - G / 2) * CELL;
    var z = (b.j + b.d / 2 - G / 2) * CELL;
    var name = b.kind === 'shop' ? 'shop' : b.kind === 'hall' ? 'hall' : 'house';
    var factory = JN.models[name] || JN.models.house;
    if (!factory) return null;
    // 同一 (类型, 尺寸桶, seed槽) 复用原型，避免 50 栋逐栋重建
    var sizeKey = b.w + 'x' + b.d;
    var key = name + '|' + sizeKey + '|' + (b.seed % 5);
    var cache = placeBuilding.cache || (placeBuilding.cache = {});
    var proto = cache[key];
    if (!proto) {
      var ctx = JN.kit.makeCtx(b.seed);
      ctx.opts = {
        w: b.w * CELL, d: b.d * CELL, seed: b.seed,
        bank: b.bank, main: b.main, kind: b.kind,
        scale: style.houseScale
      };
      try { proto = factory(ctx); } catch (e) { console.warn('模型构建失败', name, e); return null; }
      if (!proto) return null;
      var ud0 = proto.userData || {};
      var mw0 = ud0.w || 3.4, md0 = ud0.d || 3.4;
      var s0 = Math.min(b.w * CELL * 0.86 / mw0, b.d * CELL * 0.86 / md0);
      proto.scale.setScalar(s0);
      proto.updateMatrixWorld(true);
      cache[key] = proto;
    }
    var root = proto.clone(true);
    root.rotation.y = rotations[b.face] || 0;
    root.position.set(x, 0, z);
    root.updateMatrixWorld(true);
    batch.add(root);
    JN.dispose(root);
    var ud = proto.userData || {};
    return { b: b, pos: [x, z], h: (ud.h || 4) * (proto.scale.x || 1) };
  }

  /* ------------------------------------------------------------------
   * 牌坊 / 桥 / 田 / 树 / 船 / 埠头 / 道具
   * ------------------------------------------------------------------ */
  function placeAll(map, scene, style, onProgress) {
    var batch = new JN.Batch();
    var inst = new JN.Instancer();      // 重复构件（房/树/田/道具）走实例化
    var G = map.G;
    var world = { batch: batch, instancer: inst, animItems: [] };
    function X(i) { return (i - G / 2) * CELL; }
    function Z(j) { return (j - G / 2) * CELL; }

    // ---- 建筑（实例化：同类型同尺寸同 seed 槽共用模板） ----
    var bCache = {};
    map.buildings.forEach(function (b) {
      var name = b.kind === 'shop' ? 'shop' : b.kind === 'hall' ? 'hall' : 'house';
      var factory = JN.models[name] || JN.models.house;
      if (!factory) return;
      var key = name + '|' + b.w + 'x' + b.d + '|' + (b.seed % 4);
      var tpl = bCache[key];
      if (!tpl) {
        var ctx = JN.kit.makeCtx(b.seed);
        ctx.opts = {
          w: b.w * CELL, d: b.d * CELL, seed: b.seed,
          bank: b.bank, main: b.main, kind: b.kind, scale: style.houseScale
        };
        var root;
        try { root = factory(ctx); } catch (e) { console.warn('模型构建失败', name, e); return; }
        if (!root) return;
        var ud0 = root.userData || {};
        var mw0 = ud0.w || 3.4, md0 = ud0.d || 3.4;
        var s0 = Math.min(b.w * CELL * 0.86 / mw0, b.d * CELL * 0.86 / md0);
        root.scale.setScalar(s0);
        tpl = inst.addTemplate(key, root);
        tpl.scale = s0;
        tpl.height = (ud0.h || 4) * s0;
        bCache[key] = tpl;
        JN.dispose(root);
      }
      var m = new THREE.Matrix4();
      var q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotations[b.face] || 0);
      m.compose(
        new THREE.Vector3(X(b.i + b.w / 2), 0, Z(b.j + b.d / 2)),
        q,
        new THREE.Vector3(tpl.scale, tpl.scale, tpl.scale)
      );
      inst.add(key, m);
    });
    if (onProgress) onProgress(0.45, '营造屋舍');

    // ---- 点击代理（合并后仍可拾取） ----
    var pickGroup = new THREE.Group();
    pickGroup.name = 'pick-proxies';
    map.buildings.forEach(function (b, bi) {
      var cx = X(b.i + b.w / 2), cz = Z(b.j + b.d / 2);
      var ud = b.kind;
      var nameMap = {
        house: ['民居', '白墙黛瓦，马头墙高耸，一进天井'],
        shop: ['临水商铺', '前店后坊，挑台临河，酒旗招展'],
        hall: ['宗祠', '三开间两进，前廊后堂，合族议事之所'],
        courtyard: ['院落', '矮墙围合，内植花木，晾晒衣物']
      };
      var nm = nameMap[ud] || nameMap.house;
      var proxyGeo = new THREE.BoxGeometry(b.w * CELL * 0.95, 5.5, b.d * CELL * 0.95);
      var proxyMat = new THREE.MeshBasicMaterial({ visible: false });
      var proxy = new THREE.Mesh(proxyGeo, proxyMat);
      proxy.position.set(cx, 2.4, cz);
      proxy.userData.info = {
        title: nm[0],
        sub: (b.main ? '主街' : '巷内') + ' · 占地 ' + b.w + '×' + b.d + ' 格',
        body: nm[1] + '<br>门朝' + ({ N: '北', S: '南', W: '西', E: '东' }[b.face] || '街') +
          '，与邻舍留一圈空院。'
      };
      pickGroup.add(proxy);
    });
    // 宝塔与牌坊代理
    if (map.pagoda) {
      var pProxy = new THREE.Mesh(new THREE.BoxGeometry(4.4, 20, 4.4), new THREE.MeshBasicMaterial({ visible: false }));
      pProxy.position.set(X(map.pagoda.i + 0.5), 9, Z(map.pagoda.j + 0.5));
      pProxy.userData.info = {
        title: '宝塔', sub: '距最近民居 ' + (map.pagoda.dist || 18).toFixed(1) + ' 格',
        body: '七层八角，层层出檐，塔刹鎏金。登塔可俯瞰全村水系与街巷。'
      };
      pickGroup.add(pProxy);
    }
    map.paifangs.forEach(function (p) {
      var pr = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.5, 7.4), new THREE.MeshBasicMaterial({ visible: false }));
      pr.position.set(X(p.i + 0.5), 3.6, Z(p.j + 0.5));
      pr.rotation.y = p.axis === 'x' ? 0 : Math.PI / 2;
      pr.userData.info = {
        title: '牌坊', sub: '主路端头 · 四柱三间',
        body: '石柱承斗拱，匾额题字，是村口的门面与界标。'
      };
      pickGroup.add(pr);
    });
    scene.add(pickGroup);
    world.pickGroup = pickGroup;
    if (JN.app) JN.app.pickList = pickGroup.children;

    // ---- 厅堂前的旗杆石、广场 ----
    // ---- 宝塔 ----
    if (map.pagoda && JN.models.pagoda) {
      var pctx = JN.kit.makeCtx(map.seed ^ 0x777);
      pctx.opts = { scale: 1 };
      var pg = JN.models.pagoda(pctx);
      if (pg) {
        pg.position.set(X(map.pagoda.i + 0.5), 0, Z(map.pagoda.j + 0.5));
        pg.updateMatrixWorld(true);
        batch.add(pg);
        JN.dispose(pg);
      }
    }

    // ---- 牌坊 ----
    map.paifangs.forEach(function (p) {
      if (!JN.models.paifang) return;
      var ctx = JN.kit.makeCtx(p.seed);
      var g = JN.models.paifang(ctx);
      if (!g) return;
      g.position.set(X(p.i + 0.5), 0, Z(p.j + 0.5));
      g.rotation.y = p.axis === 'x' ? Math.PI / 2 : 0;
      g.updateMatrixWorld(true);
      batch.add(g);
      JN.dispose(g);
    });

    // ---- 桥 ----
    map.bridges.forEach(function (br) {
      var factory = JN.models[br.type] || JN.models.bridgeFlat;
      if (!factory) return;
      var ctx = JN.kit.makeCtx(br.seed);
      ctx.opts = { span: br.span };
      var g = factory(ctx);
      if (!g) return;
      var gw = (g.userData && g.userData.w) || 6;
      // 桥长按水面宽度 + 桥台（拱桥自带桥台，平桥略加长）
      var targetLen = (br.span + 2.2) * CELL;
      var s = targetLen / gw;
      g.scale.setScalar(Math.max(0.7, Math.min(1.25, s)));
      // 桥面高度对齐：拱桥模型自身 h 为桥顶，缩放到合适尺度
      g.position.set(X(br.i + 0.5), 0, Z(br.j + 0.5));
      // 通行方向：axis==='x' 表示街沿 X 走 → 桥的 X 轴对齐世界 X
      g.rotation.y = br.axis === 'x' ? 0 : Math.PI / 2;
      g.updateMatrixWorld(true);
      batch.add(g);
      JN.dispose(g);
    });
    if (onProgress) onProgress(0.6, '架设桥梁');

    // ---- 农田（实例化） ----
    var fCache = {};
    map.fields.forEach(function (f) {
      if (!JN.models.field) return;
      var key = 'field|' + f.crop + '|' + f.w + 'x' + f.d + '|' + (f.seed % 3);
      var tpl = fCache[key];
      if (!tpl) {
        var ctx = JN.kit.makeCtx(f.seed);
        ctx.opts = { w: f.w * CELL, d: f.d * CELL, crop: f.crop, seed: f.seed };
        var g = JN.models.field(ctx);
        if (!g) return;
        tpl = inst.addTemplate(key, g);
        tpl.scale = 1;
        fCache[key] = tpl;
        JN.dispose(g);
      }
      var m = new THREE.Matrix4().compose(
        new THREE.Vector3(X(f.i + f.w / 2), 0, Z(f.j + f.d / 2)),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1)
      );
      inst.add(key, m);
    });
    if (onProgress) onProgress(0.7, '开垦田畴');

    // ---- 树（实例化） ----
    var treeCache = {};
    map.trees.forEach(function (t) {
      if (!JN.models.tree) return;
      var key = 'tree|' + t.species + '|' + (t.seed % 3);
      var tpl = treeCache[key];
      if (!tpl) {
        var ctx = JN.kit.makeCtx(t.seed);
        ctx.opts = { species: t.species, lod: 0 };
        var proto = JN.models.tree(ctx);
        if (!proto) return;
        tpl = inst.addTemplate(key, proto);
        treeCache[key] = tpl;
        JN.dispose(proto);
      }
      var sc = t.s * style.houseScale * 0.72;
      var m = new THREE.Matrix4().compose(
        new THREE.Vector3(X(t.i + 0.5), 0, Z(t.j + 0.5)),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (t.seed % 628) / 100),
        new THREE.Vector3(sc, sc, sc)
      );
      inst.add(key, m);
    });
    if (onProgress) onProgress(0.82, '栽种林木');

    // ---- 船 ----
    map.boats.forEach(function (b) {
      if (!JN.models.boat) return;
      var ctx = JN.kit.makeCtx(b.seed);
      var g = JN.models.boat(ctx);
      if (!g) return;
      g.position.set(X(b.i + 0.5), WATER_Y + 0.12, Z(b.j + 0.5));
      g.rotation.y = (b.axis === 'x' ? 0 : Math.PI / 2) + ((b.seed % 100) / 100 - 0.5) * 0.35;
      g.scale.setScalar(b.s * 1.55);
      // 船不合并：需要轻微起伏动画
      g.userData.dynamic = true;
      g.traverse(function (o) { if (o.isMesh) o.userData.dynamic = true; });
      scene.add(g);
      var phase = (b.seed % 1000) / 1000 * 6.28;
      var y0 = g.position.y, r0 = g.rotation.z;
      JN.anim.add(function (tt) {
        g.position.y = y0 + Math.sin(tt * 1.1 + phase) * 0.035;
        g.rotation.z = r0 + Math.sin(tt * 0.8 + phase) * 0.02;
      });
    });

    // ---- 埠头 ----
    map.wharves.forEach(function (w) {
      if (!JN.models.wharf) return;
      var ctx = JN.kit.makeCtx(w.seed);
      var g = JN.models.wharf(ctx);
      if (!g) return;
      g.position.set(X(w.i + 0.5), 0, Z(w.j + 0.5));
      var rot = { S: 0, N: Math.PI, W: -Math.PI / 2, E: Math.PI / 2 }[w.face] || 0;
      g.rotation.y = rot + Math.PI;  // 埠头模型水面朝 -Z
      g.updateMatrixWorld(true);
      batch.add(g);
      JN.dispose(g);
    });

    // ---- 道具（实例化） ----
    var pCache = {};
    map.props.forEach(function (p) {
      if (!JN.models.props) return;
      var key = 'props|' + p.type + '|' + (p.seed % 3);
      var tpl = pCache[key];
      if (!tpl) {
        var ctx = JN.kit.makeCtx(p.seed);
        ctx.opts = { type: p.type };
        var g = JN.models.props(ctx);
        if (!g) return;
        tpl = inst.addTemplate(key, g);
        pCache[key] = tpl;
        JN.dispose(g);
      }
      var m = new THREE.Matrix4().compose(
        new THREE.Vector3(X(p.i + 0.5), 0, Z(p.j + 0.5)),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot),
        new THREE.Vector3(1, 1, 1)
      );
      inst.add(key, m);
    });

    // ---- 廊棚与亭 ----
    placeExtras(map, scene, batch, style);

    var merged = batch.build(scene, 'village');
    var instGroup = inst.build(scene, 'instanced');
    world.merged = merged;
    world.instGroup = instGroup;
    world.stats = {
      meshes: batch.sourceMeshes,
      verts: batch.vertices,
      tris: batch.triangles,
      instMeshes: instGroup.children.length
    };
    return world;
  }

  /* ------------------------------------------------------------------
   * 廊棚与亭（在 placeAll 合并前调用）
   * ------------------------------------------------------------------ */
  function placeExtras(map, scene, batch, style) {
    var G = map.G;
    var T = JN.T;
    function X(i) { return (i - G / 2) * CELL; }
    function Z(j) { return (j - G / 2) * CELL; }

    // ---- 廊棚 ----
    if (JN.models.corridor) {
      var used = 0;
      map.streets.filter(function (s) { return s.main; }).forEach(function (st) {
        if (used >= 2 || st.to - st.from < 14) return;
        var len = Math.min(10, st.to - st.from - 4);
        if (len < 7) return;
        var start = st.from + Math.floor((st.to - st.from - len) / 2);
        for (var t = start; t < start + len; t++) {
          var ii = st.axis === 'x' ? t : st.at;
          var jj = st.axis === 'x' ? st.at : t;
          if (map.cells[map.idx(ii, jj)] !== T.ROAD) return;
        }
        var ctx = JN.kit.makeCtx(map.seed ^ (st.at * 31 + start));
        ctx.opts = { len: len };
        var g = JN.models.corridor(ctx);
        if (!g) return;
        var mi = st.axis === 'x' ? start + len / 2 : st.at + 0.5;
        var mj = st.axis === 'x' ? st.at + 0.5 : start + len / 2;
        g.position.set(X(mi), 0, Z(mj));
        g.rotation.y = st.axis === 'x' ? 0 : Math.PI / 2;
        g.updateMatrixWorld(true);
        batch.add(g);
        JN.dispose(g);
        used++;
      });
    }

    // ---- 亭 ----
    if (JN.models.pavilion) {
      var cands = [];
      var pstart = Math.floor(map.seed % (G * G));
      for (var pk = 0; pk < G * G && cands.length < 2; pk++) {
        var pi = (pstart + pk * 7) % G, pj = Math.floor((pstart + pk * 13) / G) % G;
        if (pi < 2 || pj < 2 || pi >= G - 2 || pj >= G - 2) continue;
        var c0 = map.cells[map.idx(pi, pj)];
        if (c0 !== T.EMPTY && c0 !== T.BANK) continue;
        var nw = false, clear = true;
        for (var dj = -2; dj <= 2; dj++) for (var di = -2; di <= 2; di++) {
          var ii2 = pi + di, jj2 = pj + dj;
          if (ii2 < 0 || jj2 < 0 || ii2 >= G || jj2 >= G) continue;
          var c2 = map.cells[map.idx(ii2, jj2)];
          if (c2 === T.WATER) nw = true;
          if (c2 === T.BUILD) clear = false;
        }
        if (!nw || !clear) continue;
        cands.push([pi, pj]);
      }
      cands.forEach(function (c, k) {
        var ctx = JN.kit.makeCtx(map.seed ^ 0x999 ^ k);
        var g = JN.models.pavilion(ctx);
        if (!g) return;
        g.position.set(X(c[0] + 0.5), 0, Z(c[1] + 0.5));
        g.rotation.y = k * 1.1 + 0.3;
        g.updateMatrixWorld(true);
        batch.add(g);
        JN.dispose(g);
      });
    }
  }

  /* ------------------------------------------------------------------
   * 远山：多层水墨山峦（环状排布，越远越淡）
   * ------------------------------------------------------------------ */
  function buildBackdrop(map, scene, style) {
    var G = map.G, R = G * CELL * 0.5;
    var rng = JN.makeRNG(map.seed ^ 0xabc);
    var group = new THREE.Group();
    var night = style.time.id === 'night';

    // 环形山带：每一层是一圈连续的圆筒状山脊（像远山围合），避免单块平面被裁切
    var layers = [
      { r: 78, hMin: 10, hMax: 18, color: night ? 0x2b3f50 : 0x6f887c, alpha: 1.0, seg: 72 },
      { r: 108, hMin: 18, hMax: 30, color: night ? 0x22333f : 0x879d93, alpha: 0.75, seg: 64 },
      { r: 150, hMin: 30, hMax: 48, color: night ? 0x1a2833 : 0xa0b2a9, alpha: 0.48, seg: 56 }
    ];
    layers.forEach(function (L, li) {
      var seg = L.seg;
      var verts = [], cols = [];
      var base = new THREE.Color(L.color);
      var tip = base.clone().offsetHSL(0, -0.02, 0.05);
      // 生成一圈山脊高度序列（多个峰叠加）
      var peakRng = JN.makeRNG(map.seed ^ (0xabc + li * 31));
      var peaks = [];
      var np = 5 + li * 2;
      for (var p = 0; p < np; p++) peaks.push({ a: peakRng.range(0, Math.PI * 2), w: peakRng.range(0.12, 0.35), h: peakRng.range(0.5, 1.0) });
      function ridgeH(a) {
        var hh = 0;
        for (var q = 0; q < peaks.length; q++) {
          var d = Math.atan2(Math.sin(a - peaks[q].a), Math.cos(a - peaks[q].a)) / peaks[q].w;
          hh = Math.max(hh, peaks[q].h * Math.exp(-d * d * 0.9));
        }
        return L.hMin + (L.hMax - L.hMin) * hh;
      }
      for (var s = 0; s < seg; s++) {
        var a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
        var h0 = ridgeH(a0), h1 = ridgeH(a1);
        var x0 = Math.cos(a0) * L.r, z0 = Math.sin(a0) * L.r;
        var x1 = Math.cos(a1) * L.r, z1 = Math.sin(a1) * L.r;
        var yBot = -6;
        // 两个三角：底边两点 + 顶部两点（用四边形条带）
        verts.push(x0, yBot, z0, x1, yBot, z1, x1, h1, z1,
          x0, yBot, z0, x1, h1, z1, x0, h0, z0);
        // 顶部深、底部淡
        var c0 = base.clone(), c1 = tip.clone();
        for (var vv = 0; vv < 6; vv++) {
          var isTop = (vv === 2 || vv === 4 || vv === 5);
          var cc = isTop ? c1 : c0;
          cols.push(cc.r, cc.g, cc.b);
        }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      geo.computeVertexNormals();
      var mat = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: L.alpha,
        side: THREE.DoubleSide, fog: true, depthWrite: false
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 10 + li;
      group.add(mesh);
    });
    scene.add(group);

    // 雾
    var fogCol = new THREE.Color(style.time.bg);
    scene.fog = new THREE.Fog(fogCol.getHex(), style.time.fogNear, style.time.fogFar);
    scene.background = fogCol.clone();
    return group;
  }

  /* ------------------------------------------------------------------
   * 灯光
   * ------------------------------------------------------------------ */
  function buildLights(map, scene, style) {
    var tm = style.time;
    var hemi = new THREE.HemisphereLight(style.season.hemi, 0x5b5a4a, tm.hemiI * (tm.id === 'night' ? 1.5 : 1));
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(tm.sun, tm.sunI * (tm.id === 'night' ? 1.2 : 1));
    var ang = { dawn: 0.9, noon: 1.15, dusk: 2.1, night: 3.6 }[tm.id] || 1.0;
    sun.position.set(Math.cos(ang) * 34, 40, Math.sin(ang) * 30);
    sun.castShadow = true;
    var S = map.G * 0.62;
    sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
    sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 140;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    scene.add(sun.target);

    var fill = new THREE.DirectionalLight(0xcfe2ff, tm.id === 'night' ? 0.55 : 0.45);
    fill.position.set(-24, 18, -26);
    scene.add(fill);

    // 夜间：暖色环境补光（灯笼氛围）
    if (tm.id === 'night' || tm.id === 'dusk') {
      var warm = new THREE.PointLight(0xffb060, tm.id === 'night' ? 2.2 : 1.2, 90, 1.6);
      warm.position.set(0, 12, 0);
      scene.add(warm);
    }
    return { hemi: hemi, sun: sun, fill: fill };
  }

  JN.World = {
    tuneMaterials: tuneMaterials,
    buildTerrain: buildTerrain,
    buildWater: buildWater,
    buildBanks: buildBanks,
    buildStreets: buildStreets,
    placeAll: placeAll,
    buildBackdrop: buildBackdrop,
    buildLights: buildLights,
    WATER_Y: WATER_Y,
    CELL: CELL,
    rotations: rotations
  };
})();
