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

---

# Header fragrance-logo QA

## Comparison target

- Source visual truth: `C:/Users/erik9/AppData/Local/Temp/codex-clipboard-7c69b61e-3cc1-4b99-b340-e4fdca135923.png`.
- Browser-rendered implementation: `D:/Code/this-or-that-fragrance-games/qa-artifacts/logo-homepage-after.jpg`.
- Viewport: 1280 × 720 desktop at 1× device scale.
- State: dark theme; homepage top.

## Comparison evidence

- Full source-to-implementation comparison: `D:/Code/this-or-that-fragrance-games/qa-artifacts/logo-comparison.png`.
- Focused region comparison uses the same artifact because the supplied source contains only the 128 × 72 header-logo crop.

## Required fidelity surfaces

- Fonts and typography: existing Geist wordmark, weight, tracking, and baseline remain unchanged.
- Spacing and layout rhythm: mark-to-wordmark gap remains compact; the 24 px replacement is centered in the existing 64 px header without affecting navigation.
- Colors and visual tokens: existing amber accent and dark header surface remain unchanged.
- Image quality and asset fidelity: dedicated Hugeicons `PerfumeIcon` replaces the cleaning-style spray-bottle mark, giving the logo a wider glass body, short neck, and atomizer silhouette at UI scale.
- Copy and content: “This or That” remains unchanged.

## Comparison history

1. P2: the prior narrow spray-bottle outline read as a household cleaning product rather than fragrance branding.
   - Fix: replaced it with a dedicated perfume-bottle icon, increased to 24 px, and used a 1.8 px stroke for small-size clarity.
   - Post-fix evidence: `D:/Code/this-or-that-fragrance-games/qa-artifacts/logo-comparison.png` shows the wider, more recognizable fragrance silhouette while preserving the wordmark.
2. No remaining actionable P0, P1, or P2 findings.

## Browser verification

- Brand link remains uniquely labeled “This or That,” visible, and navigates to `/`.
- No horizontal overflow and no browser console warnings or errors.
- Production build and focused ESLint check passed.

final result: passed

---

# Homepage and game-page concept implementation QA

## Comparison target

- Source visual truth:
  - `C:/Users/erik9/Downloads/Generated image 1.png` (editorial homepage hero, daily feature, compact game rows).
  - `C:/Users/erik9/Downloads/Generated image 2.png` (three-column grouped game browser).
  - `C:/Users/erik9/Downloads/Generated image 3.png` (outlined game-card system and category hierarchy).
- Browser-rendered implementation:
  - `D:/Code/this-or-that-fragrance-games/qa-artifacts/home-desktop-viewport.png`.
  - `D:/Code/this-or-that-fragrance-games/qa-artifacts/game-setup-desktop.png`.
  - `D:/Code/this-or-that-fragrance-games/qa-artifacts/home-mobile-viewport.png`.
  - `D:/Code/this-or-that-fragrance-games/qa-artifacts/game-setup-mobile.png`.
- Viewports: 1536 × 1024 desktop and 390 × 844 mobile.
- State: dark theme; homepage top; Higher Rating setup; Higher Rating round 1 after selecting 15 rounds.

## Comparison evidence

- Full-view side-by-side comparison: `D:/Code/this-or-that-fragrance-games/qa-artifacts/comparison-home.png`.
- Focused card-system comparison: `D:/Code/this-or-that-fragrance-games/qa-artifacts/comparison-cards.png`.
- The implementation intentionally combines image 1's hero/daily hierarchy with image 3's three-column cards so all 18 implemented game modes remain discoverable.

## Required fidelity surfaces

- Fonts and typography: Geist Sans matches the references' neutral grotesk character. Heavy display weight, tight headline tracking, muted body copy, and amber emphasis follow the source hierarchy without clipping at desktop or mobile widths.
- Spacing and layout rhythm: 1280 px desktop shell, 64 px sticky header, 128 px game cards, rounded daily feature, and 390 px single-column collapse match the concepts' density and grouping. No horizontal overflow at either tested viewport.
- Colors and visual tokens: near-black background, slightly raised ink cards, restrained warm borders, off-white text, muted stone copy, and amber accent match the shared palette across all three references. Light theme remains functional as an alternate state.
- Image quality and asset fidelity: references contain no raster product imagery. All visible UI symbols use Phosphor's consistent outlined icon family; no placeholder art, CSS drawings, handcrafted SVGs, gradients, or emoji were introduced.
- Copy and content: source phrasing is preserved where applicable. “Eighteen games” intentionally reflects the actual implemented catalog rather than the concept's outdated “Thirteen games.”
- Accessibility and behavior: native links/buttons, visible focus rings, labeled search and theme controls, wrapped mobile option controls, reduced-motion support, and semantic section headings remain in place.

## Comparison history

1. P2: initial implementation's desktop hero was taller and sat about 20 px lower than the source, delaying the daily feature and first game row.
   - Fix: reduced the desktop display size from 72 px to 60 px, removed the extra hero top padding, and tightened daily-card vertical padding.
   - Post-fix evidence: `D:/Code/this-or-that-fragrance-games/qa-artifacts/comparison-home.png` shows aligned header-to-hero rhythm and closer above-the-fold density.
2. No remaining actionable P0, P1, or P2 findings. Different game-group labels and the complete 18-mode catalog are intentional product-content adaptations across the three supplied concepts.

## Browser verification

- Homepage daily CTA navigated to `/play/connections-daily`; “All games” returned to `/#games`.
- Higher Rating setup accepted 15 rounds and started at “Round 1 of 15.”
- Search input accepted a query and exposed its live searching state.
- Light and dark theme controls updated the document theme correctly.
- Desktop and mobile homepage/game setup rendered without horizontal overflow.
- Browser console checked after homepage navigation and game start: zero errors.
- Production build passed. ESLint passed with zero errors and four pre-existing unused-function warnings in scraper scripts.

final result: passed
