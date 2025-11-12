import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'unfunereal-matilda-frenular.ngrok-free.dev',
      'localhost',
      '127.0.0.1',
      '.ngrok-free.dev',
      '.ngrok.io',
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})

