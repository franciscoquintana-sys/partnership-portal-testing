import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/sales-deck/',
  plugins: [react()],
  preview: {
    allowedHosts: true,
  },
})
