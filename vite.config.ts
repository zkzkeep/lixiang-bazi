import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base 用相对路径，打包后可直接丢到 Cloudflare Pages / GitHub Pages / NAS 任意子目录
export default defineConfig({
  base: './',
  plugins: [react()],
})
