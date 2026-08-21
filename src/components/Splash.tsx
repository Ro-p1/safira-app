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
        src="/logo-mark.png"
        alt="SAFIRA"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-24 h-auto object-contain"
      />
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="mt-5 font-heading font-bold text-lg tracking-wide text-white"
      >
        SAFIRA
      </motion.p>
    </motion.div>
  );
}
