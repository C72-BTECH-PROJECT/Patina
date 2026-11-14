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
    'inline-flex items-center justify-center gap-2 rounded-md font-medium',
    'transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[.98]',
    'focus-visible:outline-none focus-visible:shadow-focus',
    'disabled:opacity-50 disabled:pointer-events-none',
  ].join(' ');

  // Design spec §6.1; the .btn classes in index.css must look the same.
  const variants = {
    primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-border',
    outline: 'border border-border bg-surface text-foreground hover:bg-muted',
    ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
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
