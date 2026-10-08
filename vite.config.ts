import path from 'path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'
import { absoluteImageTags, headTags, normalizeSiteUrl, robotsTxt, sitemapXml } from './src/lib/siteMeta.ts'
import { blockedSupabaseDirectives } from './src/lib/cspCheck.ts'

// Canonical link, og:url, absolute og:image/twitter:image, sitemap.xml and robots.txt from VITE_SITE_URL. Unset, the build ships no
// canonical link and no sitemap rather than a placeholder domain (src/lib/siteMeta.ts).
function siteMeta(siteUrl: string | null): Plugin {
  return {
    name: 'ledger-site-meta',
    transformIndexHtml: (html) =>
      absoluteImageTags(html, siteUrl).replace(/ *<!-- site-meta:[^>]*-->\n?/, siteUrl ? `    ${headTags(siteUrl)}\n` : ''),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
      if (siteUrl) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl) })
    },
  }
}

// The CSP in vercel.json must let the app reach VITE_SUPABASE_URL, or a self-hosted Supabase on its
// own domain loads a blank app (LED-325, src/lib/cspCheck.ts). A Vercel build fails; elsewhere,
// where vercel.json is not served, it only warns.
function cspCheck(supabaseUrl: string | undefined): Plugin {
  return {
    name: 'ledger-csp-check',
    apply: 'build',
    buildStart() {
      // A build against local Supabase is for local use; vercel.json is not what serves it.
      if (!supabaseUrl || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(supabaseUrl)) return
      let csp: string | undefined
      try {
        const config = JSON.parse(readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'))
        csp = config.headers
          ?.flatMap((rule: { headers: { key: string; value: string }[] }) => rule.headers)
          .find((header: { key: string }) => header.key === 'Content-Security-Policy')?.value
      } catch {
        return
      }
      if (!csp) return
      const blocked = blockedSupabaseDirectives(csp, supabaseUrl)
      if (blocked.length === 0) return
      const message =
        `vercel.json's Content-Security-Policy does not allow VITE_SUPABASE_URL (${new URL(supabaseUrl).origin}) in ${blocked.join(' and ')}. ` +
        'Add its origin (and its wss:// origin to connect-src) or every request to Supabase is blocked. See README "Self-hosting on your own Supabase domain".'
      if (process.env.VERCEL) this.error(message)
      else this.warn(message)
    },
  }
}

// Code only the PDF export and the CSV import use (LED-317). The chunks these dynamic imports start
// are named `deferred-*`, left out of the precache and cached on first use (runtimeCaching below), so
// installing the app skips them. A chunk holds only what its entry alone reaches; shared code splits off.
const DEFERRED_ENTRY = /node_modules\/.*\/(jspdf|jspdf-autotable|html2canvas|dompurify|canvg)\/|src\/components\/transactions\/ImportCSVDialog\.tsx$/

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // The commit an error report names (LED-258). Vercel sets VERCEL_GIT_COMMIT_SHA on every build.
  define: {
    'import.meta.env.VITE_RELEASE': JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'local'),
  },
  server: {
    host: '127.0.0.1',
  },
  build: {
    rolldownOptions: {
      output: {
        chunkFileNames: (chunk) =>
          chunk.facadeModuleId && DEFERRED_ENTRY.test(chunk.facadeModuleId)
            ? 'assets/deferred-[name]-[hash].js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
  plugins: [
    siteMeta(normalizeSiteUrl(loadEnv(mode, process.cwd(), '').VITE_SITE_URL)),
    cspCheck(loadEnv(mode, process.cwd(), '').VITE_SUPABASE_URL),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Don't inject the manifest tag — we manage it manually in index.html
      injectManifest: undefined,
      manifest: false,
      workbox: {
        // The app shell and every page are precached, so any page opens offline after install. The
        // PDF and import code is not (LED-317).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        globIgnores: ['**/deferred-*.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MiB
        // Network-first for navigations so fresh HTML is always preferred
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // A deferred chunk, cached when first used so it works offline afterwards. File names
            // carry a content hash, so a cached copy never goes stale.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/deferred-.*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ledger-deferred-chunks',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
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
