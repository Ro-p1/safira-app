/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        safira: {
          dark: "#0C2F3D",
          deep: "#14495A",
          moss: "#6FA83A",
          mosslight: "#D4E85C",
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
