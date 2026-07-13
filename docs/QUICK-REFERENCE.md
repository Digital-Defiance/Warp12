# OpenSkill + TEI Grade - Quick Reference

**TL;DR:** Everything is ready. Deploy now or polish UI first (optional).

---

## 🚀 Deploy Right Now (15 minutes)

```bash
cd /Volumes/Code/Warp12

# Build
yarn build:all

# Wipe Firebase (user confirmed safe)
# → Go to Firebase Console → Delete playerStats collection

# Deploy
yarn deploy:firestore   # Rules
yarn deploy:functions   # Cloud Functions  
yarn deploy:hosting     # Web app (optional)

# Verify
# → Play test match
# → Check Firestore for displayGrade field
# → Done!
```

**Full instructions:** `docs/DEPLOYMENT-CHECKLIST.md`

---

## 📊 What Changed

### Before (Elo)
```
Rating: 1532 (numeric)
Display: "1532 · Class V"
Problems: Flickering at boundaries, no uncertainty
```

### After (OpenSkill + TEI Grades)
```
Rating: μ=32.0, σ=1.2 (Bayesian)
Display: "V67" (grade + score)
Benefits: No flickering (hysteresis), shows confidence
```

---

## 💻 Code Examples

### Engine (warp12-engine)
```typescript
import { getTeiDisplay, updateVsAI, getAIAnchor } from 'warp12-engine';

// Update rating
const aiAnchor = getAIAnchor('commander', 'points');
const [newRating] = updateVsAI(playerRating, aiAnchor, finishRank);

// Get TEI display with hysteresis
const tei = getTeiDisplay(newRating, currentGrade);
// → { grade: 'V', score: 67, formatted: 'V67' }
```

### Client Service
```typescript
import { usePlayerStats } from '../firebase/use-player-stats';

const playerStats = usePlayerStats();

// Get full TEI display
const tei = playerStats.getTeiDisplay('commander', 'points');
// → { grade: 'V', score: 67, formatted: 'V67' }

// Get rating with displayGrade
const rating = playerStats.getStoredRating('commander', 'points');
// → { mu: 32.0, sigma: 1.2, displayGrade: 'V', ... }
```

### UI Component
```tsx
import { TeiDisplay } from './components/tei-display';

<TeiDisplay
  rating={rating}
  currentGrade={rating?.displayGrade}
  objective="points"
  size="large"
/>
```

---

## 📁 Key Files

### What's Complete ✅
- `libs/engine/src/lib/rating/` - OpenSkill + TEI grades
- `functions/src/tei/` - Cloud Functions with displayGrade
- `apps/Warp12/src/firebase/stats-service.ts` - Client service
- `apps/Warp12/src/app/components/tei-*.tsx` - UI components

### What's Optional ⏳
- `apps/Warp12/src/app/profile-page.tsx` - Use TeiDisplay (cosmetic)
- `apps/Warp12/src/app/leaderboard-page.tsx` - Use badges (cosmetic)
- `apps/Warp12/src/app/sector-summary.tsx` - Use TeiChange (cosmetic)

---

## 🧪 Verification

### After Deployment
1. **Play solo AI match** → Check Firestore
2. **Verify displayGrade field** → Should be "P" for new players
3. **Play 10+ matches** → Watch grade progress (P → I → C)
4. **Check for flickering** → Should be none at boundaries

### Expected Data
```json
playerStats/{uid}/localAi/commander/points: {
  "rating": {
    "mu": 25.5,
    "sigma": 7.8,
    "matches": 1,
    "displayRating": 2.1,
    "displayGrade": "P"  // ← NEW!
  },
  "wins": 1
}
```

---

## 🎯 Grade System

| Grade | Name        | σ Range   | Enter σ | Exit σ |
|-------|-------------|-----------|---------|--------|
| **E** | Elite       | < 0.5     | < 0.4   | > 0.6  |
| **V** | Veteran     | 0.5-1.5   | < 1.4   | > 1.6  |
| **C** | Consistent  | 1.5-2.5   | < 2.4   | > 2.6  |
| **I** | Improving   | 2.5-4.0   | < 3.8   | > 4.2  |
| **P** | Provisional | ≥ 4.0     | —       | —      |

**Score:** `(μ - 3σ) normalized to 0-99`

**Hysteresis:** Enter/exit thresholds prevent flickering

---

## 📚 Full Documentation

- `MIGRATION-COMPLETE.md` - Complete overview (**START HERE**)
- `DEPLOYMENT-CHECKLIST.md` - Step-by-step deploy guide
- `TEI-GRADE-SYSTEM.md` - Grade system spec
- `HYSTERESIS-IMPLEMENTATION.md` - Technical details
- `INTEGRATION-COMPLETE-SUMMARY.md` - What's ready
- `BUILD-VERIFICATION.md` - Test results

**Located in:** `/Volumes/Code/Warp12/docs/`

---

## ✅ Status

**Migration:** ✅ COMPLETE  
**Testing:** ✅ 62/62 tests passing  
**Builds:** ✅ All successful  
**Ready:** ✅ YES - Deploy now  

---

## 🚨 Troubleshooting

**Issue:** Rating not updating  
→ Check function logs: `firebase functions:log`

**Issue:** displayGrade undefined  
→ Expected for first match, will populate next time

**Issue:** Flickering  
→ Verify currentGrade passed to getTeiDisplay()

**Rollback:**  
→ See `DEPLOYMENT-CHECKLIST.md` section "Rollback Plan"

---

**Need help?** See full docs in `/Volumes/Code/Warp12/docs/`
