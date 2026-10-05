import type { OAuthErrorMessage } from './oauthErrors.ts'

export type AuthErrorKind = 'profile' | 'session' | 'signout' | 'settings'

export interface AuthError {
  kind: AuthErrorKind
  message: string
  detail: string | null
}

const MESSAGES: Record<AuthErrorKind, string> = {
  profile: "Couldn't load your profile. Some details may be out of date.",
  session: "Couldn't check your sign-in. Reload to try again.",
  signout: "Signed out on this device. We couldn't reach the server, so your session may stay open elsewhere until it expires.",
  settings: "Couldn't save your settings to your account. They apply on this device until they're saved.",
}

const ACTION_LABELS: Record<AuthErrorKind, string> = {
  profile: 'Retry',
  session: 'Reload',
  signout: 'Try again',
  settings: 'Retry',
}

export function makeAuthError(kind: AuthErrorKind, detail?: string | null): AuthError {
  return { kind, message: MESSAGES[kind], detail: detail ?? null }
}

export function authErrorActionLabel(kind: AuthErrorKind): string {
  return ACTION_LABELS[kind]
}

/**
 * Google sign-in could not start (LED-196): `signInWithOAuth` returned an error or threw before
 * the redirect. Provider and library text is never shown; the message depends only on whether the
 * device is online.
 */
export function describeOAuthStartFailure(online: boolean): OAuthErrorMessage {
  if (!online) {
    return {
      title: "Couldn't start Google sign-in",
      body: "You're offline. Connect to the internet and try again.",
    }
  }
  return {
    title: "Couldn't start Google sign-in",
    body: 'Something went wrong before we could reach Google. Try again in a moment.',
  }
}
