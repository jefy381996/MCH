import { METALS, type MetalId } from '@mch/index-core';
import { useEffect, useMemo, useState } from 'react';
import { DemoBanner } from '../components/DemoBanner.tsx';
import { LineChart } from '../components/LineChart.tsx';
import {
  ButtonLink,
  Feature,
  METAL_COLOR,
  MetalDot,
  SectionHead,
  type IconName,
} from '../components/ui.tsx';
import { getJSON, type HistoryPayload } from '../lib/api.ts';
import {
  deltaGlyph,
  deltaWords,
  fmtAgo,
  fmtLondonMinute,
  fmtNumber,
  fmtPct,
  fmtUsd,
  fmtWeight,
} from '../lib/format.ts';
import { milestones, STATUS_LABEL } from '../lib/roadmap.ts';
import { Link } from '../lib/router.tsx';
import type { Point } from '../lib/scale.ts';
import { useSiteData } from '../lib/site-data.tsx';

const STATUS_TEXT = {
  live: 'Live',
  delayed: 'Delayed',
  closed: 'Markets closed',
  waiting: 'Waiting for prices',
} as const;

const ROLE: Record<MetalId, string> = {
  XAU: 'The classic store of value, held by central banks and investors worldwide.',
  XAG: 'Both a precious metal and an industrial one, used in solar panels and electronics.',
  XPT: 'A scarce industrial metal, essential to catalytic converters and hydrogen technology.',
  NI: 'The industrial metal of the energy transition, used in stainless steel and EV batteries.',
};

export function Home() {
  const { isDemo, live } = useSiteData();
  return (
    <>
      <HomeHero />
      {isDemo && live && (
        <div className="section-tight">
          <DemoBanner label={live.dataSource.label} />
        </div>
      )}
      <MetalStrip />
      <WhyMch />
      <HowItWorksPreview />
      <CoinPreview />
      <RoadmapPreview />
      <ClosingCta />
    </>
  );
}

function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero-copy">
        <p className="eyebrow">
          <span className="eyebrow-dot" aria-hidden="true" />
          The MCH Index · published on Cardano
        </p>
        <h1 id="home-title" tabIndex={-1}>
          Four metals.
          <br />
          <span className="metal-text">One transparent index.</span>
        </h1>
        <p className="lead">
          MCH (Metal Chain) tracks gold, silver, platinum and nickel in a single live index, and
          publishes it on the Cardano blockchain, where anyone can check every number.
        </p>
        <div className="actions">
          <ButtonLink to="/live-index">See the live index</ButtonLink>
          <ButtonLink to="/how-it-works" variant="secondary">
            How it works
          </ButtonLink>
        </div>
        <ul className="hero-metals" aria-label="The four metals">
          {(['XAU', 'XAG', 'XPT', 'NI'] as const).map((m) => (
            <li key={m}>
              <MetalDot metal={m} />
              {METALS[m].name}
            </li>
          ))}
        </ul>
      </div>
      <LiveCard />
    </section>
  );
}

function LiveCard() {
  const { live, basket, connection } = useSiteData();
  const [history, setHistory] = useState<HistoryPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      getJSON<HistoryPayload>('/api/index/history?range=7d', controller.signal)
        .then(setHistory)
        .catch(() => {});
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const points = useMemo<Point[]>(() => {
    const pts = (history?.points ?? []).map((p) => ({ t: Date.parse(p.t), v: Number(p.index) }));
    const snap = live?.snapshot;
    if (snap) {
      const t = Date.parse(snap.computedAt);
      if (pts.length === 0 || t > pts[pts.length - 1]!.t) pts.push({ t, v: Number(snap.index) });
    }
    return pts;
  }, [history, live]);

  const snapshot = live?.snapshot;
  const state = live?.status ?? 'waiting';
  const change24 = live?.change24hPct;
  return (
    <aside className="live-card" aria-label="MCH Index, live">
      <div className="live-card-top">
        <span className="live-card-label">MCH Index</span>
        <span className="status" data-state={state} role="status">
          <span className="dot" aria-hidden="true" />
          {STATUS_TEXT[state]}
          {connection === 'polling' && ' · reconnecting'}
        </span>
      </div>
      <p className="live-card-value">{snapshot ? fmtNumber(snapshot.index) : '—'}</p>
      {snapshot && (
        <p className="live-card-deltas">
          {change24 !== null && change24 !== undefined && (
            <span aria-label={`${deltaWords(change24)} ${fmtPct(Math.abs(change24))} in 24 hours`}>
              <span aria-hidden="true">
                {deltaGlyph(change24)} <b>{fmtPct(change24)}</b> 24h
              </span>
            </span>
          )}
          <span>
            {deltaGlyph(snapshot.changeSinceBasePct)} <b>{fmtPct(snapshot.changeSinceBasePct)}</b>{' '}
            since base date
          </span>
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
          {snapshot ? `Updated ${fmtAgo(snapshot.computedAt)}` : 'Connecting…'}
          {basket ? ` · base 100` : ''}
        </span>
        <Link to="/live-index">Full index →</Link>
      </div>
    </aside>
  );
}

function MetalStrip() {
  const { live, basket } = useSiteData();
  const components = live?.snapshot?.components;
  const ids: MetalId[] = basket?.basket.components.map((c) => c.metal as MetalId) ?? [
    'XAU',
    'XAG',
    'XPT',
    'NI',
  ];
  return (
    <section className="section" aria-labelledby="basket-heading">
      <SectionHead
        id="basket-heading"
        eyebrow="The basket"
        title="Precious and industrial metals, in equal measure"
        lead="Each metal carries an equal weight. Its price is compared with its own price on the base date, so a 10% rise counts the same whether it is gold or nickel."
      />
      <div className="metal-grid">
        {ids.map((id) => {
          const info = METALS[id];
          const c = components?.find((x) => x.metal === id);
          const weight = basket?.basket.components.find((x) => x.metal === id)?.weightPpm;
          return (
            <article
              key={id}
              className="metal-card"
              style={{ ['--metal' as string]: METAL_COLOR[id] }}
            >
              <div className="metal-card-head">
                <h3>{info.name}</h3>
                <span className="metal-symbol">{id}</span>
              </div>
              <p className="metal-price">
                {c ? fmtUsd(c.price, id === 'NI' ? 0 : 2) : '—'}
                <span> / {info.unit === 'tonne' ? 'tonne' : 'troy oz'}</span>
              </p>
              <p className="metal-change">
                {c ? (
                  <>
                    {deltaGlyph(c.changeSinceBasePct)} {fmtPct(c.changeSinceBasePct)}{' '}
                    <span>since base</span>
                  </>
                ) : (
                  <span>Waiting for prices</span>
                )}
              </p>
              <p className="metal-role">{ROLE[id]}</p>
              <dl className="metal-meta">
                <div>
                  <dt>Weight</dt>
                  <dd>{weight ? fmtWeight(weight) : '25%'}</dd>
                </div>
                <div>
                  <dt>Reference market</dt>
                  <dd>{info.market}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'layers',
    title: 'One number, four metals',
    text: 'Gold, silver, platinum and nickel combined into a single index that started at 100 on its base date.',
  },
  {
    icon: 'open',
    title: 'Open methodology',
    text: 'The formula, the weights and the base prices are published. Anyone can recompute the index themselves.',
  },
  {
    icon: 'shield',
    title: 'Verified on-chain',
    text: 'The Cardano contract recalculates every update from the posted prices and rejects anything that does not match.',
  },
  {
    icon: 'exact',
    title: 'Exact to the last digit',
    text: 'Whole-number arithmetic, identical in the website, the backend and the contract. No rounding drift, ever.',
  },
  {
    icon: 'filter',
    title: 'Guarded prices',
    text: 'Incoming prices are checked before they count, so one bad print cannot move the index.',
  },
  {
    icon: 'pin',
    title: 'Built in the United Kingdom',
    text: 'Developed with UK financial-promotion rules in mind, and launched only after legal review.',
  },
];

function WhyMch() {
  return (
    <section className="section" aria-labelledby="why-heading">
      <SectionHead
        id="why-heading"
        eyebrow="Why MCH"
        title="A metals index you can verify, not just trust"
      />
      <div className="feature-grid">
        {FEATURES.map((f) => (
          <Feature key={f.title} icon={f.icon} title={f.title}>
            {f.text}
          </Feature>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: 'Prices come in',
    text: 'Prices for each metal arrive from market-data sources throughout the trading day.',
  },
  {
    title: 'They are checked',
    text: 'A guard compares each price with recent history and holds back anything implausible.',
  },
  {
    title: 'The index is calculated',
    text: 'Each metal is compared with its base price, weighted and combined into one number.',
  },
  {
    title: 'It is published on Cardano',
    text: 'The oracle writes the index on-chain, where the contract verifies it before accepting it.',
  },
];

function HowItWorksPreview() {
  return (
    <section className="section" aria-labelledby="how-heading">
      <SectionHead
        id="how-heading"
        eyebrow="How it works"
        title="From market prices to a verified number on‑chain"
      />
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="step">
            <span className="step-number" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      <p className="section-link">
        <Link to="/how-it-works">Read how it works in detail →</Link>
      </p>
    </section>
  );
}

function CoinPreview() {
  const { oracle } = useSiteData();
  const exists = Boolean(oracle?.token);
  return (
    <section className="section" aria-labelledby="coin-heading">
      <div className="split-panel">
        <div>
          <p className="eyebrow">The MCH coin</p>
          <h2 id="coin-heading">A native Cardano token with a supply fixed for good</h2>
          <p className="lead">
            MCH is created once, in a single transaction, and the contract makes it impossible to
            create any more. Its details are readable by any Cardano wallet.
          </p>
          <p className="fine">
            MCH is not backed by metal, cannot be exchanged for metal, and is not offered for sale.
          </p>
          <div className="actions">
            <ButtonLink to="/token">About the coin</ButtonLink>
          </div>
        </div>
        <dl className="fact-grid">
          <div>
            <dt>Total supply</dt>
            <dd>100,000,000 MCH</dd>
          </div>
          <div>
            <dt>Further minting</dt>
            <dd>Impossible</dd>
          </div>
          <div>
            <dt>Blockchain</dt>
            <dd>Cardano</dd>
          </div>
          <div>
            <dt>Token standard</dt>
            <dd>CIP-68</dd>
          </div>
          <div>
            <dt>Divisible to</dt>
            <dd>6 decimal places</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{exists ? 'Created on Cardano' : 'Ready to create'}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function RoadmapPreview() {
  const { oracle } = useSiteData();
  const items = milestones({
    coinExists: Boolean(oracle?.token),
    oracleLive: Boolean(oracle?.oracleDeployed),
  });
  return (
    <section className="section" aria-labelledby="roadmap-heading">
      <SectionHead
        id="roadmap-heading"
        eyebrow="Roadmap"
        title="Where MCH is today"
        lead="The technology is built and tested. The remaining steps are about data licensing, independent checks and launching the right way."
      />
      <ol className="roadmap-strip">
        {items.slice(0, 7).map((m) => (
          <li key={m.title} data-status={m.status}>
            <span className="chip" data-status={m.status}>
              {STATUS_LABEL[m.status]}
            </span>
            <span className="roadmap-strip-title">{m.title}</span>
          </li>
        ))}
      </ol>
      <p className="section-link">
        <Link to="/roadmap">See the full roadmap →</Link>
      </p>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="cta-band" aria-labelledby="cta-heading">
      <h2 id="cta-heading">Watch the MCH Index move, live</h2>
      <p>Every price, every weight and every calculation, on one page.</p>
      <div className="actions">
        <ButtonLink to="/live-index">Open the live index</ButtonLink>
        <ButtonLink to="/faq" variant="secondary">
          Read the FAQ
        </ButtonLink>
      </div>
    </section>
  );
}
