// Sign-in errors in plain language (LED-96). Supabase redirects back to /login
// with `error` and `error_description` in the URL. The description is provider
// text ("server_error: unable to exchange external code") and, being in the
// URL, anyone can craft it — so only the `error` code is read, and it picks one
// of our own messages. Nothing from the URL is ever rendered.

export interface OAuthErrorMessage {
  title: string
  body: string
}

const MESSAGES: Record<string, OAuthErrorMessage> = {
  access_denied: {
    title: "Sign-in didn't complete",
    body: 'Google sign-in was cancelled or not allowed. Try again — nothing was saved.',
  },
  server_error: {
    title: "Sign-in didn't complete",
    body: "We couldn't finish signing you in with Google. Try again — nothing was saved.",
  },
  temporarily_unavailable: {
    title: 'Sign-in is briefly unavailable',
    body: 'Google or our sign-in service is busy. Wait a moment and try again — nothing was saved.',
  },
}

const FALLBACK: OAuthErrorMessage = {
  title: "Sign-in didn't complete",
  body: 'Something went wrong while signing in. Try again — nothing was saved.',
}

export function describeOAuthError(code: string | null | undefined): OAuthErrorMessage {
  return (code && Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : undefined) ?? FALLBACK
}

/** The URL error, if Supabase sent one. Requires both params, as Supabase always sets both. */
export function oauthErrorFromSearch(search: string): OAuthErrorMessage | null {
  const params = new URLSearchParams(search)
  if (!params.has('error') || !params.has('error_description')) return null
  return describeOAuthError(params.get('error'))
}
