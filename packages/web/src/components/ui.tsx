import type { MetalId } from '@mch/index-core';
import type { ReactNode } from 'react';
import { Link } from '../lib/router.tsx';

export const METAL_COLOR: Record<MetalId, string> = {
  XAU: 'var(--gold)',
  XAG: 'var(--silver)',
  XPT: 'var(--platinum)',
  NI: 'var(--nickel)',
};

export function MetalDot({ metal }: { metal: MetalId }) {
  return (
    <span className="metal-dot" style={{ background: METAL_COLOR[metal] }} aria-hidden="true" />
  );
}

/** The top of every inner page. Its heading receives focus after navigation. */
export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1 tabIndex={-1}>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </header>
  );
}

export function SectionHead({
  eyebrow,
  title,
  lead,
  id,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  id?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className="section-head" data-align={align}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={id}>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}

export function ButtonLink({
  to,
  children,
  variant = 'primary',
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Link to={to} className={`btn btn-${variant}`}>
      {children}
      {variant === 'primary' && (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M3 7h8M7.5 3.5 11 7l-3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </Link>
  );
}

export type IconName =
  | 'layers'
  | 'open'
  | 'shield'
  | 'exact'
  | 'filter'
  | 'pin'
  | 'chain'
  | 'coin'
  | 'clock'
  | 'chart'
  | 'key'
  | 'check';

const PATHS: Record<IconName, ReactNode> = {
  layers: (
    <>
      <path d="M12 3 21 8l-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  open: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v6c0 4.5-3.4 7.8-8 9-4.6-1.2-8-4.5-8-9V6z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  exact: (
    <>
      <path d="M5 9h14M5 15h14" />
      <path d="M10 4 8 20M16 4l-2 16" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  chain: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 9.5v5l3-2.5 3 2.5v-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="m7 15 4-4 3 3 5-6" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="12" r="3.5" />
      <path d="M11.5 12H21M17 12v3M20 12v2" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/** A bordered tile with an icon, a title and a sentence or two. */
export function Feature({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="feature">
      <span className="feature-icon">
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="notice" role="note">
      <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="var(--series-1)" />
        <path d="M10 9v5M10 6v.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div>
        <strong>{title}</strong>
        <div>{children}</div>
      </div>
    </div>
  );
}
