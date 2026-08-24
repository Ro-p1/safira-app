import { motion } from "framer-motion";

// Splash screen yang tampil sesaat setiap kali aplikasi dibuka (mis. saat
// ikon SAFIRA di-tap dari layar utama HP), sebelum masuk ke Onboarding.
// Tampilannya sengaja dibuat identik dengan ikon aplikasi: logo SAFIRA
// (pin lokasi berbentuk huruf "S") di atas latar hijau tua polos.
export default function Splash() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="app-frame fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: "#183321" }}
    >
      <motion.img
        src="/logo-full.png"
        alt="SAFIRA"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-32 h-auto object-contain"
      />
    </motion.div>
  );
}
