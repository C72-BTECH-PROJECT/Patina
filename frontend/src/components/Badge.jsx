import React from 'react';

/**
 * Badge — Status indicator / label
 *
 * @param {Object} props
 * @param {'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline'} props.variant
 * @param {'sm' | 'md'} props.size
 * @param {React.ReactNode} props.children
 * @param {string} props.className
 */
function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className = '',
  ...props
}) {
  const base = [
    'inline-flex items-center',
    'font-medium rounded-full',
    'whitespace-nowrap',
  ].join(' ');

  const variants = {
    default: 'bg-secondary text-secondary-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
    outline: 'border border-border text-foreground',
  };

  const sizes = {
    sm: 'px-2.5 py-0.5 text-caption',
    md: 'px-3 py-1 text-body-sm',
  };

  const classes = [
    base,
    variants[variant],
    sizes[size],
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
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
        className="w-3 h-3 mr-1"
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
        className="w-3 h-3 mr-1 animate-spin"
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
        className="w-3 h-3 mr-1"
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
