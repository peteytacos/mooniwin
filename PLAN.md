# Moon I Win — Site Plan

## The Game
**Moon I Win** is a daily competition passed down through the centuries: who saw the moon first today?

**Rules:**
1. Be outside
2. Be within shouting distance of your group
3. First to point at the moon and shout "Moon I Win!" wins for the day
4. Fake moon sightings disqualify you until tomorrow
5. Everyone in the group must be physically outside
6. Tricking someone to come outside is very much encouraged
7. You may text a photo of the moon if playing remotely

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Vercel-native, great SEO, RSC for perf |
| 3D Graphics | React Three Fiber + Three.js | Declarative 3D, massive ecosystem |
| Post-processing | @react-three/postprocessing | Bloom, glitch, god rays on the moon |
| Animation | Framer Motion | Page transitions, UI spring animations |
| Styling | Tailwind CSS | Fast, consistent dark-space theme |
| Language | TypeScript | Safety, DX |
| Deployment | Vercel | mooniwin.com domain, edge functions, analytics |

---

## Site Structure

### Pages
```
/           → Hero — stunning 3D interactive moon scene + one-liner CTA
/rules      → The Rules — animated scroll reveal of each rule
/play       → Moon Tracker — real-time moonrise time + phase for your location
/win        → Victory Card Generator — create a shareable "Moon I Win" card
/challenge  → Challenge someone — generate a trick link to rope in a friend
```

---

## Visual Design Direction

**Theme:** Deep space. Cinematic. The moon as protagonist.

### Hero Scene (Three.js)
- Full-viewport WebGL canvas
- Photorealistic moon with displacement + normal maps (NASA textures)
- Star field with parallax scroll effect
- Subtle nebula/galaxy in the background
- **Moon reacts to mouse movement** — rotates slowly, craters catch light
- Bloom + god rays post-processing for the moon's glow
- Animated astronaut floating past (glTF model, looping)
- Text overlay: "Moon I Win" in bold, minimal typography
- CTA button: "Learn the Rules" that triggers a smooth scroll or page transition

### Rules Page
- Dark, starfield background (CSS or lightweight Three.js canvas)
- Each rule animates in as you scroll (Framer Motion `whileInView`)
- Giant moon icon/illustration behind each rule section
- Rule numbers styled like craters or celestial coordinates
- Mobile-first layout — the game is played on phones

### Moon Tracker (`/play`)
- Uses browser Geolocation API → fetches moonrise/moonset/phase data
- Displays: "The moon rises in your area at 7:42 PM" with a countdown timer
- Shows current moon phase with a real-time 3D mini moon
- "Is the moon up right now?" → YES (go play!) / NO (check back at X:XX)
- Fallback: manual location entry

### Victory Card Generator (`/win`)
- User enters their name and optionally location
- Canvas API generates a shareable image card:
  - Black sky background
  - Moon phase for today
  - "I won Moon I Win on [date]"
  - mooniwin.com URL watermark
- One-tap download or native share (Web Share API)
- Pre-generated Open Graph cards for Twitter/Instagram

### Challenge Link Generator (`/challenge`)
- User enters their name
- Generates a unique URL: `mooniwin.com/c/[name]-[token]`
- When the link recipient opens it, they see:
  - "👆 [Name] has challenged you to Moon I Win!"
  - The full rules
  - "Get outside and win!"
- The trick: **the link itself is the trick** — now they know the game and are in your group

---

## Viral Mechanics

### 1. The Challenge Link (Highest Impact)
The #1 growth driver. Works like Wordle's share mechanic but with a social hook.
- Easy to text to someone
- The recipient *has* to read the rules to understand why they got sent the link
- Once they read the rules, they're playing

### 2. Victory Share Cards
- Frictionless image generation — no sign-up, one tap to share
- Designed for Instagram Stories, Twitter/X, iMessage
- Moon phase included = unique card every day
- People will post these, and their followers will ask "what is this?"

### 3. Daily Moon Notifications (PWA)
- Site is a PWA — installable on home screen
- Optional push notification: "🌕 The moon is rising! Get outside."
- This creates daily engagement and reminds people to play

### 4. Streak Tracking (localStorage + shareable URL)
- No account required — track wins in localStorage
- "You're on a 7-day streak! 🌕🌕🌕🌕🌕🌕🌕"
- Streak encoded in a shareable URL so it survives device switches
- Leaderboards are social — generate a group leaderboard URL to share with friends

### 5. Global Win Counter
- A rolling real-time counter on the hero: "🌍 14,382 wins declared today"
- Powered by a Vercel edge function + KV store (or simple Upstash Redis)
- When someone submits a win card, it increments the counter
- Social proof + FOMO — people see others winning

### 6. Moon Phase Badges
- Special achievement for winning on:
  - Full Moon 🌕 (the prestige win)
  - New Moon 🌑 (nearly impossible — bragging rights)
  - Blood Moon / Eclipse (legendary)
  - Solstice / Equinox
- Badges encoded in the victory card

### 7. Multilingual Rules (Phase 2)
- The game is for everyone on Earth — translate the rules
- Auto-detect browser language, show rules in user's language
- "Moon I Win" stays in English (the battle cry is universal)

### 8. OG / SEO Optimization
- Dynamic Open Graph images (Vercel OG) for every page
- Challenge links get personalized OG cards: "Pete has challenged you..."
- This makes link previews look compelling in iMessage, WhatsApp, Twitter

### 9. Press-Worthy Framing
- Lean into the "passed down through centuries" mythology
- "The world's oldest daily game"
- Write a fun, short "History" section — makes journalists want to cover it
- Submit to Product Hunt, Hacker News Show HN, Reddit r/mildlyinteresting

### 10. TikTok / Reels Content Hooks
- The trick mechanic is gold for content:
  - "I got my whole family to come outside by pretending there was a spider"
  - First-person POV: spotting the moon, yelling "Moon I Win!"
- Add a #MoonIWin hashtag prominently and encourage content creation
- Consider a UGC section on the site showing top TikToks

---

## Moon Data
- **Moon phase:** Calculate client-side with `suncalc` npm package (no API needed)
- **Moonrise/moonset times:** `suncalc` + browser geolocation
- **Moon textures:** NASA CGI Moon Kit (free, public domain, photorealistic)

---

## Phase 1 — MVP (Ship it)
- [ ] Next.js project scaffolded and deployed to Vercel
- [ ] Hero page with full Three.js interactive moon scene
- [ ] Rules page with scroll animations
- [ ] Moon Tracker page (geolocation + suncalc)
- [ ] Victory Card generator (Canvas API + Web Share)
- [ ] Challenge link system
- [ ] OG meta tags + Vercel OG dynamic images
- [ ] PWA manifest (installable)
- [ ] mooniwin.com domain connected

## Phase 2 — Growth
- [ ] Win counter (edge function + KV store)
- [ ] Push notifications for moonrise
- [ ] Streak tracking (localStorage + URL encoding)
- [ ] Moon phase badges on victory cards
- [ ] Multilingual rules
- [ ] UGC / social feed section

---

## Deployment
- Vercel (free tier is fine for MVP, Pro when traffic grows)
- Domain: mooniwin.com → Vercel nameservers
- Edge functions for win counter API
- Vercel Analytics + Speed Insights enabled from day 1

---

## What Makes This Go Viral

The game has 5 natural viral properties:

1. **Daily ritual** → people come back every day (retention)
2. **Trick mechanic** → inherently creates stories worth sharing
3. **Zero barrier** → no equipment, no account, free, outdoor
4. **Universal** → works in every country, every culture, every age
5. **Victory** → people love sharing wins — the card gives them the format

The website's job is to be so beautiful and fun that when someone gets challenged and lands on the page, they immediately want to share it themselves.
