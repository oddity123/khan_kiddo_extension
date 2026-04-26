/** @type {import('tailwindcss').Config} */
export default {
  content: ["./sidepanel.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: {
          50: "#f7f9fc",
          100: "#ecf1f8",
          800: "#1f2937"
        }
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(15, 23, 42, 0.25)"
      }
    }
  },
  plugins: []
};
