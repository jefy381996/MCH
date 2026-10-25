import { METALS, type MetalId } from '@mch/index-core';
import {
  ButtonLink,
  Icon,
  MetalDot,
  PageHeader,
  SectionHead,
  type IconName,
} from '../components/ui.tsx';
import { fmtDate, fmtUsd, fmtWeight } from '../lib/format.ts';
import { Link } from '../lib/router.tsx';
import { useSiteData } from '../lib/site-data.tsx';

const FLOW: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'chart', title: 'Market prices', text: 'Gold, silver, platinum, nickel' },
  { icon: 'filter', title: 'Price guard', text: 'Bad prints held back' },
  { icon: 'exact', title: 'MCH Index', text: 'Exact calculation' },
  { icon: 'key', title: 'Oracle', text: 'Signs and submits' },
  { icon: 'shield', title: 'Cardano contract', text: 'Recomputes and verifies' },
];

const GUARD_LIMIT: Record<MetalId, string> = { XAU: '5%', XAG: '8%', XPT: '8%', NI: '10%' };

export function HowItWorks() {
  const { basket } = useSiteData();
  const components = basket?.basket.components ?? [];
  return (
    <>
      <PageHeader
        eyebrow="How it works"
        title="From market prices to a verified number on‑chain"
        lead="The MCH Index is built in four stages. Each one is designed so that the result can be checked independently, not just taken on trust."
      />

      <ol className="flow" aria-label="The journey of a price">
        {FLOW.map((node) => (
          <li key={node.title} className="flow-node">
            <span className="feature-icon">
              <Icon name={node.icon} />
            </span>
            <strong>{node.title}</strong>
            <span>{node.text}</span>
          </li>
        ))}
      </ol>

      <section className="section detail" aria-labelledby="prices-heading">
        <span className="detail-number" aria-hidden="true">
          01
        </span>
        <div>
          <h2 id="prices-heading">Market prices</h2>
          <p>
            Each metal is priced in US dollars against the market that sets its global reference
            price. Gold, silver and platinum are traded on the London bullion markets; nickel on the
            London Metal Exchange.
          </p>
          <ul className="metal-list">
            {(['XAU', 'XAG', 'XPT', 'NI'] as const).map((m) => (
              <li key={m}>
                <MetalDot metal={m} />
                <strong>{METALS[m].name}</strong>
                <span>{METALS[m].market}</span>
              </li>
            ))}
          </ul>
          <p className="fine">
            During this preview the site runs on simulated prices, clearly labelled as such.
            Licensed market data is the next step on the <Link to="/roadmap">roadmap</Link>.
          </p>
        </div>
      </section>

      <section className="section detail" aria-labelledby="guard-heading">
        <span className="detail-number" aria-hidden="true">
          02
        </span>
        <div>
          <h2 id="guard-heading">The price guard</h2>
          <p>
            Data feeds occasionally deliver a wrong number: a typing error, a glitch, a price in the
            wrong unit. Before any price counts, it is compared with the last accepted price for
            that metal.
          </p>
          <ul className="plain-list">
            <li>
              A price that jumps further than the metal&rsquo;s limit is set aside, not used. The
              limits are{' '}
              {(['XAU', 'XAG', 'XPT', 'NI'] as const)
                .map((m) => `${GUARD_LIMIT[m]} for ${METALS[m].name.toLowerCase()}`)
                .join(', ')}
              .
            </li>
            <li>
              If the next three prices agree with each other, the move is real and is accepted. A
              single wild print never reaches the index; a genuine new level does, a moment later.
            </li>
            <li>Prices dated in the future, or not above zero, are rejected outright.</li>
          </ul>
        </div>
      </section>

      <section className="section detail" aria-labelledby="calc-heading">
        <span className="detail-number" aria-hidden="true">
          03
        </span>
        <div>
          <h2 id="calc-heading">The calculation</h2>
          <p>
            Each metal&rsquo;s price is divided by its own price on the base date, so a 10% rise
            counts as 1.10 whatever the metal&rsquo;s unit. Those ratios are weighted, added up and
            multiplied by 100.
          </p>
          <div className="formula">index = 100 × Σ ( weight × price ÷ base price )</div>
          {components.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Metal</th>
                    <th scope="col" className="num">
                      Weight
                    </th>
                    <th scope="col" className="num">
                      Base price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((c) => {
                    const info = METALS[c.metal as MetalId];
                    return (
                      <tr key={c.metal}>
                        <td>
                          <MetalDot metal={c.metal as MetalId} /> {info.name}
                        </td>
                        <td className="num">{fmtWeight(c.weightPpm)}</td>
                        <td className="num">
                          {fmtUsd(c.basePrice, c.metal === 'NI' ? 0 : 2)} /{' '}
                          {info.unit === 'tonne' ? 't' : 'oz'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p>
            {basket ? `The index was exactly 100 on ${fmtDate(basket.basket.baseDate)}. ` : ''}All
            arithmetic uses whole numbers of millionths, with a single rounding step at the end. The
            website, the backend and the on-chain contract share the same rules and the same test
            cases, so they always agree to the last digit.
          </p>
        </div>
      </section>

      <section className="section detail" aria-labelledby="chain-heading">
        <span className="detail-number" aria-hidden="true">
          04
        </span>
        <div>
          <h2 id="chain-heading">Publishing on Cardano</h2>
          <p>
            An oracle service writes the index and the four prices behind it to the Cardano
            blockchain. It publishes whenever the index moves by 0.5%, and at least once an hour.
          </p>
          <ul className="plain-list">
            <li>
              <strong>The contract checks the arithmetic.</strong> It recalculates the index from
              the posted prices and rejects any update whose index does not match.
            </li>
            <li>
              <strong>Only the genuine feed counts.</strong> The live feed is marked by a unique
              token that cannot be copied, so readers always know which data is official.
            </li>
            <li>
              <strong>Two keys, two jobs.</strong> A routine key signs price updates; a separate,
              offline key can replace it if it is ever lost or compromised.
            </li>
            <li>
              <strong>Low running cost.</strong> Each update costs about 0.26 ADA in network fees.
            </li>
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="numbers-heading">
        <SectionHead
          id="numbers-heading"
          eyebrow="Engineering"
          title="Tested before it is trusted"
        />
        <dl className="stat-grid">
          <div>
            <dt>Contract tests</dt>
            <dd>221</dd>
          </div>
          <div>
            <dt>Randomised index checks</dt>
            <dd>20,000</dd>
          </div>
          <div>
            <dt>Decimal places, exact</dt>
            <dd>6</dd>
          </div>
          <div>
            <dt>Network fee per update, about</dt>
            <dd>0.26 ADA</dd>
          </div>
        </dl>
      </section>

      <section className="cta-band" aria-labelledby="how-cta">
        <h2 id="how-cta">See the result, live</h2>
        <p>The index, the basket and every price behind them.</p>
        <div className="actions">
          <ButtonLink to="/live-index">Open the live index</ButtonLink>
          <ButtonLink to="/token" variant="secondary">
            About the MCH coin
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
