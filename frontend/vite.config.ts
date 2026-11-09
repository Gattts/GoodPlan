import { readFileSync } from 'node:fs'
import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Em desenvolvimento e no `vite preview` dos testes de ponta a ponta, o navegador fala só com o Vite, que repassa
// /api para o backend. GP_API_ORIGIN troca o endereço do backend (o E2E usa outra porta).
const apiProxy = { '/api': process.env.GP_API_ORIGIN ?? 'http://127.0.0.1:8000' }

// O `vite preview` ignora o public/_headers: a CSP de produção é aplicada aqui para os testes de ponta a ponta valerem.
const headersFile = readFileSync(path.resolve(import.meta.dirname, 'public/_headers'), 'utf8')
const contentSecurityPolicy = /Content-Security-Policy:\s*(.+)/.exec(headersFile)?.[1]

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { proxy: apiProxy },
  preview: {
    proxy: apiProxy,
    headers: contentSecurityPolicy ? { 'Content-Security-Policy': contentSecurityPolicy } : undefined,
  },
})
