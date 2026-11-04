## 2026-11-04 · Navigation is a bottom tab bar on phones and a left rail on desktop

- Decided by: Claude, default
- Why: four destinations used one-handed on phones; a rail uses desktop width without stretching content
- Rejected: hamburger drawer (hides destinations behind a tap for a daily task); top tabs on phone (out of thumb reach)
- Rests on: docs/context-ke-khabe.md (Users), docs/REQUIREMENTS.md (UI: mobile-first)

## 2026-11-04 · Manage is hidden from members rather than shown disabled

- Decided by: Claude, default
- Why: members can never use it; a disabled tab adds noise and invites "why can't I?"
- Rejected: showing it disabled with an explanation
- Rests on: docs/REQUIREMENTS.md (Roles)

## 2026-11-04 · No notifications, streaks or nudges in v1

- Decided by: Claude, default
- Why: once-a-day utility; requirements list notifications as out of scope
- Rejected: morning reminder to order
- Rests on: docs/REQUIREMENTS.md (Out of scope)

## 2026-11-04 · Unbuilt destinations show an empty state, not disabled controls

- Decided by: Claude, default
- Why: the previous home card showed two disabled buttons with no path forward (dead end)
- Rejected: hiding unbuilt destinations until built
- Rests on: review of the `/` placeholder, 2026-11-04
