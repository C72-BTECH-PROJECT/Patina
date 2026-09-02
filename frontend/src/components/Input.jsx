import React from 'react';

const safeLabel = (label) =>
  typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : Math.random().toString(36).slice(2);

/**
 * Input — Form input with label and error
 *
 * @param {Object} props
 * @param {string} props.label - Visible label text
 * @param {string} props.error - Error message (shows below input)
 * @param {string} props.helperText - Helper text (shows below input)
 * @param {boolean} props.required - Mark field as required
 * @param {string} props.id - Input id (auto-generated if not provided)
 * @param {string} props.className
 */
function Input({
  label,
  error,
  helperText,
  required,
  id,
  className = '',
  ...props
}) {
  const inputId = id || `input-${safeLabel(label)}`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-body-sm font-medium text-foreground"
        >
          {label}
          {required && (
            <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
          )}
        </label>
      )}

      <input
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        aria-required={required || undefined}
        className={[
          'flex h-10 w-full rounded-md',
          'border bg-background px-3 py-2',
          'text-body-sm text-foreground',
          'placeholder:text-muted-foreground',
          'transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-destructive focus-visible:ring-destructive/20'
            : 'border-input',
        ].join(' ')}
        {...props}
      />

      {error && (
        <p
          id={`${inputId}-error`}
          className="text-caption text-destructive flex items-center gap-1"
          role="alert"
        >
          <svg
            className="w-3 h-3 flex-shrink-0"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 3.5V6.5M6 8V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      )}

      {!error && helperText && (
        <p
          id={`${inputId}-helper`}
          className="text-caption text-muted-foreground"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

/**
 * Input.Textarea — Multi-line input
 */
Input.Textarea = function InputTextarea({
  label,
  error,
  helperText,
  required,
  id,
  rows = 4,
  className = '',
  ...props
}) {
  const textareaId = id || `textarea-${safeLabel(label)}`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-body-sm font-medium text-foreground"
        >
          {label}
          {required && (
            <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
          )}
        </label>
      )}

      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
        aria-required={required || undefined}
        className={[
          'flex w-full rounded-md',
          'border bg-background px-3 py-2',
          'text-body-sm text-foreground',
          'placeholder:text-muted-foreground',
          'transition-colors duration-200',
          'resize-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-destructive focus-visible:ring-destructive/20'
            : 'border-input',
        ].join(' ')}
        {...props}
      />

      {error && (
        <p
          id={`${textareaId}-error`}
          className="text-caption text-destructive flex items-center gap-1"
          role="alert"
        >
          <svg
            className="w-3 h-3 flex-shrink-0"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 3.5V6.5M6 8V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      )}

      {!error && helperText && (
        <p
          id={`${textareaId}-helper`}
          className="text-caption text-muted-foreground"
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

/**
 * Input.Select — Dropdown select
 */
Input.Select = function InputSelect({
  label,
  error,
  helperText,
  required,
  id,
  children,
  className = '',
  ...props
}) {
  const selectId = id || `select-${safeLabel(label)}`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-body-sm font-medium text-foreground"
        >
          {label}
          {required && (
            <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
          )}
        </label>
      )}

      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          aria-required={required || undefined}
          className={[
            'flex h-10 w-full rounded-md',
            'border bg-background px-3 py-2 pr-8',
            'text-body-sm text-foreground',
            'appearance-none cursor-pointer',
            'transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-destructive focus-visible:ring-destructive/20'
              : 'border-input',
          ].join(' ')}
          {...props}
        >
          {children}
        </select>

        {/* Chevron icon */}
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {error && (
        <p
          id={`${selectId}-error`}
          className="text-caption text-destructive flex items-center gap-1"
          role="alert"
        >
          <svg
            className="w-3 h-3 flex-shrink-0"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 3.5V6.5M6 8V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      )}

      {!error && helperText && (
        <p
          id={`${selectId}-helper`}
          className="text-caption text-muted-foreground"
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

export default Input;
