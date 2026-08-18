/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        safira: {
          dark: "#1F3D2E",
          deep: "#2E5339",
          moss: "#6B8F5C",
          mosslight: "#8FAE7A",
          gold: "#D4AF37",
          goldlight: "#E8B923",
        },
      },
      fontFamily: {
        heading: ["Baloo 2", "Fredoka", "sans-serif"],
        body: ["Poppins", "Inter", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
