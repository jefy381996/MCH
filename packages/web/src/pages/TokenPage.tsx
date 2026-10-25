import { OnChain } from '../components/OnChain.tsx';
import { Token } from '../components/Token.tsx';
import { ButtonLink, Feature, Notice, PageHeader, SectionHead } from '../components/ui.tsx';
import { fmtTokenAmount } from '../lib/format.ts';
import { Link } from '../lib/router.tsx';
import { useSiteData } from '../lib/site-data.tsx';

export function TokenPage() {
  const { oracle, live } = useSiteData();
  const token = oracle?.token ?? null;
  const planned = token ? '' : ' (planned)';
  const supply = token
    ? `${fmtTokenAmount(BigInt(token.supply), token.decimals)} MCH`
    : '100,000,000 MCH';
  return (
    <>
      <PageHeader
        eyebrow="The MCH coin"
        title="MCH, a native token on Cardano"
        lead="MCH is the coin of the Metal Chain project: a Cardano native token, designed to be created once with a fixed supply, alongside the MCH Index."
      />

      <Notice title="Not backed by metal, and not for sale">
        <p>
          MCH is not backed by gold, silver, platinum or nickel and cannot be exchanged for them.
          Its price is not linked to the MCH Index. MCH is not offered for sale, on this site or
          anywhere else. See <Link to="/legal">important information</Link>.
        </p>
      </Notice>

      <section className="section" aria-labelledby="facts-heading">
        <SectionHead id="facts-heading" eyebrow="Key facts" title="The coin at a glance" />
        <dl className="fact-grid fact-grid-wide">
          <div>
            <dt>Name</dt>
            <dd>Metal Chain (MCH)</dd>
          </div>
          <div>
            <dt>Total supply{planned}</dt>
            <dd>{supply}</dd>
          </div>
          <div>
            <dt>Further minting</dt>
            <dd>Impossible, enforced by the contract</dd>
          </div>
          <div>
            <dt>Divisible to{planned}</dt>
            <dd>6 decimal places</dd>
          </div>
          <div>
            <dt>Blockchain</dt>
            <dd>Cardano</dd>
          </div>
          <div>
            <dt>Token standard</dt>
            <dd>CIP-68 fungible token</dd>
          </div>
          <div>
            <dt>Contract language</dt>
            <dd>Aiken (Plutus V3)</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{token ? 'Created on Cardano' : 'Ready to create'}</dd>
          </div>
        </dl>
      </section>

      <section className="section" aria-labelledby="design-heading">
        <SectionHead
          id="design-heading"
          eyebrow="Design"
          title="Simple rules, enforced by code"
          lead="The coin's contract is deliberately small: the full supply is created once, holders may burn (destroy) their own coins, and no one can ever create more."
        />
        <div className="feature-grid">
          <Feature icon="key" title="Created exactly once">
            The minting policy is tied to a single transaction input. Once that input is spent, the
            policy can never approve creating more coins.
          </Feature>
          <Feature icon="coin" title="Fixed supply">
            All the coins are created together, and no one, including the MCH team, can create more
            later. Holders can burn their own coins if they choose.
          </Feature>
          <Feature icon="open" title="Readable by wallets">
            Name, ticker, description and logo follow the CIP-68 standard, so wallets and explorers
            that support it can show them. The project&rsquo;s admin key can update these details;
            it can never change the supply.
          </Feature>
        </div>
      </section>

      <section className="section" aria-labelledby="is-heading">
        <SectionHead id="is-heading" eyebrow="Clearly stated" title="What MCH is, and is not" />
        <div className="grid grid-2">
          <div className="card list-card">
            <h3>MCH is</h3>
            <ul className="check-list">
              <li>A native token on the Cardano blockchain</li>
              <li>Designed with a fixed supply</li>
              <li>Part of the Metal Chain project, alongside the MCH Index</li>
              <li>Open to inspection by anyone, on a public blockchain</li>
            </ul>
          </div>
          <div className="card list-card">
            <h3>MCH is not</h3>
            <ul className="cross-list">
              <li>Backed by, or exchangeable for, any metal</li>
              <li>Priced at, or guaranteed to follow, the MCH Index</li>
              <li>Offered for sale, on this site or elsewhere</li>
              <li>A savings product, a deposit or an investment recommendation</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="chain-heading">
        <SectionHead
          id="chain-heading"
          eyebrow="On-chain"
          title="Check it yourself"
          lead="Once the coin exists, its policy id and a link to it on a Cardano explorer appear here, and a connected wallet can show its own MCH balance. This site only reads; it never asks you to sign anything."
        />
        <div className="grid grid-2">
          <Token oracle={oracle} showNotice={false} heading="h3" />
          <OnChain oracle={oracle} live={live} heading="h3" />
        </div>
      </section>

      <section className="cta-band" aria-labelledby="token-cta">
        <h2 id="token-cta">See what the coin sits alongside</h2>
        <p>The MCH Index: four metals, one verifiable number.</p>
        <div className="actions">
          <ButtonLink to="/live-index">Open the live index</ButtonLink>
          <ButtonLink to="/roadmap" variant="secondary">
            View the roadmap
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
