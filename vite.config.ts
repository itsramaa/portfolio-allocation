import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/binance': {
        target: 'https://api.binance.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/binance/, ''),
        configure: (proxy, options) => {
          proxy.on('error', (err) => {
            console.error('Proxy error:', err)
          })
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('Proxying request:', req.method, req.url, '->', String(options.target ?? '') + (req.url ?? ''))
          })
        }
      },
      '/bapi': {
        target: 'https://api.binance.com',
        changeOrigin: true,
        secure: true,
        configure: (proxy, options) => {
          proxy.on('error', (err) => {
            console.error('Alpha API proxy error:', err)
          })
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('Proxying Alpha request:', req.method, req.url, '->', String(options.target ?? '') + (req.url ?? ''))
          })
        }
      }
    }
  }
})
