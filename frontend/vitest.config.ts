import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts'],
      css: false,
      // Datas sempre no fuso de São Paulo: "hoje" depende do fuso, e o CI roda em UTC.
      env: { TZ: 'America/Sao_Paulo' },
      coverage: { include: ['src/**/*.{ts,tsx}'], exclude: ['src/test/**', 'src/main.tsx', 'src/lib/api-schema.d.ts'] },
    },
  }),
)
