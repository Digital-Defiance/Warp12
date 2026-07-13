# TEI Grade UI Design Guide
**Implementation Guide for Phase 3**

## Design Principles

### 1. TEI Primary, OpenSkill in Tooltips
- **Main UI:** Always show TEI grades ("V67", "E84", "I40")
- **Tooltips:** Show underlying OpenSkill (μ, σ) for power users
- **Never:** Show raw OpenSkill numbers as primary display

### 2. Progressive Disclosure
- **Default:** Simple, gamified TEI grade
- **Hover:** Tooltip with grade explanation + OpenSkill details
- **Advanced:** Optional "Show Advanced Stats" toggle in settings

### 3. Color-Coded Confidence
- **E (Elite):** Gold/Yellow (#FFD700) — Rare, aspirational
- **V (Veteran):** Blue (#4169E1) — Reliable, established
- **C (Consistent):** Green (#32CD32) — Stable performance
- **I (Improving):** Orange (#FFA500) — Recent changes, growing
- **P (Provisional):** Gray (#9E9E9E) — Still establishing

## Component Specifications

### TeiDisplay Component

**Primary Use:** Show player ratings throughout the app

**Visual Layout:**
```
┌──────────────┐
│  V  67       │  ← Large, prominent
│  │   │       │
│  │   └─ Score (0-99)
│  └───── Grade letter (E/V/C/I/P)
└──────────────┘
```

**Props:**
```typescript
interface TeiDisplayProps {
  rating: PlayerRating;          // { mu, sigma, matches }
  objective?: RatingTrack;       // 'goOut' | 'points' - for label
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;         // Default: true
  showLabel?: boolean;           // "Go-Out Rating"
  className?: string;
}
```

**Tooltip Content:**
```
Veteran: Highly reliable skill estimate

Conservative Rating: 67/99
Skill (μ): 32.0
Confidence (σ): 1.2
Matches: 150

Your rating is μ - 3σ = 28.2
```

**CSS Classes:**
```scss
.tei-display {
  &--size-small { font-size: 1rem; }
  &--size-medium { font-size: 1.5rem; }
  &--size-large { font-size: 2rem; }
}

.tei-grade {
  font-weight: bold;
  
  &--elite { color: #FFD700; }      // Gold
  &--veteran { color: #4169E1; }    // Blue
  &--consistent { color: #32CD32; }  // Green
  &--improving { color: #FFA500; }   // Orange
  &--provisional { color: #9E9E9E; } // Gray
}

.tei-score {
  font-weight: normal;
  margin-left: 0.25rem;
}
```

**Accessibility:**
```html
<span aria-label="Veteran grade, 67 out of 99">
  <span class="tei-grade tei-grade--veteran">V</span>
  <span class="tei-score">67</span>
</span>
```

---

### TeiChange Component

**Primary Use:** Show rating changes after match completion

**Visual Layout:**
```
┌──────────────────────────────┐
│  V65  →  V67  (+2)          │
│   ↑       ↑     ↑           │
│  before  after  delta       │
└──────────────────────────────┘
```

**With Grade Change (Promotion):**
```
┌──────────────────────────────┐
│  I67  →  C67  🎉            │ ← Celebration for grade up!
│   ↑       ↑                  │
│  orange  green               │
└──────────────────────────────┘
```

**Props:**
```typescript
interface TeiChangeProps {
  beforeRating: PlayerRating;
  afterRating: PlayerRating;
  showDelta?: boolean;           // Default: true
  animate?: boolean;             // Default: true
  className?: string;
}
```

**Tooltip Content (on delta):**
```
Skill (μ): +2.1
Confidence (σ): -0.15
```

**Animation Sequence:**
1. Show "before" TEI (0.5s fade in)
2. Arrow slides in (0.3s)
3. "after" TEI fades in with color shift (0.5s)
4. Delta appears (0.3s)
5. If grade changed: Confetti/glow animation (1s)

---

### TeiGradeBadge Component

**Primary Use:** Compact grade indicator (leaderboards, player cards)

**Visual Layout:**
```
┌───┐
│ V │  ← Colored circle with letter
└───┘
```

**Props:**
```typescript
interface TeiGradeBadgeProps {
  grade: TeiGrade;              // 'E' | 'V' | 'C' | 'I' | 'P'
  size?: 'small' | 'medium';
  showTooltip?: boolean;        // Default: true
  className?: string;
}
```

**Tooltip Content:**
```
Veteran
Highly reliable skill estimate
```

**CSS:**
```scss
.tei-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: bold;
  
  &--size-small {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.875rem;
  }
  
  &--size-medium {
    width: 2rem;
    height: 2rem;
    font-size: 1rem;
  }
  
  &--elite { background: #FFD700; color: #000; }
  &--veteran { background: #4169E1; color: #FFF; }
  &--consistent { background: #32CD32; color: #FFF; }
  &--improving { background: #FFA500; color: #FFF; }
  &--provisional { background: #9E9E9E; color: #FFF; }
}
```

---

## UI Locations

### Profile Page

**Main Rating Display:**
```
┌────────────────────────────────────┐
│  Your TEI Ratings                  │
├────────────────────────────────────┤
│  Go-Out Rating:    V67 (150 games)│
│  Points Rating:    C52 (120 games)│
└────────────────────────────────────┘

[Show Advanced Stats ▼]
```

**Advanced Stats (collapsed by default):**
```
┌────────────────────────────────────┐
│  ▼ Advanced Stats                  │
├────────────────────────────────────┤
│  Go-Out (μ): 32.0                 │
│  Go-Out (σ): 1.2                  │
│  Ordinal Rating: 28.2              │
│                                    │
│  [Rating History Graph]            │
└────────────────────────────────────┘
```

---

### Leaderboard

**Table Layout:**
```
┌──────┬─────────────┬─────────┬─────────┐
│ Rank │ Captain     │ Rating  │ Matches │
├──────┼─────────────┼─────────┼─────────┤
│  1   │ Alice       │ E84     │ 650     │
│  2   │ Bob         │ V78     │ 420     │
│  3   │ Carol       │ V72     │ 380     │
│  4   │ Dave        │ C58     │ 190     │
│  5   │ Eve         │ I45     │  85     │
│  6   │ Frank       │ P22 ⚠️  │  12     │  ← Provisional badge
└──────┴─────────────┴─────────┴─────────┘
```

**Advanced View (toggle):**
```
┌──────┬─────────┬─────────┬──────┬──────┬─────────┐
│ Rank │ Captain │ Rating  │   μ  │   σ  │ Matches │
├──────┼─────────┼─────────┼──────┼──────┼─────────┤
│  1   │ Alice   │ E84     │ 45.0 │ 0.4  │ 650     │
│  2   │ Bob     │ V78     │ 40.5 │ 1.1  │ 420     │
└──────┴─────────┴─────────┴──────┴──────┴─────────┘
```

---

### Match Summary

**Post-Game Card:**
```
┌────────────────────────────────────┐
│  Rating Change                     │
├────────────────────────────────────┤
│  Go-Out:  V65 → V67 (+2)          │
│                                    │
│  Skill increased by 2.1            │
│  Confidence improved by 0.15σ      │
└────────────────────────────────────┘
```

**Grade Promotion:**
```
┌────────────────────────────────────┐
│  🎉 Grade Promotion! 🎉           │
├────────────────────────────────────┤
│  I67 → C67                        │
│                                    │
│  You've reached Consistent!        │
│  Your rating is now more reliable. │
└────────────────────────────────────┘
```

---

### In-Game Player Card (HUD)

**Compact Display:**
```
┌─────────────────────┐
│ [V] Alice           │  ← Just badge, no score (less clutter)
│ [C] Bob             │
│ [I] Carol           │
└─────────────────────┘
```

**Hover Tooltip:**
```
Alice - Veteran (V67)
150 matches played
```

---

## Responsive Design

### Mobile (< 768px)
- Use compact `TeiGradeBadge` in lists
- Full `TeiDisplay` only on profile/detail pages
- Tooltips become tap-to-show overlays

### Tablet (768px - 1024px)
- Medium size TEI displays
- Compact tables with horizontal scroll

### Desktop (> 1024px)
- Large TEI displays on profiles
- Full table columns visible
- Hover tooltips work well

---

## Animations

### Grade Promotion (I → C, C → V, etc.)
```css
@keyframes grade-promotion {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); filter: brightness(1.5); }
  100% { transform: scale(1); }
}
```

### Rating Increase (+)
```css
@keyframes rating-up {
  0% { color: inherit; }
  50% { color: #32CD32; } /* Green */
  100% { color: inherit; }
}
```

### Rating Decrease (-)
```css
@keyframes rating-down {
  0% { color: inherit; }
  50% { color: #FF4444; } /* Red */
  100% { color: inherit; }
}
```

---

## Accessibility Checklist

- [ ] All grade colors meet WCAG AA contrast ratios
- [ ] Screen reader announcements for ratings
- [ ] Keyboard navigation for tooltips (Tab to focus, Esc to close)
- [ ] ARIA labels for all rating components
- [ ] Color is not the only differentiator (letters + colors)
- [ ] Focus indicators visible on grade badges
- [ ] Reduced motion support (disable animations if prefers-reduced-motion)

---

## Implementation Order

1. **Core Components** (Week 1)
   - `TeiDisplay` component
   - `TeiGradeBadge` component
   - Storybook stories for both
   
2. **Profile & Leaderboard** (Week 1-2)
   - Update profile page
   - Update leaderboard
   - Test with real data
   
3. **Match Summary** (Week 2)
   - `TeiChange` component
   - Post-match cards
   - Grade promotion animations
   
4. **Polish & Testing** (Week 2)
   - In-game HUD updates
   - Responsive testing
   - Accessibility audit
   - User acceptance testing

---

## Example Code

```tsx
// Basic usage
import { TeiDisplay } from './components/tei-display';

<TeiDisplay 
  rating={{ mu: 32.0, sigma: 1.2, matches: 150 }}
  objective="goOut"
  size="large"
/>

// With change animation
import { TeiChange } from './components/tei-change';

<TeiChange
  beforeRating={beforeMatch}
  afterRating={afterMatch}
  animate={true}
/>

// Compact badge
import { TeiGradeBadge } from './components/tei-grade-badge';

<TeiGradeBadge grade="V" size="small" />
```

---

**Status:** Ready for Phase 3 implementation  
**Dependencies:** warp12-engine exports (getTeiDisplay, etc.) ✅  
**Next:** Create React components + Storybook stories
