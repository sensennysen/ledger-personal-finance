# LED-32 — Theme toggle in the header

## Pattern
- Row 1 owns the theme toggle at every size: the desktop/tablet row already had it, the mobile row now has a Sun/Moon ghost button between search and the avatar. Settings keeps its Light/Dark selector unchanged.

## Decisions
- Removed the duplicate "Light/Dark theme" button from the mobile account sheet in `AppLayout` (and its now-unused `useTheme`, `Sun`, `Moon` imports). One entry per surface, per spec 2.2 item 3.

## Backlog
- **No browser check done** (needs Supabase/auth): row 1 at 390px with title, status, dashboard tools, search, toggle and avatar may crowd.
- "System" theme option (2B design item 7) is out of scope; `ThemeContext` stores only light/dark.
- LED-100 (dark token pair audit) is now unblocked.
