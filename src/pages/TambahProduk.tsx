import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { ProductCategory } from "../types";
import BottomNav from "../components/BottomNav";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function TambahProduk() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  const [namaProduk, setNamaProduk] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [tanggalPanen, setTanggalPanen] = useState("");
  const [metode, setMetode] = useState("");
  const [sertifikasi, setSertifikasi] = useState<string[]>([]);
  const [sertifikasiInput, setSertifikasiInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("product_categories")
      .select("*")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError("Format file harus JPG, PNG, atau WEBP.");
      setFile(null);
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setFileError("Ukuran file maksimal 5MB.");
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(f);
  }

  function addSertifikasi() {
    if (sertifikasiInput.trim()) {
      setSertifikasi((s) => [...s, sertifikasiInput.trim()]);
      setSertifikasiInput("");
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Perangkat/browser ini tidak mendukung deteksi lokasi otomatis.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setError("Gagal mengambil lokasi. Isi koordinat secara manual atau coba lagi.");
        setLocating(false);
      }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let fotoUrl: string | null = null;

      if (file) {
        const filePath = `products/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("product-photos").upload(filePath, file);
        if (uploadErr) throw new Error(`Gagal upload foto: ${uploadErr.message}`);
        const { data: publicUrl } = supabase.storage.from("product-photos").getPublicUrl(filePath);
        fotoUrl = publicUrl.publicUrl;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error: fnError } = await supabase.functions.invoke("create-product", {
        body: {
          category_id: categoryId,
          nama_produk: namaProduk,
          lokasi_produksi: lokasi,
          produksi_lat: lat ? parseFloat(lat) : null,
          produksi_lng: lng ? parseFloat(lng) : null,
          tanggal_panen: tanggalPanen,
          metode_produksi: metode || null,
          sertifikasi,
          foto_url: fotoUrl,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (fnError || data?.error) throw new Error(data?.error ?? fnError?.message ?? "Gagal menyimpan produk");

      navigate(`/produsen/produk/${data.product.id}`);
    } catch (err: any) {
      setError(err.message ?? "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-frame pb-24">
      <div className="gradient-header px-6 pt-6 pb-4 text-white flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-heading text-lg font-bold">Tambah Produk</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
        <Field label="Nama produk" value={namaProduk} onChange={setNamaProduk} required />

        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Kategori</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 bg-white"
          >
            <option value="">Pilih kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama_kategori}
              </option>
            ))}
          </select>
        </div>

        <Field label="Lokasi produksi" value={lokasi} onChange={setLokasi} required />

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-600">Koordinat GPS (untuk peta pelacakan)</label>
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
              placeholder="Lintang (lat)"
              className="border border-gray-200 rounded-2xl px-4 py-3"
            />
            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              type="number"
              step="any"
              placeholder="Bujur (lng)"
              className="border border-gray-200 rounded-2xl px-4 py-3"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Opsional, tapi tanpa ini titik lokasi produksi tidak akan muncul di peta halaman Tracking.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Tanggal panen</label>
          <input
            type="date"
            value={tanggalPanen}
            onChange={(e) => setTanggalPanen(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-2xl px-4 py-3"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Metode produksi (opsional)</label>
          <textarea
            value={metode}
            onChange={(e) => setMetode(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3"
            rows={3}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Sertifikasi</label>
          <div className="flex gap-2 mb-2">
            <input
              value={sertifikasiInput}
              onChange={(e) => setSertifikasiInput(e.target.value)}
              placeholder="mis. HACCP, Organik"
              className="flex-1 border border-gray-200 rounded-2xl px-4 py-3"
            />
            <button type="button" onClick={addSertifikasi} className="border border-gray-200 rounded-2xl px-4">
              <Plus size={18} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sertifikasi.map((s, i) => (
              <span key={i} className="bg-safira-mosslight/20 text-safira-dark text-xs px-3 py-1 rounded-full flex items-center gap-1">
                {s}
                <button type="button" onClick={() => setSertifikasi((arr) => arr.filter((_, idx) => idx !== i))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Foto produk (opsional)</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="w-full border border-gray-200 rounded-2xl px-4 py-3" />
          {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="gradient-btn w-full py-4 rounded-2xl text-white font-semibold shadow-lg disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Terbitkan Produk & QR Code"}
        </button>
      </form>

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
