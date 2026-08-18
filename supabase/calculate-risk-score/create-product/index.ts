// ============================================================
// Edge Function: create-product
// Menerima data produk dari producer yang sudah login & approved,
// menghitung record_hash di server (tidak dipercayakan ke client),
// lalu insert ke tabel products lewat service role.
//
// Dipanggil dari frontend via supabase.functions.invoke('create-product', ...)
// bukan lewat insert langsung ke tabel — supaya hash tidak bisa dipalsukan.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Tidak ada token autentikasi" }, 401);
    }

    // Klien untuk verifikasi identitas user yang memanggil (pakai anon key + token user)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      return json({ error: "Sesi tidak valid, silakan login ulang" }, 401);
    }

    // Service role client untuk operasi database (bypass RLS)
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Pastikan pemanggil adalah producer approved
    const { data: producer } = await supabase
      .from("producers")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!producer || producer.status_verifikasi !== "approved") {
      return json({ error: "Hanya producer yang sudah diverifikasi yang boleh menambah produk" }, 403);
    }

    const body = await req.json();
    const {
      category_id,
      nama_produk,
      lokasi_produksi,
      tanggal_panen,
      metode_produksi,
      sertifikasi,
      foto_url,
      supersedes_id, // opsional — kalau ini "koreksi data", bukan produk baru
    } = body;

    if (!category_id || !nama_produk || !lokasi_produksi || !tanggal_panen) {
      return json({ error: "Field wajib belum lengkap" }, 400);
    }

    let qrCodeValue: string;
    let prevHash = "GENESIS";

    if (supersedes_id) {
      // Koreksi data: harus pakai qr_code_value yang SAMA dengan produk asal
      const { data: originalProduct, error: origErr } = await supabase
        .from("products")
        .select("*")
        .eq("id", supersedes_id)
        .single();

      if (origErr || !originalProduct) {
        return json({ error: "Produk asal tidak ditemukan" }, 404);
      }
      if (originalProduct.producer_id !== producer.id) {
        return json({ error: "Anda bukan pemilik produk ini" }, 403);
      }
      qrCodeValue = originalProduct.qr_code_value;
      prevHash = originalProduct.record_hash;
    } else {
      qrCodeValue = crypto.randomUUID();
    }

    const rowData = {
      producer_id: producer.id,
      category_id,
      nama_produk,
      lokasi_produksi,
      tanggal_panen,
      metode_produksi: metode_produksi ?? null,
      sertifikasi: sertifikasi ?? [],
      foto_url: foto_url ?? null,
      qr_code_value: qrCodeValue,
      supersedes_id: supersedes_id ?? null,
    };

    const hashInput = JSON.stringify({
      producer_id: rowData.producer_id,
      category_id: rowData.category_id,
      nama_produk: rowData.nama_produk,
      lokasi_produksi: rowData.lokasi_produksi,
      tanggal_panen: rowData.tanggal_panen,
      metode_produksi: rowData.metode_produksi,
      sertifikasi: rowData.sertifikasi,
      foto_url: rowData.foto_url,
      qr_code_value: rowData.qr_code_value,
      prev_hash: prevHash,
    });
    const recordHash = await sha256(hashInput);

    const { data: inserted, error: insertErr } = await supabase
      .from("products")
      .insert({ ...rowData, prev_hash: prevHash, record_hash: recordHash })
      .select()
      .single();

    if (insertErr) {
      return json({ error: insertErr.message }, 500);
    }

    return json({ success: true, product: inserted });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
