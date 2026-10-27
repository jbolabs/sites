import { useCallback, useEffect, useRef } from "react";

/**
 * Long enough to see the card fill in and hear it announced as checked,
 * short enough to feel like one motion.
 */
export const AUTO_ADVANCE_MS = 250;

/**
 * For a step that asks one single-choice question: `schedule()` on a pick
 * runs `advance` after a beat, and a newer pick or leaving the step cancels
 * it. The step's Continue button stays for keyboard users who arrow through
 * the options (arrowing selects too, so it also advances).
 */
export const useAutoAdvance = (
  advance: () => void,
  delay = AUTO_ADVANCE_MS
) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(advance);

  useEffect(() => {
    latest.current = advance;
  }, [advance]);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  return useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      latest.current();
    }, delay);
  }, [delay]);
};
