# Ke Khabe

## Users

- **Members:** office colleagues who eat breakfast at work. They answer "আজ খাবেন?" on their phone in the morning, often between arriving and sitting down, with a few seconds of attention. Occasionally they check what they owe and who they owe it to.
- **Managers:** one or more members who also run the day: post the menu, close orders, buy the food, enter real prices and who paid. They do this on a phone at the shop counter or at a desk after buying.
- Bangla is the first language for everyone; some prefer English UI.
- Devices: mostly mid-range Android phones; some desktop use by managers.

## Product

A web app (SvelteKit on Cloudflare Workers, D1) replacing a paper or chat-based breakfast tally. New product, single office, no revenue model. Full requirements: [REQUIREMENTS.md](REQUIREMENTS.md).

## Constraints

- Google sign-in only; any Google account may join; the site is not indexed.
- Money is integer poisha; day and month boundaries are Asia/Dhaka.
- Mobile-first, installable; no offline mode in v1.
- One developer; ships incrementally.

## Ethical stance

- Everyone sees everyone's balances, by the team's choice, for transparency; nothing else about members is exposed.
- No notifications, streaks, badges or nudges in v1. The app is a utility used once a day.
- Debt is shown as neutral fact: amounts and direction, never shaming copy or alarm colors beyond red/green sign.
- Every money change is attributable: who logged it and when, with voids instead of deletes.

## Success

- A member orders today's breakfast in under 15 seconds from opening the app.
- The manager closes and finalizes a day without leaving the app for a calculator.
- At month end, every member's balance matches what the group agrees they owe, with no disputes resolved outside the app.

## Open questions

- Should a member be able to see a single colleague's full history, or only their balance and monthly totals?
