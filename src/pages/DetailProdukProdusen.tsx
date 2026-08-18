import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../lib/supabase";
import { Product, RiskScore } from "../types";
import BottomNav from "../components/BottomNav";

const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || window.location.origin;

export default function DetailProdukProdusen() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [score, setScore] = useState<RiskScore | null>(null);
  const [versions, setVersions] = useState<Product[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const [lokasiTransit, setLokasiTransit] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [suhu, setSuhu] = useState("");
  const [kelembapan, setKelembapan] = useState("");
  const [petugas, setPetugas] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function load() {
    const { data: productData } = await supabase.from("products").select("*").eq("id", productId).single();
    setProduct(productData);

    if (productData) {
      const { data: versionData } = await supabase
        .from("products")
        .select("*")
        .eq("qr_code_value", productData.qr_code_value)
        .order("dibuat_pada", { ascending: false });
      setVersions(versionData ?? []);

      const { data: scoreData } = await supabase
        .from("risk_scores")
        .select("*")
        .eq("product_id", productId)
        .order("dihitung_pada", { ascending: false })
        .limit(1)
        .maybeSingle();
      setScore(scoreData);

      const { data: logData } = await supabase
        .from("distribution_logs")
        .select("*")
        .eq("product_id", productId)
        .order("waktu_dicatat", { ascending: false });
      setLogs(logData ?? []);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false)
    );
  }

  async function handleAddLog(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    await supabase.functions.invoke("log-distribution", {
      body: {
        product_id: productId,
        lokasi_transit: lokasiTransit,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        suhu: parseFloat(suhu),
        kelembapan: parseFloat(kelembapan),
        nama_petugas: petugas,
      },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    setLokasiTransit("");
    setLat("");
    setLng("");
    setSuhu("");
    setKelembapan("");
    setPetugas("");
    setSubmitting(false);
    load();
  }

  function downloadQR() {
    const canvas = document.getElementById("product-qr") as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${product?.nama_produk}.png`;
    a.click();
  }

  if (!product) return <div className="app-frame p-6">Memuat...</div>;

  const qrUrl = `${APP_DOMAIN}/scan/${product.qr_code_value}`;

  return (
    <div className="app-frame pb-24">
      <div className="gradient-header px-6 pt-6 pb-4 text-white flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="font-heading text-lg font-bold">{product.nama_produk}</h1>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col items-center">
          <QRCodeCanvas id="product-qr" value={qrUrl} size={180} />
          <p className="text-xs text-gray-400 mt-3 break-all text-center">{product.qr_code_value}</p>
          <div className="flex gap-3 mt-4 w-full">
            <button onClick={downloadQR} className="flex-1 flex items-center justify-center gap-2 border border-gray-200 rounded-2xl py-2 text-sm">
              <Download size={14} /> Unduh QR
            </button>
            <button
              onClick={() => navigate(`/hasil/${product.id}`)}
              className="flex-1 flex items-center justify-center gap-2 gradient-btn text-white rounded-2xl py-2 text-sm"
            >
              <ExternalLink size={14} /> Lihat Halaman Konsumen
            </button>
          </div>
        </div>
      </div>

      {score && (
        <div className="px-6 pb-4">
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400 uppercase">Skor Risiko</p>
              <p className="font-heading text-2xl font-bold text-safira-dark">{Math.round(score.total_score)}</p>
              <p className="text-xs text-gray-400">Panen {new Date(product.tanggal_panen).toLocaleDateString("id-ID")}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
              {score.status}
            </span>
          </div>
        </div>
      )}

      <div className="px-6 pb-4">
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <h3 className="font-heading font-semibold text-safira-dark mb-3">Catat Titik Distribusi</h3>
          <form onSubmit={handleAddLog} className="space-y-3">
            <input
              value={lokasiTransit}
              onChange={(e) => setLokasiTransit(e.target.value)}
              placeholder="Lokasi transit"
              required
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm"
            />
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">Koordinat GPS titik ini</span>
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  className="text-xs font-semibold text-safira-dark underline disabled:opacity-50"
                >
                  {locating ? "Mendeteksi..." : "Gunakan lokasi saya"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  type="number"
                  step="any"
                  placeholder="Lat"
                  className="border border-gray-200 rounded-2xl px-4 py-3 text-sm"
                />
                <input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  type="number"
                  step="any"
                  placeholder="Lng"
                  className="border border-gray-200 rounded-2xl px-4 py-3 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={suhu}
                onChange={(e) => setSuhu(e.target.value)}
                type="number"
                step="0.1"
                placeholder="Suhu (°C)"
                required
                className="border border-gray-200 rounded-2xl px-4 py-3 text-sm"
              />
              <input
                value={kelembapan}
                onChange={(e) => setKelembapan(e.target.value)}
                type="number"
                step="0.1"
                placeholder="Kelembapan (%)"
                required
                className="border border-gray-200 rounded-2xl px-4 py-3 text-sm"
              />
            </div>
            <input
              value={petugas}
              onChange={(e) => setPetugas(e.target.value)}
              placeholder="Nama petugas"
              required
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={submitting}
              className="gradient-btn w-full py-3 rounded-2xl text-white font-semibold disabled:opacity-50"
            >
              {submitting ? "Menyimpan..." : "+ Simpan Catatan"}
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="bg-safira-mosslight/10 rounded-xl p-3 text-sm">
                <p className="font-medium text-safira-dark">{l.lokasi_transit}</p>
                <p className="text-xs text-gray-500">
                  {l.suhu}°C · {l.kelembapan}% RH · {new Date(l.waktu_dicatat).toLocaleString("id-ID")}
                </p>
                <p className="text-[10px] text-gray-400">{l.record_hash.slice(0, 12)}...</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <h3 className="font-heading font-semibold text-safira-dark mb-3">Riwayat Versi Data</h3>
          <div className="space-y-2 mb-4">
            {versions.map((v, i) => (
              <div key={v.id} className="bg-gray-50 rounded-xl p-3 text-sm">
                <p className="font-medium text-safira-dark">
                  Versi {versions.length - i} · {new Date(v.dibuat_pada).toLocaleDateString("id-ID")}
                </p>
                <p className="text-xs text-gray-500">
                  {v.nama_produk} — {v.lokasi_produksi}
                </p>
                <p className="text-[10px] text-gray-400">{v.record_hash.slice(0, 12)}...</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate(`/produsen/koreksi/${product.id}`)}
            className="w-full border border-safira-dark text-safira-dark rounded-2xl py-3 text-sm font-medium"
          >
            Ajukan Koreksi Data
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
