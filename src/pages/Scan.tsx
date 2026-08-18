import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import { Keyboard, Image as ImageIcon, Zap } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import BottomNav from "../components/BottomNav";
import { addGuestHistoryRecord } from "../lib/guestHistory";

export default function Scan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  type CameraStatus = "loading" | "granted" | "denied" | "notfound" | "inuse" | "unsupported" | "error";
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("loading");
  const [cameraErrorDetail, setCameraErrorDetail] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const scanningRef = useRef(true);

  const permissionDenied = cameraStatus !== "granted" && cameraStatus !== "loading";

  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let detectorInterval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function startCamera() {
      setCameraStatus("loading");
      setCameraErrorDetail(null);
      scanningRef.current = true;
      setTorchOn(false);
      setTorchSupported(false);
      videoTrackRef.current = null;

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("unsupported");
        setCameraErrorDetail("Browser ini tidak mendukung akses kamera (getUserMedia tidak tersedia).");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraStatus("granted");

        const videoTrack = stream.getVideoTracks()[0];
        videoTrackRef.current = videoTrack ?? null;
        if (videoTrack) {
          // @ts-ignore - "torch" belum ada di tipe MediaTrackCapabilities bawaan TS
          const caps = videoTrack.getCapabilities?.() ?? {};
          // @ts-ignore
          setTorchSupported(!!caps.torch);
        }

        // Pakai jsQR (pure JS, jalan di semua browser/OS) alih-alih BarcodeDetector
        // native, karena BarcodeDetector hanya didukung penuh di Android/macOS dan
        // TIDAK tersedia di Chrome/Edge Windows.
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        detectorInterval = setInterval(() => {
          const video = videoRef.current;
          if (!video || !ctx || !scanningRef.current) return;
          if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code) {
            scanningRef.current = false;
            handleScanResult(code.data);
          }
        }, 300);
      } catch (err) {
        // Log error asli ke console supaya gampang di-debug (lihat DevTools Console)
        console.error("[Scan] gagal mengakses kamera:", err);
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setCameraStatus("denied");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setCameraStatus("notfound");
        } else if (name === "NotReadableError") {
          setCameraStatus("inuse");
        } else {
          setCameraStatus("error");
        }
        setCameraErrorDetail(err instanceof Error ? err.message : String(err));
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (detectorInterval) clearInterval(detectorInterval);
      videoTrackRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  async function toggleTorch() {
    const track = videoTrackRef.current;
    if (!track || !torchSupported) {
      setError("Flash tidak didukung di kamera/perangkat ini.");
      return;
    }
    try {
      const next = !torchOn;
      // @ts-ignore - "torch" belum ada di tipe MediaTrackConstraintSet bawaan TS
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (err) {
      console.error("[Scan] gagal mengubah flash:", err);
      setError("Gagal mengaktifkan flash. Coba lagi.");
    }
  }

  const cameraStatusMessage: Record<Exclude<CameraStatus, "loading" | "granted">, string> = {
    denied:
      "Izin kamera ditolak. Klik ikon kunci/info di address bar browser, aktifkan izin Camera untuk situs ini, lalu coba lagi.",
    notfound:
      "Tidak ada kamera yang terdeteksi di perangkat ini. Pastikan kamera terpasang, atau gunakan kode produk manual di bawah.",
    inuse:
      "Kamera sedang dipakai aplikasi lain (mis. Zoom/Teams). Tutup aplikasi tersebut lalu coba lagi.",
    unsupported:
      "Browser ini tidak mendukung akses kamera. Gunakan kode produk manual di bawah.",
    error:
      "Terjadi kesalahan saat mengakses kamera. Coba lagi, atau masukkan kode produk secara manual di bawah.",
  };

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
      scanningRef.current = true;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);

  async function handleGalleryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // biar bisa pilih file yang sama lagi nanti
    if (!file) return;

    setGalleryLoading(true);
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context tidak tersedia");
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });
      if (code) {
        await handleScanResult(code.data);
      } else {
        setError("QR code tidak ditemukan pada gambar. Coba gambar lain atau masukkan kode secara manual.");
      }
    } catch (err) {
      console.error("[Scan] gagal membaca QR dari galeri:", err);
      setError("Gagal membaca gambar. Coba gambar lain atau masukkan kode secara manual.");
    } finally {
      setGalleryLoading(false);
    }
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

      {!permissionDenied && !manualMode && (
        <div className="relative bg-black aspect-[3/4] w-full overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
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
            <button
              onClick={toggleTorch}
              disabled={!torchSupported}
              title={torchSupported ? "Nyalakan/matikan flash" : "Flash tidak didukung di perangkat ini"}
              className={`p-3 rounded-full disabled:opacity-40 ${torchOn ? "bg-amber-400 text-black" : "bg-black/40"}`}
            >
              <Zap size={20} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={galleryLoading}
              className="bg-black/40 p-3 rounded-full disabled:opacity-50"
            >
              <ImageIcon size={20} />
            </button>
            <button onClick={() => setManualMode(true)} className="bg-black/40 p-3 rounded-full">
              <Keyboard size={20} />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleGalleryFile}
            className="hidden"
          />
          {galleryLoading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm">
              Membaca gambar...
            </div>
          )}
        </div>
      )}

      {(permissionDenied || manualMode) && (
        <div className="px-6 py-8">
          {permissionDenied && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm text-amber-800">
              <p>
                {cameraStatusMessage[cameraStatus as Exclude<CameraStatus, "loading" | "granted">] ??
                  cameraStatusMessage.error}
              </p>
              {cameraErrorDetail && (
                <p className="mt-1 text-xs text-amber-700/70">Detail: {cameraErrorDetail}</p>
              )}
              {(cameraStatus === "notfound" || cameraStatus === "inuse" || cameraStatus === "error") && (
                <button
                  onClick={() => setRetryCount((c) => c + 1)}
                  className="mt-3 text-sm font-semibold text-amber-900 underline"
                >
                  Coba Lagi
                </button>
              )}
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
