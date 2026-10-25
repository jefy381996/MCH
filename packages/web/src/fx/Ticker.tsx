import { METALS, type MetalId } from '@mch/index-core';
import { deltaGlyph, fmtNumber, fmtPct, fmtUsd } from '../lib/format.ts';
import { useSiteData } from '../lib/site-data.tsx';
import { METAL_COLOR } from '../components/ui.tsx';

/**
 * A slow, endless strip of live prices across the page. The second copy only
 * exists to make the loop seamless, so screen readers skip it.
 */
export function Ticker() {
  const { live } = useSiteData();
  const snap = live?.snapshot;
  if (!snap) return <div className="ticker ticker-empty" aria-hidden="true" />;
  const items = (
    <>
      <span className="ticker-item ticker-index">
        <span className="ticker-name">MCH INDEX</span>
        <span className="ticker-price">{fmtNumber(snap.index)}</span>
        <span className="ticker-change">
          {deltaGlyph(snap.changeSinceBasePct)} {fmtPct(snap.changeSinceBasePct)}
        </span>
      </span>
      {snap.components.map((c) => (
        <span key={c.metal} className="ticker-item">
          <span className="ticker-dot" style={{ background: METAL_COLOR[c.metal as MetalId] }} />
          <span className="ticker-name">{METALS[c.metal as MetalId].name.toUpperCase()}</span>
          <span className="ticker-price">{fmtUsd(c.price, c.metal === 'NI' ? 0 : 2)}</span>
          <span className="ticker-change">
            {deltaGlyph(c.changeSinceBasePct)} {fmtPct(c.changeSinceBasePct)}
          </span>
        </span>
      ))}
      {live?.dataSource.isDemo && <span className="ticker-item ticker-note">DEMO PRICES</span>}
    </>
  );
  return (
    <div className="ticker" role="region" aria-label="Live prices">
      <div className="ticker-track">
        <div className="ticker-group">{items}</div>
        <div className="ticker-group" aria-hidden="true">
          {items}
        </div>
      </div>
    </div>
  );
}
