// The public address of a deployment, for the canonical link, og:url, sitemap.xml and robots.txt.
// Ledger is self-hostable, so the address is VITE_SITE_URL at build time, never a fixed domain.
// Without it the build omits the canonical link and the sitemap rather than publishing a
// placeholder. Pure: vite.config.ts and the tests import it.

/** Pages a search engine may index: the sign-in page and the legal pages (LED-189). */
export const PUBLIC_ROUTES = ['/', '/login', '/privacy', '/terms', '/data-deletion', '/cookies', '/notices'] as const

/** The site URL without a trailing slash, or null when it is unset or not an http(s) URL. */
export function normalizeSiteUrl(raw: string | undefined | null): string | null {
  const value = raw?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
  } catch {
    return null
  }
}

/**
 * og:image and twitter:image with an absolute URL. Link previews (Facebook, X, LinkedIn, Slack)
 * ignore a relative path, so a root-relative `content="/…"` gets the site URL in front. Without a
 * site URL the HTML is unchanged.
 */
export function absoluteImageTags(html: string, siteUrl: string | null): string {
  if (!siteUrl) return html
  return html.replace(
    /(<meta\s+(?:property="og:image"|name="twitter:image")\s+content=")\/(?!\/)/g,
    `$1${siteUrl}/`,
  )
}

/** Tags for <head>: canonical and og:url. Empty when there is no site URL. */
export function headTags(siteUrl: string | null): string {
  if (!siteUrl) return ''
  return [
    `<link rel="canonical" href="${siteUrl}/" />`,
    `<meta property="og:url" content="${siteUrl}/" />`,
  ].join('\n    ')
}

export function sitemapXml(siteUrl: string): string {
  const urls = PUBLIC_ROUTES.map((route) => {
    const priority = route === '/' ? '1.0' : route === '/login' ? '0.5' : '0.2'
    return `  <url>\n    <loc>${siteUrl}${route}</loc>\n    <priority>${priority}</priority>\n  </url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

/** robots.txt; it names the sitemap only when there is one (a Sitemap line must be absolute). */
export function robotsTxt(siteUrl: string | null): string {
  return `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ''}`
}
