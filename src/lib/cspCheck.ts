// The CSP in vercel.json names the hosts the app may reach (LED-325). A self-hosted Supabase on its
// own domain is not among them, and every request it makes is then blocked: the app loads blank.
// The build checks VITE_SUPABASE_URL against the policy so that shows up at build time instead.
// Pure: vite.config.ts passes the policy text in.

/** The sources a directive lists, or null when the policy has no such directive. */
export function directiveSources(csp: string, directive: string): string[] | null {
  for (const part of csp.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/)
    if (name === directive) return sources
  }
  return null
}

function sourceMatches(source: string, url: URL): boolean {
  const match = source.match(/^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([^/:]+)(?::(\d+|\*))?/i)
  if (!match) return false
  const [, scheme, wildcard, host, port] = match
  if (scheme && `${scheme.toLowerCase()}:` !== url.protocol) return false
  const hostname = url.hostname.toLowerCase()
  const target = host.toLowerCase()
  const hostOk = wildcard ? hostname.endsWith(`.${target}`) : hostname === target
  if (!hostOk) return false
  if (port && port !== '*') return (url.port || (url.protocol === 'https:' ? '443' : '80')) === port
  return port === '*' || url.port === ''
}

/** True when `directive` (falling back to default-src) lets the page reach `url`. */
export function cspAllows(csp: string, directive: string, url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const sources = directiveSources(csp, directive) ?? directiveSources(csp, 'default-src') ?? ['*']
  return sources.some((source) => source === '*' || (source !== "'self'" && !source.startsWith("'") && sourceMatches(source, parsed)))
}

/** The directives that would block the Supabase URL, empty when the policy allows it. */
export function blockedSupabaseDirectives(csp: string, supabaseUrl: string): string[] {
  return ['connect-src', 'img-src'].filter((directive) => !cspAllows(csp, directive, supabaseUrl))
}
