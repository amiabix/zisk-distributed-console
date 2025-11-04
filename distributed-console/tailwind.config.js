/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'display': ['IBM Plex Sans', 'Inter', 'system-ui', 'sans-serif'],
        'mono': ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Primary Green - Semantic token system
        'primary': {
          50: '#f0fdf4',
          100: '#bbf7d0',
          200: '#86efac',
          300: '#4ade80',
          400: '#0ABF83',
          500: '#007755',  // Main brand green (Victorian Peak)
          600: '#1da767',
          700: '#18875a',
          800: '#136b3d',
          900: '#0f4a31',
          950: '#0a2e1f',
          DEFAULT: '#007755',
          light: '#0ABF83',
          lighter: '#A4F6D0',
          lightest: '#EBFEF5',
          bright: '#00ff7c', // Spring Green (for dark backgrounds) - bright variant
          dark: '#00ff7c', // Legacy alias - use primary-500 instead
        },
        // Secondary Yellow - Semantic token system
        'accent': {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fef08a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f4ff00',  // Main brand yellow (Busy Bee)
          600: '#f59e0b',
          700: '#d97706',
          800: '#b45309',
          900: '#92400e',
          950: '#713f12',
          DEFAULT: '#f4ff00',
        },
        // Semantic colors
        'error': {
          100: '#fee2e2',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
        },
        'success': {
          100: '#d1fae5',
          300: '#a7f3d0',
          400: '#6ee7b7',
          500: '#10b981',
        },
        'warning': {
          100: '#fef3c7',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
        },
        'info': {
          100: '#dbeafe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
        },
        // Gray Scale - Dark theme optimized
        'gray': {
          50: '#F3F3F2',
          100: '#E7E7E3',
          200: '#B8B8B4',
          300: '#8E8E8A',
          400: '#606060',
          500: '#363636',
          600: '#2D2E3D',
          700: '#1A1A24',
          800: '#0C0C0C',
          900: '#0C0C0C',
        },
        // Neutral - Legacy support
        'neutral': {
          DEFAULT: '#E7E7E3',
          light: '#F3F3F2',
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
      },
      spacing: {
        'xs': '0.25rem',   // 4px
        'sm': '0.5rem',    // 8px
        'md': '1rem',      // 16px
        'lg': '1.5rem',    // 24px
        'xl': '2rem',      // 32px
        '2xl': '3rem',     // 48px
        '3xl': '4rem',     // 64px
      },
      borderRadius: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        'button': '12px',
        'input': '4px',
        'card': '16px',
        'modal': '24px',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backdropBlur: {
        'xs': '2px',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '300ms',
        'slow': '500ms',
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0, 119, 85, 0.5), 0 0 40px rgba(0, 119, 85, 0.25)',
        'glow-yellow': '0 0 20px rgba(244, 255, 0, 0.5), 0 0 40px rgba(244, 255, 0, 0.25)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.25)',
      },
      zIndex: {
        'dropdown': '10',
        'sticky': '20',
        'fixed': '30',
        'backdrop': '40',
        'modal': '50',
        'tooltip': '60',
        'notification': '70',
      },
    },
  },
  plugins: [],
};
