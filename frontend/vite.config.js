import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Fix 404 on page refresh during development
  server: {
    historyApiFallback: true,
  },
})
