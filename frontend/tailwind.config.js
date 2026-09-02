/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#ffffff',
          primary: '#fafafa',
          secondary: '#f5f5f5',
          tertiary: '#e5e5e5',
        },
        foreground: {
          DEFAULT: '#0a0a0a',
          muted: '#737373',
        },
        surface: {
          DEFAULT: '#ffffff',
          hover: '#fafafa',
          elevated: '#f5f5f5',
        },
        border: {
          DEFAULT: '#e5e5e5',
          hover: '#d4d4d4',
          glow: '#0a0a0a',
        },
        accent: {
          purple: '#0a0a0a',
          cyan: '#0a0a0a',
          pink: '#0a0a0a',
          emerald: '#22c55e',
          amber: '#f59e0b',
          rose: '#ef4444',
        },
        glow: {
          purple: 'rgba(10, 10, 10, 0.1)',
          cyan: 'rgba(10, 10, 10, 0.1)',
          pink: 'rgba(10, 10, 10, 0.1)',
          emerald: 'rgba(34, 197, 94, 0.1)',
        },
        primary: {
          DEFAULT: '#0a0a0a',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: '#f5f5f5',
          foreground: '#737373',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        success: {
          DEFAULT: '#22c55e',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: '#f59e0b',
          foreground: '#ffffff',
        },
        ring: '#0a0a0a',
        input: '#e5e5e5',
        secondary: {
          DEFAULT: '#f5f5f5',
          foreground: '#0a0a0a',
        },
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        heading: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': 'linear-gradient(135deg, rgba(10, 10, 10, 0.05) 0%, rgba(10, 10, 10, 0.05) 50%, rgba(10, 10, 10, 0.05) 100%)',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'scan': 'scan 2s linear infinite',
        'rotate-slow': 'rotate-slow 20s linear infinite',
        'particle-drift': 'particle-drift 15s linear infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'border-rotate': 'border-rotate 4s linear infinite',
        'counter': 'counter 2s ease-out forwards',
        'reveal-up': 'reveal-up 0.6s ease-out forwards',
        'reveal-scale': 'reveal-scale 0.4s ease-out forwards',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.1', filter: 'blur(40px)' },
          '50%': { opacity: '0.2', filter: 'blur(60px)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'rotate-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'particle-drift': {
          '0%': { transform: 'translate(0, 0) scale(1)', opacity: '0' },
          '10%': { opacity: '0.05' },
          '90%': { opacity: '0.05' },
          '100%': { transform: 'translate(100px, -200px) scale(0)', opacity: '0' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'border-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'counter': {
          '0%': { '--num': '0' },
          '100%': { '--num': 'var(--target)' },
        },
        'reveal-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'reveal-scale': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'glow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        'glow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        'glow-cyan': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        'glow-purple': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        'inner-glow': 'inset 0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
