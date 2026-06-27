import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// GitHub Pages 배포 시 레포지토리 이름을 base로 설정
// 예: https://papavhub.github.io/HemStock/ 으로 배포되므로 '/HemStock/'
export default defineConfig({
  plugins: [react()],
  base: '/HemStock/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
