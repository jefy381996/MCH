import { useRef, type CSSProperties, type ReactNode } from 'react';
import { canHover, useReducedMotion } from './motion.ts';

/**
 * Tilts its content towards the pointer, with a soft sheen that follows it.
 * Only with a mouse or trackpad, and never with reduced motion.
 */
export function Tilt({
  children,
  className = '',
  style,
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Largest tilt, in degrees. */
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const active = !reduced && canHover();
  return (
    <div
      ref={ref}
      className={`tilt ${className}`.trim()}
      style={style}
      onPointerMove={(event) => {
        const el = ref.current;
        if (!active || !el) return;
        const r = el.getBoundingClientRect();
        const x = (event.clientX - r.left) / r.width;
        const y = (event.clientY - r.top) / r.height;
        el.style.setProperty('--rx', `${(0.5 - y) * max}deg`);
        el.style.setProperty('--ry', `${(x - 0.5) * max}deg`);
        el.style.setProperty('--mx', `${x * 100}%`);
        el.style.setProperty('--my', `${y * 100}%`);
        el.dataset.hover = '';
      }}
      onPointerLeave={() => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
        delete el.dataset.hover;
      }}
    >
      {children}
    </div>
  );
}
