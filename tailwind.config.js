/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        'arabic': ['Noto Sans Arabic', 'Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [
    // RTL support plugin
    function({ addUtilities }) {
      const newUtilities = {
        '.rtl\\:text-right': {
          '[dir="rtl"] &': {
            'text-align': 'right',
          },
        },
        '.rtl\\:text-left': {
          '[dir="rtl"] &': {
            'text-align': 'left',
          },
        },
        '.rtl\\:flex-row-reverse': {
          '[dir="rtl"] &': {
            'flex-direction': 'row-reverse',
          },
        },
        '.rtl\\:ml-auto': {
          '[dir="rtl"] &': {
            'margin-left': 'auto',
          },
        },
        '.rtl\\:mr-auto': {
          '[dir="rtl"] &': {
            'margin-right': 'auto',
          },
        },
        '.rtl\\:left-auto': {
          '[dir="rtl"] &': {
            'left': 'auto',
          },
        },
        '.rtl\\:right-0': {
          '[dir="rtl"] &': {
            'right': '0',
          },
        },
      };
      addUtilities(newUtilities, ['responsive']);
    },
  ],
};
