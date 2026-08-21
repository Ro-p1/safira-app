import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Product, RiskScore } from "../types";
import BottomNav from "../components/BottomNav";

const statusColor: Record<string, string> = {
  AMAN: "#3E7D3E",
  WASPADA: "#D4AF37",
  BERESIKO: "#C0392B",
  MENUNGGU_DATA: "#9CA3AF",
};

export default function HasilAnalisis() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [score, setScore] = useState<RiskScore | null>(null);
  const [verify, setVerify] = useState<{ valid: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function load() {
    setLoading(true);
    const { data: productData } = await supabase
      .from("products")
      .select("*, product_categories(*)")
      .eq("id", productId)
      .single();
    setProduct(productData);

    const { data: scoreData } = await supabase
      .from("risk_scores")
      .select("*")
      .eq("product_id", productId)
      .order("dihitung_pada", { ascending: false })
      .limit(1)
      .maybeSingle();
    setScore(scoreData);

    if (productData) {
      const { data: verifyData } = await supabase.functions.invoke("verify-chain", {
        body: { qr_code_value: productData.qr_code_value },
      });
      setVerify(verifyData ?? null);
    }

    setLoading(false);
  }

  if (loading) {
    return <div className="app-frame flex items-center justify-center min-h-screen">Memuat...</div>;
  }

  if (!product) {
    return <div className="app-frame p-6">Produk tidak ditemukan.</div>;
  }

  const belumAdaData = !score;
  const status = score?.status ?? "MENUNGGU_DATA";
  const totalScore = score?.total_score ?? 0;
  const color = statusColor[status];

  const komponen = score
    ? [
        { label: "Kesegaran (30%)", value: score.freshness_score },
        { label: "Penyimpanan (25%)", value: score.storage_score },
        { label: "Distribusi (25%)", value: score.distribution_score },
        { label: "Kepatuhan (10%)", value: score.compliance_score },
        { label: "Riwayat Risiko (10%)", value: score.historical_score },
      ]
    : [];

  const circumference = 2 * Math.PI * 70;
  const dashOffset = circumference - (Math.min(totalScore, 100) / 100) * circumference;

  return (
    <div className="app-frame pb-24">
      <div className="gradient-header px-6 pt-6 pb-4 text-white flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="font-heading text-lg font-bold">Hasil Analisis AI</h1>
          <p className="text-sm text-white/80">{product.nama_produk}</p>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col items-center">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="70" fill="none" stroke="#EEF2EE" strokeWidth="14" />
            {!belumAdaData && (
              <circle
                cx="90"
                cy="90"
                r="70"
                fill="none"
                stroke={color}
                strokeWidth="14"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 90 90)"
              />
            )}
            <text x="90" y="85" textAnchor="middle" className="font-heading" fontSize="36" fontWeight="700" fill="#1F3D2E">
              {belumAdaData ? "-" : Math.round(totalScore)}
            </text>
            <text x="90" y="108" textAnchor="middle" fontSize="11" fill="#9CA3AF">
              SKOR RISIKO
            </text>
          </svg>
          <span
            className="px-4 py-1 rounded-full text-sm font-semibold mt-2"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {status === "MENUNGGU_DATA" ? "Menunggu Data Distribusi" : status}
          </span>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {belumAdaData
              ? "Produk belum memiliki catatan distribusi sama sekali."
              : `Dihitung ${new Date(score!.dihitung_pada).toLocaleString("id-ID")}`}
          </p>
        </div>
      </div>

      {!belumAdaData && (
        <div className="px-6">
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm mb-4">
            <h3 className="font-heading font-semibold text-safira-dark mb-1">Rincian Skor</h3>
            <p className="text-xs text-gray-400 mb-4">Semakin rendah nilai, semakin aman.</p>
            <div className="space-y-3">
              {komponen.map((k) => (
                <div key={k.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{k.label}</span>
                    <span className="font-medium text-safira-dark">{k.value.toFixed(1)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(k.value, 100)}%`,
                        backgroundColor: k.value > 60 ? "#C0392B" : k.value > 30 ? "#D4AF37" : "#3E7D3E",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-safira-mosslight/10 rounded-3xl p-5 mb-4">
            <h3 className="font-heading font-semibold text-safira-dark mb-2">Catatan & Rekomendasi</h3>
            <p className="text-sm text-gray-600">{score!.catatan_ai}</p>
          </div>
        </div>
      )}

      <div className="px-6">
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm mb-4">
          <h3 className="font-heading font-semibold text-safira-dark mb-3">Informasi Produk</h3>
          <InfoRow label="Produsen" value={product.lokasi_produksi} />
          <InfoRow label="Tanggal Panen" value={new Date(product.tanggal_panen).toLocaleDateString("id-ID")} />
          <InfoRow label="Sertifikasi" value={product.sertifikasi.join(", ") || "-"} />
        </div>

        <div
          className={`rounded-3xl p-5 mb-6 flex items-start gap-3 ${
            verify?.valid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
          }`}
        >
          {verify?.valid ? (
            <ShieldCheck className="text-green-600 flex-shrink-0" size={22} />
          ) : (
            <ShieldAlert className="text-red-600 flex-shrink-0" size={22} />
          )}
          <div>
            <p className={`font-medium text-sm ${verify?.valid ? "text-green-700" : "text-red-700"}`}>
              {verify?.message ?? "Memverifikasi rantai data..."}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Hash: {product.record_hash.slice(0, 10)}...{product.record_hash.slice(-8)}
            </p>
          </div>
        </div>

        <button
          onClick={load}
          className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-2xl py-3 text-sm text-gray-500 mb-4"
        >
          <RefreshCw size={14} /> Hitung Ulang Skor
        </button>
      </div>

      <BottomNav />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-400">{label}</span>
      <span className="text-safira-dark font-medium">{value}</span>
    </div>
  );
}
