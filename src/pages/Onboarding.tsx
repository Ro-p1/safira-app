import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// PENTING: Onboarding SENGAJA tidak menyimpan status "sudah dilihat" di mana pun
// (bukan di localStorage, bukan di database) — sesuai spesifikasi, halaman ini
// harus muncul ulang setiap kali aplikasi dibuka dari awal. Status ini hanya
// hidup di state komponen App, yang otomatis reset setiap kali app di-mount ulang.

const slides = [
  {
    title: "Selamat Datang di SAFIRA",
    desc: "Smart and Transparent Food Intelligent Risk Analysis. Lacak perjalanan pangan Anda dari produsen sampai ke meja makan.",
    image: "/onboarding-1-welcome.png",
  },
  {
    title: "Input Data Produsen",
    desc: "Produsen mencatat data produk — asal, tanggal panen, metode produksi, dan sertifikasi — sebagai titik awal rantai pasok yang transparan.",
    image: "/onboarding-2-produsen.png",
  },
  {
    title: "Pencatatan Distribusi",
    desc: "Setiap titik transit dicatat: suhu, kelembapan, lokasi, dan waktu — membentuk jejak yang tidak bisa diubah diam-diam (hash-chain).",
    image: "/onboarding-3-distribusi.png",
  },
  {
    title: "Analisis AI & Scan QR",
    desc: "Sistem menghitung skor risiko dari data nyata. Cukup scan QR pada kemasan untuk melihat hasilnya secara instan.",
    image: "/onboarding-4-ai.png",
  },
];

export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0);

  const isLast = index === slides.length - 1;

  function next() {
    if (isLast) {
      onFinish();
    } else {
      setIndex((i) => i + 1);
    }
  }

  const slide = slides[index];

  return (
    <div className="app-frame flex flex-col">
      <div className="gradient-header px-6 pt-6 pb-4 flex items-center justify-between text-white">
        <span className="font-heading font-bold text-lg tracking-wide flex items-center gap-2">
          <img src="/logo.png" alt="" className="w-6 h-6 object-contain" />
          SAFIRA
        </span>
        <button onClick={onFinish} className="text-sm text-white/80">
          Lewati
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <div className="w-56 h-56 mx-auto mb-8 flex items-center justify-center">
              <img src={slide.image} alt={slide.title} className="w-full h-full object-contain" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-safira-dark mb-3">
              {slide.title}
            </h1>
            <p className="text-gray-500 leading-relaxed">{slide.desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-center gap-2 mb-6">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-safira-dark" : "w-2 bg-gray-200"
            }`}
          />
        ))}
      </div>

      <div className="px-6 pb-8">
        <button
          onClick={next}
          className="gradient-btn w-full py-4 rounded-2xl text-white font-semibold shadow-lg"
        >
          {isLast ? "Mulai" : "Lanjut"}
        </button>
      </div>
    </div>
  );
}
