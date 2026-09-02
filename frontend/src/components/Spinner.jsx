import React from 'react';

/**
 * Spinner — Loading indicator
 *
 * @param {Object} props
 * @param {'xs' | 'sm' | 'md' | 'lg'} props.size
 * @param {string} props.color - Override color (default: current text color)
 * @param {string} props.className
 */
function Spinner({
  size = 'md',
  color,
  className = '',
  ...props
}) {
  const sizes = {
    xs: 'w-3 h-3 border',
    sm: 'w-4 h-4 border',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-2',
  };

  return (
    <div
      className={`${sizes[size]} rounded-full border-current border-t-transparent animate-spin ${className}`}
      style={color ? { color } : undefined}
      role="status"
      aria-label="Loading"
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * Spinner.Page — Full page loading state
 */
Spinner.Page = function SpinnerPage({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Spinner size="lg" />
      <p className="text-body-sm text-muted-foreground">{message}</p>
    </div>
  );
};

/**
 * Spinner.Button — Inline button loading state
 */
Spinner.Button = function SpinnerButton({ size = 'sm' }) {
  return <Spinner size={size} className="text-current" />;
};

export default Spinner;
