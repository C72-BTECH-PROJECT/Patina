import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button — Core interactive element
 *
 * @param {Object} props
 * @param {'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'} props.variant
 * @param {'sm' | 'md' | 'lg'} props.size
 * @param {boolean} props.loading - Show spinner, disable interaction
 * @param {boolean} props.disabled - Disable without spinner
 * @param {boolean} props.fullWidth - Full width button
 * @param {React.ReactNode} props.children
 * @param {string} props.className
 */
function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  children,
  className = '',
  ...props
}) {
  const base = [
    'inline-flex items-center justify-center gap-2',
    'font-medium rounded-md',
    'transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'cursor-pointer select-none',
  ].join(' ');

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 shadow-xs hover:shadow-card',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
    // The `accent` colour has sub-keys only in tailwind.config.js (no DEFAULT), so the
    // bare accent hover classes generated no CSS; `muted` is the hover surface the
    // other controls use.
    outline: 'border border-input bg-background hover:bg-muted hover:text-foreground active:bg-muted/80',
    ghost: 'hover:bg-muted hover:text-foreground active:bg-muted/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/95',
  };

  const sizes = {
    sm: 'h-8 px-3 text-caption',
    md: 'h-10 px-4 text-body-sm',
    lg: 'h-12 px-6 text-body',
  };

  const classes = [
    base,
    variants[variant],
    sizes[size],
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export default Button;
