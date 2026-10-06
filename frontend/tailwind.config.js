/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        security: {
          50: '#f5f9ff',
          200: '#a5b4fc',
          500: '#4f46e5',
          700: '#1f3a5f',
          900: '#081827',
        },
      },
      boxShadow: {
        soft: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
      },
    },
  },
  plugins: [],
}
