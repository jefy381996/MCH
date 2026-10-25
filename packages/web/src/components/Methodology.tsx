import { METALS, type BasketFile, type MetalId } from '@mch/index-core';
import { fmtDate, fmtUsd, fmtWeight } from '../lib/format.ts';

export function Methodology({
  basket,
  sourceLabel,
}: {
  basket: BasketFile | null;
  sourceLabel?: string;
}) {
  return (
    <section className="card prose" aria-labelledby="method-title">
      <h2 id="method-title">How the index is calculated</h2>
      <p>
        Each metal&rsquo;s price is divided by its price on the base date, so a metal that has risen
        10% counts as 1.10 whatever its unit. Those ratios are blended by weight and multiplied by
        100:
      </p>
      <div className="formula">index = 100 × Σ ( weight × price ÷ base price )</div>
      {basket && (
        <>
          <p>
            Base date: <b>{fmtDate(basket.baseDate)}</b>. The index is 100 whenever every metal is
            at its base price. Basket version {basket.version}.
            {basket.isDemo ? ' The base prices are illustrative placeholders for the demo.' : ''}
          </p>
          <div className="table-wrap">
            <table className="table-stack">
              <thead>
                <tr>
                  <th scope="col">Metal</th>
                  <th scope="col" className="num">
                    Weight
                  </th>
                  <th scope="col" className="num">
                    Base price
                  </th>
                  <th scope="col">Reference market</th>
                </tr>
              </thead>
              <tbody>
                {basket.components.map((c) => {
                  const info = METALS[c.metal as MetalId];
                  return (
                    <tr key={c.metal}>
                      <td>{info.name}</td>
                      <td className="num">{fmtWeight(c.weightPpm)}</td>
                      <td className="num">
                        {fmtUsd(c.basePrice, c.metal === 'NI' ? 0 : 2)} /{' '}
                        {info.unit === 'tonne' ? 't' : 'oz'}
                      </td>
                      <td className="wrap">{info.market}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p>
        All arithmetic is done in whole numbers of millionths, with one rounding step at the end, so
        the backend and the on-chain contract always agree to the last digit. The contract
        recomputes the index from the posted prices and rejects any update that does not match.
      </p>
      <p>
        Metals do not trade around the clock. When a market is closed the index uses that
        metal&rsquo;s last price, and each price on this page shows how old it is. Price source:{' '}
        {sourceLabel ?? '…'}.
      </p>
    </section>
  );
}
