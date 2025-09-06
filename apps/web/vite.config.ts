import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { resolve } from 'path'


// 支持通过环境变量 WEB_PORT 设置前端端口（可选，默认5173）
const port = Number(process.env.WEB_PORT) || 5173;

export default defineConfig({
  plugins: [react()],
  server: {
    port,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
