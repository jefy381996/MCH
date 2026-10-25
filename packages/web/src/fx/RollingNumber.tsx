const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * A number whose digits roll like an odometer when it changes. Screen readers
 * get the plain value; the rolling strips are decoration.
 */
export function RollingNumber({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`rolling ${className}`.trim()} aria-label={value} role="text">
      {value.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="rolling-digit" aria-hidden="true">
            <span
              className="rolling-strip"
              style={{ transform: `translateY(${-Number(ch) * 10}%)` }}
            >
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} className="rolling-sep" aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
