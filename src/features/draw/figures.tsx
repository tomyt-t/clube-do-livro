/**
 * The bar's cast, drawn like the club's illustrations: flat colors and a
 * dark outline. Decorative; the dialog says in words what happens.
 */

const INK = '#1d1d20';

export function DuckFigure({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 52 38" className={className} aria-hidden="true">
      <path
        d="M9 20q-7-1-8-9 7 1 11 5"
        fill="#e2ad22"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <ellipse cx="23" cy="24" rx="17" ry="10" fill="#f3cf6b" stroke={INK} strokeWidth="2" />
      <path d="M15 22q8 6 15 0" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="38" cy="12" r="7.5" fill="#f3cf6b" stroke={INK} strokeWidth="2" />
      <path
        d="M44.5 11l7 2.2-7 2.8z"
        fill="#e2532d"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="40" cy="10.5" r="1.5" fill={INK} />
      <path
        d="M18 33.5l-3.5 3.5h7zM29 33.5l-3.5 3.5h7z"
        fill="#e2532d"
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A round wrestler seen from the side; `facing` is the side it pushes toward. */
export function WrestlerFigure({
  facing,
  className,
}: {
  facing: 'left' | 'right';
  className?: string;
}) {
  // Mirrored inside the drawing, so a CSS animation on the svg cannot undo it.
  const mirror = facing === 'left' ? 'translate(60 0) scale(-1 1)' : undefined;
  return (
    <svg viewBox="0 0 60 64" className={className} aria-hidden="true">
      <g transform={mirror}>
        <circle cx="28" cy="34" r="22" fill="#f3b0c0" stroke={INK} strokeWidth="2.2" />
        <path d="M8 40h40v8H8z" fill="#233a72" stroke={INK} strokeWidth="2" />
        <circle cx="40" cy="12" r="9" fill="#f3b0c0" stroke={INK} strokeWidth="2.2" />
        <path d="M33 5q7-5 14 0" fill={INK} />
        <circle cx="44" cy="11" r="1.4" fill={INK} />
        <path d="M46 30q12 2 12 8" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <path d="M20 56l-2 7M36 56l2 7" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** The ring of packed clay with its straw edge, seen from above. */
export function RingFigure({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="49" fill="#e4c8a6" />
      <circle
        cx="50"
        cy="50"
        r="41"
        fill="none"
        stroke="#c8951b"
        strokeWidth="4"
        strokeDasharray="3 1.4"
      />
      <path d="M44 45v10M56 45v10" stroke="#fbf6e8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
