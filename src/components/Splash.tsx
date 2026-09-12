import { motion } from "framer-motion";

// Splash screen — 1 gambar utuh (background + ikon + tulisan SITARA
// sudah jadi satu file), tampil sesaat tiap kali aplikasi dibuka,
// sebelum masuk ke Onboarding. Gak perlu susun ikon+teks manual lagi
// di sini; kalau nanti mau ganti tampilan splash, cukup ganti file
// /splash-full.png saja.
export default function Splash() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="app-frame fixed inset-0 z-50"
    >
      <motion.img
        src="/splash-full.png"
        alt="SITARA"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full h-full object-cover"
      />
    </motion.div>
  );
}
