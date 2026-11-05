/* =========================================================================
 * 30-app.js — 江南古村 · 应用层（渲染器 / 相机 / 交互 / UI / 生成流水线）
 * ========================================================================= */
(function () {
  'use strict';
  var JN = window.JN;

  var app = {
    renderer: null, scene: null, camera: null, world: null, map: null,
    clock: null, time: 0, generation: 0, busy: false,
    camState: { theta: 0.72, phi: 0.92, radius: 62, target: new THREE.Vector3(0, 0, 0), dest: null },
    quality: 'high'
  };
  JN.app = app;

  var $ = function (id) { return document.getElementById(id); };
  var elLog, elTitle, elStyle, elStats, elChecks, elSeal, elToast, elLoading, elBar, elTip;

  /* ------------------------------------------------------------------
   * 初始化
   * ------------------------------------------------------------------ */
  function init() {
    elLog = $('log'); elTitle = $('villageName'); elStyle = $('styleName');
    elStats = $('stats'); elChecks = $('checks'); elSeal = $('seal');
    elToast = $('toast'); elLoading = $('loading'); elBar = $('bar'); elTip = $('tip');

    var canvas = document.createElement('canvas');
    canvas.id = 'gl';
    document.body.appendChild(canvas);

    var r;
    try {
      r = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      document.body.innerHTML = '<div style="color:#eee;padding:40px;font:16px serif">此浏览器不支持 WebGL，无法生成村落。</div>';
      return;
    }
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.SRGBColorSpace !== undefined) r.outputColorSpace = THREE.SRGBColorSpace;
    if (THREE.ACESFilmicToneMapping !== undefined) {
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.0;
    }
    app.renderer = r;

    app.scene = new THREE.Scene();
    app.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.5, 420);
    app.clock = new THREE.Clock();

    window.addEventListener('resize', onResize);
    bindInput(canvas);
    bindUI();

    if (location.hash && /^#\d+/.test(location.hash)) {
      var h = parseInt(location.hash.slice(1), 10);
      if (isFinite(h)) { generate(h); startLoop(); return; }
    }
    var q = new URLSearchParams(location.search);
    if (q.get('seed')) {
      app.forceOpts = { layout: q.get('layout'), season: q.get('season'), time: q.get('time') };
      app.forceCam = q.get('cam');
      generate(+q.get('seed'));
      startLoop();
      return;
    }
    generate((Math.random() * 1e9) | 0);
    startLoop();
  }

  function onResize() {
    if (!app.renderer) return;
    app.renderer.setSize(window.innerWidth, window.innerHeight);
    app.camera.aspect = window.innerWidth / window.innerHeight;
    app.camera.updateProjectionMatrix();
  }

  /* ------------------------------------------------------------------
   * 相机：轨道 + 平滑
   * ------------------------------------------------------------------ */
  function updateCamera(dt) {
    var c = app.camState;
    if (c.dest) {
      c.theta += (c.dest.theta - c.theta) * Math.min(1, dt * 6);
      c.phi += (c.dest.phi - c.phi) * Math.min(1, dt * 6);
      c.radius += (c.dest.radius - c.radius) * Math.min(1, dt * 5);
      if (Math.abs(c.dest.theta - c.theta) < 0.002 &&
        Math.abs(c.dest.phi - c.phi) < 0.002 &&
        Math.abs(c.dest.radius - c.radius) < 0.05) {
        c.theta = c.dest.theta; c.phi = c.dest.phi; c.radius = c.dest.radius;
        c.dest = null;
      }
    }
    var phi = Math.max(0.18, Math.min(1.42, c.phi));
    var r = Math.max(20, Math.min(150, c.radius));
    var cx = c.target.x + Math.sin(c.theta) * Math.sin(phi) * r;
    var cy = c.target.y + Math.cos(phi) * r;
    var cz = c.target.z + Math.cos(c.theta) * Math.sin(phi) * r;
    app.camera.position.set(cx, cy, cz);
    app.camera.lookAt(c.target);
  }

  function flyTo(theta, phi, radius) {
    app.camState.dest = { theta: theta === undefined ? app.camState.theta : theta, phi: phi === undefined ? app.camState.phi : phi, radius: radius === undefined ? app.camState.radius : radius };
  }

  /* ------------------------------------------------------------------
   * 输入
   * ------------------------------------------------------------------ */
  function bindInput(canvas) {
    var dragging = false, lastX = 0, lastY = 0, moved = 0;
    var touchDist = 0;
    function down(x, y) { dragging = true; lastX = x; lastY = y; moved = 0; canvas.style.cursor = 'grabbing'; }
    function move(x, y) {
      if (!dragging) return;
      var dx = x - lastX, dy = y - lastY;
      lastX = x; lastY = y;
      moved += Math.abs(dx) + Math.abs(dy);
      app.camState.dest = null;
      app.camState.theta -= dx * 0.006;
      app.camState.phi = Math.max(0.18, Math.min(1.42, app.camState.phi - dy * 0.005));
    }
    function up() { dragging = false; canvas.style.cursor = 'grab'; }

    canvas.addEventListener('mousedown', function (e) { down(e.clientX, e.clientY); });
    window.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', up);
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      app.camState.dest = null;
      app.camState.radius = Math.max(18, Math.min(150, app.camState.radius * (1 + Math.sign(e.deltaY) * 0.08)));
    }, { passive: false });

    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) down(e.touches[0].clientX, e.touches[0].clientY);
      else if (e.touches.length === 2) {
        touchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
      if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY);
      else if (e.touches.length === 2) {
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (touchDist) {
          app.camState.dest = null;
          app.camState.radius = Math.max(18, Math.min(150, app.camState.radius * (touchDist / d)));
        }
        touchDist = d;
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', function () { up(); touchDist = 0; }, { passive: true });

    // 键盘
    window.addEventListener('keydown', function (e) {
      if (e.key === 'r' || e.key === 'R') { generate(); }
      if (e.key === ' ') { e.preventDefault(); flyTo(app.camState.theta + Math.PI * 0.5); }
      if (e.key === '1') flyTo(0.72, 0.95, 66);
      if (e.key === '2') flyTo(0.72, 0.42, 52);
    });
  }

  function bindUI() {
    elSeal.addEventListener('click', function () { if (!app.busy) generate(); });
    var btnStyle = $('btnStyle');
    if (btnStyle) btnStyle.addEventListener('click', function () {
      app.camState.dest = null;
      flyTo(app.camState.theta + Math.PI * 0.35, app.camState.phi, app.camState.radius);
    });
    var btnTop = $('btnTop');
    if (btnTop) btnTop.addEventListener('click', function () { flyTo(0.72, 0.34, 74); });
    var btnEye = $('btnEye');
    if (btnEye) btnEye.addEventListener('click', function () { flyTo(app.camState.theta, 1.18, 34); });
    var btnSave = $('btnSave');
    if (btnSave) btnSave.addEventListener('click', function () { saveImage(); });
    var btnChecks = $('btnChecks');
    if (btnChecks) btnChecks.addEventListener('click', function () {
      var p = $('checks');
      if (p) p.classList.toggle('open');
    });
    var btnLight = $('btnLight');
    if (btnLight) btnLight.addEventListener('click', function () { cycleTime(); });

    // 点击建筑：射线拾取 → 显示信息
    app.canvas = $('gl');
    var downXY = [0, 0];
    app.canvas.addEventListener('pointerdown', function (e) { downXY = [e.clientX, e.clientY]; });
    app.canvas.addEventListener('pointerup', function (e) {
      if (Math.abs(e.clientX - downXY[0]) + Math.abs(e.clientY - downXY[1]) > 8) return;
      pickAt(e.clientX, e.clientY);
    });
    var infoClose = $('infoClose');
    if (infoClose) infoClose.addEventListener('click', hideInfo);
  }

  function pickAt(cx, cy) {
    if (!app.map || !app.world) return;
    var rect = app.canvas.getBoundingClientRect();
    var pointer = new THREE.Vector2(
      ((cx - rect.left) / rect.width) * 2 - 1,
      -((cy - rect.top) / rect.height) * 2 + 1
    );
    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, app.camera);
    var hits = raycaster.intersectObjects(app.pickList, false);
    if (!hits.length) { hideInfo(); return; }
    var info = hits[0].object.userData.info;
    if (info) showInfo(info);
  }

  function showInfo(info) {
    var card = $('infoCard');
    if (!card) return;
    card.querySelector('.ic-title').textContent = info.title;
    card.querySelector('.ic-sub').textContent = info.sub;
    card.querySelector('.ic-body').innerHTML = info.body;
    card.classList.add('show');
  }
  function hideInfo() {
    var card = $('infoCard');
    if (card) card.classList.remove('show');
  }

  function cycleTime() {
    if (!app.map || app.busy) return;
    var pool = JN.MapGen.STYLE_POOL.time;
    var idx = pool.findIndex(function (t) { return t.id === app.map.style.time.id; });
    var next = pool[(idx + 1) % pool.length];
    var seed = app.map.seed;
    app.forceOpts = Object.assign({}, app.forceOpts || {}, {
      layout: app.map.style.layout.id,
      season: app.map.style.season.id,
      time: next.id
    });
    generate(seed);
    toast('时辰 → ' + next.name);
  }

  /* ------------------------------------------------------------------
   * 生成流水线
   * ------------------------------------------------------------------ */
  var NAME_A = ['梅', '柳', '莲', '荷', '竹', '兰', '棠', '杏', '桑', '稻', '溪', '汀', '涵', '云', '月', '烟', '雨', '雪', '棠', '沅'];
  var NAME_B = ['溪', '塘', '墩', '村', '坞', '泾', '浜', '桥', '渡', '口', '里', '庄', '洲', '埭', '漾'];
  var NAME_C = ['荷风', '映月', '听雨', '问梅', '枕流', '涵碧', '拾翠', '望仙', '涵芳', '栖云'];

  function pickName(rng) {
    if (rng.chance(0.55)) return rng.pick(NAME_A) + rng.pick(NAME_B);
    return rng.pick(NAME_C) + '村';
  }

  function generate(seed) {
    if (app.busy) return;
    app.busy = true;
    elLoading.classList.add('show');
    elBar.style.width = '6%';
    setTip('勘定山水……');

    var s = seed === undefined ? (Math.random() * 1e9) | 0 : seed;
    setTimeout(function () { step1(s); }, 30);
  }

  function setTip(t) { if (elTip) elTip.textContent = t; }

  function step1(seed) {
    var t0 = performance.now();
    var map;
    try {
      map = JN.MapGen.generate(seed, app.forceOpts || {});
    } catch (e) {
      console.error(e);
      toast('生成失败：' + e.message);
      app.busy = false; elLoading.classList.remove('show');
      return;
    }
    app.map = map;
    var genMs = performance.now() - t0;
    elBar.style.width = '22%';
    setTip('开浚河渠……');
    setTimeout(function () { step2(map, genMs); }, 20);
  }

  function step2(map, genMs) {
    // 清理旧世界
    clearWorld();
    var scene = app.scene;
    JN.anim.clear();
    var style = map.style;
    JN.World.tuneMaterials(style);

    var t0 = performance.now();
    var rng = JN.makeRNG(map.seed);
    elBar.style.width = '36%';
    setTip('平治水土……');
    // 分帧：先地形/水/远山，再驳岸/街巷，最后模型（避免长任务卡死）
    requestAnimationFrame(function () {
      try {
        JN.World.buildTerrain(map, scene, style);
        JN.World.buildWater(map, scene, style);
        JN.World.buildBackdrop(map, scene, style);
        app.lights = JN.World.buildLights(map, scene, style);
      } catch (e) { console.error(e); failGen(e); return; }
      elBar.style.width = '50%';
      setTip('垒砌驳岸……');
      requestAnimationFrame(function () {
        try {
          JN.World.buildBanks(map, scene);
          JN.World.buildStreets(map, scene);
        } catch (e) { console.error(e); failGen(e); return; }
        elBar.style.width = '62%';
        setTip('营造屋舍……');
        requestAnimationFrame(function () {
          var world;
          try {
            world = JN.World.placeAll(map, scene, style, function (p, label) {
              elBar.style.width = Math.round(62 + p * 32) + '%';
              setTip(label + '……');
            });
          } catch (e) { console.error(e); failGen(e); return; }
          app.world = world;
          app.buildMs = performance.now() - t0;
          app.genMs = genMs;
          elBar.style.width = '100%';
          setTip('村落已成');
          setTimeout(function () { finish(map, world); }, 150);
        });
      });
    });
  }

  function failGen(e) {
    toast('构建出错：' + e.message);
    app.busy = false;
    elLoading.classList.remove('show');
  }

  function clearWorld() {
    if (!app.scene) return;
    var keep = [];
    var toRemove = [];
    app.scene.children.forEach(function (c) {
      if (c.isLight) keep.push(c);
      else toRemove.push(c);
    });
    toRemove.forEach(function (c) {
      app.scene.remove(c);
      c.traverse(function (o) {
        if (o.isMesh) {
          if (o.geometry) o.geometry.dispose();
          if (o.material && o.material.dispose && !o.userData.sharedMat) o.material.dispose();
        }
      });
    });
    app.lights = null;
  }

  /* ------------------------------------------------------------------
   * 生成完成：刷新 UI
   * ------------------------------------------------------------------ */
  function finish(map, world) {
    app.busy = false;
    elLoading.classList.remove('show');
    document.body.classList.add('ready');

    var rng = JN.makeRNG(map.seed ^ 0x9e3779b9);
    var name = pickName(rng);
    elTitle.textContent = name;
    elStyle.innerHTML = '<b>' + map.style.layout.name + '</b> · ' + map.style.season.name + ' · ' + map.style.time.name;
    document.title = name + ' · 江南古村';

    var st = map.stats;
    var tri = world && world.stats ? Math.round(world.stats.tris) : 0;
    elStats.innerHTML = [
      row('屋舍', st.houses + ' 栋', '其中厅堂 ' + st.hall + '、临水商铺 ' + st.shop),
      row('桥', st.bridges + ' 座', '拱桥 ' + map.bridges.filter(function (b) { return b.type === 'bridge'; }).length + '、平桥 ' + map.bridges.filter(function (b) { return b.type === 'bridgeFlat'; }).length),
      row('田野', st.fields + ' 块', '稻 / 蔬 / 油菜 / 桑'),
      row('林木', st.trees + ' 株', '临水、边缘、树丛加密'),
      row('牌坊', st.paifangs + ' 座', '主路两端 ' + Math.round(map.paifangRatio * 100) + '%'),
      row('面数', (tri / 1000).toFixed(1) + 'k', '合并后 ' + (world && world.merged ? world.merged.children.length : 0) + ' 个 draw call')
    ].join('');

    renderChecks(map.checks);

    // 视角：随机方位俯瞰
    var theta = rng.range(0, Math.PI * 2);
    app.camState.theta = theta;
    app.camState.phi = 0.88;
    app.camState.radius = 74;
    app.camState.dest = { theta: theta + 0.4, phi: 0.80, radius: 60 };
    if (app.forceCam) {
      var parts = app.forceCam.split(',').map(Number);
      if (parts.length >= 3) {
        app.camState.theta = parts[0]; app.camState.phi = parts[1];
        app.camState.radius = parts[2]; app.camState.dest = null;
      }
    }
    if (app.world && app.world.pickGroup) app.pickList = app.world.pickGroup.children;
    history.replaceState(null, '', '#' + map.seed);
    toast('已生成 · ' + map.style.layout.name);
  }

  function row(k, v, s) {
    return '<div class="row"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + (s || '') + '</div></div>';
  }

  function renderChecks(checks) {
    var html = '';
    checks.list.forEach(function (c) {
      html += '<li class="' + (c.ok ? 'ok' : 'bad') + '"><i>' + (c.ok ? '✓' : '✗') + '</i><div><b>[' + c.id + '] ' + c.name + '</b><span>' + c.detail + '</span></div></li>';
    });
    elChecks.innerHTML = html;
    var badge = $('badge');
    if (badge) badge.textContent = checks.allPass ? '八规皆合' : '有待修整';
    if (badge) badge.className = 'badge ' + (checks.allPass ? 'ok' : 'bad');
  }

  var toastTimer = null;
  function toast(msg) {
    elToast.textContent = msg;
    elToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { elToast.classList.remove('show'); }, 2200);
  }

  function saveImage() {
    try {
      app.renderer.render(app.scene, app.camera);
      var url = app.renderer.domElement.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = (elTitle.textContent || '江南古村') + '-seed-' + (app.map ? app.map.seed : 'x') + '.png';
      a.click();
      toast('已保存为图片');
    } catch (e) { toast('保存失败：' + e.message); }
  }

  /* ------------------------------------------------------------------
   * 主循环
   * ------------------------------------------------------------------ */
  function startLoop() {
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      app.time += dt;
      try {
        updateCamera(dt);
        JN.anim.tick(app.time, dt);
        app.renderer.render(app.scene, app.camera);
      } catch (e) {
        console.error(e);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
