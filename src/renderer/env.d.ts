/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

declare global {
  interface Window {
    /**
     * 桌面 bridge：仅在 Electron 桌面壳里由 preload 注入；
     * 浏览器/单元测试预览环境下为 undefined。所有访问点必须做 null-check。
     */
    kunlunDesktop?: import('../shared/types/desktop.js').DesktopBridge
    /**
     * 调试探针：DevTools 与 Playwright e2e 用来切 mock/real 流、注入错误、读取快照。
     * 类型用 unknown 是为了避免把 KunlunDebug 接口提到 shared 层；消费方自行 narrow。
     */
    __kunlunDebug?: unknown
  }
}

export { }