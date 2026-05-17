/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium Dark Palette
        background: {
          DEFAULT: '#0a0a0f',
          primary: '#0d0d14',
          secondary: '#12121a',
          tertiary: '#1a1a24',
        },
        surface: {
          DEFAULT: 'rgba(255, 255, 255, 0.03)',
          hover: 'rgba(255, 255, 255, 0.06)',
          elevated: 'rgba(255, 255, 255, 0.08)',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          hover: 'rgba(255, 255, 255, 0.15)',
          glow: 'rgba(139, 92, 246, 0.5)',
        },
        accent: {
          purple: '#8b5cf6',
          cyan: '#06b6d4',
          pink: '#ec4899',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
        },
        glow: {
          purple: 'rgba(139, 92, 246, 0.4)',
          cyan: 'rgba(6, 182, 212, 0.4)',
          pink: 'rgba(236, 72, 153, 0.4)',
          emerald: 'rgba(16, 185, 129, 0.4)',
        },
      },
      fontFamily: {
        display: ['Clash Display', 'sans-serif'],
        sans: ['Satoshi', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.15) 50%, rgba(236, 72, 153, 0.1) 100%)',
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
          '0%, 100%': { opacity: '0.4', filter: 'blur(40px)' },
          '50%': { opacity: '0.8', filter: 'blur(60px)' },
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
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
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
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'reveal-scale': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-md': '0 0 40px rgba(139, 92, 246, 0.4)',
        'glow-lg': '0 0 80px rgba(139, 92, 246, 0.5)',
        'glow-cyan': '0 0 40px rgba(6, 182, 212, 0.4)',
        'glow-purple': '0 0 60px rgba(139, 92, 246, 0.5)',
        'inner-glow': 'inset 0 0 30px rgba(139, 92, 246, 0.1)',
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