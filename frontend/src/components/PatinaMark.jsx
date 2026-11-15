// The layered-L mark (Docs/design-refs/brand/patina-mark.svg). The tile follows
// --primary and the square --verdigris, so the mark follows the palette.
export default function PatinaMark({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`shrink-0 ${className}`}
         aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="hsl(var(--primary))" />
      <g fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round">
        <path d="M7.80 9.80V24.30H22.20" />
        <path d="M13.00 8.00V19.20H24.00" />
        <path d="M18.00 6.20V14.20H25.80" />
      </g>
      <rect x="21.4" y="6.20" width="4.4" height="4.4" rx="0.6" fill="hsl(var(--verdigris))" />
    </svg>
  );
}
