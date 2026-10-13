import { METALS, type FeedStatus } from '@mch/index-core';
import type { IndexPayload } from '../lib/api.ts';
import { deltaGlyph, fmtAgo, fmtNumber, fmtPct, fmtUsd, fmtWeight } from '../lib/format.ts';

const STATUS_LABEL: Record<FeedStatus, string> = {
  live: 'Live',
  delayed: 'Delayed',
  closed: 'Closed',
};

export function BasketTable({ data }: { data: IndexPayload | null }) {
  const snapshot = data?.snapshot;
  return (
    <section className="card" aria-labelledby="basket-title">
      <h2 id="basket-title">What&rsquo;s in the basket</h2>
      <p className="sub">
        Four metals, each measured against its own price on the base date. The contribution column
        is how many index points each metal adds up to.
      </p>
      {!snapshot ? (
        <p className="note">Waiting for the first prices.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Metal</th>
                <th scope="col" className="num optional-col">
                  Weight
                </th>
                <th scope="col" className="num">
                  Price
                </th>
                <th scope="col" className="num">
                  Since base
                </th>
                <th scope="col" className="num optional-col">
                  Contribution
                </th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.components.map((c) => {
                const info = METALS[c.metal];
                const status = data?.componentStatus[c.metal] ?? 'closed';
                return (
                  <tr key={c.metal}>
                    <th scope="row">
                      <span className="metal-name">{info.name}</span>
                      <span className="metal-code optional-text">{c.metal}</span>
                    </th>
                    <td className="num optional-col">{fmtWeight(c.weightPpm)}</td>
                    <td className="num">
                      {fmtUsd(c.price, c.metal === 'NI' ? 0 : 2)}{' '}
                      <span className="unit">/ {info.unit === 'tonne' ? 't' : 'oz'}</span>
                    </td>
                    <td className="num">
                      <span aria-hidden="true">{deltaGlyph(c.changeSinceBasePct)} </span>
                      {fmtPct(c.changeSinceBasePct)}
                    </td>
                    <td className="num optional-col">{fmtNumber(c.contribution)}</td>
                    <td>
                      <span className="status" data-state={status}>
                        <span className="dot" aria-hidden="true" />
                        <span>
                          {STATUS_LABEL[status]}
                          <span className="optional-text"> · {fmtAgo(c.observedAt)}</span>
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">
        Prices are in US dollars: gold, silver and platinum per troy ounce, nickel per tonne.
        Source: {data?.dataSource.label ?? '…'}.
      </p>
    </section>
  );
}
