# Ke Khabe navigation

## Destinations

| Destination | Label   | Path       | Who      | Job                                                               |
| ----------- | ------- | ---------- | -------- | ----------------------------------------------------------------- |
| Today       | আজ      | `/`        | everyone | Answer "আজ খাবেন?", pick items and quantities, see today's status |
| Ledger      | হিসাব   | `/ledger`  | everyone | Everyone's net balance, suggested settle-ups, log "A paid B"      |
| Reports     | রিপোর্ট | `/reports` | everyone | Monthly report per member and month overview                      |
| Manage      | ম্যানেজ | `/manage`  | managers | Run today's day: menu, close, finalize with prices and payers     |

Order follows frequency of use: daily, weekly, monthly, then the managers' tools.

### Manage sub-sections

| Label     | Path              | Job                                      |
| --------- | ----------------- | ---------------------------------------- |
| আজকের দিন | `/manage`         | Create menu, open, close, finalize today |
| আইটেম     | `/manage/items`   | Item catalog                             |
| সদস্য     | `/manage/members` | Roles and active status                  |

## Shell

```
Phone (< 1024px)                      Desktop (≥ 1024px)
┌──────────────────────────┐          ┌────────────┬──────────────────────────┐
│ কে খাবে          ◐  (A)  │ header   │ কে খাবে     │                          │
├──────────────────────────┤          │            │  page content            │
│                          │          │ ▣ আজ        │  (max ~42rem, left-      │
│  page content            │          │ ▢ হিসাব     │   aligned to the rail)   │
│                          │          │ ▢ রিপোর্ট    │                          │
│                          │          │ ▢ ম্যানেজ    │                          │
├──────────────────────────┤          │            │                          │
│  আজ   হিসাব  রিপোর্ট  ম্যানেজ │ tab bar  │ (A) Ifty  ◐ │                          │
└──────────────────────────┘          └────────────┴──────────────────────────┘
```

- Phone: top header holds the wordmark, theme toggle and account menu; destinations live in a bottom tab bar within thumb reach, padded for the home indicator.
- Desktop: a left rail holds the wordmark, destinations, and account plus theme at the bottom; the header and tab bar are not shown.
- The current destination is marked with `aria-current="page"` and a filled icon plus label weight, not color alone.
- Members never see the Manage tab; managers see it last.
- Account menu: name, role, logout.
- Login, the inactive-account page and the dev gallery sit outside the shell.

## Empty states

Each destination that has no data yet shows what will appear there and, when the viewer can act, the action that fills it. No disabled controls stand in for unbuilt features.
