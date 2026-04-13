# Thermal Resonance Hero — Intelligence Tab

## Context

ClimatePulse needs a distinctive visual identity piece. The user has a p5.js generative art prototype ("Thermal Resonance") that renders animated Gaussian pulse curves over a gradient background. This spec describes integrating that animation as a hero banner in the Intelligence tab, adapted to the catalyst.study brand palette and built with pure Canvas API (no p5.js dependency).

## Design Decisions (Confirmed)

| Decision | Choice |
|----------|--------|
| Placement | Intelligence tab hero only (not global header) |
| Interactivity | Subtle data-driven + hover tooltip (desktop only) |
| Color palette | Plum (#4A1942) → Forest (#1B4332) → Green (#2D6A4F) gradient, cream (#F8F6F3) signals |
| Data source | Date-seeded PRNG (today's date = unique daily art, consistent across reloads) |
| Implementation | Pure Canvas 2D API + useRef/useEffect (zero new dependencies) |
| Mobile | Hidden entirely — clean text-only header fallback |

## Component: `ThermalResonanceHero`

**File:** `src/components/thermal-resonance-hero.tsx`

A `"use client"` component rendering an animated canvas with overlay text.

### Props

```typescript
interface ThermalResonanceHeroProps {
  title?: string;          // Default: "Daily Intelligence Briefing"
  subtitle?: string;       // Default: formatted today's date + signal count
  className?: string;
}
```

### Canvas Animation

**Gradient background:** 3-stop linear gradient at 135deg — `#4A1942` (plum) → `#1B4332` (deep forest) → `#2D6A4F` (forest green).

**Signal curves:** 5 Gaussian bell curves rendered as smooth paths with cream (`#F8F6F3`) stroke at varying opacities (0.2–0.65). Each curve has:
- `mu` — horizontal center position (randomised 0.12–0.88)
- `sigma` — spread width (randomised range)
- `amp` — amplitude (randomised 0.45–1.0)
- Sinusoidal drift on mu, sigma, and amplitude for organic motion
- Simple harmonic noise layered on the Gaussian shape

**Baseline:** A subtle horizontal reference line at ~78% height, cream at 12% opacity.

**Animation speed:** Target ~24fps via `requestAnimationFrame` with a frame counter incrementing by 1 per frame. Frame counter advances at roughly 60% of the original prototype speed (the user noted it was "a bit fast"). Achieved by scaling all `speed` and `sigmaSpeed` parameters by 0.6x.

**Curve vertical range:** Curves are constrained to the upper ~65% of the canvas. The bottom 35% is reserved for the gradient overlay + title text, preventing curves from cutting through the title.

### Overlay

A `div` absolutely positioned at the bottom of the hero with:
- CSS gradient from `transparent` to `rgba(27,67,50,0.6)` — ensures title readability
- Title in display font (`font-display`), white
- Subtitle in smaller text, white at 70% opacity

### Hover Tooltip (Desktop Only)

On `mouseenter` of the canvas area (desktop only, hidden below `md` breakpoint):
- Small tooltip appears in the top-right corner
- Shows: "Signal Pulse" label in sage (#95D5B2), curve count, date seed
- Semi-transparent forest background with backdrop blur
- Fades in/out with CSS transition

### Responsive Behavior

- **Desktop (md+):** Full animated canvas, 200px height, hover tooltip enabled
- **Mobile (<md):** Component renders a simple styled `div` with the gradient background (no canvas, no animation), title and subtitle only. This avoids unnecessary GPU usage on mobile.

### Performance

- `requestAnimationFrame` loop with cleanup on unmount
- Pauses animation when document is hidden (`visibilitychange` event)
- Canvas resolution matches `devicePixelRatio` for sharp rendering on Retina
- ResizeObserver for responsive canvas sizing
- No dependencies on pipeline data — renders immediately

### Seeded PRNG

Uses a `mulberry32` PRNG seeded with `YYYYMMDD` integer (e.g., `20260412`). This means:
- Same curves every time you load the page on a given day
- Different curves tomorrow
- Deterministic — no flicker or layout shift

## Integration into Intelligence Tab

**File modified:** `src/components/intelligence-tab.tsx`

Insert `<ThermalResonanceHero />` at the top of the Intelligence tab's return JSX, before the existing content (Daily Number, stories, etc.). Wrap in a container div that handles the rounded corners.

```tsx
// At top of IntelligenceTab render:
<ThermalResonanceHero
  title="Daily Intelligence Briefing"
  subtitle={`${format(new Date(), 'EEEE, d MMMM yyyy')} · ${signalCount} signals tracked`}
/>
// ... existing Daily Number, Hero Stories, Compact Stories, etc.
```

Date formatting: use a simple helper (no date-fns needed — `Intl.DateTimeFormat` or manual formatting).

## Files

| File | Action |
|------|--------|
| `src/components/thermal-resonance-hero.tsx` | Create — new component |
| `src/components/intelligence-tab.tsx` | Modify — import and render hero at top |

## Verification

1. Run `npm run dev` and open `http://localhost:3030`
2. Navigate to Intelligence tab
3. Confirm: animated plum → forest gradient with cream Gaussian curves
4. Confirm: curves stay in upper portion, not cutting through title text
5. Confirm: animation is smooth but not too fast
6. Confirm: hover over canvas shows tooltip (desktop)
7. Resize to mobile width — confirm canvas is hidden, simple gradient header shown
8. Reload page — confirm same curves appear (date seed consistency)
9. Check browser devtools Performance tab — confirm no excessive paint/layout thrashing
