import type { CSSProperties, ElementType, ReactNode } from 'react';
import { useInView } from './motion.ts';

/**
 * Fades and lifts its content into place the first time it scrolls into view.
 * With reduced motion the CSS shows it straight away.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
  style,
  ...rest
}: {
  children: ReactNode;
  as?: ElementType;
  /** Seconds, for staggering a group. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  id?: string;
  'aria-labelledby'?: string;
}) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? 'is-in' : ''} ${className}`.trim()}
      style={{ ...style, ['--delay' as string]: `${delay}s` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
