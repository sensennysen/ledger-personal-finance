import path from 'path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { headTags, normalizeSiteUrl, robotsTxt, sitemapXml } from './src/lib/siteMeta.ts'

// Canonical link, og:url, sitemap.xml and robots.txt from VITE_SITE_URL. Unset, the build ships no
// canonical link and no sitemap rather than a placeholder domain (src/lib/siteMeta.ts).
function siteMeta(siteUrl: string | null): Plugin {
  return {
    name: 'ledger-site-meta',
    transformIndexHtml: (html) =>
      html.replace(/ *<!-- site-meta:[^>]*-->\n?/, siteUrl ? `    ${headTags(siteUrl)}\n` : ''),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
      if (siteUrl) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '127.0.0.1',
  },
  plugins: [
    siteMeta(normalizeSiteUrl(loadEnv(mode, process.cwd(), '').VITE_SITE_URL)),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Don't inject the manifest tag — we manage it manually in index.html
      injectManifest: undefined,
      manifest: false,
      workbox: {
        // Cache all app shell assets
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MiB
        // Network-first for navigations so fresh HTML is always preferred
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Cache Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Cache Google Fonts files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
