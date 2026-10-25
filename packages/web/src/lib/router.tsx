import { useEffect, useState, type AnchorHTMLAttributes } from 'react';

const NAVIGATED = 'mch:navigate';

/** The current path without a trailing slash ("/" for the home page). */
export function currentPath(): string {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

export function navigate(to: string): void {
  const here = window.location.pathname + window.location.search + window.location.hash;
  if (to !== here) window.history.pushState(null, '', to);
  // Announced even for the same address, so a link to the current section scrolls to it again.
  window.dispatchEvent(new CustomEvent(NAVIGATED, { detail: Date.now() }));
}

export interface Location {
  path: string;
  /** "#section" or "". */
  hash: string;
  /** Changes on every navigation, so effects can react to it. */
  key: number;
  /** How we got here: the first load, a link, or the browser's back/forward buttons. */
  kind: 'load' | 'link' | 'history';
}

/** Re-renders on every navigation, including the browser's back and forward buttons. */
export function useLocation(): Location {
  const [location, setLocation] = useState<Location>(() => ({
    path: currentPath(),
    hash: window.location.hash,
    key: 0,
    kind: 'load',
  }));
  useEffect(() => {
    const update = (kind: Location['kind']) => () =>
      setLocation((previous) => ({
        path: currentPath(),
        hash: window.location.hash,
        key: previous.key + 1,
        kind,
      }));
    const onHistory = update('history');
    const onLink = update('link');
    window.addEventListener('popstate', onHistory);
    window.addEventListener(NAVIGATED, onLink);
    return () => {
      window.removeEventListener('popstate', onHistory);
      window.removeEventListener(NAVIGATED, onLink);
    };
  }, []);
  return location;
}

export function usePath(): string {
  return useLocation().path;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

/**
 * A link within the site. It changes page without a reload, but stays a real
 * link: opening it in a new tab, copying it or middle-clicking all work.
 */
export function Link({ to, onClick, ...rest }: LinkProps) {
  return (
    <a
      href={to}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (event.defaultPrevented || event.button !== 0 || modified) return;
        event.preventDefault();
        navigate(to);
      }}
    />
  );
}
