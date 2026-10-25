import { Link } from '../lib/router.tsx';
import { useSiteData } from '../lib/site-data.tsx';
import { Logo } from './Header.tsx';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { to: '/live-index', label: 'Live index' },
      { to: '/token', label: 'The MCH coin' },
      { to: '/how-it-works', label: 'How it works' },
      { to: '/live-index#methodology', label: 'Methodology' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/roadmap', label: 'Roadmap' },
      { to: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/legal', label: 'Important information' },
      { to: '/legal#risks', label: 'Risk statement' },
      { to: '/legal#privacy', label: 'Privacy' },
      { to: '/legal#terms', label: 'Terms of use' },
    ],
  },
];

export function Footer() {
  const { isDemo, site } = useSiteData();
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Link to="/" className="brand" aria-label="MCH, Metal Chain: home">
            <Logo />
            <span>
              MCH <small>Metal Chain</small>
            </span>
          </Link>
          <p>
            A transparent index of gold, silver, platinum and nickel, built for the Cardano
            blockchain in the United Kingdom.
          </p>
          {site?.contactEmail && (
            <p>
              <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
            </p>
          )}
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} className="footer-col" aria-label={column.title}>
            <h2>{column.title}</h2>
            <ul>
              {column.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="footer-legal">
        <p>
          {isDemo ? 'Prices on this site are simulated demo data. ' : ''}MCH tokens are not offered
          for sale on this site. Nothing here is financial advice or an offer to buy or sell
          anything.
        </p>
        <p>
          The MCH Index is calculated by MCH from metal prices
          {isDemo ? ' (simulated during this preview)' : ' supplied by third parties'}. It is not an
          official price of the London Metal Exchange, the LBMA or any other market.
        </p>
        <p>© {new Date().getFullYear()} MCH · Metal Chain</p>
      </div>
      <p className="footer-wordmark" aria-hidden="true">
        Metal Chain
      </p>
    </footer>
  );
}
