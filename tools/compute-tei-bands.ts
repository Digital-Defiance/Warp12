/**
 * Compute TEI grade bands for Academy placement table in RULES.tex
 * 
 * This script computes the actual TEI grade ranges based on the real
 * getTeiDisplay() implementation and calibrated AI anchors.
 */

import { getTeiDisplay } from '../libs/engine/src/lib/rating/tei-grade.js';
import type { PlayerRating } from '../libs/engine/src/lib/rating/types.js';

// Simulate ratings across the spectrum
function computeBands() {
  console.log('\n=== TEI GRADE BANDS FOR ACADEMY PLACEMENT ===\n');

  // Ensign (New to dominoes) - targeting P and I grades
  console.log('Ensign (New to dominoes):');
  console.log('  P00 (absolute beginner):');
  const p00: PlayerRating = { mu: 13.3, sigma: 8.33, matches: 1 }; // Conservative: 13.3-25=0
  console.log(`    μ=${p00.mu.toFixed(1)}, σ=${p00.sigma.toFixed(1)}, TEI=${getTeiDisplay(p00).formatted}`);
  
  console.log('  P15 (learning):');
  const p15: PlayerRating = { mu: 16.0, sigma: 6.0, matches: 3 }; // Conservative: 16-18=0, but closer
  console.log(`    μ=${p15.mu.toFixed(1)}, σ=${p15.sigma.toFixed(1)}, TEI=${getTeiDisplay(p15).formatted}`);
  
  console.log('  I22 (early improvement):');
  const i22: PlayerRating = { mu: 20.0, sigma: 3.5, matches: 10 }; // Conservative: 20-10.5=9.5→score≈0, but μ higher
  console.log(`    μ=${i22.mu.toFixed(1)}, σ=${i22.sigma.toFixed(1)}, TEI=${getTeiDisplay(i22).formatted}`);
  
  console.log('  I25 (upper Ensign):');
  const i25: PlayerRating = { mu: 21.5, sigma: 3.5, matches: 15 };
  console.log(`    μ=${i25.mu.toFixed(1)}, σ=${i25.sigma.toFixed(1)}, TEI=${getTeiDisplay(i25).formatted}`);
  
  // Lieutenant (Knows multi-trail) - targeting I to C grades
  console.log('\nLieutenant (Knows multi-trail):');
  console.log('  I28 (entering Lieutenant):');
  const i28: PlayerRating = { mu: 22.5, sigma: 3.0, matches: 20 };
  console.log(`    μ=${i28.mu.toFixed(1)}, σ=${i28.sigma.toFixed(1)}, TEI=${getTeiDisplay(i28).formatted}`);
  
  console.log('  C38 (consistent performance):');
  const c38: PlayerRating = { mu: 25.5, sigma: 2.3, matches: 40 };
  console.log(`    μ=${c38.mu.toFixed(1)}, σ=${c38.sigma.toFixed(1)}, TEI=${getTeiDisplay(c38).formatted}`);
  
  console.log('  C45 (upper Lieutenant):');
  const c45: PlayerRating = { mu: 28.0, sigma: 2.0, matches: 60 };
  console.log(`    μ=${c45.mu.toFixed(1)}, σ=${c45.sigma.toFixed(1)}, TEI=${getTeiDisplay(c45).formatted}`);
  
  // Commander (Seasoned strategist) - targeting C to V grades
  console.log('\nCommander (Seasoned strategist):');
  console.log('  C52 (entering Commander):');
  const c52: PlayerRating = { mu: 30.5, sigma: 1.8, matches: 80 };
  console.log(`    μ=${c52.mu.toFixed(1)}, σ=${c52.sigma.toFixed(1)}, TEI=${getTeiDisplay(c52).formatted}`);
  
  console.log('  V63 (veteran skill):');
  const v63: PlayerRating = { mu: 35.5, sigma: 1.3, matches: 200 };
  console.log(`    μ=${v63.mu.toFixed(1)}, σ=${v63.sigma.toFixed(1)}, TEI=${getTeiDisplay(v63).formatted}`);
  
  console.log('  V70 (upper Commander):');
  const v70: PlayerRating = { mu: 38.0, sigma: 1.0, matches: 300 };
  console.log(`    μ=${v70.mu.toFixed(1)}, σ=${v70.sigma.toFixed(1)}, TEI=${getTeiDisplay(v70).formatted}`);
  
  // Elite territory (beyond Commander)
  console.log('\nBeyond Commander (Elite):');
  console.log('  E76 (elite player):');
  const e76: PlayerRating = { mu: 40.5, sigma: 0.4, matches: 500 };
  console.log(`    μ=${e76.mu.toFixed(1)}, σ=${e76.sigma.toFixed(1)}, TEI=${getTeiDisplay(e76).formatted}`);
  
  console.log('\n=== AI ANCHORS ===\n');
  const ensignPoints: PlayerRating = { mu: 18.0, sigma: 2.0, matches: 9999 };
  console.log(`Ensign (Points):     ${getTeiDisplay(ensignPoints).formatted} (μ=${ensignPoints.mu}, σ=${ensignPoints.sigma})`);
  
  const lieutenantPoints: PlayerRating = { mu: 26.5, sigma: 1.8, matches: 9999 };
  console.log(`Lieutenant (Points): ${getTeiDisplay(lieutenantPoints).formatted} (μ=${lieutenantPoints.mu}, σ=${lieutenantPoints.sigma})`);
  
  const commanderPoints: PlayerRating = { mu: 35.0, sigma: 1.5, matches: 9999 };
  console.log(`Commander (Points):  ${getTeiDisplay(commanderPoints).formatted} (μ=${commanderPoints.mu}, σ=${commanderPoints.sigma})`);
  
  console.log('');
}

computeBands();
