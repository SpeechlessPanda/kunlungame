# Kunlungame

Kunlungame 是一个面向 Windows 的桌面叙事游戏项目。当前仓库已经落下 Part 01 的最小桌面壳，用于承载后续的主线内容、知识检索与本地模型编排。

## 当前范围

1. Electron + Vue 3 + TypeScript + Vite 最小工程骨架。
2. 主进程、预加载层、渲染层与 shared 类型层的基础边界。
3. 桌面壳到模型启动规划器的最小桥接接口。
4. 运行时状态、态度值与最小存档读写恢复链路。
5. 基础类型检查、单元测试、构建与 e2e 入口。

## 开发命令

1. `pnpm install`
2. `pnpm dev`
3. `pnpm build`
4. `pnpm typecheck`
5. `pnpm test`
6. `pnpm test:e2e`
7. `pnpm models:download`
8. `pnpm knowledge:compile`

## 当前桌面壳能力

1. 主进程创建最小安全窗口，默认关闭 `nodeIntegration`，只允许预加载桥接暴露白名单 API。
2. 预加载层向渲染层暴露 `window.kunlunDesktop`，当前包含 `ping()` 和 `getStartupSnapshot()`。
3. 主进程启动时会调用模型启动规划器，为后续首次启动下载流程与设置页模型页预留稳定摘要。
4. 渲染层当前只挂载最小页面，用于验证壳层链路已通。
5. 知识层已经支持从受约束 Markdown 编译为结构化知识 JSON，并提供按节点、关键词、主题排序的检索逻辑。
6. 状态层已经支持默认存档创建、态度值钳制、终点节点回合推进、存档持久化与损坏回退。

## 当前已验证项

1. `pnpm test -- tests/desktopShell.test.ts`
2. `pnpm exec tsc --noEmit`
3. `pnpm exec vue-tsc --noEmit -p tsconfig.renderer.json`
4. `pnpm build`
5. `pnpm test -- tests/contentContracts.test.ts`
6. `pnpm test -- tests/knowledgeCompilation.test.ts`
7. `pnpm test -- tests/runtimeState.test.ts`
8. `pnpm test:e2e`

## 已知延期项

1. Playwright 当前只覆盖渲染层最小烟雾链路，尚未覆盖完整 Electron 黑盒启动与模型接入链路。
2. 运行时状态目前尚未接入 Electron 主进程 IPC 或正式设置页，只先稳定模型与仓储边界。
3. 正式 UI 视觉、主线推进、知识检索、内容素材接入均在后续 spec 中继续实现。