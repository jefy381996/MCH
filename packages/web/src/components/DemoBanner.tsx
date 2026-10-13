export function DemoBanner({ label }: { label: string }) {
  return (
    <div className="banner" role="note">
      <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 2 19 18H1z" fill="var(--warning)" />
        <path d="M10 8v4.5M10 15v.5" stroke="#0b0b0b" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div>
        <strong>Demo data</strong>
        <p>
          {label}. The numbers on this page move like real metal prices but are generated for
          testing.
        </p>
      </div>
    </div>
  );
}
