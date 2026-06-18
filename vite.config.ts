import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// In production we serve under a GitHub Pages project path
// (https://<user>.github.io/gw2-loadout/); dev serves from '/'. Override the
// prod path with VITE_BASE (e.g. '/' for a user/custom-domain deploy).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.VITE_BASE ?? '/gw2-loadout/' : '/',
  plugins: [react(), tailwindcss()],
}))
