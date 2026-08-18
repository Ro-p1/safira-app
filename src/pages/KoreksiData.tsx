import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Product, ProductCategory } from "../types";
import BottomNav from "../components/BottomNav";

export default function KoreksiData() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [original, setOriginal] = useState<Product | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  const [namaProduk, setNamaProduk] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [tanggalPanen, setTanggalPanen] = useState("");
  const [metode, setMetode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("product_categories").select("*").then(({ data }) => setCategories(data ?? []));
    supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single()
      .then(({ data }) => {
        setOriginal(data);
        if (data) {
          setNamaProduk(data.nama_produk);
          setCategoryId(data.category_id);
          setLokasi(data.lokasi_produksi);
          setTanggalPanen(data.tanggal_panen);
          setMetode(data.metode_produksi ?? "");
        }
      });
  }, [productId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!original) return;
    setSubmitting(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { data } = await supabase.functions.invoke("create-product", {
      body: {
        category_id: categoryId,
        nama_produk: namaProduk,
        lokasi_produksi: lokasi,
        tanggal_panen: tanggalPanen,
        metode_produksi: metode || null,
        sertifikasi: original.sertifikasi,
        foto_url: original.foto_url,
        supersedes_id: original.id,
      },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    setSubmitting(false);
    if (data?.product) navigate(`/produsen/produk/${data.product.id}`);
  }

  if (!original) return <div className="app-frame p-6">Memuat...</div>;

  return (
    <div className="app-frame pb-24">
      <div className="gradient-header px-6 pt-6 pb-4 text-white flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="font-heading text-lg font-bold">Koreksi Data</h1>
          <p className="text-sm text-white/80">Versi lama tetap tersimpan</p>
        </div>
      </div>

      <div className="mx-6 mt-4 bg-safira-mosslight/10 text-sm text-gray-600 rounded-2xl p-4">
        Data lama tidak dihapus. Koreksi akan membuat versi baru yang dirantai ke versi sebelumnya,
        dan QR Code produk tetap berlaku.
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
        <Field label="Nama produk" value={namaProduk} onChange={setNamaProduk} required />
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Kategori</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 bg-white"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama_kategori}
              </option>
            ))}
          </select>
        </div>
        <Field label="Lokasi produksi" value={lokasi} onChange={setLokasi} required />
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Tanggal panen</label>
          <input
            type="date"
            value={tanggalPanen}
            onChange={(e) => setTanggalPanen(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Metode produksi</label>
          <textarea
            value={metode}
            onChange={(e) => setMetode(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3"
            rows={3}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="gradient-btn w-full py-4 rounded-2xl text-white font-semibold shadow-lg disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Simpan Versi Baru"}
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
