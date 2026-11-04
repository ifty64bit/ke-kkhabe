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

## 2026-11-04 · Today is a single centered prompt with links under it; no sidebar or tab bar

- Decided by: the designer
- Why: the app's daily job is one question; app-style navigation and a card around the question added chrome without purpose
- Rejected: left rail and bottom tab bar (previous default)
- Rests on: designer feedback on the rail layout, 2026-11-04

## 2026-11-04 · Items are picked in a dialog opened from "হ্যাঁ, খাবো"

- Decided by: the designer
- Why: keeps the prompt clean; the picker appears only when the answer is yes
- Rejected: inline item list under the prompt
- Rests on: designer feedback, 2026-11-04

## 2026-11-04 · The egg-pan tile is the brand mark

- Decided by: the designer
- Why: the designer preferred it to the wordmark-only header
- Rejected: wordmark only
- Rests on: designer feedback, 2026-11-04

## 2026-11-04 · A day's price is the item's total cost, split evenly per piece

- Decided by: the designer
- Why: prices change daily, and when a shop runs out an item can come from a second shop at a different price on the same day; the total captures both
- Rejected: one per-piece price chosen by the manager (total may not match what was spent); charging by which shop's piece (manager must assign pieces to people)
- Rests on: designer answer, 2026-11-04

## 2026-11-04 · Days do not record shop names

- Decided by: the designer
- Why: not needed
- Rejected: optional note per day; per-item shop list
- Rests on: designer answer, 2026-11-04

## 2026-11-04 · Items have a single name

- Decided by: the designer
- Why: separate Bangla and English names were unnecessary
- Rejected: required Bangla name with optional English name
- Rests on: designer feedback, 2026-11-04
