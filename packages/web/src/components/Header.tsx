import { useEffect, useRef, useState } from 'react';
import { Link, usePath } from '../lib/router.tsx';
import { useSiteData } from '../lib/site-data.tsx';

type Theme = 'system' | 'light' | 'dark';
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = {
  system: 'Theme: system',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

export const NAV = [
  { to: '/live-index', label: 'Live index' },
  { to: '/token', label: 'MCH coin' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/roadmap', label: 'Roadmap' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
];

function storedTheme(): Theme {
  try {
    const t = localStorage.getItem('mch-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--text-1)" />
      <path
        d="M16 6 25 11v10l-9 5-9-5V11z"
        fill="none"
        stroke="var(--page)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M11 19v-6l5 4 5-4v6"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Header() {
  const path = usePath();
  const { networkLabel } = useSiteData();
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem('mch-theme');
      else localStorage.setItem('mch-theme', theme);
    } catch {
      // Private mode: the choice just won't persist.
    }
  }, [theme]);

  // A new page closes the phone menu.
  useEffect(() => setMenuOpen(false), [path]);

  // While open, the phone menu closes on Escape and on a tap anywhere else.
  useEffect(() => {
    if (!menuOpen) return;
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
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  return (
    <header className="site-header" ref={headerRef}>
      <div className="site-header-inner">
        <Link to="/" className="brand" aria-label="MCH, Metal Chain: home">
          <Logo />
          <span>
            MCH <small>Metal Chain</small>
          </span>
        </Link>
        <div className="header-actions">
          <span className="badge network-badge">{networkLabel}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme(NEXT[theme])}
            aria-label={`${LABEL[theme]}. Change theme`}
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
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              {menuOpen ? (
                <path d="M4 4l10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.8" />
              ) : (
                <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.8" />
              )}
            </svg>
          </button>
        </div>
        {/* After the menu button in reading order, so Tab goes from the button into the menu;
            on wide screens CSS places it between the logo and the buttons. */}
        <nav id="site-nav" className="site-nav" data-open={menuOpen || undefined} aria-label="Main">
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={path === item.to ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {theme === 'system' && <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />}
      {theme === 'dark' && <circle cx="8" cy="8" r="6.25" fill="currentColor" />}
    </svg>
  );
}
