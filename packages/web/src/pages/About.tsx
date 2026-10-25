import { METALS, type MetalId } from '@mch/index-core';
import { ButtonLink, Feature, METAL_COLOR, PageHeader, SectionHead } from '../components/ui.tsx';
import { useSiteData } from '../lib/site-data.tsx';

const WHY: Record<MetalId, string> = {
  XAU: 'Long the benchmark precious metal. Gold is held by central banks and watched most closely in uncertain times.',
  XAG: 'A precious metal with a large industrial side: electronics, solar panels and medical uses account for much of its demand.',
  XPT: 'Rarer than gold, and central to catalytic converters, chemical processing and hydrogen fuel cells.',
  NI: 'An industrial metal at the heart of stainless steel and of the batteries that power electric vehicles.',
};

export function About() {
  const { onChain, site } = useSiteData();
  return (
    <>
      <PageHeader
        eyebrow="About MCH"
        title="Making metal prices simple, open and verifiable"
        lead={`Metal Chain (MCH) brings four of the world's most important metals together in one index, ${onChain ? 'and publishes it' : 'designed to be published'} where anyone can check it: on a public blockchain.`}
      />

      <section className="section" aria-labelledby="mission-heading">
        <SectionHead id="mission-heading" eyebrow="Our mission" title="Why we are building MCH" />
        <div className="two-col-text">
          <p>
            Metal prices matter well beyond the trading floor, to manufacturers, miners and anyone
            following the economy, but following them means juggling different markets, units and
            trading hours. Gold is quoted per troy ounce in London, nickel per tonne on the London
            Metal Exchange, and each market keeps its own hours.
          </p>
          <p>
            MCH combines them into a single, easy-to-follow number, with a method simple enough to
            explain in one line. And instead of asking people to trust a figure on a website, MCH is
            built to publish it on Cardano, where a contract checks every update before accepting
            it.
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="metals-heading">
        <SectionHead
          id="metals-heading"
          eyebrow="The basket"
          title="Why these four metals"
          lead="Two precious metals and two industrial ones: together they reflect both sides of the metals market."
        />
        <div className="metal-grid">
          {(['XAU', 'XAG', 'XPT', 'NI'] as const).map((m) => (
            <article
              key={m}
              className="metal-card"
              style={{ ['--metal' as string]: METAL_COLOR[m] }}
            >
              <div className="metal-card-head">
                <h3>{METALS[m].name}</h3>
                <span className="metal-symbol">{m}</span>
              </div>
              <p className="metal-role">{WHY[m]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="principles-heading">
        <SectionHead
          id="principles-heading"
          eyebrow="Principles"
          title="What we will not compromise on"
        />
        <div className="feature-grid feature-grid-2">
          <Feature icon="open" title="Transparency">
            The methodology, weights and base prices are public. Every number on this site can be
            recalculated by anyone.
          </Feature>
          <Feature icon="shield" title="Verifiability">
            The index is designed to be checked by a smart contract on a public blockchain, not just
            asserted by us.
          </Feature>
          <Feature icon="exact" title="Accuracy">
            Exact arithmetic, guarded data and extensive testing, so that the index is right to the
            last digit.
          </Feature>
          <Feature icon="pin" title="Doing it properly">
            Based in the United Kingdom and working within UK rules, with a legal review and an
            independent security audit on the roadmap.
          </Feature>
        </div>
      </section>

      {site?.contactEmail && (
        <section className="section" aria-labelledby="contact-heading">
          <SectionHead
            id="contact-heading"
            eyebrow="Contact"
            title="Get in touch"
            lead={
              <>
                {site.operator ? `MCH is run by ${site.operator}. ` : ''}For questions about the
                project, email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
              </>
            }
          />
        </section>
      )}

      <section className="cta-band" aria-labelledby="about-cta">
        <h2 id="about-cta">See where the project stands</h2>
        <p>What is built, and what comes next.</p>
        <div className="actions">
          <ButtonLink to="/roadmap">View the roadmap</ButtonLink>
          <ButtonLink to="/faq" variant="secondary">
            Read the FAQ
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
