declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

declare global {
  interface Window {
    kunlunDesktop: import('../shared/types/desktop.js').DesktopBridge
  }
}

export {}