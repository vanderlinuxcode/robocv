

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    host: true,
    proxy: {
      '/api': {
        target: 'http:
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path
      },
      '/socket.io': {
        target: 'http:
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  }
})