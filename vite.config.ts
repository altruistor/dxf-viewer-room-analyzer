import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/dxf-viewer-room-analyzer/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          dxfParser: ['dxf-parser'],
          libredwg: ['@mlightcad/libredwg-web']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    fs: {
      allow: ['..']
    }
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['@mlightcad/libredwg-web']
  }
})
