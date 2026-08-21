import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import jsQR from "jsqr";
import { Keyboard, Image as ImageIcon, Zap } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import BottomNav from "../components/BottomNav";
import { addGuestHistoryRecord } from "../lib/guestHistory";

export default function Scan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  // Dukung deep link /scan/:qrCodeValue (mis. dari QR yang di-scan aplikasi
  // kamera bawaan HP, bukan lewat kamera in-app) — kalau ada, langsung
  // resolve produknya tanpa menunggu user memindai ulang di dalam app.
  const { qrCodeValue: deepLinkQrCode } = useParams();

  const [permissionDenied, setPermissionDenied] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (deepLinkQrCode) {
      resolveProduct(deepLinkQrCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkQrCode]);

  useEffect(() => {
    // Kalau dibuka lewat deep link, langsung resolve produk dan jangan
    // repot-repot menyalakan kamera.
    if (deepLinkQrCode) return;

    let stream: MediaStream | null = null;
    let detectorInterval: ReturnType<typeof setInterval> | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Gunakan BarcodeDetector native kalau tersedia (Chrome/Android).
        // Kalau tidak ada (mis. Safari/iOS), fallback ke jsQR: gambar tiap
        // frame video ke canvas tersembunyi, lalu decode pixel-nya manual.
        if ("BarcodeDetector" in window) {
          // @ts-ignore - BarcodeDetector belum ada di semua tipe TS bawaan
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          detectorInterval = setInterval(async () => {
            if (!videoRef.current || !scanning) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) {
                setScanning(false);
                handleScanResult(codes[0].rawValue);
              }
            } catch {
              // frame belum siap, abaikan
            }
          }, 500);
        } else {
          const canvas = canvasRef.current ?? document.createElement("canvas");
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          detectorInterval = setInterval(() => {
            const video = videoRef.current;
            if (!video || !ctx || !scanning || video.readyState !== video.HAVE_ENOUGH_DATA) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            if (code?.data) {
              setScanning(false);
              handleScanResult(code.data);
            }
          }, 350);
        }
      } catch {
        setPermissionDenied(true);
      }
    }

    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (detectorInterval) clearInterval(detectorInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScanResult(rawValue: string) {
    // QR encode berupa URL deep-link: https://<domain>/scan/{qr_code_value}
    // Ambil UUID di bagian akhir path, atau anggap rawValue itu sendiri UUID-nya
    const match = rawValue.match(/([0-9a-fA-F-]{36})$/);
    const qrCodeValue = match ? match[1] : rawValue.trim();
    await resolveProduct(qrCodeValue);
  }

  async function resolveProduct(qrCodeValue: string) {
    setError(null);
    // Ambil versi terbaru produk (head dari rantai supersedes) berdasarkan qr_code_value
    const { data: versions, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .eq("qr_code_value", qrCodeValue)
      .order("dibuat_pada", { ascending: false });

    if (prodErr || !versions || versions.length === 0) {
      setError("Produk tidak ditemukan. Pastikan QR code valid.");
      setScanning(true);
      return;
    }

    const product = versions[0];

    // Catat ke scan_history (boleh guest, user_id null)
    await supabase.from("scan_history").insert({
      user_id: user?.id ?? null,
      product_id: product.id,
    });

    if (!user) {
      const { data: latestScore } = await supabase
        .from("risk_scores")
        .select("*")
        .eq("product_id", product.id)
        .order("dihitung_pada", { ascending: false })
        .limit(1)
        .maybeSingle();

      addGuestHistoryRecord({
        product_id: product.id,
        qr_code_value: qrCodeValue,
        nama_produk: product.nama_produk,
        status: latestScore?.status ?? "MENUNGGU_DATA",
        total_score: latestScore?.total_score ?? 0,
        waktu_scan: new Date().toISOString(),
      });
    }

    // Alur "Scan -> Track -> Result" sesuai referensi infografis
    navigate(`/tracking/${product.id}`);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) resolveProduct(manualCode.trim());
  }

  return (
    <div className="app-frame pb-20">
      <div className="gradient-header px-6 pt-6 pb-4 text-white">
        <h1 className="font-heading text-xl font-bold">Scan QR Produk</h1>
        <p className="text-sm text-white/80">Arahkan kamera ke QR pada kemasan</p>
      </div>

      {deepLinkQrCode && !error && (
        <div className="px-6 py-10 text-center text-gray-400 text-sm">Membuka produk...</div>
      )}

      {!deepLinkQrCode && !permissionDenied && !manualMode && (
        <div className="relative bg-black aspect-[3/4] w-full overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-52 h-52 relative">
              {["top-0 left-0 border-t-4 border-l-4", "top-0 right-0 border-t-4 border-r-4",
                "bottom-0 left-0 border-b-4 border-l-4", "bottom-0 right-0 border-b-4 border-r-4"]
                .map((cls, i) => (
                  <div key={i} className={`absolute w-8 h-8 border-safira-mosslight rounded-sm ${cls}`} />
                ))}
            </div>
          </div>
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-6 text-white">
            <button className="bg-black/40 p-3 rounded-full"><Zap size={20} /></button>
            <button className="bg-black/40 p-3 rounded-full"><ImageIcon size={20} /></button>
            <button onClick={() => setManualMode(true)} className="bg-black/40 p-3 rounded-full">
              <Keyboard size={20} />
            </button>
          </div>
        </div>
      )}

      {(permissionDenied || manualMode) && (
        <div className="px-6 py-8">
          {permissionDenied && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm text-amber-800">
              Izin kamera diperlukan untuk memindai. Silakan aktifkan izin kamera di pengaturan
              browser, atau masukkan kode produk secara manual di bawah.
            </div>
          )}
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <label className="text-sm font-medium text-gray-600">Masukkan Kode Produk Manual</label>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="contoh: b4aee85a-2e73-43da-a675-..."
              className="w-full border border-gray-200 rounded-2xl px-4 py-3"
            />
            <button type="submit" className="gradient-btn w-full py-3 rounded-2xl text-white font-semibold">
              Cari Produk
            </button>
          </form>
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl p-4">
          {error}
        </div>
      )}

      <div className="px-6 py-6">
        <div className="bg-safira-mosslight/10 rounded-3xl p-5">
          <h3 className="font-heading font-semibold text-safira-dark mb-2">Cara Memindai</h3>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Posisikan QR Code di dalam bingkai hijau.</li>
            <li>Jaga jarak sekitar 15–25 cm dan pastikan cahaya cukup.</li>
            <li>Hasil analisis risiko muncul otomatis setelah terbaca.</li>
          </ol>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
