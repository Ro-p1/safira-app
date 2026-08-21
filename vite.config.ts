import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "logo-192.png", "logo-512.png", "logo-mark.png"],
      manifest: {
        name: "SAFIRA - Smart and Transparent Food Intelligent Risk Analysis",
        short_name: "SAFIRA",
        description: "Aplikasi keamanan pangan berbasis Blockchain + AI",
        theme_color: "#183321",
        // Sama dengan warna latar logo, supaya splash screen native yang
        // di-generate otomatis oleh Android/Chrome saat ikon SAFIRA di-tap
        // dari layar utama menyatu mulus dengan ikonnya (tidak ada "kotak").
        background_color: "#183321",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "logo-192.png", sizes: "192x192", type: "image/png" },
          { src: "logo-512.png", sizes: "512x512", type: "image/png" },
          { src: "logo-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
