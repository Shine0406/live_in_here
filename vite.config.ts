import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { matchReportPlugin } from './server/matchReportPlugin.ts'
import { policyPlugin } from './server/policyPlugin.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [
      react(),
      matchReportPlugin({
        apiKey: env.OPENAI_API_KEY,
        baseURL: env.OPENAI_BASE_URL,
        model: env.OPENAI_MODEL,
      }),
      policyPlugin({ apiKey: env.YOUTH_API_KEY }),
    ],
  }
})
