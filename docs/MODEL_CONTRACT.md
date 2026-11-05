# 模型契约 · 江南古村 3D 生成器

> 每个模型由一个独立子任务完成，本文件是唯一的接口约定。**只写自己那一个文件，不要改动 src/、tools/ 或其他模型文件。**

## 0. 工程位置

```
03-创意网页作品/jiangnan-village-3d/
├─ three.min.js          Three.js r160（UMD，全局 THREE）
├─ src/00-utils.js       随机数、几何合并 JN.Batch、动画注册表
├─ src/05-kit.js         材质库 + 共用构件（瓦作/木作/石作/植被）
├─ models/<name>.js       ← 你的产出，一个文件一个模型
└─ tools/verify.mjs       自检脚本（必须跑通）
```

## 1. 文件格式

```js
/* models/house.js —— 江南民居 */
(function () {
  'use strict';
  var JN = window.JN;
  JN.models['house'] = function (ctx) {
    // ctx.rng 确定性随机；ctx.mat('tile') 取材质（务必用 ctx.mat，材质必须共享才能合并）
    var g = new THREE.Group();
    ...
    g.userData = { w: 3.2, d: 2.8, h: 5.2, door: { x: 0, z: 1.4 }, kind: 'house' };
    return g;
  };
})();
```

- **不要**用 ES module / import / export，最终会被内联进单个 HTML。
- **不要**访问 `document`（除 `JN.kit.HAS_DOM` 判断外），所有贴图由材质库提供。
- 所有随机必须走 `ctx.rng`（同一 seed 必须完全一致）。
- 所有材质必须 `ctx.mat(名字)`（材质库里的名字，见 §5）。**禁止 new THREE.MeshStandardMaterial**（会导致无法合并、风格割裂）。
- 所有 mesh 必须 `castShadow = true; receiveShadow = true`（除非玻璃/纸/水面等确实不需要的薄片）。

## 2. 坐标系与尺寸

- 单位 = 1 格 ≈ 1.2 米。**所有模型原点在占地中心、y=0 是地面**，向上为 +Y。
- 默认朝向：**正面（门/入口）朝 +Z**。地图生成器会按门朝向旋转模型。
- 模型报出的 `userData.w / d / h` 必须与实际包围盒接近（±10%），生成器用它做碰撞与避让。
- `userData.door`：门在本地坐标中的位置（x,z），用于生成器对齐道路。

## 3. 自检（必须通过）

```bash
cd 03-创意网页作品/jiangnan-village-3d
node tools/verify.mjs <name> --file models/<name>.js
```

通过标准：4 个不同 seed 全部无异常、无 NaN、底部贴地（|min.y| ≤ 0.06）、三角面 15k–90k、网格 < 600。
把 verify 的最终输出贴在你的总结里。

## 4. 质量要求（这是重点）

要“高精度、可把玩的模型”，不是方块堆。逐项对照：

1. **轮廓**：江南民居必须有马头墙/硬山双坡瓦顶/出檐；桥必须有拱券、分水尖、栏板望柱；塔必须层层出檐、平座、塔刹。
2. **层次**：墙面要有勒脚（深色石基）、墙面、檐下木作/斗栱、瓦面、屋脊，至少 4 层材质区分。
3. **细节密度**：每栋建筑的可见细节 ≥ 8 类（窗棂、门簪、门环、瓦当、滴水、屋脊起翘、柱础、雀替、挂落、灯笼、匾额、石阶……）。
4. **不规则**：屋顶举折要带曲线（kit 已提供），墙要有微小倾斜/收分，构件要有随机微差（尺寸 ±5%、颜色靠材质变体），避免“完美盒子”。
5. **色彩**：只用 §5 的材质名；白墙黛瓦、木作赭褐、石作青灰。禁止高饱和色块。
6. **可玩性**：模型是俯瞰视角下的小景，最高 6-9 单位；不要做过大的单体。

## 5. 材质名（ctx.mat(name) 可用）

`plaster` 白墙 / `plasterWarm` 暖白 / `plasterGrey` 灰白（马头墙） / `tile` 黛瓦 / `tileDark` 深瓦 / `ridge` 脊瓦 / `ridgeLight` 瓦垄
`wood` 木 / `woodDark` 深木 / `woodLight` 浅木 / `woodRed` 朱木 / `woodRedDark` 暗朱 / `woodBlack` 黑漆 / `bamboo` 竹
`stone` 石 / `stoneLight` 浅石 / `stoneDark` 深石 / `stoneWet` 湿石 / `slab` 石板 / `slabDark` 深石板 / `brick` 砖
`thatch` 茅草 / `paper` 窗纸 / `paperLit` 亮窗纸
`clothRed` `clothDeep` `clothIndigo` `clothWhite` `clothUmber` 布
`gold` 金 / `bronze` 铜 / `iron` 铁 / `lacquerRed` 朱漆
`leafSpring` `leafDeep` `leafLight` `leafWillow` `leafPine` `leafMaple` `leafBlossom` `leafPlum` `hedge` 叶
`rice` `riceGold` 稻 / `earth` 土 / `mud` 淤泥 / `water` 水
`lantern` 灯笼 / `lanternGlow` 灯芯 / `mist` 雾

## 6. 可用的构建工具（ctx.xxx / JN.kit.xxx）

```js
ctx.mat(name)                       // 取共享材质
ctx.box(w, h, d, mat, x, y, z)      // 立方体
ctx.cyl(rt, rb, h, seg, mat, x,y,z)
ctx.uvBox(w, h, d, mat, su, sv)     // 带正确平铺 UV 的盒子（石阶、墙面）
ctx.lathe(points[[r,y],...], seg, mat)  // 车削：柱础、宝顶、罐
ctx.roofGable({w,d,h,over,curve,lift,tileRows,ridge,mat,ridgeOrn})  // 硬山双坡瓦顶，带举折+翼角+瓦垄+正脊
ctx.roofHip({w,d,h,over,lift,mat,finial})                           // 庑殿/攒尖
ctx.horseWall({len,height,steps,thick,mat})                          // 马头墙（阶梯山墙）
ctx.lattice({w,h,cols,rows,style:'grid'|'ice'|'step'|'round',paper,frame,rng}) // 格窗
ctx.door({w,h,double,studs,mat,frame,canopy})                        // 木门
ctx.steps({w,n,rise,run,mat})                                        // 石阶（向 -Z 上升）
ctx.plinth({w,d,h,mat})                                              // 台基
ctx.railing({len,h,mat,spacing})                                     // 石栏杆
ctx.lantern({r,h,mat,string,light})                                  // 灯笼（可带点光源）
ctx.banner({w,h,mat,pole})                                           // 旗幡
ctx.trunk({h,r,rTip,bend,seg,sides,mat,wave,rootFlare})              // 树干（可弯曲、根部膨大）
ctx.blob({r,mat,seed,amp,detail,flatY})                              // 噪声扰动树冠团
ctx.jar({r,h,mat})                                                   // 陶罐
ctx.kit                                                              // 完整工具对象 JN.kit
```

细节层可用 `JN.kit.materials` 之外自行计算的几何，但**材质必须来自 ctx.mat**。

## 7. 性能预算（单模型，合并前）

| 项 | 上限 |
|---|---|
| 三角面 | 60,000（目标 20k–45k） |
| Mesh 数 | 600（目标 120–350） |
| 材质种类 | ≤ 12 |

生成器会把整村合并成少量 draw call，所以细节可以大胆做，但别超预算。

## 8. 验收清单（贴进总结）

- [ ] `node tools/verify.mjs` 通过，4 seed 无警告性失败
- [ ] 原点在地面中心，正面朝 +Z，userData 完整
- [ ] 视觉：远看有剪影、近看有细节，无穿模、无悬空
- [ ] 所有材质来自材质库，无自定义材质
- [ ] 同一 seed 输出一致（无 Math.random）
