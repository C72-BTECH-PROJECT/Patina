import React from 'react';

/**
 * Card — Surface container
 *
 * @param {Object} props
 * @param {'default' | 'hover' | 'interactive'} props.variant
 * @param {boolean} props.noPadding - Remove default padding
 * @param {React.ReactNode} props.children
 * @param {string} props.className
 */
function Card({
  variant = 'default',
  noPadding = false,
  children,
  className = '',
  ...props
}) {
  const base = [
    'bg-card text-card-foreground',
    'border border-border',
    'rounded-lg',
  ].join(' ');

  const variants = {
    default: 'shadow-card',
    hover: 'shadow-card transition-shadow duration-200 hover:shadow-card-hover',
    interactive: 'shadow-card transition-all duration-200 hover:shadow-card-hover cursor-pointer hover:border-primary/20',
  };

  const padding = noPadding ? '' : 'p-6';

  const classes = [
    base,
    variants[variant],
    padding,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

/**
 * Card.Header — Section header inside card
 */
Card.Header = function CardHeader({ children, className = '' }) {
  return (
    <div className={`flex items-center justify-between pb-4 border-b border-border ${className}`}>
      {children}
    </div>
  );
};

/**
 * Card.Title — Heading inside card
 */
Card.Title = function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`font-heading font-semibold text-h3 text-foreground ${className}`}>
      {children}
    </h3>
  );
};

/**
 * Card.Description — Supporting text inside card
 */
Card.Description = function CardDescription({ children, className = '' }) {
  return (
    <p className={`text-body-sm text-muted-foreground ${className}`}>
      {children}
    </p>
  );
};

/**
 * Card.Content — Main content area
 */
Card.Content = function CardContent({ children, className = '' }) {
  return (
    <div className={`pt-4 ${className}`}>
      {children}
    </div>
  );
};

/**
 * Card.Footer — Bottom section inside card
 */
Card.Footer = function CardFooter({ children, className = '' }) {
  return (
    <div className={`flex items-center pt-4 border-t border-border ${className}`}>
      {children}
    </div>
  );
};

export default Card;
