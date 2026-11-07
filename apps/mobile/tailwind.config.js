const { loadTokens } = require('./theme/load-tokens.cjs');
const { colors } = loadTokens();

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      borderRadius: {
        cell: '2px',
        input: '4px',
        btn: '4px',
        sheet: '16px',
        avatar: '9999px',
      },
      fontFamily: {
        display: ['ArchivoNarrow_600SemiBold', 'sans-serif'],
        'display-bold': ['ArchivoNarrow_700Bold', 'sans-serif'],
        text: ['PublicSans_400Regular', 'sans-serif'],
        'text-medium': ['PublicSans_500Medium', 'sans-serif'],
        'text-semibold': ['PublicSans_600SemiBold', 'sans-serif'],
      },
      spacing: {
        'touch-target': '48px',
        'row-min': '56px',
        'btn-h': '52px',
      },
    },
  },
  plugins: [],
};
