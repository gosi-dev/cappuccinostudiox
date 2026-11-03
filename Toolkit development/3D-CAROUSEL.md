# 3D Carousel Creation Tool (Shelved)

**Status:** Shelved for later. Re-integrate from this spec when resuming Toolkit development.

---

## Overview

A second tool mode on the 3D Cabinet page, switched via "3D Cabinet" / "3D Carousel" buttons. The Carousel tool provides:

- **Master Box** – Container with full transform (scale, rotation, position X/Y/Z), face/edge visibility, edge weight.
- **Iso Discs** – Array of discs (count, thickness, width, length, spacing, edge weight). Scroll rotates discs (random direction or coordinate parallax spiral); scroll speed controls rotation speed.
- **Baby Containers** – Array per disc on the inner edge (count, equidistant or random placement at r/2). Each has thickness, width, length, rotations; optional replace with imported 3D model (origin at baby bottom face center).
- **Center Cylinder** – Along master box axis, front to back; diameter control; visibility Off / On (Union or Subtract with discs).
- **Selection** – Click/tap an Iso Disc or Baby Container to show a contextual panel with that object’s transform (position, rotation, scale). Deselect to return to main carousel controls.
- **Config** – Copy/Load includes `toolMode: "cabinet" | "carousel"` and all carousel parameters.

---

## UI Structure (when re-enabled)

### Tool mode switch (above cabinet controls)
- Two buttons: `#toolModeCabinet`, `#toolModeCarousel`. Active class: `.active`.
- Wrapper: `.tool-mode-switch`.

### Carousel controls panel (`.carousel-tool-section`)
- **Master Box:** Scale X/Y/Z, Rotation X/Y/Z (°), Position X/Y/Z (slider + value input each). Master Box Edge Weight. Show Faces, Show Edges (checkboxes).
- **Iso Discs:** Number of Iso Discs (Max input + slider 0–max + value input). Disc Thickness, Width, Length, Spacing, Disc Edge Weight. Scroll Rotation Mode (select: Random Direction | Coordinate Parallax Spiral).
- **Baby Containers:** Count per Disc (Max + slider + value). Placement (Equidistant | Random). Thickness, Width, Length, Baby Edge Weight. Replace with 3D Model (file input .glb/.gltf/.obj).
- **Center Cylinder:** Visibility (Off | On). Cylinder Diameter. Mode when On (Union | Subtract). Cylinder Edge Weight.
- **Scroll:** Scroll Speed (rotation) – slider + value input.

### Selected object section (`.selected-object-section`)
- Shown when an Iso Disc or Baby Container is selected. Contains: label `#selectedObjectLabel`, Position X/Y/Z, Rotation X/Y/Z, Scale X/Y/Z inputs, Deselect button `#deselectObjectBtn`.
- Panel gets class `.has-selection` and carousel-tool-section main controls are hidden.

---

## Scene structure (when re-enabled)

Inside `#scene3d`:
- `#boxContainer` – Cabinet box (hidden when carousel mode: `.scene-3d.carousel-mode .box-container { display: none }`).
- `#carouselScene` – Visible when carousel mode. Contains:
  - `#masterBoxCarousel` – Six faces (`.box-face-c`), then `#isoDiscStack`, then `#centerCylinderWrap`.
  - Iso discs (`.iso-disc`) with `.iso-disc-inner`; inside each, baby containers (`.baby-container-el`).
  - Center cylinder: multiple slices (`.center-cylinder`) when visibility On.

---

## Control IDs (for re-wiring)

- Master: `carouselScaleX`, `carouselScaleXValue`, same for Y/Z. `carouselRotX`, `carouselRotXValue`, same for Y/Z. `carouselPosX`, `carouselPosXValue`, same for Y/Z. `carouselMasterEdgeWeight`, `carouselMasterEdgeWeightValue`. `carouselMasterShowFaces`, `carouselMasterShowEdges`.
- Discs: `carouselIsoDiscCountMax`, `carouselIsoDiscCount`, `carouselIsoDiscCountValue`. `carouselDiscThickness`, `carouselDiscThicknessValue`, etc. `carouselDiscSpacing`, `carouselDiscEdgeWeight`. `carouselRotationMode`.
- Babies: `carouselBabyCountMax`, `carouselBabyCount`, `carouselBabyCountValue`. `carouselBabyPlacement`. `carouselBabyThickness`, `carouselBabyWidth`, `carouselBabyLength`, `carouselBabyEdgeWeight`. `carouselBabyModelFile`.
- Cylinder: `carouselCylinderVisibility`, `carouselCylinderDiameter`, `carouselCylinderDiameterValue`, `carouselCylinderMode`, `carouselCylinderEdgeWeight`, `carouselCylinderEdgeWeightValue`.
- Scroll: `carouselScrollSpeed`, `carouselScrollSpeedValue`.
- Selected: `selectedObjectLabel`, `selectedPosX/Y/Z`, `selectedRotX/Y/Z`, `selectedScaleX/Y/Z`, `deselectObjectBtn`.

---

## Config keys (carousel)

When `toolMode === 'carousel'`, append to config:  
`carouselScaleX/Y/Z`, `carouselRotX/Y/Z`, `carouselPosX/Y/Z`, `carouselMasterEdgeWeight`, `carouselMasterShowFaces`, `carouselMasterShowEdges`, `carouselIsoDiscCount`, `carouselIsoDiscCountMax`, `carouselDiscThickness`, `carouselDiscWidth`, `carouselDiscLength`, `carouselDiscSpacing`, `carouselDiscEdgeWeight`, `carouselRotationMode`, `carouselBabyCount`, `carouselBabyCountMax`, `carouselBabyPlacement`, `carouselBabyThickness`, `carouselBabyWidth`, `carouselBabyLength`, `carouselBabyEdgeWeight`, `carouselCylinderVisibility`, `carouselCylinderDiameter`, `carouselCylinderMode`, `carouselCylinderEdgeWeight`, `carouselScrollSpeed`.

Load: if `config.toolMode === 'carousel'` call `setToolMode('carousel')`, then `applyCarouselConfig(config)`.

---

## JS entry points (when re-adding)

- `toolMode` (string 'cabinet' | 'carousel').
- `setToolMode(mode)` – toggles `scene3d.classList.carousel-mode`, `controlsPanel.classList.carousel-mode`, button active state; if carousel calls `buildCarousel()`.
- `getCarouselInputs()` – reads all carousel control values.
- `getCarouselConfig()` – returns object for config copy (includes carousel keys + iso/baby max).
- `applyCarouselConfig(config)` – sets all carousel inputs from config, then `buildCarousel()`.
- `buildCarousel()` – clears and rebuilds master box faces, iso disc stack, cylinder; applies selection state if any.
- `selectCarouselElement(el, type)` – sets `selectedCarouselElement`, shows selected-object-section, fills transform inputs.
- `clearSelection()`, `attachSelectedInputListeners()`.
- `bindCarouselInputs()` – IIFE that syncs all carousel sliders with value inputs, configurable max for disc count and baby count, and change handlers that call `buildCarousel()`.
- Carousel scroll: wheel on `#carouselScene` updates `carouselScrollPosition` and per-disc rotation (random or spiral), then updates each disc’s `rotateZ` in DOM.

---

## CSS classes to re-add

- `.scene-3d.carousel-mode .box-container { display: none }`
- `.carousel-scene`, `.scene-3d.carousel-mode .carousel-scene { display: block }`
- `.master-box-carousel`, `.master-box-carousel .box-face-c`, `.iso-disc-stack`, `.iso-disc`, `.iso-disc-inner`, `.baby-container-el`, `.center-cylinder-wrap`, `.center-cylinder`
- `.controls-panel.carousel-mode .cabinet-tool-section { display: none }`, `.controls-panel.carousel-mode .carousel-tool-section { display: block }`
- `.selected-object-section`, `.controls-panel.has-selection .selected-object-section { display: block }`, `.controls-panel.has-selection .carousel-tool-section .control-group, h3, hr { display: none !important }`
- `.tool-mode-switch`, `.tool-mode-btn`, `.tool-mode-btn.active`

---

*Archived from live 3d-cabinet implementation. Re-integrate using this spec and the existing 3d-cabinet.html structure.*
