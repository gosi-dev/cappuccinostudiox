# Anti Box / Mask Modifier (Shelved)

**Status:** Shelved for later. To be fleshed out with full Boolean logic in Toolkit.

---

## Concept

- **Anti box:** A second box used as a Boolean mask against the Master box. Elements (iso cards, discs, baby containers, faces) whose center lies inside the anti box volume are hidden.
- **Alignment:** The face of the anti box that touches the master box is always **center-aligned** with the chosen master face. User picks position: Front, Back, Left, Right, Top, Bottom.
- **Dimensions:** Anti box **Width** and **Height** control the two dimensions of that face; **Depth** controls how far the anti box extends from the face **into** the master box (penetration).

---

## Intended behaviour (to implement later)

- **Cabinet:** Hide iso cards and master box faces when their center is inside the anti box AABB.
- **Carousel:** Hide iso discs and baby containers when their center is inside the anti box AABB.
- **Boolean logic (future):** Replace simple “hide if inside” with proper Boolean (e.g. subtract / union) if needed for geometry or export.

---

## AABB (axis-aligned bounding box) for mask volume

Master box half dimensions: `halfWidth`, `halfHeight`, `halfLength`. Anti box: `width`, `height`, `depth`.

- **Front:** face at Z = halfLength. Volume: X ∈ [-width/2, width/2], Y ∈ [-height/2, height/2], Z ∈ [halfLength − depth, halfLength].
- **Back:** Z ∈ [-halfLength, -halfLength + depth], same X,Y.
- **Right:** X ∈ [halfWidth − depth, halfWidth], Y ∈ [-height/2, height/2], Z ∈ [-width/2, width/2].
- **Left:** X ∈ [-halfWidth, -halfWidth + depth], same Y,Z.
- **Top:** Y ∈ [halfHeight − depth, halfHeight], X ∈ [-width/2, width/2], Z ∈ [-height/2, height/2].
- **Bottom:** Y ∈ [-halfHeight, -halfHeight + depth], same X,Z.

Point-in-AABB test:  
`px >= xMin && px <= xMax && py >= yMin && py <= yMax && pz >= zMin && pz <= zMax`.

---

## UI (when re-enabled)

- **Enable Mask** (checkbox)
- **Position (face):** Front | Back | Left | Right | Top | Bottom
- **Anti Box Width** (slider + value input, px)
- **Anti Box Height** (slider + value input, px)
- **Anti Box Depth** (slider + value input, px)
- **Show anti box (wireframe)** (checkbox) – optional wireframe of the anti box volume

---

## Config keys (for copy/load)

- `maskEnabled`, `maskPosition`, `maskAntiWidth`, `maskAntiHeight`, `maskAntiDepth`, `maskShowAntiBox`

---

## Integration points in 3d-cabinet.html (when re-adding)

1. **CSS:** `.anti-box`, `.anti-box .anti-face` (wireframe styling).
2. **HTML:** Mask Modifier section in controls (after tool-mode-switch, before cabinet-tool-section).
3. **JS:**  
   - `getMaskParams()`, `getAntiBoxAABB()`, `pointInAABB()`, `faceCenter()`  
   - `applyMaskToCabinet()` (call from `updateBox()`; hide cards and box faces inside AABB).  
   - `updateAntiBoxVisual()` (draw wireframe anti box).  
   - `applyMaskToCarousel()` (call from `buildCarousel()`; hide discs and babies inside AABB).  
   - Mask control bindings (sliders + value inputs, enable/position/show wireframe).  
   - Config: include mask keys in `generateConfigString()` and apply in load config.
4. **Cabinet:** Store `dataset.baseOffset` (Z) for cards; face centers from face class (front/back/left/right/top/bottom).  
5. **Carousel:** Store `dataset.discZ` on discs; `dataset.babyX`, `dataset.babyY`, `dataset.babyZ` on babies when creating them, for mask test.

---

*Archived from live 3d-cabinet implementation. Re-integrate from this spec when fleshing out Boolean logic in Toolkit.*
