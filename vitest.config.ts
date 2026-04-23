import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      // realLlamaSession.ts 直接 import('node-llama-cpp') 并装载真实 GGUF，
      // 单元测试无法覆盖；该路径依靠 dialogue:smoke + e2e 兜底。
      exclude: ['src/modeling/realLlamaSession.ts']
    }
  }
})