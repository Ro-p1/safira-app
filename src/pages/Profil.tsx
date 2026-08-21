import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, ShieldCheck, Smartphone, BookOpen, Bell, Trash2, Heart, HeartPulse, Factory, Recycle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { clearGuestHistory } from "../lib/guestHistory";
import BottomNav from "../components/BottomNav";

const NOTIF_KEY = "safira_notif_enabled";

export default function Profil() {
  const { user, producer, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, aman: 0, waspada: 0, beresiko: 0 });
  const [notifEnabled, setNotifEnabled] = useState(localStorage.getItem(NOTIF_KEY) !== "false");

  useEffect(() => {
    if (user) loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadStats() {
    const { data } = await supabase
      .from("scan_history")
      .select("product_id")
      .eq("user_id", user!.id);

    let aman = 0,
      waspada = 0,
      beresiko = 0;

    for (const row of data ?? []) {
      const { data: score } = await supabase
        .from("risk_scores")
        .select("status")
        .eq("product_id", row.product_id)
        .order("dihitung_pada", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (score?.status === "AMAN") aman++;
      else if (score?.status === "WASPADA") waspada++;
      else if (score?.status === "BERESIKO") beresiko++;
    }

    setStats({ total: data?.length ?? 0, aman, waspada, beresiko });
  }

  function toggleNotif() {
    const next = !notifEnabled;
    setNotifEnabled(next);
    localStorage.setItem(NOTIF_KEY, String(next));
  }

  async function handleClearHistory() {
    if (!confirm("Hapus semua riwayat scan? Tindakan ini tidak bisa dibatalkan.")) return;
    if (user) {
      await supabase.from("scan_history").delete().eq("user_id", user.id);
      loadStats();
    } else {
      clearGuestHistory();
      window.location.reload();
    }
  }

  return (
    <div className="app-frame pb-24">
      <div className="gradient-header px-6 pt-6 pb-4 text-white">
        <h1 className="font-heading text-lg font-bold flex items-center gap-2">
          <img src="/logo-mark.png" alt="" className="w-6 h-6 object-contain" />
          Profil
        </h1>
        {user && <p className="text-sm text-white/80">{user.email}</p>}
      </div>

      <div className="px-6 py-6 space-y-4">
        {user ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
            <p className="font-medium text-safira-dark">{user.email}</p>
            <p className="text-xs text-gray-400 mb-3">Akun terverifikasi</p>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-2xl py-3 text-sm text-gray-600"
            >
              <LogOut size={16} /> Keluar
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="gradient-btn w-full py-4 rounded-2xl text-white font-semibold shadow-lg"
          >
            Login / Daftar Akun
          </button>
        )}

        {producer?.status_verifikasi === "approved" && (
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-safira-dark font-heading font-semibold">
              <Factory size={16} /> Status Produsen
            </div>
            <p className="font-medium text-safira-dark">{producer.nama}</p>
            <p className="text-sm text-gray-500">{producer.lokasi}</p>
            <p className="text-sm text-gray-500">{producer.kontak}</p>
            <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
              Terverifikasi
            </span>
          </div>
        )}

        {user && (
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
            <h3 className="font-heading font-semibold text-safira-dark mb-3">Statistik Scan</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <StatBox value={stats.total} label="Total" />
              <StatBox value={stats.aman} label="Aman" color="#3E7D3E" />
              <StatBox value={stats.waspada} label="Waspada" color="#D4AF37" />
              <StatBox value={stats.beresiko} label="Beresiko" color="#C0392B" />
            </div>
          </div>
        )}

        {/* Pengaturan */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-4">
          <h3 className="font-heading font-semibold text-safira-dark">Pengaturan</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Bell size={16} /> Notifikasi produk berisiko
            </div>
            <button
              onClick={toggleNotif}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                notifEnabled ? "bg-safira-dark" : "bg-gray-200"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  notifEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <button
            onClick={handleClearHistory}
            className="w-full flex items-center gap-2 text-sm text-red-600 border border-red-100 rounded-2xl py-3 justify-center"
          >
            <Trash2 size={16} /> Hapus Riwayat Scan
          </button>
        </div>

        {/* Cara SAFIRA menghitung */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3 text-safira-dark font-heading font-semibold">
            <BookOpen size={16} /> Cara SAFIRA Menghitung
          </div>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Kesegaran (30%) — umur produk dibanding masa simpan wajar kategorinya.</li>
            <li>• Penyimpanan (25%) — deviasi suhu &amp; kelembapan dari rentang aman.</li>
            <li>• Distribusi (25%) — lama perjalanan dan banyaknya titik transit.</li>
            <li>• Kepatuhan (10%) — jumlah sertifikasi yang dilampirkan produsen.</li>
            <li>• Riwayat (10%) — persentase produk produsen yang pernah berisiko.</li>
          </ul>
          <p className="text-xs text-gray-400 mt-3">
            Skor 0–30 AMAN, 31–60 WASPADA, 61–100 BERESIKO. Nilai dihitung dari data nyata yang
            diinput produsen dan petugas distribusi.
          </p>
        </div>

        {/* Integritas & privasi */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-safira-dark font-heading font-semibold">
            <ShieldCheck size={16} /> Integritas &amp; Privasi
          </div>
          <p className="text-sm text-gray-600">
            Setiap catatan produk dan distribusi dikunci dengan hash berantai (SHA-256) dan
            bersifat insert-only. Koreksi data membuat versi baru tanpa menghapus jejak lama.
          </p>
        </div>

        {/* Latar belakang & SDGs — konten dari infografis referensi */}
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <h3 className="font-heading font-semibold text-safira-dark mb-2">Tentang SAFIRA</h3>
          <p className="text-sm text-gray-600 mb-3">
            Sekitar 150 juta kasus orang sakit dan meninggal per tahun di Asia Tenggara akibat
            pangan tidak aman. 56% kasus keracunan di Indonesia berasal dari katering atau makanan
            rumahan, dan tercatat 9.089 kasus keracunan dalam 103 insiden pada program Makan Bergizi
            Gratis. SAFIRA hadir untuk menjawab tantangan ini lewat Blockchain dan AI.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <SdgBadge icon={<Heart size={16} />} title="SDG 2" desc="Zero Hunger — pangan aman & berkualitas" />
            <SdgBadge icon={<HeartPulse size={16} />} title="SDG 3" desc="Kesehatan — deteksi dini penyakit pangan" />
            <SdgBadge icon={<Factory size={16} />} title="SDG 9" desc="Inovasi digital pangan" />
            <SdgBadge icon={<Recycle size={16} />} title="SDG 12" desc="Konsumsi bertanggung jawab" />
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-safira-dark font-heading font-semibold">
            <Smartphone size={16} /> Pasang sebagai Aplikasi
          </div>
          <p className="text-sm text-gray-600">
            Buka menu browser lalu pilih "Tambahkan ke Layar Utama" untuk menjalankan SAFIRA
            seperti aplikasi native, lengkap dengan ikon dan mode layar penuh.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

function StatBox({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div>
      <p className="font-heading text-lg font-bold" style={{ color: color ?? "#1F3D2E" }}>
        {value}
      </p>
      <p className="text-[10px] text-gray-400 uppercase">{label}</p>
    </div>
  );
}

function SdgBadge({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-safira-mosslight/10 rounded-2xl p-3">
      <div className="flex items-center gap-1 text-safira-dark font-semibold text-xs mb-1">
        {icon} {title}
      </div>
      <p className="text-[10px] text-gray-500">{desc}</p>
    </div>
  );
}
