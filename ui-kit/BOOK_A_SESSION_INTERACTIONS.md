# Book A Session Modal — Interaction Layers

All interactive elements use the same visual language. **Click/Press feedback** across the site = white bg, white border, red text.

---

## 1. Header (non-interactive)

| Property | Value |
|----------|--------|
| **Class** | `.kit-modal-label` |
| **Role** | Label only, no interaction. |
| **Visual** | Yellow fill, yellow outline, red text. |

---

## 2. Name input

| Property | Value |
|----------|--------|
| **Class** | `.kit-modal-input` |
| **Element** | `<input type="text">` |
| **Placeholder** | `FIRSTNAME LASTNAME` (uppercase) |

| State | Trigger | Background | Text / placeholder | Border |
|-------|---------|------------|--------------------|--------|
| **Default** | — | Red | Yellow 50% opacity | Yellow 2px |
| **Hover** | — | No hover mode | — | — |
| **Active / Focus** | `:active`, `:focus` | Red | Yellow (full) | Yellow |

---

## 3. Email input

| Property | Value |
|----------|--------|
| **Class** | `.kit-modal-input` + `type="email"` |
| **Element** | `<input type="email">` |
| **Placeholder** | `emailaddress@email.com` (lowercase) |

Same states as name input; input and placeholder use lowercase.

---

## 4. Service dropdown

| Property | Value |
|----------|--------|
| **Class** | `.kit-modal-select` |
| **Element** | `<select>` |

| State | Trigger | Background | Text | Border | Arrow |
|-------|---------|------------|------|--------|--------|
| **Default** | — | Red | Yellow | Yellow 2px | ▼ yellow |
| **Hover** | `:hover` | Yellow | Red | Yellow | ▼ red |
| **Active / Focus** | `:active`, `:focus` | Yellow | Red | Yellow | ▲ red (roll up) |

Arrow color always matches text color.

---

## 5. Date dropdown

| Property | Value |
|----------|--------|
| **Class** | `.kit-modal-date` |

Same behaviour as service dropdown (default → hover → active/focus with ▲).

---

## 6. Time dropdown

| Property | Value |
|----------|--------|
| **Class** | `.kit-modal-time` |

Same behaviour as service dropdown.

---

## 7. Complete button

| Property | Value |
|----------|--------|
| **Class** | `.kit-modal-submit` |
| **Element** | `<button type="button">` |

| State | Trigger | Background | Text | Border | Icon |
|-------|---------|------------|------|--------|------|
| **Default** | — | Red | Yellow | Yellow 2px | Yellow |
| **Hover** | `:hover` | Yellow | Red | Yellow | Red |
| **Click / Press feedback** | `:active`, `.touch-active` | White | Red | White | Red |

---

## Site-wide rule

**Click feedback / Press feedback** = white background, white border, red text. Use for `:active` and `.touch-active` on primary actions.
