/**
 * Confetti celebration hook for grade promotions.
 * 
 * Triggers a brief confetti animation when rating grades improve.
 */

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

export function useConfettiOnPromotion(promoted: boolean, enabled: boolean = true) {
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || !promoted || hasTriggeredRef.current) {
      return;
    }

    hasTriggeredRef.current = true;

    // Create confetti instance
    const myConfetti = confetti.create(undefined, {
      resize: true,
      useWorker: true,
    });

    // Trigger celebration
    const duration = 2000;
    const end = Date.now() + duration;

    (function frame() {
      // Burst from center
      myConfetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0.5, y: 0.6 },
        colors: ['#ffd700', '#4fc3f7', '#81c784'],
      });

      myConfetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 0.5, y: 0.6 },
        colors: ['#ffd700', '#4fc3f7', '#81c784'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();

    // Reset trigger after animation completes
    const resetTimer = setTimeout(() => {
      hasTriggeredRef.current = false;
    }, duration + 1000);

    return () => {
      clearTimeout(resetTimer);
    };
  }, [promoted, enabled]);
}
