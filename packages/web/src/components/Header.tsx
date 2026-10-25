import { useEffect, useRef, useState } from 'react';
import { useScrollY } from '../fx/motion.ts';
import { Link, usePath } from '../lib/router.tsx';
import { useSiteData } from '../lib/site-data.tsx';

type Theme = 'dark' | 'light';

export const NAV = [
  { to: '/live-index', label: 'Live index' },
  { to: '/token', label: 'MCH coin' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/roadmap', label: 'Roadmap' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
];

/** Dark unless the visitor chose light (public/theme.js applies it before the page draws). */
function storedTheme(): Theme {
  try {
    return localStorage.getItem('mch-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="logo-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--gold)" />
          <stop offset="55%" stopColor="var(--platinum)" />
          <stop offset="100%" stopColor="var(--nickel)" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        fill="none"
        stroke="url(#logo-metal)"
        strokeWidth="1.5"
      />
      <path
        d="M16 6.5 24.5 11.2v9.6L16 25.5l-8.5-4.7v-9.6z"
        fill="none"
        stroke="var(--text-1)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <path
        d="M11.5 19v-6l4.5 3.6 4.5-3.6v6"
        fill="none"
        stroke="url(#logo-metal)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScrollProgress() {
  const y = useScrollY();
  const max =
    typeof document === 'undefined'
      ? 1
      : document.documentElement.scrollHeight - window.innerHeight;
  const progress = max > 0 ? Math.min(1, y / max) : 0;
  return (
    <div
      className="scroll-progress"
      style={{ transform: `scaleX(${progress})` }}
      aria-hidden="true"
    />
  );
}

export function Header() {
  const path = usePath();
  const { networkLabel } = useSiteData();
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useScrollY() > 12;
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('mch-theme', theme);
    } catch {
      // Private mode: the choice just won't persist.
    }
  }, [theme]);

  // A new page closes the phone menu.
  useEffect(() => setMenuOpen(false), [path]);

  // While open: no page scrolling behind it, Escape closes it, a tap outside closes it.
  useEffect(() => {
    if (!menuOpen) return;
    document.documentElement.classList.add('menu-open');
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.documentElement.classList.remove('menu-open');
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  return (
    <header
      className="site-header"
      ref={headerRef}
      data-scrolled={scrolled || menuOpen || undefined}
    >
      <div className="site-header-inner">
        <Link to="/" className="brand" aria-label="MCH, Metal Chain: home">
          <Logo />
          <span className="brand-name">
            MCH <small>Metal Chain</small>
          </span>
        </Link>
        <div className="header-actions">
          <span className="badge network-badge">
            <span className="badge-dot" aria-hidden="true" />
            {networkLabel}
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <ThemeIcon theme={theme} />
          </button>
          <button
            ref={menuButtonRef}
            type="button"
            className="icon-button menu-button"
            aria-expanded={menuOpen}
            aria-controls="site-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="burger" data-open={menuOpen || undefined} aria-hidden="true">
              <span />
              <span />
            </span>
          </button>
        </div>
        {/* After the menu button in reading order, so Tab goes from the button into the menu;
            on wide screens CSS places it between the logo and the buttons. */}
        <nav id="site-nav" className="site-nav" data-open={menuOpen || undefined} aria-label="Main">
          <ul>
            {NAV.map((item, i) => (
              <li key={item.to} style={{ ['--i' as string]: i }}>
                <Link
                  to={item.to}
                  aria-current={path === item.to ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="nav-index" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="nav-note">
            Four metals. One transparent index. <span>{networkLabel}</span>
          </p>
        </nav>
      </div>
      <ScrollProgress />
    </header>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  return theme === 'dark' ? (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3 3l1.3 1.3M11.7 11.7 13 13M3 13l1.3-1.3M11.7 4.3 13 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
