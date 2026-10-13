import { useEffect, useState } from 'react';
import { BasketTable } from './components/BasketTable.tsx';
import { DemoBanner } from './components/DemoBanner.tsx';
import { Footer } from './components/Footer.tsx';
import { Header } from './components/Header.tsx';
import { Hero } from './components/Hero.tsx';
import { History } from './components/History.tsx';
import { Methodology } from './components/Methodology.tsx';
import { OnChain } from './components/OnChain.tsx';
import { Token } from './components/Token.tsx';
import { getJSON, type BasketPayload, type OraclePayload } from './lib/api.ts';
import { useLiveIndex } from './lib/useLiveIndex.ts';

const ORACLE_REFRESH_MS = 60_000;

export function App() {
  const { data, connection } = useLiveIndex();
  const [basket, setBasket] = useState<BasketPayload | null>(null);
  const [oracle, setOracle] = useState<OraclePayload | null>(null);

  useEffect(() => {
    getJSON<BasketPayload>('/api/basket')
      .then(setBasket)
      .catch(() => {});
    const loadOracle = () =>
      getJSON<OraclePayload>('/api/oracle')
        .then(setOracle)
        .catch(() => setOracle({ configured: true, status: null, error: 'unreachable' }));
    void loadOracle();
    const timer = window.setInterval(loadOracle, ORACLE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const isDemo = data?.dataSource.isDemo ?? basket?.basket.isDemo ?? false;
  const network = oracle?.status?.network;
  const networkLabel = network
    ? network === 'Mainnet'
      ? 'Cardano'
      : `${network} testnet`
    : 'Not on-chain yet';

  return (
    <div className="page">
      <Header networkLabel={networkLabel} />
      <main>
        {isDemo && data && <DemoBanner label={data.dataSource.label} />}
        <Hero data={data} baseDate={basket?.basket.baseDate} connection={connection} />
        <div style={{ height: 16 }} />
        <BasketTable data={data} />
        <History live={data} basket={basket?.basket ?? null} />
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <OnChain oracle={oracle} live={data} />
          <Token oracle={oracle} />
        </div>
        <div style={{ height: 16 }} />
        <Methodology basket={basket?.basket ?? null} sourceLabel={data?.dataSource.label} />
      </main>
      <Footer isDemo={isDemo} />
    </div>
  );
}
