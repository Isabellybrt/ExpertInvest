/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        // Mobile First: default styles apply to mobile (<768px, single column)
        // Tablet/Desktop: ≥768px
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      colors: {
        // Semantic colors for investment indicators
        gain: {
          DEFAULT: '#16a34a', // green-600 - valorização
        },
        loss: {
          DEFAULT: '#dc2626', // red-600 - desvalorização
        },
      },
      fontSize: {
        // Ensure minimum 16px on mobile for legibility (Req 12.4)
        base: ['1rem', { lineHeight: '1.5rem' }],
      },
      minWidth: {
        touch: '44px', // Minimum touch target (Req 12.3)
      },
      minHeight: {
        touch: '44px', // Minimum touch target (Req 12.3)
      },
    },
  },
  plugins: [],
};
