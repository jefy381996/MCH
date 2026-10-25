import type { ReactNode } from 'react';
import { ButtonLink, PageHeader } from '../components/ui.tsx';
import { Link } from '../lib/router.tsx';

const QUESTIONS: Array<{ q: string; a: ReactNode }> = [
  {
    q: 'What is MCH?',
    a: (
      <p>
        MCH (Metal Chain) is a project that tracks four metals, gold, silver, platinum and nickel,
        in one live index, and publishes that index on the Cardano blockchain. It also has its own
        Cardano token, the MCH coin.
      </p>
    ),
  },
  {
    q: 'What is the MCH Index?',
    a: (
      <p>
        A single number that summarises the four metal prices. Each metal is compared with its own
        price on the base date, the four comparisons are weighted equally, and the result is
        multiplied by 100. So an index of 103 means the basket is, on balance, 3% higher than on the
        base date. <Link to="/how-it-works">How it works</Link> explains the details.
      </p>
    ),
  },
  {
    q: 'Is the MCH coin backed by metal?',
    a: (
      <p>
        No. MCH is not backed by gold, silver, platinum or nickel, and it cannot be exchanged for
        them. The coin and the index are separate things.
      </p>
    ),
  },
  {
    q: 'Does the coin’s price follow the MCH Index?',
    a: (
      <p>
        No. Nothing ties the coin&rsquo;s market price to the index. Designs that could link them,
        such as a reserve that redeems coins at the index value, are being explored, and are listed
        on the <Link to="/roadmap">roadmap</Link>.
      </p>
    ),
  },
  {
    q: 'Can I buy MCH?',
    a: (
      <p>
        No. MCH is not offered for sale, on this site or anywhere else, at present. Any future
        availability will follow a UK legal review and an independent security audit. Be wary of
        anyone offering to sell you MCH.
      </p>
    ),
  },
  {
    q: 'Where do the prices come from?',
    a: (
      <p>
        Each metal uses its global reference market: the London bullion markets for gold, silver and
        platinum, and the London Metal Exchange for nickel. During this preview the site uses
        simulated prices, labelled as demo data everywhere they appear, while licensed market data
        is arranged.
      </p>
    ),
  },
  {
    q: 'How often does the index update?',
    a: (
      <p>
        On this site, every time a new price arrives: the page updates live, without refreshing. On
        Cardano, the index is published whenever it moves by 0.5%, and at least once an hour.
      </p>
    ),
  },
  {
    q: 'What happens when the markets are closed?',
    a: (
      <p>
        Metals do not trade around the clock. When a market is closed, the index keeps using that
        metal&rsquo;s last price, and the site shows how old each price is.
      </p>
    ),
  },
  {
    q: 'Why Cardano?',
    a: (
      <p>
        Cardano lets the contract check every update before it is accepted, keeps fees low (about
        0.26 ADA per index update) and supports native tokens directly, so the MCH coin needs no
        separate token contract. MCH&rsquo;s contracts are written in Aiken, a language designed for
        Cardano.
      </p>
    ),
  },
  {
    q: 'How can I check the index myself?',
    a: (
      <p>
        The formula, the weights and the base prices are all published on the{' '}
        <Link to="/live-index#methodology">live index page</Link>, so you can recalculate the index
        from the four prices. Once the on-chain feed is running, anyone can also read it directly
        from the Cardano blockchain.
      </p>
    ),
  },
  {
    q: 'Is anything on this site financial advice?',
    a: (
      <p>
        No. This site describes the MCH Index and the MCH coin. It does not recommend buying,
        selling or holding anything. See <Link to="/legal">important information</Link>.
      </p>
    ),
  },
  {
    q: 'Who is behind MCH?',
    a: <p>MCH is an independent project based in the United Kingdom.</p>,
  },
];

export function Faq() {
  return (
    <>
      <PageHeader
        eyebrow="FAQ"
        title="Frequently asked questions"
        lead="Straight answers about the MCH Index and the MCH coin."
      />
      <div className="faq">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q}>
            <summary>{q}</summary>
            <div className="faq-answer">{a}</div>
          </details>
        ))}
      </div>
      <section className="cta-band" aria-labelledby="faq-cta">
        <h2 id="faq-cta">Still curious?</h2>
        <p>The clearest answer is the index itself.</p>
        <div className="actions">
          <ButtonLink to="/live-index">Open the live index</ButtonLink>
          <ButtonLink to="/about" variant="secondary">
            About MCH
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
