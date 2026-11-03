# Project Files: Mobile scroll — what we want, how it works, and where it can fail

## 1. What we want to do

- **Scroll from anywhere**: Starting a swipe **on an isocard** or on empty space should scroll the 3D carousel (same behavior).
- **Horizontal = vertical**:  
  - Swipe **left → right** should do the same as **down → up** (move carousel forward).  
  - Swipe **right → left** should do the same as **up → down** (move carousel backward).
- **Tap still opens project**: A short tap on a card (no real movement) should still open the project page; only real swipes should scroll.

---

## 2. How the system is built (realities in the code)

### DOM and hierarchy

- **`.scene-3d`**: Full viewport (`100vw` × `100vh`), fixed, contains everything 3D.
- **`#boxContainer`**: Inside `.scene-3d`; has the 3D transform; direct children are:
  - Six **box faces** (`.front`, `.back`, `.right`, `.left`, `.top`, `.bottom`) — from HTML.
  - Many **`.front-duplicate`** (iso cards) — **created in JS** in `manageIsoCards()`, inserted with `boxContainer.insertBefore(newCard, backFace)`.
- **Iso cards**: Each card is a `div.box-face.front-duplicate.iso-card` with an `<img>` inside. They are **not** inside `.front`; they are siblings of the six faces.

So the tree is:

```text
.scene-3d
  #boxContainer
    .front
    .front-duplicate.iso-card  (× N)
    .back, .right, .left, .top, .bottom
```

### Event flow we rely on

1. **Scroll logic**  
   - `handleTouchStart` / `handleTouchMove` / `handleTouchEnd` update `targetScrollPosition` (and `scrollPosition` via `animateScroll()`), then `updateBox()` repositions the cards.

2. **Where we listen**  
   - **Window**: `touchstart` (passive), `touchmove` (passive: false, **no** capture).  
   - **`.scene-3d`** and **`#boxContainer`**: `touchstart` / `touchmove` / `touchend` with **`capture: true`** so we see touches **before** they reach the card.  
   - **Each of the six box faces**: same touch listeners (capture).  
   - **Cards**: Touch listeners are added in `manageIsoCards()` and again in `attachIsoCardHoverHandlers()`. But `attachIsoCardHoverHandlers()` **replaces** each card with a **clone**; the clone does **not** get the scroll listeners that were on the original in `manageIsoCards()`. So after the first run, scroll is **only** handled by scene/container/faces (capture), not by the card elements themselves.

3. **Intended behavior**  
   - Touch **on a card**: event target = card (or the `<img>` inside).  
   - **Capture** runs first: `.scene-3d` → `#boxContainer` → … → target.  
   - So our `handleTouchMove` on `.scene-3d` and `#boxContainer` should run **before** the target. We call `preventDefault()` and `stopPropagation()` there so the card never sees `touchmove` and the browser doesn’t scroll the page.  
   - We use `effectiveDelta = deltaY + deltaX` so left→right behaves like down→up and right→left like up→down.

4. **Tap vs scroll**  
   - We set `scrollGestureUsed = true` in `handleTouchMove` when we update scroll.  
   - Card `touchend` checks `!scrollGestureUsed` before navigating.  
   - So after a scroll, tap-to-open is suppressed.

### CSS we added

- **`.scene-3d`** and **`.box-container`**: `touch-action: none` so the browser doesn’t use touch for its own scrolling/panning.  
- **`.iso-card`**: Only `pointer-events: auto`; no explicit `touch-action` (inherits from container).

---

## 3. Potential problems and snags

### A. Touch never reaches our handlers when starting on a card

- **Cause**: On some mobile browsers, touch on a **transformed** or **stacking-context** element (the cards have 3D transform) can be “claimed” by the browser or by a different hit-test path, so the event might not be delivered to our capture listeners on `.scene-3d` / `#boxContainer`.  
- **Reality**: We didn’t add `touch-action: none` directly on **`.iso-card`**. If the browser applies default touch behavior to the card, it might not invoke our handlers.  
- **Fix to try**: Add `touch-action: none` (and if needed `-webkit-touch-callout: none`) to **`.iso-card`** so the card doesn’t participate in browser touch handling.

### B. `preventDefault()` not taking effect on `touchmove`

- **Cause**: If **any** listener in the chain is registered with **`passive: true`**, the browser may ignore `preventDefault()` for that event. We use `passive: false` only for `touchmove` (and only on scene/container/faces with capture). If another script or polyfill adds a passive touch listener higher up, our preventDefault might be ignored and the page might scroll or do something else.  
- **Reality**: We don’t control every script; e.g. `core.js` → `ui.js` (menu, carousel). If they attach passive touch listeners on `document`/`window`, that’s usually fine, but a passive `touchmove` on a parent could still change behavior.  
- **Fix**: Ensure **all** `touchmove` listeners that need to claim the gesture use `{ passive: false }` and, if needed, run in capture on a container that wraps the scene.

### C. Event target is the `<img>` inside the card

- **Cause**: User touches the image. Target is `<img>`, not the card div.  
- **Reality**: Capture still goes scene → boxContainer → card → img, so our capture listeners on scene and boxContainer should still run. So this alone shouldn’t break scroll unless there’s a browser bug or a parent with `pointer-events: none` that changes the path.  
- **Optional**: Give the img `pointer-events: none` and keep `pointer-events: auto` only on the card so the target is always the card. That can simplify mental model and avoid odd cases on some devices.

### D. Cards are re-created and lose scroll listeners

- **Reality**: We already rely on **scene/container/faces** for scroll, not on the cards. So this is by design. But if `updateBox()` / `manageIsoCards()` run often and replace nodes, we must ensure we’re not re-registering duplicate listeners on scene/container/faces (we’re not; we register once at load).

### E. Load/init order

- **Reality**: Touch listeners are attached in `DOMContentLoaded`. `scene3d = document.querySelector('.scene-3d')` runs once; the element exists in the HTML. Cards are created later in `updateBox()` → `manageIsoCards()`. So scene and container are stable; only their children (cards) change. No race condition for our scroll listeners.

### F. iOS Safari / WebKit quirks

- **Reality**: iOS sometimes treats touches on transformed/overflow elements differently; `touch-action: none` on an ancestor might not apply to the actual touch target.  
- **Fix to try**: Explicit `touch-action: none` on **`.iso-card`** and, if needed, on the inner `img` (or make img non-target with `pointer-events: none`).

### G. Horizontal vs vertical scaling

- **Reality**: We use `effectiveDelta = deltaY + deltaX` with the same `touchSensitivity`. So 1px horizontal = 1px vertical. If that feels wrong (e.g. too sensitive in one direction), we’d scale one axis (e.g. `deltaX * 0.7`) or tune sensitivity.

---

## 4. Oversights worth paying attention to

1. **Where “it doesn’t work” happens**  
   - Device/browser (e.g. iOS Safari vs Chrome Android).  
   - Only when **starting on a card** vs only when **starting on “blank”** (blank is still inside `.scene-3d`).  
   - Only **horizontal** swipes vs **all** swipes.  
   That narrows down whether the issue is: touch not reaching us on cards (A, C, F), preventDefault not working (B), or something else.

2. **No listener on the cards for scroll**  
   After `attachIsoCardHoverHandlers()` runs, the scroll touch handlers on the **cards** are gone (replaced by clones). So we **must** rely on capture on scene/container (and optionally faces). If the browser doesn’t call our capture listeners for touches on the card, scroll from card will never work until we fix that (e.g. touch-action on card, or different listener strategy).

3. **Multiple systems**  
   - **HTML/CSS**: structure, `touch-action`, `pointer-events`, transforms.  
   - **JS**: capture vs bubble, passive vs non-passive, one-time registration vs per-card.  
   - **Browser**: how it decides hit-testing and who gets the touch, especially with 3D transforms and `touch-action`.  
   Any of these can block the intended behavior; the doc above lines them up so we can test and fix one layer at a time.

---

## 5. Summary table

| Goal                         | Mechanism                                      | What can go wrong                                      |
|-----------------------------|------------------------------------------------|--------------------------------------------------------|
| Scroll when starting on card| Capture touch on scene/container, touch-action | Touch not delivered to us; preventDefault ignored       |
| Left→right = down→up        | effectiveDelta = deltaY + deltaX               | Sensitivity / scaling (can tune later)                 |
| Right→left = up→down        | same                                           | same                                                   |
| Tap opens project           | !scrollGestureUsed in card touchend            | scrollGestureUsed timing (we clear in setTimeout(0))   |

If you can say exactly where it fails (e.g. “only when I start on a card on iPhone”), we can target the fix (e.g. add `touch-action: none` and optional `pointer-events: none` on img to `.iso-card` and re-test).
