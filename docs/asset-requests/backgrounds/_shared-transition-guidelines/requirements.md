# 背景转场统一规范

目标：让 8 节点切换时“像讲述在呼吸”，而不是生硬换图。

统一规范：
- 基础转场：crossfade 500-700ms，easing 使用 `cubic-bezier(0.22, 1, 0.36, 1)`。
- 允许叠加：轻雾、纹样、微粒三类覆盖层，透明度不超过 0.35。
- 减少眩晕：禁止快速闪烁、禁止高频抖动。
- 无障碍：`prefers-reduced-motion` 时，转场降为 0-120ms。

实现对齐：
- 前端组件 `BackgroundStage.vue` 已实现 keyed transition。
- 资产方需保证相邻节点在亮度与色温上有可连续性。
