# Design QA

## Comparison target

- Source visual truth:
  - `C:/Users/erik9/AppData/Local/Temp/codex-clipboard-8dd5c030-6e77-40f2-9024-27cb54bdaee0.png` (opaque white bottle background and missing note artwork)
  - `C:/Users/erik9/AppData/Local/Temp/codex-clipboard-02853b62-591e-41d6-908d-9351045c3546.png` (floating product image treatment)
  - `C:/Users/erik9/AppData/Local/Temp/codex-clipboard-248048df-fe84-48f9-9743-5b58b9e97464.png` (enclosed white patch inside a ring-shaped cap)
- Browser-rendered implementation:
  - `C:/Users/erik9/.codex/visualizations/2026/07/20/019f7f9e-2c88-7b62-a9e2-75e8170b4466/inara-after-v2-matched.png`
  - `C:/Users/erik9/.codex/visualizations/2026/07/20/019f7f9e-2c88-7b62-a9e2-75e8170b4466/supremacy-after-v2-matched.png`
  - `C:/Users/erik9/.codex/visualizations/2026/07/20/019f7f9e-2c88-7b62-a9e2-75e8170b4466/supremacy-mobile-v2.png`
- Viewports: 1091 × 613 desktop; 390 × 844 mobile.
- State: dark theme; top of fragrance detail page.

## Comparison evidence

- Matched before/after comparison:
  `C:/Users/erik9/.codex/visualizations/2026/07/20/019f7f9e-2c88-7b62-a9e2-75e8170b4466/supremacy-before-after.png`
- The opaque catalog JPG now composites as a cutout against the existing dark image well. The cap ring remains intact and its enclosed opening shows the page background.
- Inara Black retains its silver highlights and dark bottle edges without a white rectangular matte.

## Required fidelity surfaces

- Layout, typography, spacing, colors, borders, and page copy are unchanged.
- All 414 opaque `fimgs.net` catalog bottle images use the shared background-removal endpoint. The 6,682 native transparent `img.fraganty.ai` images bypass it.
- Background removal is restricted to edge-connected near-white pixels and qualifying enclosed upper-product holes. Legitimate white product bodies and labels remain opaque.
- Woodsy Notes, Aromatic Notes, Herbal Notes, and Spicy Notes now use exact 120 × 120 ingredient artwork instead of letter fallbacks.

## Findings and fixes

1. P1: the first mask removed only edge-connected white, leaving white inside ring-shaped packaging.
   - Fix: added enclosed-component classification constrained by size, shape, fill ratio, and upper-product position.
   - Result: the ring opening is transparent while the white speckled bottle remains intact.
2. No remaining P0, P1, or P2 visual findings.

## Browser verification

- Verified Inara Black desktop: bottle cutout loaded at 375 × 500; all eight note images loaded, including the four formerly missing broad-note illustrations.
- Verified Supremacy Collector's Edition desktop and 390 px mobile: cap opening transparent, white bottle body preserved, no horizontal overflow.
- Verified Creed Aventus: native transparent Fraganty image remains direct and bypasses processing.
- Production build passed. ESLint passed with zero errors; four existing unused-function warnings remain in scraper files.

Earlier task result: passed

---

# Note thumbnail containment QA

## Comparison target

- Source visual truth: `C:/Users/erik9/AppData/Local/Temp/codex-clipboard-299d2bf7-d5be-434a-a28f-a79f8ca16d2e.png`.
- Browser-rendered implementation: `C:/Users/erik9/.codex/visualizations/2026/07/20/019f7fd6-aced-7732-9260-6c495c898971/note-images-after.png`.
- Viewports: 1146 × 958 desktop and 390 × 844 mobile.
- State: dark theme; Afnan Supremacy Collector's Edition Pour Homme fragrance detail, scrolled to accords and perfume pyramid.

## Comparison evidence

- Full-view side-by-side comparison: `C:/Users/erik9/.codex/visualizations/2026/07/20/019f7fd6-aced-7732-9260-6c495c898971/note-images-comparison.png`.
- Focused region comparison was not needed because every 80 × 80 note frame and its image remain clearly legible in the full-view comparison.
- All ten note images render as equal 70.39 × 70.39 inner squares, use `object-fit: cover`, retain a 12 px image radius, and remain inside their 80 × 80 white frames.

## Required fidelity surfaces

- Fonts and typography: unchanged.
- Spacing and layout rhythm: unchanged; existing white inset border and 80 × 80 frame size preserved.
- Colors and visual tokens: unchanged.
- Image quality and asset fidelity: source assets unchanged; wide and tall images now crop consistently instead of letterboxing.
- Copy and content: unchanged.

## Comparison history

1. P2: Apple and portrait-oriented note artwork were letterboxed and appeared undersized inside otherwise uniform square frames.
   - Fix: use a rounded square cover crop for perfume-pyramid thumbnails only.
   - Post-fix evidence: Apple, Orange Blossom, Pineapple, Birch, and all other notes now fill the same inner square while remaining contained by the white frame.

## Browser verification

- Desktop: all ten images loaded, remained contained, and produced no horizontal overflow.
- Mobile: all ten images remained contained at 390 px with no horizontal overflow.
- Console checked; one unrelated existing Next.js development-runtime script-tag message was present. Production build and TypeScript completed successfully.

No remaining P0, P1, or P2 visual findings.

final result: passed
