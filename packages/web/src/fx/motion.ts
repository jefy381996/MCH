import { useEffect, useRef, useState, type RefObject } from 'react';

const query = (q: string) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(q)
    : null;

/** True when the visitor has asked their device for less motion. Every effect respects it. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => query('(prefers-reduced-motion: reduce)')?.matches ?? false,
  );
  useEffect(() => {
    const mq = query('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const update = () => setReduced(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** A mouse or trackpad: hover effects make sense. False on touch screens. */
export function canHover(): boolean {
  return query('(hover: hover) and (pointer: fine)')?.matches ?? false;
}

/** Becomes true the first time the element scrolls into view, and stays true. */
export function useInView<T extends Element>(
  options: IntersectionObserverInit = { rootMargin: '0px 0px -10% 0px' },
): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, options);
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);
  return [ref, inView];
}

/** How far the page has scrolled, as a number of pixels, updated once per frame. */
export function useScrollY(): number {
  const [y, setY] = useState(0);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setY(window.scrollY));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return y;
}

export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
