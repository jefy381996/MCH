import { ButtonLink, PageHeader } from '../components/ui.tsx';
import { milestones, STATUS_LABEL } from '../lib/roadmap.ts';
import { useSiteData } from '../lib/site-data.tsx';

export function Roadmap() {
  const { oracle } = useSiteData();
  const items = milestones({
    coinExists: Boolean(oracle?.token),
    oracleLive: Boolean(oracle?.oracleDeployed),
  });
  const done = items.filter((m) => m.status === 'done').length;
  return (
    <>
      <PageHeader
        eyebrow="Roadmap"
        title="Built carefully, launched properly"
        lead="The technology behind MCH is built and tested. What remains is licensed data, independent checks and a launch that follows UK rules."
      >
        <div className="progress" aria-label={`${done} of ${items.length} milestones complete`}>
          <div className="progress-bar">
            <span style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
          <span>
            {done} of {items.length} milestones complete
          </span>
        </div>
      </PageHeader>

      <ol className="timeline">
        {items.map((m, i) => (
          <li key={m.title} className="timeline-item" data-status={m.status}>
            <span className="timeline-marker" aria-hidden="true">
              {m.status === 'done' ? (
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <path
                    d="m3 7.5 2.5 2.5L11 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <div className="timeline-body">
              <div className="timeline-head">
                <h2>{m.title}</h2>
                <span className="chip" data-status={m.status}>
                  {STATUS_LABEL[m.status]}
                </span>
              </div>
              <p>{m.summary}</p>
              <ul>
                {m.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      <section className="cta-band" aria-labelledby="roadmap-cta">
        <h2 id="roadmap-cta">Follow the index while the work continues</h2>
        <p>The MCH Index is running now, on clearly labelled demonstration prices.</p>
        <div className="actions">
          <ButtonLink to="/live-index">Open the live index</ButtonLink>
          <ButtonLink to="/how-it-works" variant="secondary">
            How it works
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
