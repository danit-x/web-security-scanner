import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'
import securityHeaders from './security-headers.json'

// Security headers for `vite preview` (the production build served locally),
// built from the same file vercel.json mirrors (QA DEF-010). Not applied to
// `vite dev`, where a CSP would block Vite's own hot-reload scripts.
const apiOrigin = process.env.VITE_API_URL || 'http://localhost:5000'
const csp = Object.entries(securityHeaders.contentSecurityPolicy)
  .map(([directive, sources]) => `${directive} ${sources.join(' ')}`.trim())
  .join('; ')
  .replace('%API_ORIGIN%', apiOrigin)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: {
    headers: { ...securityHeaders.headers, 'Content-Security-Policy': csp },
  },
})
