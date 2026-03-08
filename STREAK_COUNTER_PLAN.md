# Streak & Win Counter — Implementation Plan

Two independent features that reinforce each other:
- **Global win counter** — social proof ("14,382 wins declared today")
- **Personal streak** — individual motivation ("🔥 7-day streak!")

---

## Feature 1: Global Win Counter

### Goal
Show a live "X wins today" count in the nav after the cinematic plays. Makes the
app feel alive and communal even with zero social features.

### Storage: Vercel KV
Redis `INCR` keyed by UTC date: `wins:2026-03-08`. Resets automatically as the
key ages out (48h TTL). Vercel KV is the natural fit — already on Vercel, no
extra infrastructure, and INCR is atomic so concurrent uploads don't race.

Requires `VERCEL_KV_REST_API_URL` + `VERCEL_KV_REST_API_TOKEN` env vars, which
are set automatically when you attach a KV store in the Vercel dashboard.

### Design decisions
| Decision | Choice | Why |
|---|---|---|
| Counter granularity | UTC calendar day | Simple, globally consistent |
| Key format | `wins:YYYY-MM-DD` | Easy to expire; no cleanup needed |
| TTL | 48h | Survives timezone edge cases |
| Cache on reads | 30s stale-while-revalidate | Reduces KV reads under load |
| Failure mode | Silently skip increment | Upload must not fail due to KV |
| Failure on read | Return `null`, hide the count | Don't show "0 wins today" on error |

### New / changed files

**`src/app/api/stats/route.ts`** (new)
```
GET /api/stats → { winsToday: number }
Cache-Control: s-maxage=30, stale-while-revalidate=60
```
Reads `wins:<today-utc>` from KV, returns 0 on any error.

**`src/app/api/wins/route.ts`** (modify)
After successful `put()` to Vercel Blob, fire-and-forget:
```ts
kv.incr(`wins:${todayUtc}`).then(() =>
  kv.expire(`wins:${todayUtc}`, 48 * 60 * 60)
).catch(() => {});  // never fail the upload
```

**`src/components/CinematicScene.tsx`** (modify)
- After `showNav` becomes true, `fetch('/api/stats')` once
- Store result in `winsToday: number | null` state
- Render below the nav buttons (or inline in nav) when non-null:

```
🌕  14,382 wins today
```

Fade in with the nav (`motion.div`, same transition). Skip rendering if null
(KV error / first load) so it never shows a misleading zero.

### Package addition
```
npm install @vercel/kv
```

---

## Feature 2: Personal Streak (localStorage)

### Goal
After claiming a win, show the user their consecutive-day streak in the preview
step. No backend, no account — entirely local.

### Storage schema
```ts
// localStorage key: "mooniwin_streak"
interface StreakData {
  lastWinDate: string; // "YYYY-MM-DD" in local timezone
  count: number;
}
```

### Date logic
- Use `new Date().toLocaleDateString("en-CA")` → gives `YYYY-MM-DD` in the
  user's local timezone (the right "day" for the person playing outdoors)
- On `recordWin()`:
  - `lastWinDate === today` → already counted today, return current count
  - `lastWinDate === yesterday` → increment count
  - anything older or missing → reset to 1
- Only call `recordWin()` when the upload succeeds (`winId` is set), not on
  upload failure — prevents gaming the streak counter

### New file: `src/lib/streak.ts`
```ts
export function getStreak(): { count: number; lastWinDate: string | null }
export function recordWin(): number  // returns the new streak count
```

Wraps localStorage access in try/catch for SSR safety and private browsing.

### UI in `ClaimWinModal.tsx` (preview step)
When `winId` is set (the upload resolved), call `recordWin()` once and display:

```
streak count  →  display
─────────────────────────
1             →  first win!  🌕
2             →  2-day streak  🔥
7             →  7-day streak  🔥
30+           →  30-day streak  🏆
```

Place it between the win card image and the share button. Small, low-contrast
text — celebratory but not intrusive. One-time render (no live update).

Add a tooltip / caption: `"streak lives in this browser"` in small muted text
so users understand it's local.

### Modified files

| File | Change |
|---|---|
| `src/lib/streak.ts` | New — all streak logic |
| `src/components/ClaimWinModal.tsx` | Call `recordWin()` when `winId` set; render streak badge |

---

## Interaction between the two features

The global counter increments on every upload regardless of streak. The streak
only updates on successful upload. They're independent — no shared state.

---

## Rollout order

1. **Streak first** — zero dependencies, works in any environment, testable
   locally right now. Ship it.
2. **Global counter second** — requires Vercel KV to be provisioned. Hook up
   the KV store in the Vercel dashboard, add env vars, then deploy.

---

## Out of scope (for now)

- Streak continuity across devices (would require auth)
- Push notification reminders ("Don't break your streak!")
- Group/friend leaderboards
- "Longest streak" badges or milestone rewards
- Streak displayed on the share card
