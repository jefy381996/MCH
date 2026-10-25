import { useEffect, useState } from 'react';
import { easeOutExpo, useInView, useReducedMotion } from './motion.ts';

/** Counts up from zero the first time it comes into view. */
export function CountUp({
  to,
  decimals = 0,
  duration = 1600,
  suffix = '',
}: {
  to: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
}) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);
  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setValue(to);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(to * easeOutExpo(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, to, duration]);
  const fmt = (v: number) =>
    v.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref}>
      <span aria-hidden="true">
        {fmt(value)}
        {suffix}
      </span>
      <span className="visually-hidden">
        {fmt(to)}
        {suffix}
      </span>
    </span>
  );
}
