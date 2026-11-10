/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.tsx"
  ],
  theme: {
    extend: {
      colors: {
        giftflip: {
          background: "#090b12",
          surface: "#151722",
          purple: "#8b5cf6",
          accent: "#a78bfa"
        }
      }
    }
  },
  plugins: []
};
