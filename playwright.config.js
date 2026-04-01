import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:5173/P2P_Chat_App/',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/P2P_Chat_App/',
    reuseExistingServer: true,
    timeout: 15_000,
  },
})
