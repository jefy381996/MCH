import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getJSON,
  type BasketPayload,
  type HistoryPayload,
  type IndexPayload,
  type OraclePayload,
  type SitePayload,
} from './api.ts';
import { useLiveIndex, type Connection } from './useLiveIndex.ts';

const ORACLE_REFRESH_MS = 60_000;

export interface SiteData {
  live: IndexPayload | null;
  connection: Connection;
  basket: BasketPayload | null;
  oracle: OraclePayload | null;
  site: SitePayload | null;
  /** The last 7 days, for the home page's chart and sparklines. Refreshed every minute. */
  week: HistoryPayload | null;
  isDemo: boolean;
  /** The price oracle is running on Cardano: only then is the index "published on-chain". */
  onChain: boolean;
  /** Short label for the header badge, e.g. "Cardano" or "Not on-chain yet". */
  networkLabel: string;
}

const SiteDataContext = createContext<SiteData | null>(null);

/**
 * One live connection and one set of fetches for the whole site, so moving
 * between pages is instant and never opens a second WebSocket.
 */
export function SiteDataProvider({ children }: { children: ReactNode }) {
  const { data: live, connection } = useLiveIndex();
  const [basket, setBasket] = useState<BasketPayload | null>(null);
  const [oracle, setOracle] = useState<OraclePayload | null>(null);
  const [site, setSite] = useState<SitePayload | null>(null);
  const [week, setWeek] = useState<HistoryPayload | null>(null);

  useEffect(() => {
    getJSON<BasketPayload>('/api/basket')
      .then(setBasket)
      .catch(() => {});
    getJSON<SitePayload>('/api/site')
      .then(setSite)
      .catch(() => {});
    const loadOracle = () =>
      getJSON<OraclePayload>('/api/oracle')
        .then(setOracle)
        // One failed refresh must not wipe what is already known (e.g. that the coin exists).
        .catch(() =>
          setOracle((previous) =>
            previous
              ? { ...previous, error: 'unreachable' }
              : {
                  configured: true,
                  network: null,
                  token: null,
                  oracleDeployed: false,
                  status: null,
                  error: 'unreachable',
                },
          ),
        );
    const loadWeek = () =>
      getJSON<HistoryPayload>('/api/index/history?range=7d')
        .then(setWeek)
        .catch(() => {});
    void loadOracle();
    void loadWeek();
    const timer = window.setInterval(() => {
      void loadOracle();
      void loadWeek();
    }, ORACLE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const network = oracle?.network;
  const value: SiteData = {
    live,
    connection,
    basket,
    oracle,
    site,
    week,
    onChain: Boolean(oracle?.oracleDeployed),
    isDemo: live?.dataSource.isDemo ?? basket?.basket.isDemo ?? false,
    networkLabel: network
      ? network === 'Mainnet'
        ? 'Cardano'
        : `${network} testnet`
      : 'Pre-launch',
  };
  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData(): SiteData {
  const data = useContext(SiteDataContext);
  if (!data) throw new Error('useSiteData must be used inside SiteDataProvider');
  return data;
}
