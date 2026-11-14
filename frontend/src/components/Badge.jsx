import React from 'react';

/**
 * Badge — Status indicator / label
 *
 * @param {Object} props
 * @param {'default' | 'outline' | 'primary' | 'success' | 'warning' | 'destructive'
 *   | 'evidenced' | 'claimed' | 'notfound' | 'unverified' | 'partly' | 'verified'} props.variant
 * @param {'sm' | 'md'} props.size
 * @param {React.ElementType} [props.icon] - lucide component, rendered first (decorative)
 * @param {React.ReactNode} props.children
 * @param {string} props.className
 */
function Badge({
  variant = 'default',
  size = 'sm',
  icon: Icon,
  children,
  className = '',
  ...props
}) {
  // Design spec §6.4.
  const base = [
    'inline-flex items-center gap-[5px]',
    'rounded-full border font-medium',
    'whitespace-nowrap',
  ].join(' ');

  const variants = {
    default: 'bg-muted text-foreground border-transparent',
    outline: 'bg-surface text-foreground border-border',
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning-text border-warning/30',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    evidenced: 'chip-evidenced',
    claimed: 'chip-claimed',
    notfound: 'chip-notfound',
    unverified: 'chip-unverified',
    partly: 'chip-partly',
    verified: 'chip-verified',
  };

  const sizes = {
    sm: 'h-[22px] px-2 text-caption',
    md: 'h-7 px-3 text-body-sm',
  };

  const classes = [
    base,
    variants[variant],
    sizes[size],
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
      {Icon && <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * Badge.Dot — Colored dot indicator
 */
Badge.Dot = function BadgeDot({ color = 'currentColor', className = '' }) {
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
};

/**
 * Badge.Verified — Pre-styled verified badge with checkmark
 */
Badge.Verified = function BadgeVerified({ className = '' }) {
  return (
    <Badge variant="success" className={className}>
      <svg
        className="w-3 h-3 shrink-0"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M10 3L4.5 8.5L2 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Verified
    </Badge>
  );
};

/**
 * Badge.Pending — Pre-styled pending badge with spinner
 */
Badge.Pending = function BadgePending({ className = '' }) {
  return (
    <Badge variant="warning" className={className}>
      <svg
        className="w-3 h-3 shrink-0 animate-spin"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx="6"
          cy="6"
          r="4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path
          d="M6 1.5A4.5 4.5 0 0110.5 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      Pending
    </Badge>
  );
};

/**
 * Badge.Failed — Pre-styled failed badge with X
 */
Badge.Failed = function BadgeFailed({ className = '' }) {
  return (
    <Badge variant="destructive" className={className}>
      <svg
        className="w-3 h-3 shrink-0"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M9 3L3 9M3 3L9 9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Failed
    </Badge>
  );
};

export default Badge;
