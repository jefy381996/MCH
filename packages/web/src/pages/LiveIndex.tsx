import { BasketTable } from '../components/BasketTable.tsx';
import { DemoBanner } from '../components/DemoBanner.tsx';
import { Hero } from '../components/Hero.tsx';
import { History } from '../components/History.tsx';
import { Methodology } from '../components/Methodology.tsx';
import { OnChain } from '../components/OnChain.tsx';
import { PageHeader } from '../components/ui.tsx';
import { useSiteData } from '../lib/site-data.tsx';

export function LiveIndex() {
  const { live, basket, oracle, connection, isDemo } = useSiteData();
  return (
    <>
      <PageHeader
        eyebrow="Live index"
        title="The MCH Index"
        lead="Gold, silver, platinum and nickel, combined into one number that started at 100 on its base date. It updates as prices move."
      />
      {isDemo && live && <DemoBanner label={live.dataSource.label} />}
      <Hero data={live} baseDate={basket?.basket.baseDate} connection={connection} />
      <div className="stack">
        <BasketTable data={live} />
      </div>
      <History live={live} basket={basket?.basket ?? null} />
      <div className="stack" id="methodology">
        <Methodology basket={basket?.basket ?? null} sourceLabel={live?.dataSource.label} />
      </div>
      <div className="stack">
        <OnChain oracle={oracle} live={live} />
      </div>
    </>
  );
}
