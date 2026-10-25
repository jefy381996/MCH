const EDGE_LAYERS = 12;

/** A slowly turning MCH coin, drawn in CSS 3D with a real edge. Decorative. */
export function Coin() {
  return (
    <div className="coin-stage" aria-hidden="true">
      <div className="coin">
        {Array.from({ length: EDGE_LAYERS }, (_, i) => (
          <div
            key={i}
            className="coin-edge"
            style={{ transform: `translateZ(${i - EDGE_LAYERS / 2}px)` }}
          />
        ))}
        <div
          className="coin-face coin-front"
          style={{ transform: `translateZ(${EDGE_LAYERS / 2}px)` }}
        >
          <span className="coin-ring" />
          <span className="coin-mark">MCH</span>
          <span className="coin-sub">METAL CHAIN</span>
        </div>
        <div
          className="coin-face coin-back"
          style={{ transform: `rotateY(180deg) translateZ(${EDGE_LAYERS / 2}px)` }}
        >
          <span className="coin-ring" />
          <span className="coin-mark">₳</span>
          <span className="coin-sub">ON CARDANO</span>
        </div>
      </div>
      <div className="coin-shadow" />
    </div>
  );
}
