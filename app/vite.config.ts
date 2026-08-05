import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed under zircl.org/app (same domain as the landing page, see
// ../vercel.json) — base only applies to production builds so local dev
// still runs at the plain localhost root.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/app/' : '/',
  server: { port: Number(process.env.PORT) || 5180, host: true },
  build: { outDir: 'dist', sourcemap: false },
}))
