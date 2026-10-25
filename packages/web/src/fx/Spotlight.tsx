import { useRef, type ReactNode } from 'react';
import { canHover } from './motion.ts';

/**
 * A grid whose cards light up softly around the pointer, like a torch passing
 * over brushed metal. Each child with the "spot" class gets its own light.
 */
export function Spotlight({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`spotlight ${className}`.trim()}
      onPointerMove={(event) => {
        if (!canHover() || !ref.current) return;
        for (const card of ref.current.querySelectorAll<HTMLElement>('.spot')) {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--sx', `${event.clientX - r.left}px`);
          card.style.setProperty('--sy', `${event.clientY - r.top}px`);
        }
      }}
    >
      {children}
    </div>
  );
}
