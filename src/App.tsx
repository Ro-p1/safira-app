import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import Onboarding from "./pages/Onboarding";
import Scan from "./pages/Scan";
import Tracking from "./pages/Tracking";
import HasilAnalisis from "./pages/HasilAnalisis";
import Riwayat from "./pages/Riwayat";
import Produsen from "./pages/Produsen";
import TambahProduk from "./pages/TambahProduk";
import DetailProdukProdusen from "./pages/DetailProdukProdusen";
import KoreksiData from "./pages/KoreksiData";
import Profil from "./pages/Profil";
import Login from "./pages/Login";

export default function App() {
  // PENTING: onboardingDone SELALU false di awal setiap kali komponen App
  // di-mount (yaitu setiap kali app dibuka/direfresh) — tidak dibaca dari
  // localStorage atau database mana pun, sesuai spesifikasi.
  const [onboardingDone, setOnboardingDone] = useState(false);

  return (
    <AuthProvider>
      <BrowserRouter>
        {!onboardingDone ? (
          <Onboarding onFinish={() => setOnboardingDone(true)} />
        ) : (
          <Routes>
            <Route path="/scan" element={<Scan />} />
            <Route path="/scan/:qrCodeValue" element={<Scan />} />
            <Route path="/tracking/:productId" element={<Tracking />} />
            <Route path="/hasil/:productId" element={<HasilAnalisis />} />
            <Route path="/riwayat" element={<Riwayat />} />
            <Route path="/produsen" element={<Produsen />} />
            <Route path="/produsen/tambah" element={<TambahProduk />} />
            <Route path="/produsen/produk/:productId" element={<DetailProdukProdusen />} />
            <Route path="/produsen/koreksi/:productId" element={<KoreksiData />} />
            <Route path="/profil" element={<Profil />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/scan" replace />} />
          </Routes>
        )}
      </BrowserRouter>
    </AuthProvider>
  );
}
