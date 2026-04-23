# Character 3D Asset Integration Design

## 1. 目标

为未来使用 Blender 或 Unreal 制作并导出的主角 3D 资源预先建立稳定的仓库合同、目录约定、导出清单与测试边界，使后续运行时接入不需要再次从零定义字段与文件组织方式。

## 2. 背景

当前仓库已经有背景素材槽位和角色 portrait 槽位，但角色侧仍停留在 2D 占位语义，没有覆盖 3D 角色运行时需要的模型、骨骼、材质、动作、表情、口型和挂点信息。

用户已确认以下约束：

1. 仓库内部主交付格式以 FBX 为主。
2. 角色最终以运行时 3D 形式在游戏中消费，而不是只导出为 2D 立绘。
3. 这次准备需要预留基础骨骼动画以及表情、口型接口。

## 3. 设计原则

1. 不破坏现有 2D portrait 槽位语义，3D 合同以并行形式新增。
2. 源资产管理与运行时消费解耦，避免 DCC 目录结构直接渗透到运行时代码。
3. 先定输入合同和导出清单，不提前锁死未来 3D runtime 的具体技术选型。
4. 新合同必须能同时容纳 Blender 与 Unreal 导出流程。
5. 版本字段必须显式存在，为后续导出规范演进保留兼容空间。

## 4. 方案比较

### 4.1 最小合同型

只新增主 FBX 路径、贴图目录和少量动作字段。

优点：

1. 改动最小。
2. 便于快速开始。

缺点：

1. 未来补表情、口型、LOD、挂点时容易重排字段。
2. 无法稳定表达 Blender/Unreal 源资产来源。

### 4.2 运行时重资产型

一次性定义完整运行时 3D 角色加载所需全部字段和所有可选资源。

优点：

1. 理论上一次到位。
2. 后续渲染层开发时字段更完整。

缺点：

1. 当前项目还未进入 3D 运行时实现阶段，容易过早绑定具体实现。
2. 合同复杂度高，初次导入资产时维护成本大。

### 4.3 双层清单型

把角色资产拆成源资产清单和运行时资产清单两层，通过统一角色槽位和版本字段关联。

优点：

1. 适合当前“先做资产准备，后接运行时”的阶段。
2. 能兼容 Blender 与 Unreal 的差异化导出流程。
3. 允许后续单独更换导出工具或导出脚本，而不打破运行时入口。

缺点：

1. Schema 比最小合同略大。
2. 需要多维护一份 manifest。

### 4.4 结论

本设计采用双层清单型。

## 5. 资产边界与对象模型

建议在现有内容契约旁边新增 3D 角色资产合同层，核心对象分为三类。

### 5.1 Character Runtime 3D Slot

职责：

1. 为剧情、UI、运行时和资产校验器提供统一入口键。
2. 作为角色 3D 资产包的稳定引用标识。

建议命名：

1. `character.<characterId>.runtime-3d`

### 5.2 Character Source Asset Manifest

职责：

1. 记录 DCC 侧源资产来源。
2. 记录导出是从哪个工具、哪个源场景、哪个预设产生的。
3. 供美术与技术回溯导出来源，而不直接供运行时消费。

建议字段：

1. `characterId`
2. `sourceTool`，枚举值至少包含 `blender`、`unreal`
3. `sourceProjectPath`
4. `sourceScene`
5. `masterFbxPath`
6. `textureSourceDir`
7. `notes`
8. `exportProfileVersion`

### 5.3 Character Runtime Asset Manifest

职责：

1. 作为程序消费 3D 角色资源的稳定单一入口。
2. 屏蔽具体导出工具差异，只暴露运行时需要的数据。

建议字段：

1. `characterId`
2. `version`
3. `runtimeModelFile`
4. `skeletonId`
5. `materialSet`
6. `animationSet`
7. `facialChannels`
8. `lipSyncChannels`
9. `mountPoints`
10. `physicsProxy`
11. `lods`
12. `scale`
13. `upAxis`

## 6. 目录与文件组织

每个角色资产建议使用统一目录布局：

1. `assets/characters/<characterId>/source/`
2. `assets/characters/<characterId>/runtime/`
3. `assets/characters/<characterId>/exports/`

目录职责：

### 6.1 source

1. 存放 Blender 工程、Unreal 工程引用、导出说明和原始贴图。
2. 允许较重、较碎的制作期文件存在。

### 6.2 runtime

1. 存放当前版本真正入包的运行时文件。
2. 包括主 FBX、贴图、动画清单、物理代理、runtime manifest。
3. 后续加载器、校验器和构建流程只能读取这里。

### 6.3 exports

1. 存放中间产物和临时导出结果。
2. 不视为稳定运行时输入。
3. 允许后续被清理或重建。

## 7. 最小必填合同

这次准备至少需要把以下字段固定下来：

1. `sourceTool`
2. `sourceScene`
3. `runtimeModelFile`
4. `skeletonId`
5. `materialSet`
6. `animationSet`
7. `facialChannels`
8. `lipSyncChannels`
9. `mountPoints`
10. `exportProfileVersion`

字段意图：

### 7.1 materialSet

必须表达材质槽到纹理集合的映射，至少覆盖基础色、法线、ORM 或项目定义的最小贴图集合。

### 7.2 animationSet

至少要求能表达 `idle`、`talk`、`react` 三类基础动作。后续可以扩展更多动作，但这三类是最小启动集。

### 7.3 facialChannels

用于表达表情通道名列表，不绑定具体实现为骨骼、blend shape 或其他驱动方式。

### 7.4 lipSyncChannels

用于表达口型通道或 viseme 名列表，作为后续 AI 驱动对白与口型映射的稳定入口。

### 7.5 mountPoints

用于定义武器点、特效点、注视点、UI 对话注视点等挂点集合。

## 8. 数据流

目标数据流如下：

1. 美术在 Blender 或 Unreal 中维护角色源工程。
2. 导出阶段产出主 FBX、贴图和动画片段。
3. 导出脚本或人工流程生成 source manifest 与 runtime manifest。
4. 仓库中的共享合同与测试先验证 manifest 结构正确。
5. 后续运行时加载器仅消费 runtime manifest，不直接扫描 source 目录。

这样可以保证：

1. 源资产管理与程序消费分离。
2. 未来即使更换导出脚本，只要 runtime manifest 不变，上层逻辑无需重写。

## 9. 错误处理与校验策略

这次准备阶段应明确以下失败条件：

1. 缺少 `runtimeModelFile` 时，manifest 校验失败。
2. 缺少 `skeletonId` 时，动画复用兼容性校验失败。
3. `animationSet` 缺失最小动作集合时，黑盒导入示例失败。
4. `sourceTool` 出现未定义值时，schema 失败。
5. `exportProfileVersion` 缺失时，manifest 不允许入库。
6. 口型或表情通道为空时，只有在角色被明确标记为无口型角色的前提下才允许；默认主角资产不允许为空。

## 10. 测试策略

### 10.1 黑盒测试

1. 给出一份最小 hero 运行时 3D manifest，系统能识别为合法。
2. 给出一份缺失基础动作的 manifest，系统会拒绝通过。
3. 给出一份缺失版本字段的 manifest，系统会拒绝通过。

### 10.2 白盒测试

1. `sourceTool` 枚举值与 schema 一致。
2. 角色 3D slot 命名规则稳定。
3. 表情与口型通道字段按预期保留数组形态。
4. material、animation、mount point 结构在最小样例中可正确解析。

## 11. 本轮实现边界

本轮后续实现只准备以下内容：

1. 新增共享 schema、类型和最小样例。
2. 新增 3D 角色导出规范文档。
3. 新增黑盒与白盒测试。
4. 保持现有 2D portrait 合同不变，仅新增并行 3D 合同。

明确不做：

1. 不实现模型加载器。
2. 不接 Electron IPC。
3. 不实现渲染层 UI。
4. 不绑定未来必须使用某个 3D runtime 框架。

## 12. 风险

1. 如果现在继续只保留 portrait 槽位，后续 3D 导入时会缺少统一入口，字段会在多个模块里临时生长。
2. 如果现在把运行时细节写得过深，会提前锁死未来 renderer 或引擎接入方式。
3. 如果不把导出版本写入 manifest，后续 Blender/Unreal 导出规范一变，历史资产兼容会失控。

## 13. 验收标准

1. 仓库内存在正式 3D 角色资产设计文档。
2. 设计明确 FBX 主交付、运行时 3D 消费和表情/口型预留三个关键约束。
3. 设计明确 source/runtime/exports 三层目录职责。
4. 设计明确共享合同、测试和文档的后续实现范围。