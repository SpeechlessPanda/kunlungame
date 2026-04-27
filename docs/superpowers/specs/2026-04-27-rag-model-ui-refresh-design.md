# RAG Model And UI Refresh Design

## 背景

本轮处理三个用户可见问题：确认默认模型是否真正接入 3B；修复每轮内容重复、知识段像写死脚本的问题；重构前端 UI/UX，使它更贴合 galgame 与中华文化传播场景。

## 设计结论

### 模型与真实链路

- 默认档继续使用 `qwen2.5-3b-instruct-q4km`，Pro 档保持 7B 需用户显式选择。
- 渲染层不得因为 preload 注入稍慢而永久停留在 mock。启动后要等待桌面 bridge 完成一次探测，再初始化运行时存档、模型 profile、下载状态和真实依赖工厂。
- 页面右下角 AI 状态要暴露当前来源与 profile，使用户能肉眼确认是 `3B Quality`、`1.5B Lite`、`7B Pro` 还是预览脚本。
- 桌面链路应优先使用 `streamMainlineTurn()`，让主进程在 `node-llama-cpp` 生成过程中通过请求专属 IPC 通道持续推送 chunk；旧 `runMainlineTurn()` 只作为缺失流式 bridge 时的回退。
- 如果首答被质量修复回合替换，IPC 先发送 `reset` 再发送修复后 chunk，渲染层必须清空短答草稿，避免用户看到两版内容拼接。
- preload 不能跨 `contextBridge` 返回 `AsyncIterable`；流式 bridge 对外使用 callback 事件，renderer adapter 再在本进程内包装成队列。

### RAG 知识组织

- 运行时保留当前节点边界检索，绝不跨未来节点偷取知识。
- 将检索结果从原始 Markdown 块改造成 AI 更容易遵循的 RAG cards：每张卡包含来源、摘要、事实要点、可讲角度，并明确要求模型用角色口吻重新组织，不得照抄条目。
- 修复知识编译摘要残留 Markdown 粗体符号的问题，避免模型直接学到 `**标题**`、列表符号等百科痕迹。
- 每一轮仍按 `turnsInCurrentNode` 轮换候选条目，使同节点多轮不会拿到完全相同的前三条知识。

### UI/UX 方向

Web 调研结论：Figma/itch.io 有大量 visual novel dialogue UI 与背景/立绘素材包；Kenney 提供通用 UI/input prompt 资源；Reka/Radix Vue 适合无样式可访问组件，Naive UI 适合完整后台式组件，Lucide Vue 适合树摇图标。当前项目是轻量 galgame 壳，不引入重型组件库，采用 `lucide-vue-next` 提供图标资产，保留本地 CSS 组件体系。

风格采用“玉牍星幕”：深青墨背景、玉白对话卷轴、朱砂/铜金小面积强调、竹简与星图纹理。首屏就是可游玩的视觉小说界面，不做营销页。信息架构保持：舞台背景、角色、顶部状态、底部对话、双选项、设置抽屉、结局覆盖层。

### 验收

- Vitest 覆盖模型 profile、runtime bootstrap、RAG card prompt、知识编译清洗、主线回合检索轮换。
- Playwright 覆盖开始游戏、选择推进、设置、移动端布局、截图 UAT。
- UAT 检查桌面与移动截图：文本不重叠、按钮可达、对话框不遮挡状态、状态 chip 明示 AI 来源、视觉风格不再是浅粉单色。

### 本轮验收结果

- 代码确认默认 profile 为 `qwen2.5-3b-instruct-q4km`，设置中的 Compatibility/Lite 才是 1.5B；旧文档中“默认 7B / compatibility 3B”的描述已修正。
- RAG cards、Markdown 清洗和同节点轮换已落入单元测试，避免知识段继续像固定脚本。
- 真实 3B smoke 已验证 `selectedProfileId = qwen2.5-3b-instruct-q4km`、`fallbackUsed = false`；短答会触发第二次本地 AI coverage repair，确保首节点知识覆盖更稳。
- IPC 流式改造已补充 preload、renderer adapter、session reset 和主线 runner 测试，确认 chunk 可以边生成边进 UI，修复回合会替换旧草稿。
- 构建版 Electron UAT 发现 sandbox preload 加载 ESM 产物会报 `Cannot use import statement outside a module`，导致 bridge 未注入、UI 回落到预览脚本；已将 preload 打成 CommonJS `out/preload/index.cjs` 并补回归测试。
- 最终真实 Electron UAT 使用 DOM `MutationObserver` 验证：构建版显示 `本地 AI · Quality Mode`，文本长度在选项出现前连续增长，首个可见字符约 6.56s，选项约 15.17s。
- 高对比度样式中的 `forced-color-adjust` 已放入 `@supports`，避免不支持该属性的浏览器产生兼容诊断。
- Playwright UAT 发现设置层被开始按钮穿透，已修复并新增回归断言。
- 当前仍使用占位 SVG 资产；视觉风格先完成壳层、图标与 token 重构，正式背景和立绘按后续资产槽位交付。
