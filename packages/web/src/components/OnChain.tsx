import type { IndexPayload, OraclePayload } from '../lib/api.ts';
import { fmtAgo, fmtLondon, fmtNumber, fmtPct, shorten } from '../lib/format.ts';

export function OnChain({
  oracle,
  live,
}: {
  oracle: OraclePayload | null;
  live: IndexPayload | null;
}) {
  const status = oracle?.status;
  const liveIndex = live?.snapshot ? Number(live.snapshot.index) : null;
  const gap =
    status && liveIndex !== null
      ? ((liveIndex - Number(status.index)) / Number(status.index)) * 100
      : null;

  return (
    <section className="card" aria-labelledby="chain-title">
      <h2 id="chain-title">On the Cardano blockchain</h2>
      <p className="sub">
        The index is also written to Cardano by the MCH oracle, where anyone can read and verify it.
        The contract rejects any update whose index does not match its own metal prices.
      </p>
      {!oracle ? (
        <p className="note">Loading…</p>
      ) : oracle.error === 'unreachable' ? (
        <p className="note">Cannot reach the MCH server right now.</p>
      ) : !oracle.configured || !oracle.oracleDeployed ? (
        <p className="note">
          The price oracle has not been deployed yet. Once it is, the on-chain value and a link to
          its latest transaction appear here.
          {oracle.token ? ' The MCH coin itself already exists: see the token panel.' : ''}
        </p>
      ) : !status ? (
        <p className="note">
          {oracle.error
            ? 'Cannot reach the Cardano network right now.'
            : 'No oracle data found on-chain.'}
        </p>
      ) : (
        <>
          <dl className="kv">
            <dt>Index on-chain</dt>
            <dd>
              <b>{fmtNumber(status.index)}</b>
              {gap !== null && (
                <span style={{ color: 'var(--text-2)' }}> ({fmtPct(gap)} live vs on-chain)</span>
              )}
            </dd>
            <dt>Published</dt>
            <dd>
              {fmtLondon(status.publishedAt)} London ({fmtAgo(status.publishedAt)})
            </dd>
            <dt>Update number</dt>
            <dd>{status.sequence.toLocaleString('en-GB')}</dd>
            <dt>Network</dt>
            <dd>{status.network}</dd>
            <dt>Oracle policy</dt>
            <dd className="mono" title={status.policyId}>
              {shorten(status.policyId)}
            </dd>
            <dt>Transaction</dt>
            <dd>
              <a href={status.explorerUrl} target="_blank" rel="noreferrer">
                View on Cardanoscan
              </a>
            </dd>
          </dl>
          <p className="note">
            Updates go on-chain when the live index moves past a set threshold, and on a regular
            heartbeat, so the on-chain value can trail the live one slightly.
          </p>
        </>
      )}
    </section>
  );
}
