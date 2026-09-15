/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        safira: {
          dark: "#0F5D52",
          deep: "#1E8C7A",
          moss: "#D4E85C",
          mosslight: "#9FE8C8",
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
