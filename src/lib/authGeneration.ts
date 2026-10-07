// Which profile read may still land (LED-295). Pure: AuthContext keeps one per provider.
//
// A profile read takes a token when it starts. Its response may set the profile, write the data
// copy or move browser settings only while the token is current: the same user is signed in and
// no newer read has started and nothing has invalidated it since (sign-out, an account switch).
// A response that arrives after sign-out or after a switch to another account is dropped, so the
// previous account's profile never reappears on screen or in this browser's storage.

export interface AuthToken {
  readonly generation: number
  readonly userId: string
}

export interface AuthGeneration {
  /** Starts a read for `userId`; any read started earlier is no longer current. */
  begin: (userId: string) => AuthToken
  /** Whether a read's response may still be applied while `currentUserId` is signed in. */
  isCurrent: (token: AuthToken, currentUserId: string | null) => boolean
  /** Drops every outstanding read: sign-out, account deletion or a change of user. */
  invalidate: () => void
}

export function createAuthGeneration(): AuthGeneration {
  let generation = 0
  return {
    begin: (userId) => ({ generation: ++generation, userId }),
    isCurrent: (token, currentUserId) => token.generation === generation && token.userId === currentUserId,
    invalidate: () => {
      generation += 1
    },
  }
}
