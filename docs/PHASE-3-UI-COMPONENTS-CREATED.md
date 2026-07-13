# Phase 3: UI Components Created

## Summary

Created 3 React components for displaying TEI grades with full hysteresis support.

## Components Created

### 1. TeiDisplay (`tei-display.tsx` + `.module.scss`)

**Purpose:** Primary rating display showing "V67" format with tooltips

**Features:**
- Shows grade letter + score (e.g., "V67", "E84")
- Colored by confidence (E=gold, V=blue, C=green, I=orange, P=gray)
- Hover tooltip shows:
  - Grade name and description
  - Conservative rating (score/99)
  - Raw OpenSkill (μ, σ)
  - Match count
  - Formula explanation
- Size variants: small, medium, large
- Optional objective label ("Go-Out Rating", "Points Rating")
- **Hysteresis support:** Accepts `currentGrade` prop

**Props:**
```typescript
interface TeiDisplayProps {
  rating: PlayerRating;           // { mu, sigma, matches }
  currentGrade?: TeiGrade;         // For hysteresis (from Firestore)
  objective?: RatingTrack;         // 'goOut' | 'points'
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;           // Default: true
  showLabel?: boolean;             // Show objective label
  className?: string;
}
```

**Usage:**
```tsx
<TeiDisplay 
  rating={playerStats.rating.goOut}
  currentGrade={playerStats.rating.goOut.displayGrade}
  objective="goOut"
  size="large"
  showLabel
/>
```

---

### 2. TeiChange (`tei-change.tsx` + `.module.scss`)

**Purpose:** Show rating changes after match completion

**Features:**
- Before → After display with arrow
- Delta display (+2, -3, etc.)
- Grade promotion/demotion badges
- Smooth animations (fade in, glow effect on promotions)
- Color-coded deltas (green +, red -, gray 0)
- Special celebration for grade upgrades (glow animation)
- **Hysteresis support:** Accepts before/after grades

**Props:**
```typescript
interface TeiChangeProps {
  beforeRating: PlayerRating;
  beforeGrade?: TeiGrade;          // For hysteresis
  afterRating: PlayerRating;
  afterGrade?: TeiGrade;           // For hysteresis
  showDelta?: boolean;             // Default: true
  animate?: boolean;               // Default: true
  className?: string;
}
```

**Usage:**
```tsx
<TeiChange
  beforeRating={beforeMatch}
  beforeGrade={storedGradeBefore}
  afterRating={afterMatch}
  afterGrade={storedGradeAfter}
  animate
/>
```

**Animations:**
- Before: 0.5s fade in
- Arrow: 0.3s slide in (0.5s delay)
- After: 0.5s fade in (0.8s delay)
- Promotion glow: 0.5s scale + brightness + drop-shadow (0.8s delay)
- Delta: 0.3s fade in (1.1s delay)
- Badge: 0.4s pop (1.2s delay)

---

### 3. TeiGradeBadge (`tei-grade-badge.tsx` + `.module.scss`)

**Purpose:** Compact grade indicator for tables/lists

**Features:**
- Just the letter (E/V/C/I/P) in colored circle
- Size variants: small (1.5rem), medium (2rem)
- Hover tooltip with grade name + description
- Hover effect: scale(1.1) + glow
- Accessible (aria-label)

**Props:**
```typescript
interface TeiGradeBadgeProps {
  grade: TeiGrade;                 // 'E' | 'V' | 'C' | 'I' | 'P'
  size?: 'small' | 'medium';
  showTooltip?: boolean;           // Default: true
  className?: string;
}
```

**Usage:**
```tsx
<TeiGradeBadge grade="V" size="small" />
```

---

## Design System

### Color Palette (CSS Variables)

```scss
--grade-elite: #ffd700         // Gold
--grade-veteran: #4169e1       // Royal blue
--grade-consistent: #32cd32    // Lime green
--grade-improving: #ffa500     // Orange
--grade-provisional: #9e9e9e   // Gray
```

### Typography

- Grade letters: `var(--font-display, system-ui)`, bold
- Scores: `var(--font-mono, monospace)`, normal weight
- Tooltips: 0.875rem body text

### Spacing

- Component gap: 0.25rem–1rem (contextual)
- Tooltip padding: 0.75rem
- Badge dimensions: 1.5rem (small), 2rem (medium)

### Animations

All animations use `ease-in-out` or `ease-out` curves with durations 0.2s–0.5s.

---

## Files Created

### Components:
- ✅ `apps/Warp12/src/app/components/tei-display.tsx`
- ✅ `apps/Warp12/src/app/components/tei-display.module.scss`
- ✅ `apps/Warp12/src/app/components/tei-change.tsx`
- ✅ `apps/Warp12/src/app/components/tei-change.module.scss`
- ✅ `apps/Warp12/src/app/components/tei-grade-badge.tsx`
- ✅ `apps/Warp12/src/app/components/tei-grade-badge.module.scss`
- ✅ `apps/Warp12/src/app/components/index.ts` (barrel export)

### Documentation:
- ✅ `docs/HYSTERESIS-IMPLEMENTATION.md`
- ✅ `docs/TEI-GRADE-SYSTEM.md` (updated with hysteresis details)
- ✅ `docs/PHASE-3-UI-COMPONENTS-CREATED.md` (this file)

---

## Integration Checklist

### Next Steps (Manual Integration Required):

1. **Import Components:**
   ```tsx
   import { TeiDisplay, TeiChange, TeiGradeBadge } from './components';
   ```

2. **Update Profile Page:**
   - Replace old TEI display with `<TeiDisplay />`
   - Pass `currentGrade` from Firestore
   - Show both Go-Out and Points ratings side-by-side

3. **Update Leaderboard:**
   - Use `<TeiGradeBadge />` in table rows
   - Use `<TeiDisplay />` for detailed view
   - Sort by `displayRating` (μ - 3σ)

4. **Update Match Summary:**
   - Use `<TeiChange />` to show before/after
   - Celebrate grade promotions with animation

5. **Update In-Game HUD:**
   - Use `<TeiGradeBadge />` next to player names
   - Keep it minimal (just the badge)

6. **Stats Service Integration:**
   - Ensure `displayGrade` is read from Firestore
   - Pass it to all TEI components
   - Update Cloud Functions to write `displayGrade` on rating updates

---

## Responsive Design

All components are mobile-friendly:

- **TeiDisplay:** Tooltip becomes modal on mobile (fixed position, centered)
- **TeiChange:** Wraps on small screens, reduces gap/font sizes
- **TeiGradeBadge:** Scales consistently, always circular

Breakpoint: `max-width: 768px`

---

## Accessibility

✅ **ARIA labels** on all interactive elements  
✅ **Keyboard navigation** support (hover states work with focus)  
✅ **Color contrast** meets WCAG AA (text + color differentiation)  
✅ **Screen reader friendly** (grade name + score announced)  
✅ **Reduced motion** support (can disable animations via CSS `prefers-reduced-motion`)

---

## Status

✅ **3/3 Components Created**  
✅ **Full Hysteresis Support**  
✅ **Responsive & Accessible**  
✅ **Animations & Polish**  

**Ready for integration into pages!**

