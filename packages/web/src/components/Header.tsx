import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = {
  system: 'Theme: system',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

function storedTheme(): Theme {
  try {
    const t = localStorage.getItem('mch-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function Header({ networkLabel }: { networkLabel: string }) {
  const [theme, setTheme] = useState<Theme>(storedTheme);

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

  return (
    <header className="header">
      <div className="brand">
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
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
            stroke="var(--series-1)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          MCH <small>Metal Chain</small>
        </span>
      </div>
      <div className="header-actions">
        <span className="badge">{networkLabel}</span>
        <button
          type="button"
          onClick={() => setTheme(NEXT[theme])}
          aria-label={`${LABEL[theme]}. Change theme`}
        >
          <ThemeIcon theme={theme} />
        </button>
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
