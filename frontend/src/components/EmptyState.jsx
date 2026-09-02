import React from 'react';

/**
 * EmptyState — Placeholder when no data exists
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Icon element (lucide-react recommended)
 * @param {string} props.title - Heading text
 * @param {string} props.description - Supporting text
 * @param {React.ReactNode} props.action - Action button element
 * @param {string} props.className
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        </div>
      )}

      {title && (
        <h3 className="font-heading font-semibold text-h3 text-foreground mb-1">
          {title}
        </h3>
      )}

      {description && (
        <p className="text-body-sm text-muted-foreground max-w-sm mb-6">
          {description}
        </p>
      )}

      {action && <div>{action}</div>}
    </div>
  );
}

export default EmptyState;
