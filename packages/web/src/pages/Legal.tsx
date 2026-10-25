import { PageHeader } from '../components/ui.tsx';
import { Link } from '../lib/router.tsx';

const SECTIONS = [
  { id: 'not-an-offer', title: 'Not an offer' },
  { id: 'risks', title: 'Risk statement' },
  { id: 'index', title: 'About the MCH Index' },
  { id: 'advice', title: 'No advice' },
  { id: 'privacy', title: 'Privacy' },
  { id: 'trademarks', title: 'Trademarks' },
];

export function Legal() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Important information"
        lead="Please read this before relying on anything on this site. Last updated 25 October 2026."
      />
      <div className="legal-layout">
        <nav className="legal-toc" aria-label="On this page">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <Link to={`/legal#${s.id}`}>{s.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="legal-body prose">
          <section id="not-an-offer" aria-labelledby="h-offer">
            <h2 id="h-offer">Not an offer</h2>
            <p>
              MCH tokens are not offered for sale on this site, and are not currently offered for
              sale anywhere else. Nothing on this site is an offer, an invitation or an inducement
              to buy, sell or hold MCH or any other cryptoasset, or to engage in any investment
              activity.
            </p>
            <p>
              The MCH coin is not backed by metal, cannot be exchanged for metal, and its price is
              not linked to the MCH Index.
            </p>
          </section>

          <section id="risks" aria-labelledby="h-risks">
            <h2 id="h-risks">Risk statement</h2>
            <p>Cryptoassets carry significant risks. In particular:</p>
            <ul>
              <li>The value of a cryptoasset can fall sharply, including to zero.</li>
              <li>
                Cryptoassets are largely unregulated in the UK. Protections such as the Financial
                Services Compensation Scheme and the Financial Ombudsman Service are unlikely to
                apply.
              </li>
              <li>There may be no market in which to sell a cryptoasset when you want to.</li>
              <li>
                Smart contracts can contain errors. MCH&rsquo;s contracts have been extensively
                tested but have not yet been reviewed by an independent security firm.
              </li>
              <li>Laws and regulations may change in ways that affect the project.</li>
            </ul>
          </section>

          <section id="index" aria-labelledby="h-index">
            <h2 id="h-index">About the MCH Index</h2>
            <p>
              The MCH Index is calculated by MCH from prices supplied by third parties. It is not an
              official price of the London Metal Exchange, the LBMA, ICE Benchmark Administration or
              any other market or benchmark administrator, and it is not endorsed by any of them.
            </p>
            <p>
              During the current preview, the prices on this site are simulated demonstration data
              and do not reflect real markets. The index is provided as information only, without
              any guarantee of accuracy, completeness or availability, and is not intended for use
              as a benchmark in financial contracts or instruments.
            </p>
          </section>

          <section id="advice" aria-labelledby="h-advice">
            <h2 id="h-advice">No advice</h2>
            <p>
              Nothing on this site is financial, investment, legal or tax advice, or a
              recommendation. If you need advice, speak to an appropriately authorised adviser.
            </p>
          </section>

          <section id="privacy" aria-labelledby="h-privacy">
            <h2 id="h-privacy">Privacy</h2>
            <ul>
              <li>This site uses no cookies, no analytics and no advertising trackers.</li>
              <li>
                If you choose a light or dark theme, that choice is stored in your own browser and
                never sent to us.
              </li>
              <li>
                Connecting a Cardano wallet is optional. The site only reads your balance to show it
                to you; it never asks you to sign or send anything, and the balance is not sent to
                us.
              </li>
              <li>
                Like most websites, our servers keep short-lived technical logs, such as the network
                address that made a request, to keep the service running and secure.
              </li>
            </ul>
          </section>

          <section id="trademarks" aria-labelledby="h-trademarks">
            <h2 id="h-trademarks">Trademarks</h2>
            <p>
              LME, LBMA, ICE and Cardano are names or trademarks of their respective owners. Their
              mention on this site describes the markets and technology MCH refers to, and does not
              imply any affiliation or endorsement.
            </p>
            <p>
              Questions about MCH? Start with the <Link to="/faq">FAQ</Link>.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
