# LED-176 · "A account" in the unique-violation copy — retro (2026-09-29)

## What shipped
- `sentence()`'s `'unique'` case in `src/lib/dataErrors.ts` hardcoded `"A ${entity}"`. Now picks the article from the entity's first letter: `/^[aeiou]/i.test(entity) ? 'An' : 'A'`.
- Checked every real caller's `entity` string (grepped `entity:` across `src`): `account`, `exchange rate` (both vowel-starting, now read "An"), and `setting`, `rule`, `budget`, `saved filter`, `purchase`, `transaction`, `category usage`, `subcategory`, `category`, `goal`, `profile` (all consonant-starting, unchanged "A"). A plain vowel-letter heuristic gets every one of them right — no entity in the codebase needs a sound-based exception (e.g. nothing starts with a silent-h or a "u" pronounced as "yoo").

## Acceptance
- (a) 23505 on accounts reads "An account with that name already exists.": **PASS**, unit-tested.
- (b) Every noun the template is used with reads correctly: **PASS**, verified against the full caller list above.
- (c) Unit test in `tests/dataErrors.test.mjs`: **PASS** — added `unique violation picks "An" before a vowel-starting entity (LED-176)`, covering `account`, `exchange rate`, and a control case (`budget`).
- Lint, `tsc -b`, full test suite (10/10 in this file, 759 total): PASS.

## Backlog
- Not live-checked against the actual 409/23505 Add Account flow (browser extension unavailable this session) — the original repro was a real duplicate-name submission (`shots/126-error-unique.png`). The unit test exercises `describeDataError` directly with a synthetic `23505` error, which is what the ticket asked to be tested, so this is a nice-to-have rather than a gap in the AC.
