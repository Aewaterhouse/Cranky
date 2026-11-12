import { defineConfig } from 'vite'
import { resolve } from 'node:path'

const API = process.env.ZB_API ?? 'http://localhost:8000'

export default defineConfig({
  server: {
    host: true,
    proxy: { '/api': API, '/ws': { target: API.replace('http', 'ws'), ws: true } },
    fs: { allow: ['..'] },
  },
  resolve: { alias: { '@content': resolve(__dirname, '../content') } },
  build: { rollupOptions: { input: { main: 'index.html', spike: 'spike.html' } } },
  test: { include: ['tests/**/*.test.ts'] },
})
