import { ButtonLink } from '../components/ui.tsx';

export function NotFound() {
  return (
    <section className="not-found" aria-labelledby="nf-title">
      <p className="eyebrow">404</p>
      <h1 id="nf-title" tabIndex={-1}>
        This page does not exist
      </h1>
      <p className="lead">The link may be out of date, or the address mistyped.</p>
      <div className="actions">
        <ButtonLink to="/">Go to the home page</ButtonLink>
        <ButtonLink to="/live-index" variant="secondary">
          Open the live index
        </ButtonLink>
      </div>
    </section>
  );
}
