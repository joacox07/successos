/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
        display: ['Sora', 'sans-serif'],
      },
      colors: {
        bg: {
          primary: 'rgb(var(--color-bg-primary) / <alpha-value>)',
          card: 'rgb(var(--color-bg-card) / var(--color-bg-card-alpha))',
          'card-hover': 'rgb(var(--color-bg-card) / var(--color-bg-card-hover-alpha))',
        },
        accent: {
          mint: 'rgb(var(--color-accent-primary) / <alpha-value>)',
          'mint-glow': 'rgb(var(--color-accent-primary) / 0.3)',
          violet: 'rgb(var(--color-accent-secondary) / <alpha-value>)',
          'violet-glow': 'rgb(var(--color-accent-secondary) / 0.3)',
          coral: 'rgb(var(--color-accent-tertiary) / <alpha-value>)',
          'coral-glow': 'rgb(var(--color-accent-tertiary) / 0.3)',
          amber: 'rgb(var(--color-accent-warm) / <alpha-value>)',
        },
        status: {
          positive: 'rgb(var(--color-positive) / <alpha-value>)',
          negative: 'rgb(var(--color-negative) / <alpha-value>)',
        },
        border: {
          primary: 'rgb(var(--color-border-primary) / var(--color-border-alpha))',
        },
        text: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-primary) / var(--color-text-secondary-alpha))',
          muted: 'rgb(var(--color-text-primary) / var(--color-text-muted-alpha))',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      animation: {
        'float': 'float 20s ease-in-out infinite',
        'float-delay': 'float 25s ease-in-out infinite 5s',
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'count-up': 'countUp 1.2s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
