# Site map — Cappuccino Studiox (conversion restructure)

The site keeps every project and every case study. What changed is the order a stranger meets them in:
the house first, the offer second, proof third, depth fourth.

## Pages

| URL | Nav label | Job | Primary CTA |
| --- | --- | --- | --- |
| `/` (`index.html`) | Outside | Front-elevation scene. The page the platform loads into — the home page, literally the home. | **Kitchen** hotspot → `/kitchen.html` |
| `/kitchen.html` (`/kitchen`) | Kitchen | Kitchen scene + offer panel. The 8-second answer to what, how much, how fast. | **Start a project** → `/offers.html` |
| `/offers.html` (`/offers`) | Offers | Three tiers, prices, deliverables, FAQ. | **Start this project** (one per tier) → `/booking.html?offer=…` |
| `/project-files.html` (`/work`) | Project files | Full archive: all 7 projects, deck, drawers. | **Open file** → case study |
| `/booking.html` (`/contact`) | Book a session | Booking form, deposit terms in the offers FAQ. | **Complete** → booking POST |
| `/project-story.html?id=N` | — | Long-form case studies (7 projects). | **Explore the story** + end-of-story **See offers** |
| `/project.html?id=N` | — | Deck case study view. | Deck navigation + end-of-deck **See offers** |

Nav is the original five items, reverted verbatim, with **Offers** slotted between Kitchen and Project files:
**GO OUTSIDE · KITCHEN · OFFERS · PROJECT FILES · BOOK A SESSION**. The current page removes itself from
the dropdown, exactly as before. The logo returns to the outside scene.

`/work`, `/kitchen`, `/offers` and `/contact` are Netlify rewrites of the real files; the temporary
`/studio` (and `/studio.html`) aliases 301 to `/`.

## Kitchen copy

- Eyebrow: *Cappuccino Studiox — Lisbon / Global*
- H1: **Thirty days of content. Delivered in seven.**
- Subhead: *Short-form video, product stills and a 30-day posting plan for founders with a launch to make. One fixed price, one week, no retainer.*
- Offer card — label *Content engine*, title **30-Day Content Engine**, price **€1,000**, note *delivered in 7 days*:
  1. 12 short-form videos, scripted, shot and edited
  2. 20 product stills, sized for feed and stories
  3. 30-day posting calendar with captions and hooks
- CTA: **Start a project →** (`offers.html`)
- Proof strip: *Recent work* — Lucid Jungles / Adidas WDTF / Onyeoma
- Link: **See all work →** (`project-files.html`)
- The offers hotspot on the kitchen desk reads **CAPPUCCINO STUDIOX OFFERS** → **SEE OFFERS** (`offers.html`).
  It sits on the papers in the scene so it looks like the offer file is already on the desk.
- Probe labels that would run past the right edge (the sticker and coffee probes, next to the offer panel)
  flip to the left of their probe and clamp inside the scene — see **Probe label balance** below.

## Probe label balance

The offer panel takes a fixed column on the left, so the scene is narrower than the viewport and the two
right-hand probes used to open their labels off-frame.

- `kitchen.js` measures the open popup (label + button) against the scene frame.
- If it would cross the right edge, the hotspot gets `.flip` and the label opens to the left of the probe.
- Anything still over an edge is nudged back in horizontally and vertically (`16px` breathing room).
- Labels are capped with `max-width: calc(100vw - var(--offer-panel-w) - 32px)` so they can never be wider
  than the visible scene; on mobile the cap is `calc(100vw - 32px)`.
- Between 769px and 1180px the offer column narrows (`clamp(300px, 28vw, 360px)`) before the scene does.
- Clicking a pulsing probe now opens that probe (`data-hotspot` ids); before, every probe dispatched a
  click on the first one.

## Offers page copy

Listed highest price first, so the €500 Edit Sprint reads as the cheap way in.

Hero: **Offers**

Lede: *Remote-first creative partnership for businesses and creators. You send the footage. I build the content system. Files arrive ready to post.*

Hero facts: kick-off within 2 working days · delivery 3 days, 7 days, or monthly · EUR, bank transfer.

### 01 — Creative Strategist — €2,500 — per month
Rolling monthly partnership. I run the creative side of your content operation — you run the company.

What you get each month:
- 16 short videos, 15–30 seconds, vertical — scripted, edited, sound-designed
- 20 posts scheduled and published
- Captions and hashtags written
- Comment and DM replies twice a week
- A monthly report on the 1st: what worked, what to repeat, what to cut, what to change next month
- A weekly research pass: what competitors and the wider market are running, and what to test next

What I actually do:
- Research what ads and content are working in the category — hooks, formats, angles
- Decide which videos are worth making, write the opening line and structure for each
- Direct the edits and the sound
- Track results — click-through, cost, conversion — and adjust the next batch
- Post, manage comments and replies, report monthly

Not included: ad spend, paid media management, influencer deals, PR, filming.

### 02 — Content Engine — €1,000 — 7 days
I figure out what to post and why — then I make it. The work stops being production and starts being strategy.

What you get:
- 12 short videos, 15–30 seconds, vertical
- 20 still images, edited for feed and stories
- A 30-day posting calendar: what goes out, which day, which caption
- A one-page plan explaining what each video is for and why it was chosen
- Two rounds of changes
- Files ready to post in 9:16, 4:5 and 1:1

What I actually do:
- Look at what's working for competitors and in the category
- Decide which 12 videos are worth making
- Write the opening line and structure for each
- Edit and sound-design them
- Hand over a calendar so the client knows when to post

Not included: filming, posting, paid ads, influencer outreach, music licensing.

### 03 — Edit Sprint — €500 — 3 days
You send the footage. I cut it. You tell me what to make; I make it look and sound good.

What you get:
- 5 finished short videos, 15–30 seconds, vertical
- Captions burned in
- Sound mixed properly — not music slapped on top
- Two rounds of changes per video
- Files ready to post

What I need from you: the raw clips, and one sentence about what each video is for.
Not included: filming, posting, stills, paid ads, music licensing. No research or content planning — the client brings the plan.

### How it works
1. Brief — share footage, goals and brand references.
2. Produce — plan, edit, sound-design and caption every asset.
3. Deliver — ready-to-post files in a shared folder.

Everything moves over email or Notion. Calls only if you want one.

### The three tiers, in one line each
| Tier | Price | What you're buying |
| --- | --- | --- |
| Creative Strategist | €2,500/mo | A department — research, scripts, production, posting, reporting |
| Content Engine | €1,000 | A brain and hands — I plan the month and make it |
| Edit Sprint | €500 | Hands — you plan, I cut |

### Who this is for
Businesses and creators with footage but no system. Founders who need a month of content without hiring a team. Brands that want sound design and direction built into every asset, not bolted on afterwards.

### FAQ
- **How does payment work?** Creative Strategist is paid at the start of each month. Edit Sprint and Content Engine are 50% to book, 50% on delivery. Invoices in EUR, bank transfer.
- **How fast can you start?** Kick-off within 2 working days of the deposit. Edit Sprint delivers 3 days later, Content Engine 7 days later.
- **How many rounds of changes?** Two per video on Edit Sprint and Content Engine. On Creative Strategist, changes happen inside the month. Extra rounds are quoted first.
- **Do you post on my account?** Only on Creative Strategist. The other two hand over finished files and a calendar.
- **Who owns the work?** The client does, once the final invoice is paid. The studio keeps the right to show the work in the portfolio unless asked not to.

## What moved where

| Before | After |
| --- | --- |
| `index.html` — front elevation scene ("home") | Back at `index.html` (the platform lands outside) |
| `kitchen.html` — kitchen scene, later promoted to `/` | `kitchen.html` again, now carrying the offer panel |
| `studio.html` — temporary alias for the exterior | Removed; `/studio` and `/studio.html` 301 to `/` |
| Menu: GO OUTSIDE / KITCHEN / PROJECT FILES / BOOK A SESSION / JUNGLE MAP | Same five names, `JUNGLE MAP` replaced by **OFFERS** in the third slot |
| Menu button label per page (OUTSIDE / KITCHEN / ADMIN …) | Unchanged behaviour — the current page hides itself |
| JUNGLE MAP menu item → `index.html` | **OFFERS** → `offers.html` |
| Kitchen hotspot 4 → **CAPPUCCINO STUDIOX OFFERS** | `offers.html` |
| Kitchen hotspot 1 "Project files" → `project-files.html` | Unchanged — still opens the archive |
| Case studies: hero = title + descriptive tagline | Hero now also carries a yellow outcome line (`caseStudy.headline` in `src/data/projects.json`) |
| Case studies ended at the next-project block | Ends with **Want something like this? See offers →** |
| Booking form: 14 agency services | Three offers added at the top, preselected by `?offer=` from the offers page |
| Booking page: no header | Header with logo + Outside / Kitchen / Offers / Project files / Book a session |
| — | New `offers.html` + `offers.css` + `offer-panel.css` |

Nothing was deleted. Every current project is still in the Project files archive, and every case study keeps
its original imagery, chapters, tagline and credits. Case study 06 is now **HOBA — Adult Chocolate**.

## Files touched

- New: `offers.html`, `offers.css`, `offer-panel.css`, `docs/SITE-MAP.md`
- Moved back: `index.html` ↔ `kitchen.html` (the exterior is home again); `studio.html` deleted
- Edited: `project-files.html`, `project-story.html`, `project-story.css`, `project.html`, `booking.html`,
  `admin.html`, `3d-cabinet.html`, `project-edit.html`, `src/data/projects.json`, `js/ui.js`, `js/core.js`,
  `js/pages/kitchen.js`, `js/pages/index.js`, `js/pages/project-story.js`, `js/site-modals.js`,
  `js/pages/booking.js`, `netlify.toml`

