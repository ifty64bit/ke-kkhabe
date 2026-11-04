# Ke Khabe navigation

## Destinations

| Destination | Label   | Path       | Who      | Job                                                               |
| ----------- | ------- | ---------- | -------- | ----------------------------------------------------------------- |
| Today       | আজ      | `/`        | everyone | Answer "আজ খাবেন?", pick items and quantities, see today's status |
| Ledger      | হিসাব   | `/ledger`  | everyone | Everyone's net balance, suggested settle-ups, log "A paid B"      |
| Reports     | রিপোর্ট | `/reports` | everyone | Monthly report per member and month overview                      |
| Manage      | ম্যানেজ | `/manage`  | managers | Run today's day: menu, close, finalize with prices and payers     |

Order follows frequency of use: daily, weekly, monthly, then the managers' tools. Today is the home page; the others are reached from the link row under the prompt.

### Manage sub-sections

| Label     | Path              | Job                                      |
| --------- | ----------------- | ---------------------------------------- |
| আজকের দিন | `/manage`         | Create menu, open, close, finalize today |
| আইটেম     | `/manage/items`   | Item catalog                             |
| সদস্য     | `/manage/members` | Roles and active status                  |

## Shell

```
 (🍳) কে খাবে                         ◐  (A)

                 বুধবার, ৪ নভেম্বর
              আজ খাবেন, Ifty?

        [ হ্যাঁ, খাবো ]      [ আজ না ]

   ─────────────────────────────────────
        হিসাব          রিপোর্ট         ম্যানেজ
```

- One column, centered, on every screen size. No sidebar or tab bar.
- Top bar on every signed-in page: egg-pan mark and wordmark (links to Today), theme toggle, account menu.
- Today is the prompt itself; its answer area changes with the day's status (no menu, open, ordered, said no, closed, finalized).
- "হ্যাঁ, খাবো" and "অর্ডার বদলান" open the item dialog: every offered item with a quantity stepper; "অর্ডার করুন" is enabled once at least one item is picked.
- Links to হিসাব, রিপোর্ট and, for managers, ম্যানেজ sit in a row under the prompt, each with a one-line hint.
- Other pages return to Today through the mark in the top bar.
- Login, the inactive-account page and the dev gallery sit outside the signed-in layout.

## Empty states

Each destination that has no data yet shows what will appear there and, when the viewer can act, the action that fills it. No disabled controls stand in for unbuilt features.
