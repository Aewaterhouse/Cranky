import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:8000', '/ws': { target: 'ws://localhost:8000', ws: true } },
    fs: { allow: ['..'] },
  },
  resolve: { alias: { '@content': resolve(__dirname, '../content') } },
  build: { rollupOptions: { input: { main: 'index.html', spike: 'spike.html' } } },
  test: { include: ['tests/**/*.test.ts'] },
})
