import { useEffect, useState } from 'react';

// D-5 (DESIGN_SPEC 5.3): the ring number counts up from 0 to `value` and ends on
// exactly String(value). Returns String(value) at once when the value is not
// finite or the user prefers reduced motion (or matchMedia is missing).

const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export default function useCountUp(value, { duration = 1200, delay = 120 } = {}) {
  const final = String(value);
  const skip = !Number.isFinite(Number(value)) || prefersReducedMotion();
  const decimals = (final.split('.')[1] || '').length;
  const [shown, setShown] = useState(skip ? final : (0).toFixed(decimals));

  useEffect(() => {
    if (skip) {
      setShown(final);
      return undefined;
    }
    const target = Number(value);
    let frame = null;
    let start = null;
    const tick = (now) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1) {
        setShown(final);
        return;
      }
      const eased = 1 - (1 - t) ** 4;
      setShown((target * eased).toFixed(decimals));
      frame = window.requestAnimationFrame(tick);
    };
    setShown((0).toFixed(decimals));
    const timer = window.setTimeout(() => {
      frame = window.requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [value, final, skip, decimals, duration, delay]);

  return skip ? final : shown;
}
