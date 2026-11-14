/** @type {import('tailwindcss').Config} */

// R-14: the semantic colours read the CSS variables defined once in
// src/index.css, so Tailwind classes and SVG/chart attributes share one value.
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        surface: token('surface'),
        track: token('track'),
        border: {
          DEFAULT: token('border'),
          hover: '#d4d4d4',
        },
        primary: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground'),
          hover: token('primary-hover'),
          soft: token('primary-soft'),
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground'),
        },
        destructive: {
          DEFAULT: token('destructive'),
          foreground: token('destructive-foreground'),
        },
        success: {
          DEFAULT: token('success'),
          foreground: token('success-foreground'),
        },
        warning: {
          DEFAULT: token('warning'),
          foreground: token('warning-foreground'),
          // `text-warning-text`: amber text on light backgrounds (index.css --warning-text).
          text: token('warning-text'),
        },
        ring: token('ring'),
        input: token('input'),
        secondary: {
          DEFAULT: token('secondary'),
          foreground: token('secondary-foreground'),
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'xs': '0 1px 2px rgb(22 27 33 / .06)',
        'card': '0 1px 2px rgb(22 27 33 / .05), 0 4px 12px -4px rgb(22 27 33 / .08)',
        'pop': '0 12px 32px -8px rgb(22 27 33 / .18), 0 2px 6px rgb(22 27 33 / .06)',
        'focus': '0 0 0 3px rgb(31 61 88 / .28)',
      },
      transitionDuration: {
        press: '100ms',
        fast: '150ms',
        base: '220ms',
        slow: '400ms',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(.2,.7,.2,1)',
        emph: 'cubic-bezier(.16,1,.3,1)',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '16px',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
