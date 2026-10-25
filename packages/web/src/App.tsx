import { useEffect, type ComponentType } from 'react';
import { Footer } from './components/Footer.tsx';
import { Header } from './components/Header.tsx';
import { useLocation } from './lib/router.tsx';
import { SiteDataProvider } from './lib/site-data.tsx';
import { About } from './pages/About.tsx';
import { Faq } from './pages/Faq.tsx';
import { Home } from './pages/Home.tsx';
import { HowItWorks } from './pages/HowItWorks.tsx';
import { Legal } from './pages/Legal.tsx';
import { LiveIndex } from './pages/LiveIndex.tsx';
import { NotFound } from './pages/NotFound.tsx';
import { Roadmap } from './pages/Roadmap.tsx';
import { TokenPage } from './pages/TokenPage.tsx';

const ROUTES: Record<string, { title: string; page: ComponentType }> = {
  '/': { title: 'MCH · Metal Chain: four metals, one transparent index', page: Home },
  '/live-index': { title: 'Live MCH Index · MCH', page: LiveIndex },
  '/token': { title: 'The MCH coin · MCH', page: TokenPage },
  '/how-it-works': { title: 'How it works · MCH', page: HowItWorks },
  '/roadmap': { title: 'Roadmap · MCH', page: Roadmap },
  '/about': { title: 'About · MCH', page: About },
  '/faq': { title: 'FAQ · MCH', page: Faq },
  '/legal': { title: 'Important information · MCH', page: Legal },
};
const NOT_FOUND = { title: 'Page not found · MCH', page: NotFound };

/** Scrolls to an in-page section and gives it focus, so keyboard users continue from there. */
function goToSection(hash: string): boolean {
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return false;
  target.scrollIntoView();
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  return true;
}

export function App() {
  return (
    <SiteDataProvider>
      <Site />
    </SiteDataProvider>
  );
}

function Site() {
  const { path, hash, key, kind } = useLocation();
  const route = ROUTES[path] ?? NOT_FOUND;
  const Page = route.page;

  useEffect(() => {
    document.title = route.title;
    // A page that does not exist should not be indexed as if it did.
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (route === NOT_FOUND) {
      if (!robots) {
        robots = document.createElement('meta');
        robots.name = 'robots';
        document.head.append(robots);
      }
      robots.content = 'noindex';
    } else {
      robots?.remove();
    }
  }, [route]);

  useEffect(() => {
    // Back and forward: the browser restores the scroll position itself.
    if (kind === 'history') return;
    if (hash) {
      if (goToSection(hash)) {
        // Content that loads a moment later (charts, tables) can push the section down.
        const again = window.setTimeout(() => goToSection(hash), 700);
        return () => window.clearTimeout(again);
      }
      return;
    }
    if (kind === 'load') return;
    // A new page starts at the top, and keyboard and screen-reader users land
    // on its heading rather than back in the header.
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
  }, [path, hash, key, kind]);

  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" className="page">
        {/* Keyed by page, so each new page plays its entrance. */}
        <div key={path} className="route" data-page={path}>
          <Page />
        </div>
      </main>
      <div className="page">
        <Footer />
      </div>
    </div>
  );
}
