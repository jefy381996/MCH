import { useMemo, useState } from 'react';
import type { OraclePayload } from '../lib/api.ts';
import {
  assetQuantity,
  detectWallets,
  lovelace,
  type Cip30Api,
  type DetectedWallet,
} from '../lib/cip30.ts';
import { fmtTokenAmount, shorten } from '../lib/format.ts';

const EXPECTED_NETWORK_ID: Record<string, number> = { Mainnet: 1, Preprod: 0, Preview: 0 };

type WalletState =
  | { kind: 'idle' }
  | { kind: 'connecting'; name: string }
  | { kind: 'connected'; name: string; api: Cip30Api; mch: bigint | null; ada: bigint }
  | { kind: 'error'; message: string };

export function Token({ oracle }: { oracle: OraclePayload | null }) {
  const token = oracle?.token ?? null;
  const network = oracle?.network ?? undefined;
  const wallets = useMemo<DetectedWallet[]>(() => detectWallets(), []);
  const [wallet, setWallet] = useState<WalletState>({ kind: 'idle' });

  async function connect(w: DetectedWallet) {
    setWallet({ kind: 'connecting', name: w.name });
    try {
      const api = await w.provider.enable();
      const networkId = await api.getNetworkId();
      if (
        network &&
        EXPECTED_NETWORK_ID[network] !== undefined &&
        networkId !== EXPECTED_NETWORK_ID[network]
      ) {
        setWallet({
          kind: 'error',
          message: `${w.name} is on a different network. Switch it to ${network}.`,
        });
        return;
      }
      const balance = await api.getBalance();
      setWallet({
        kind: 'connected',
        name: w.name,
        api,
        ada: lovelace(balance),
        mch: token ? assetQuantity(balance, token.unit) : null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The wallet refused the connection.';
      setWallet({ kind: 'error', message });
    }
  }

  return (
    <section className="card" aria-labelledby="token-title">
      <h2 id="token-title">The MCH token</h2>
      <div className="banner" style={{ background: 'var(--page)' }}>
        <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="9" fill="var(--series-1)" />
          <path d="M10 9v5M10 6v.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div>
          <strong>Not backed by metal</strong>
          <p>
            MCH is not backed by gold, silver, platinum or nickel and cannot be exchanged for them.
            Its market price is whatever buyers and sellers agree, and can differ from the MCH
            Index.
          </p>
        </div>
      </div>

      {token ? (
        <dl className="kv">
          <dt>Total supply</dt>
          <dd>
            {fmtTokenAmount(BigInt(token.supply), token.decimals)} {token.name} (fixed: no more can
            ever be minted)
          </dd>
          <dt>Policy</dt>
          <dd className="mono" title={token.policyId}>
            {shorten(token.policyId)}
          </dd>
          <dt>Explorer</dt>
          <dd>
            <a href={token.explorerUrl} target="_blank" rel="noreferrer">
              View token on Cardanoscan
            </a>
          </dd>
        </dl>
      ) : oracle?.error === 'unreachable' ? (
        <p className="note" style={{ marginTop: 0 }}>
          Cannot reach the MCH server right now.
        </p>
      ) : (
        <p className="note" style={{ marginTop: 0 }}>
          The token has not been minted yet.
        </p>
      )}

      <h3 style={{ fontSize: 15, margin: '20px 0 8px' }}>Your wallet</h3>
      {wallet.kind === 'connected' ? (
        <dl className="kv">
          <dt>Wallet</dt>
          <dd>{wallet.name}</dd>
          <dt>MCH balance</dt>
          <dd>
            <b>
              {wallet.mch === null || !token ? '—' : fmtTokenAmount(wallet.mch, token.decimals)}
            </b>
          </dd>
          <dt>ADA</dt>
          <dd>{fmtTokenAmount(wallet.ada, 6)}</dd>
        </dl>
      ) : wallets.length === 0 ? (
        <p className="note" style={{ marginTop: 0 }}>
          No Cardano wallet found in this browser. Install a wallet extension such as Lace or Eternl
          to see your MCH balance here.
        </p>
      ) : (
        <div className="filters" style={{ margin: 0 }}>
          {wallets.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => void connect(w)}
              disabled={wallet.kind === 'connecting'}
            >
              {w.icon && (
                <img
                  src={w.icon}
                  alt=""
                  width={16}
                  height={16}
                  style={{ verticalAlign: '-3px', marginRight: 6 }}
                />
              )}
              {wallet.kind === 'connecting' && wallet.name === w.name
                ? 'Connecting…'
                : `Connect ${w.name}`}
            </button>
          ))}
        </div>
      )}
      {wallet.kind === 'error' && (
        <p className="note" role="alert">
          {wallet.message}
        </p>
      )}
      <p className="note">
        Connecting only reads your balance. This site never asks you to sign or send anything
        {token ? ` (token ${shorten(token.unit, 6)})` : ''}.
      </p>
    </section>
  );
}
