export type AuthErrorKind = 'profile' | 'session' | 'signout'

export interface AuthError {
  kind: AuthErrorKind
  message: string
  detail: string | null
}

const MESSAGES: Record<AuthErrorKind, string> = {
  profile: "Couldn't load your profile. Some details may be out of date.",
  session: "Couldn't check your sign-in. Reload to try again.",
  signout: "Signed out on this device. We couldn't reach the server, so your session may stay open elsewhere until it expires.",
}

const ACTION_LABELS: Record<AuthErrorKind, string> = {
  profile: 'Retry',
  session: 'Reload',
  signout: 'Try again',
}

export function makeAuthError(kind: AuthErrorKind, detail?: string | null): AuthError {
  return { kind, message: MESSAGES[kind], detail: detail ?? null }
}

export function authErrorActionLabel(kind: AuthErrorKind): string {
  return ACTION_LABELS[kind]
}
