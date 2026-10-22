import { useEffect, useRef, useState } from "react";

const DURATION_MS = 450;

/** easeOutQuint: fast start, soft landing, so a dragged slider never feels laggy. */
const ease = (progress: number) => 1 - (1 - progress) ** 5;

/**
 * A number that glides to each new target instead of jumping, for big
 * figures that follow a slider. Reduced motion gets the target at once.
 * The first render returns the target, so server and client markup match.
 */
export const useTweenedNumber = (target: number): number => {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const from = shownRef.current;
    let frame = 0;
    if (reduce.matches || from === target) {
      shownRef.current = target;
      setShown(target);
      return () => {
        cancelAnimationFrame(frame);
      };
    }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const next = from + (target - from) * ease(progress);
      shownRef.current = next;
      setShown(next);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return shown;
};
