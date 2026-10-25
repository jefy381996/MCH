import { METALS, type MetalId } from '@mch/index-core';
import { useMemo } from 'react';
import { Delta } from '../components/Hero.tsx';
import { LineChart } from '../components/LineChart.tsx';
import { ButtonLink, Icon, METAL_COLOR, MetalDot, type IconName } from '../components/ui.tsx';
import { Coin } from '../fx/Coin.tsx';
import { CountUp } from '../fx/CountUp.tsx';
import { MetalField } from '../fx/MetalField.tsx';
import { useInView } from '../fx/motion.ts';
import { Reveal } from '../fx/Reveal.tsx';
import { RollingNumber } from '../fx/RollingNumber.tsx';
import { Sparkline } from '../fx/Sparkline.tsx';
import { Spotlight } from '../fx/Spotlight.tsx';
import { Ticker } from '../fx/Ticker.tsx';
import { Tilt } from '../fx/Tilt.tsx';
import {
  fmtAgo,
  fmtLondonMinute,
  fmtNumber,
  fmtPct,
  fmtUsd,
  fmtWeight,
  deltaGlyph,
} from '../lib/format.ts';
import { milestones, STATUS_LABEL } from '../lib/roadmap.ts';
import { Link } from '../lib/router.tsx';
import type { Point } from '../lib/scale.ts';
import { useSiteData } from '../lib/site-data.tsx';

const ORDER: MetalId[] = ['XAU', 'XAG', 'XPT', 'NI'];

const STATUS_TEXT = {
  live: 'Live',
  delayed: 'Delayed',
  closed: 'Markets closed',
  waiting: 'Waiting for prices',
} as const;

const ROLE: Record<MetalId, string> = {
  XAU: 'The most widely watched precious metal, held by central banks around the world.',
  XAG: 'Precious and industrial at once: solar panels, electronics and medicine.',
  XPT: 'Scarce and industrial: catalytic converters and hydrogen technology.',
  NI: 'The metal of the energy transition: stainless steel and EV batteries.',
};

export function Home() {
  return (
    <>
      <HomeHero />
      <div className="bleed">
        <Ticker />
      </div>
      <BasketSection />
      <IndexBreakdown />
      <WhySection />
      <FlowSection />
      <StatsBand />
      <CoinSection />
      <RoadmapSection />
      <ClosingCta />
    </>
  );
}

/* ------------------------------------------------------------------ hero */

function HomeHero() {
  const { onChain, isDemo } = useSiteData();
  return (
    <section className="home-hero bleed" aria-labelledby="home-title">
      <MetalField />
      <div className="home-hero-glow" aria-hidden="true" />
      <div className="home-hero-inner container">
        <div className="home-hero-copy">
          <p className="pill hero-in" style={{ ['--d' as string]: '0.05s' }}>
            <span className="pill-dot" aria-hidden="true" />
            Live index{isDemo ? ' · demo prices' : ''}
          </p>
          <h1
            id="home-title"
            tabIndex={-1}
            className="display hero-in"
            style={{ ['--d' as string]: '0.15s' }}
          >
            Four metals.
            <br />
            One <em className="shimmer">transparent</em> index.
          </h1>
          <p className="lead hero-in" style={{ ['--d' as string]: '0.3s' }}>
            MCH tracks gold, silver, platinum and nickel in a single live index,{' '}
            {onChain
              ? 'published on the Cardano blockchain, where anyone can check every number.'
              : 'built to be published on the Cardano blockchain, where anyone can check every number.'}
          </p>
          <div className="actions hero-in" style={{ ['--d' as string]: '0.45s' }}>
            <ButtonLink to="/live-index">Explore the live index</ButtonLink>
            <ButtonLink to="/how-it-works" variant="secondary">
              How it works
            </ButtonLink>
          </div>
          <ul
            className="hero-metals hero-in"
            style={{ ['--d' as string]: '0.6s' }}
            aria-label="The four metals"
          >
            {ORDER.map((m) => (
              <li key={m}>
                <MetalDot metal={m} />
                {METALS[m].name}
              </li>
            ))}
          </ul>
        </div>
        <div className="hero-in hero-card-wrap" style={{ ['--d' as string]: '0.35s' }}>
          <LiveCard />
        </div>
      </div>
      <a className="scroll-cue" href="#basket" aria-label="Scroll to the basket">
        <span />
      </a>
    </section>
  );
}

function LiveCard() {
  const { live, connection, isDemo, week } = useSiteData();
  const points = useMemo<Point[]>(() => {
    const pts = (week?.points ?? []).map((p) => ({ t: Date.parse(p.t), v: Number(p.index) }));
    const snap = live?.snapshot;
    if (snap) {
      const t = Date.parse(snap.computedAt);
      if (pts.length === 0 || t > pts[pts.length - 1]!.t) pts.push({ t, v: Number(snap.index) });
    }
    return pts;
  }, [week, live]);
  const snapshot = live?.snapshot;
  const state = live?.status ?? 'waiting';
  const change24 = live?.change24hPct;
  return (
    <aside className="live-card glow-border" aria-label="MCH Index, live">
      <div className="live-card-top">
        <span className="live-card-label">
          MCH Index
          {isDemo && <span className="demo-chip">Demo prices</span>}
        </span>
        <span className="status" data-state={state}>
          <span className="dot" aria-hidden="true" />
          <span role="status">{STATUS_TEXT[state]}</span>
          {connection === 'polling' && ' · reconnecting'}
        </span>
      </div>
      <p className="live-card-value">
        {snapshot ? <RollingNumber value={fmtNumber(snapshot.index)} /> : '—'}
      </p>
      {snapshot && (
        <p className="live-card-deltas">
          {change24 !== null && change24 !== undefined && <Delta value={change24} label="24h" />}
          <Delta value={snapshot.changeSinceBasePct} label="vs base prices" />
        </p>
      )}
      <div className="live-card-chart">
        {points.length > 1 ? (
          <LineChart
            points={points}
            height={150}
            compact
            label="MCH Index, last 7 days"
            formatValue={(v) => fmtNumber(v)}
            formatTime={(t) => fmtLondonMinute(new Date(t).toISOString())}
            reference={{ value: 100, label: 'Base' }}
          />
        ) : (
          <div className="chart-placeholder" />
        )}
      </div>
      <div className="live-card-foot">
        <span>
          {snapshot ? `Updated ${fmtAgo(snapshot.computedAt)} · base 100` : 'Connecting…'}
        </span>
        <Link to="/live-index">Full index →</Link>
      </div>
    </aside>
  );
}

/* ---------------------------------------------------------------- basket */

function BasketSection() {
  const { live, basket, week, isDemo } = useSiteData();
  const components = live?.snapshot?.components;
  return (
    <section className="section" id="basket" aria-labelledby="basket-heading">
      <Reveal className="section-head">
        <p className="eyebrow">The basket</p>
        <h2 id="basket-heading" className="display-2">
          Precious and industrial, <em>in equal measure</em>
        </h2>
        <p className="lead">
          Each metal carries a quarter of the weight and is measured against its own base price, so
          a 10% rise counts the same whether it is gold or nickel.
          {isDemo ? ' Prices shown are simulated for this preview.' : ''}
        </p>
      </Reveal>
      <div className="metal-grid">
        {ORDER.map((id, i) => {
          const info = METALS[id];
          const c = components?.find((x) => x.metal === id);
          const weight = basket?.basket.components.find((x) => x.metal === id)?.weightPpm;
          const base = Number(
            basket?.basket.components.find((x) => x.metal === id)?.basePrice ?? 0,
          );
          const series = (week?.points ?? []).flatMap((p) => {
            const price = p.prices[id];
            return price ? [Number(price)] : [];
          });
          if (c) series.push(Number(c.price));
          return (
            <Reveal key={id} delay={i * 0.08}>
              <Tilt className="metal-card" style={{ ['--metal' as string]: METAL_COLOR[id] }}>
                <div className="metal-card-head">
                  <h3>{info.name}</h3>
                  <span className="metal-symbol">{id}</span>
                </div>
                <p className="metal-price">
                  {c ? fmtUsd(c.price, id === 'NI' ? 0 : 2) : '—'}
                  <span> / {info.unit === 'tonne' ? 'tonne' : 'troy oz'}</span>
                </p>
                <p className="metal-change" data-sign={c ? Math.sign(c.changeSinceBasePct) : 0}>
                  {c ? (
                    <>
                      <span aria-hidden="true">{deltaGlyph(c.changeSinceBasePct)}</span>{' '}
                      {fmtPct(c.changeSinceBasePct)} <span className="muted">vs base price</span>
                    </>
                  ) : (
                    <span className="muted">Waiting for prices</span>
                  )}
                </p>
                <div className="metal-spark">
                  <Sparkline values={series} color={METAL_COLOR[id]} />
                  <span className="metal-spark-label">7 days</span>
                </div>
                <p className="metal-role">{ROLE[id]}</p>
                <dl className="metal-meta">
                  <div>
                    <dt>Weight</dt>
                    <dd>{weight ? fmtWeight(weight) : '25%'}</dd>
                  </div>
                  <div>
                    <dt>Base price</dt>
                    <dd>{base ? fmtUsd(base, id === 'NI' ? 0 : 2) : '—'}</dd>
                  </div>
                  <div className="metal-meta-wide">
                    <dt>Reference market</dt>
                    <dd>{info.market}</dd>
                  </div>
                </dl>
              </Tilt>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/** Where the index's points come from: one segment per metal, live. */
function IndexBreakdown() {
  const { live } = useSiteData();
  const [ref, inView] = useInView<HTMLDivElement>();
  const snap = live?.snapshot;
  const parts = snap ? ORDER.map((id) => snap.components.find((c) => c.metal === id)) : [];
  const total = parts.reduce((s, c) => s + (c ? Number(c.contribution) : 0), 0) || 1;
  return (
    <section className="section" aria-labelledby="breakdown-heading">
      <Reveal className="breakdown glass">
        <div className="breakdown-head">
          <div>
            <p className="eyebrow">Inside the number</p>
            <h2 id="breakdown-heading" className="display-3">
              Where the index points come from
            </h2>
          </div>
          <p className="breakdown-total">
            {snap ? <RollingNumber value={fmtNumber(snap.index)} /> : '—'}
            <span className="breakdown-label">MCH Index</span>
          </p>
        </div>
        <div
          className="breakdown-bar"
          ref={ref}
          data-in={inView || undefined}
          role="img"
          aria-label={
            snap
              ? parts
                  .map(
                    (c, i) =>
                      `${METALS[ORDER[i]!].name} ${c ? fmtNumber(c.contribution) : '—'} points`,
                  )
                  .join(', ')
              : 'Waiting for prices'
          }
        >
          {parts.map((c, i) => (
            <span
              key={ORDER[i]}
              style={{
                ['--w' as string]: `${((c ? Number(c.contribution) : 25) / total) * 100}%`,
                ['--metal' as string]: METAL_COLOR[ORDER[i]!],
                ['--i' as string]: i,
              }}
            />
          ))}
        </div>
        <ul className="breakdown-legend">
          {parts.map((c, i) => (
            <li key={ORDER[i]}>
              <MetalDot metal={ORDER[i]!} />
              <span className="breakdown-name">{METALS[ORDER[i]!].name}</span>
              <span className="breakdown-points">{c ? fmtNumber(c.contribution) : '—'}</span>
              <span className="muted">points</span>
            </li>
          ))}
        </ul>
        <p className="fine">
          Each metal adds about 25 points when it is at its base price. A metal that rises adds a
          little more, one that falls a little less; together they make the index.
        </p>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------- why */

function WhySection() {
  const { onChain } = useSiteData();
  const tiles: Array<{ icon: IconName; title: string; text: string; big?: boolean }> = [
    {
      icon: 'shield',
      title: onChain ? 'Verified on-chain' : 'Built to be verified on-chain',
      text: onChain
        ? 'A Cardano contract recalculates every update from the posted prices and rejects anything that does not match. Trust the maths, not us.'
        : 'Once live, a Cardano contract recalculates every update from the posted prices and rejects anything that does not match. Trust the maths, not us.',
      big: true,
    },
    {
      icon: 'layers',
      title: 'One number, four metals',
      text: 'Gold, silver, platinum and nickel combined into one index: 100 when every metal is at its base price.',
    },
    {
      icon: 'open',
      title: 'Open methodology',
      text: 'Formula, weights and base prices are published. Anyone can recompute the index.',
    },
    {
      icon: 'exact',
      title: 'Exact to the last digit',
      text: 'Whole-number arithmetic, identical in the backend and the contract.',
    },
    {
      icon: 'filter',
      title: 'Guarded prices',
      text: 'Each price is checked before it counts. One bad print cannot move the index.',
    },
    {
      icon: 'pin',
      title: 'Built in the UK',
      text: 'With a legal review and an independent security audit on the roadmap.',
    },
  ];
  return (
    <section className="section" aria-labelledby="why-heading">
      <Reveal className="section-head">
        <p className="eyebrow">Why MCH</p>
        <h2 id="why-heading" className="display-2">
          An index you can verify, <em>not just trust</em>
        </h2>
      </Reveal>
      <Spotlight className="bento">
        {tiles.map((tile, i) => (
          <Reveal
            key={tile.title}
            delay={i * 0.06}
            className={`bento-tile spot ${tile.big ? 'bento-big' : ''}`}
          >
            <span className="feature-icon">
              <Icon name={tile.icon} />
            </span>
            <h3>{tile.title}</h3>
            <p>{tile.text}</p>
            {tile.big && <ChainVisual />}
          </Reveal>
        ))}
      </Spotlight>
    </section>
  );
}

/** Blocks on a chain, each one checked: decoration for the big tile. */
function ChainVisual() {
  return (
    <div className="chain-visual" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="chain-block" style={{ ['--i' as string]: i }}>
          <span className="chain-hash">#{(4091 + i * 17).toString(16)}</span>
          <span className="chain-check">✓</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ flow */

function FlowSection() {
  const steps: Array<{ icon: IconName; title: string; text: string }> = [
    {
      icon: 'chart',
      title: 'Prices come in',
      text: 'From market-data sources (simulated during this preview).',
    },
    {
      icon: 'filter',
      title: 'They are checked',
      text: 'Anything implausible is held back by the guard.',
    },
    {
      icon: 'exact',
      title: 'The index is calculated',
      text: 'Weighted, combined, exact to six decimal places.',
    },
    {
      icon: 'shield',
      title: 'It goes on Cardano',
      text: 'Once live, the contract verifies every update.',
    },
  ];
  return (
    <section className="section" aria-labelledby="flow-heading">
      <Reveal className="section-head">
        <p className="eyebrow">How it works</p>
        <h2 id="flow-heading" className="display-2">
          {'From market price to a verified number on‑chain'}
        </h2>
      </Reveal>
      <Reveal className="pipeline-wrap">
        <ol className="pipeline">
          {steps.map((s, i) => (
            <li key={s.title} className="pipeline-step" style={{ ['--i' as string]: i }}>
              <span className="pipeline-node">
                <Icon name={s.icon} />
              </span>
              <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        <span className="pipeline-track" aria-hidden="true">
          <span
            className="packet"
            style={{ ['--metal' as string]: 'var(--gold)', ['--delay' as string]: '0s' }}
          />
          <span
            className="packet"
            style={{ ['--metal' as string]: 'var(--silver)', ['--delay' as string]: '1s' }}
          />
          <span
            className="packet"
            style={{ ['--metal' as string]: 'var(--platinum)', ['--delay' as string]: '2s' }}
          />
          <span
            className="packet"
            style={{ ['--metal' as string]: 'var(--nickel)', ['--delay' as string]: '3s' }}
          />
        </span>
      </Reveal>
      <p className="section-link">
        <Link to="/how-it-works">Read how it works in detail →</Link>
      </p>
    </section>
  );
}

/* ----------------------------------------------------------------- stats */

function StatsBand() {
  return (
    <section className="stats-band bleed" aria-label="MCH in numbers">
      <div className="container stats-inner">
        {[
          { to: 4, label: 'metals, one index' },
          { to: 221, label: 'contract tests passing' },
          { to: 20000, label: 'randomised index checks' },
          { to: 6, label: 'decimal places, exact' },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08} className="stat">
            <span className="stat-value">
              <CountUp to={s.to} />
            </span>
            <span className="stat-label">{s.label}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ coin */

function CoinSection() {
  const { oracle } = useSiteData();
  const exists = Boolean(oracle?.token);
  return (
    <section className="section" aria-labelledby="coin-heading">
      <div className="coin-section">
        <Reveal className="coin-visual">
          <Coin />
        </Reveal>
        <Reveal delay={0.1}>
          <p className="eyebrow">The MCH coin</p>
          <h2 id="coin-heading" className="display-2">
            A native Cardano token, <em>fixed in supply</em>
          </h2>
          <p className="lead">
            MCH is designed to be created once, in a single transaction. After that, its contract
            makes it impossible to create any more. Wallets that support CIP‑68 can read its
            details.
          </p>
          <dl className="fact-grid">
            <div>
              <dt>{exists ? 'Total supply' : 'Planned supply'}</dt>
              <dd>100,000,000</dd>
            </div>
            <div>
              <dt>Further minting</dt>
              <dd>Impossible</dd>
            </div>
            <div>
              <dt>Standard</dt>
              <dd>CIP-68</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{exists ? 'On Cardano' : 'Ready to create'}</dd>
            </div>
          </dl>
          <p className="fine">
            MCH is not backed by metal, cannot be exchanged for metal, and is not offered for sale.
          </p>
          <div className="actions">
            <ButtonLink to="/token">About the coin</ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- roadmap */

function RoadmapSection() {
  const { oracle } = useSiteData();
  const items = milestones({
    coinExists: Boolean(oracle?.token),
    oracleLive: Boolean(oracle?.oracleDeployed),
  });
  const done = items.filter((m) => m.status === 'done').length;
  const [ref, inView] = useInView<HTMLOListElement>();
  return (
    <section className="section" aria-labelledby="roadmap-heading">
      <Reveal className="section-head">
        <p className="eyebrow">Roadmap</p>
        <h2 id="roadmap-heading" className="display-2">
          Where MCH is <em>today</em>
        </h2>
        <p className="lead">
          The technology is built and tested. Next: licensed market data, the live on-chain index,
          and independent legal and security checks.
        </p>
      </Reveal>
      <ol
        ref={ref}
        className="track"
        data-in={inView || undefined}
        style={{ ['--progress' as string]: (done - 0.5) / items.length }}
      >
        {items.map((m, i) => (
          <li key={m.title} data-status={m.status} style={{ ['--i' as string]: i }}>
            <span className="track-node" aria-hidden="true" />
            <span className="chip" data-status={m.status}>
              {STATUS_LABEL[m.status]}
            </span>
            <span className="track-title">{m.title}</span>
          </li>
        ))}
      </ol>
      <p className="section-link">
        <Link to="/roadmap">See the full roadmap →</Link>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------- cta */

function ClosingCta() {
  return (
    <section className="cta-band bleed" aria-labelledby="cta-heading">
      <div className="cta-aurora" aria-hidden="true" />
      <Reveal className="container cta-inner">
        <p className="eyebrow">See it for yourself</p>
        <h2 id="cta-heading" className="display">
          Watch the index <em className="shimmer">move</em>.
        </h2>
        <p className="lead">Every price, every weight and every calculation, live on one page.</p>
        <div className="actions">
          <ButtonLink to="/live-index">Open the live index</ButtonLink>
          <ButtonLink to="/faq" variant="secondary">
            Read the FAQ
          </ButtonLink>
        </div>
      </Reveal>
    </section>
  );
}
