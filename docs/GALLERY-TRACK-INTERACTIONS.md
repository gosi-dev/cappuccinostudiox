# Gallery track interactions (review)

Reference for current gallery track behavior on the project page. Revisit when updating interactions.

---

## Shared (desktop and mobile)

- **Scroll:** Wheel (desktop) or touch scroll is only applied when the pointer/finger is over the gallery container; the track scrolls horizontally.
- **Click / tap on an item:** Handled by `onGalleryItemClick(index)`:
  - **First** click/tap on an item → **Preview mode** (`setActiveItem(index)`).
  - **Second** click/tap on the **same** item → **Content view** (fullscreen-style overlay with media and close).
- **Leaving the gallery (pointer/finger out):** If in **preview mode**, the gallery exits preview and returns to the default background state (`resetToBackground`). If only in **hover state** (desktop), that hover state is cleared (`clearHoverPreview`).
- **Click/tap outside gallery (and outside expanded background):** Same as leaving: exits preview mode and resets to default background.

---

## Desktop only (viewport > 768px)

### Default state (no preview mode)

- **Hover over an item:**
  - That item is shown in the **expanded background** (large media behind).
  - All **other** items get **media at 0 opacity** and **captions at 0.4 opacity** (`gallery-item-hover-hidden`).
  - Triggered by per-item `mouseenter` and by a container `mouseover` fallback (for Cursor and similar).
- **Leave the gallery (mouse leaves container):**
  - Hover state is cleared: expanded background is cleared, background videos resume, all items return to normal (no `gallery-item-hover-hidden`).

### Preview mode (one item “selected”)

- **Hover over a *different* item:**
  - **Only** that other item’s **media** fades in to **0.4 opacity** (`gallery-item-media-reveal`).
  - The **expanded background does not change** (still shows the previewed item).
  - `setHoverPreview` does nothing in preview mode so it doesn’t “hijack” the preview.
- **Leave that item:**
  - Its media returns to 0 opacity (class `gallery-item-media-reveal` removed).

### Scroll

- Horizontal scroll with the wheel works only when the cursor is over the gallery track/container.

---

## Mobile (viewport ≤ 768px)

- **No hover:** `setHoverPreview` is not run on small viewports, so there is no “hover preview” or “hover-hidden” state.
- **Tap:** Same as desktop: first tap = preview mode, second tap on same item = content view.
- **Leave gallery / tap outside:** Same as desktop: exits preview and resets to default background.
- **Scroll:** Touch scroll over the gallery container scrolls the track (no wheel).

---

## Modes summary

| Mode            | Who sees it   | Track appearance | Expanded background |
|-----------------|---------------|-------------------|----------------------|
| **Default**     | Both          | All items normal  | None (or bg videos)  |
| **Hover (desktop)** | Desktop only | Hovered item normal; others: media 0, captions 0.4 | Hovered item’s media |
| **Preview**     | Both          | One item normal; others: media 0, captions 0.4; on desktop, hovered other item’s media can be 0.4 | Previewed item’s media |
| **Content view**| Both          | Unchanged        | Overlay with media + close |

---

## Transitions

- Gallery item media and captions use **opacity transitions** (e.g. 0.3s ease) so hover and preview changes fade in/out smoothly on both desktop and mobile.
