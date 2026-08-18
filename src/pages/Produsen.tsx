import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackagePlus, QrCode } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { Product, RiskScore } from "../types";
import BottomNav from "../components/BottomNav";

export default function Produsen() {
  const { user, producer } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<(Product & { score?: RiskScore })[]>([]);
  const [regNama, setRegNama] = useState("");
  const [regKontak, setRegKontak] = useState("");
  const [regLokasi, setRegLokasi] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (producer?.status_verifikasi === "approved") loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producer]);

  async function loadProducts() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("producer_id", producer!.id)
      .order("dibuat_pada", { ascending: false });

    const withScores = await Promise.all(
      (data ?? []).map(async (p) => {
        const { data: score } = await supabase
          .from("risk_scores")
          .select("*")
          .eq("product_id", p.id)
          .order("dihitung_pada", { ascending: false })
          .limit(1)
          .maybeSingle();
        return { ...p, score: score ?? undefined };
      })
    );
    setProducts(withScores);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    await supabase.from("producers").insert({
      user_id: user.id,
      nama: regNama,
      kontak: regKontak,
      lokasi: regLokasi,
    });
    setSubmitting(false);
    window.location.reload();
  }

  if (!user) {
    return (
      <div className="app-frame pb-24">
        <div className="gradient-header px-6 pt-6 pb-4 text-white">
          <h1 className="font-heading text-lg font-bold">Produsen</h1>
        </div>
        <div className="px-6 py-10 text-center text-gray-500">
          <p>Silakan login terlebih dahulu untuk mengakses fitur produsen.</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!producer) {
    return (
      <div className="app-frame pb-24">
        <div className="gradient-header px-6 pt-6 pb-4 text-white">
          <h1 className="font-heading text-lg font-bold">Daftar sebagai Produsen</h1>
        </div>
        <form onSubmit={handleRegister} className="px-6 py-6 space-y-4">
          <Field label="Nama Usaha/Tani" value={regNama} onChange={setRegNama} required />
          <Field label="Kontak" value={regKontak} onChange={setRegKontak} required />
          <Field label="Lokasi" value={regLokasi} onChange={setRegLokasi} required />
          <button
            type="submit"
            disabled={submitting}
            className="gradient-btn w-full py-4 rounded-2xl text-white font-semibold shadow-lg disabled:opacity-50"
          >
            {submitting ? "Mengirim..." : "Ajukan Pendaftaran"}
          </button>
        </form>
        <BottomNav />
      </div>
    );
  }

  if (producer.status_verifikasi === "pending") {
    return (
      <div className="app-frame pb-24">
        <div className="gradient-header px-6 pt-6 pb-4 text-white">
          <h1 className="font-heading text-lg font-bold">Menunggu Verifikasi</h1>
        </div>
        <div className="px-6 py-10 text-center text-gray-500 text-sm">
          Pendaftaran producer Anda ({producer.nama}) sedang ditinjau. Untuk versi awal, verifikasi
          dilakukan manual oleh admin melalui Table Editor Supabase (ubah kolom status_verifikasi
          menjadi 'approved').
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="app-frame pb-24">
      <div className="gradient-header px-6 pt-6 pb-4 text-white">
<div className="flex items-center gap-2"><img src="/logo.png" alt="SAFIRA" className="w-6 h-6" /><div><h1 className="font-heading text-lg font-bold">Dashboard Produsen</h1><p className="text-sm text-white/80">{producer.nama}</p></div></div>
      </div>

      <div className="px-6 py-4">
        <button
          onClick={() => navigate("/produsen/tambah")}
          className="gradient-btn w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-semibold shadow-lg"
        >
          <PackagePlus size={18} /> Tambah Produk Baru
        </button>
      </div>

      <div className="px-6 space-y-3">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate(`/produsen/produk/${p.id}`)}
            className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-left"
          >
            <div className="w-10 h-10 bg-safira-mosslight/20 rounded-xl flex items-center justify-center text-safira-dark">
              <QrCode size={18} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-safira-dark">{p.nama_produk}</p>
              <p className="text-xs text-gray-400">
                Panen {new Date(p.tanggal_panen).toLocaleDateString("id-ID")}
              </p>
            </div>
            {p.score && (
              <span className="text-sm font-semibold text-safira-dark">{Math.round(p.score.total_score)}</span>
            )}
          </button>
        ))}
        {products.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">Belum ada produk terdaftar.</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-600 block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-200 rounded-2xl px-4 py-3"
      />
    </div>
  );
}
