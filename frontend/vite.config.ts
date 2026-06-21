import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['cross-chain-betting-sdk', 'ethers'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
})
