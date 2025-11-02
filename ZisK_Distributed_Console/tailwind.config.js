/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary': '#B4B4B8',
        'primary-light': '#C7C8CC',
        'neutral': '#E3E1D9',
        'neutral-light': '#F2EFE5',
        'accent': '#007755',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
    },
  },
  plugins: [],
};
