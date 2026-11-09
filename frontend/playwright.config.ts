import { defineConfig, devices } from '@playwright/test'

// Tudo no fuso de São Paulo: o executor, o navegador (timezoneId) e o "hoje" do app.
const TIMEZONE = 'America/Sao_Paulo'
process.env.TZ = TIMEZONE

const API_PORT = Number(process.env.E2E_API_PORT ?? 8766)
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 4173)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    locale: 'pt-BR',
    timezoneId: TIMEZONE,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'celular', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      // API com banco temporário e os dados de exemplo do backend.
      command: 'bash e2e/run-backend.sh',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: { E2E_API_PORT: String(API_PORT) },
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      // Front de produção servido pelo Vite, que repassa /api para a API acima (sem o Worker).
      command: `npm run build && npx vite preview --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      env: { GP_API_ORIGIN: `http://127.0.0.1:${API_PORT}` },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
})
