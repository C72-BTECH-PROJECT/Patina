export default function PatinaMark({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`shrink-0 ${className}`}
         aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="hsl(var(--primary))" />
      <rect x="3" y="3" width="26" height="26" rx="5.5" fill="none" stroke="#FFFFFF" strokeOpacity=".35" strokeWidth="1" strokeDasharray="2.2 1.8" />
      <path d="M11 9.4V22.8" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
      <g fill="none" strokeWidth="2.6" strokeLinecap="round">
        <path d="M19.43 9.00A5.2 5.2 0 0 1 23.05 15.26" stroke="#FFFFFF" />
        <path d="M21.61 17.74A5.2 5.2 0 0 1 14.39 17.74" stroke="#FFFFFF" />
        <path d="M12.95 15.26A5.2 5.2 0 0 1 16.57 9.00" stroke="#5FC4B0" />
      </g>
    </svg>
  );
}
