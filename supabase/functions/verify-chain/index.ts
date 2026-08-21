// ============================================================
// Edge Function: verify-chain
// Menghitung ulang hash-chain suatu produk (rantai supersedes di
// tabel products, dan rantai distribution_logs) untuk memastikan
// datanya belum "dirusak" secara diam-diam.
//
// PENTING (fix bug yang sempat terjadi di percobaan sebelumnya):
// Produk PERTAMA dalam rantai (prev_hash = 'GENESIS', belum ada
// row lain yang mereferensikannya lewat supersedes_id) HARUS
// otomatis dianggap valid — karena belum ada apa pun untuk
// dibandingkan. "Tidak konsisten" hanya boleh muncul kalau hash
// yang dihitung ulang beda dari hash yang tersimpan.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Hash dihitung dari field-field data (bukan termasuk id/hash itu sendiri) + prev_hash
function buildProductHashInput(row: any, prevHash: string): string {
  return JSON.stringify({
    producer_id: row.producer_id,
    category_id: row.category_id,
    nama_produk: row.nama_produk,
    lokasi_produksi: row.lokasi_produksi,
    tanggal_panen: row.tanggal_panen,
    metode_produksi: row.metode_produksi,
    sertifikasi: row.sertifikasi,
    foto_url: row.foto_url,
    qr_code_value: row.qr_code_value,
    prev_hash: prevHash,
  });
}

function buildLogHashInput(row: any, prevHash: string): string {
  return JSON.stringify({
    product_id: row.product_id,
    lokasi_transit: row.lokasi_transit,
    suhu: row.suhu,
    kelembapan: row.kelembapan,
    nama_petugas: row.nama_petugas,
    prev_hash: prevHash,
  });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const { qr_code_value } = await req.json();
    if (!qr_code_value) {
      return new Response(JSON.stringify({ error: "qr_code_value wajib diisi" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    // ============================================================
    // 1. Ambil seluruh rantai koreksi produk ini (via qr_code_value),
    //    urut dari yang paling lama ke paling baru
    // ============================================================
    const { data: productChain, error: pErr } = await supabase
      .from("products")
      .select("*")
      .eq("qr_code_value", qr_code_value)
      .order("dibuat_pada", { ascending: true });

    if (pErr || !productChain || productChain.length === 0) {
      return new Response(JSON.stringify({ error: "Produk tidak ditemukan" }), { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    let productChainValid = true;
    let expectedPrevHash = "GENESIS";

    for (const row of productChain) {
      // Kasus produk pertama: prev_hash HARUS 'GENESIS', ini valid by definition
      const hashInput = buildProductHashInput(row, expectedPrevHash);
      const recalculatedHash = await sha256(hashInput);

      if (row.prev_hash !== expectedPrevHash || row.record_hash !== recalculatedHash) {
        productChainValid = false;
        break;
      }
      expectedPrevHash = row.record_hash;
    }

    // ============================================================
    // 2. Ambil rantai distribution_logs produk (head terbaru dari chain)
    // ============================================================
    const headProduct = productChain[productChain.length - 1];

    const { data: logChain, error: lErr } = await supabase
      .from("distribution_logs")
      .select("*")
      .eq("product_id", headProduct.id)
      .order("waktu_dicatat", { ascending: true });

    let logChainValid = true;
    if (!lErr && logChain && logChain.length > 0) {
      let expectedLogPrevHash = "GENESIS";
      for (const log of logChain) {
        const hashInput = buildLogHashInput(log, expectedLogPrevHash);
        const recalculatedHash = await sha256(hashInput);
        if (log.prev_hash !== expectedLogPrevHash || log.record_hash !== recalculatedHash) {
          logChainValid = false;
          break;
        }
        expectedLogPrevHash = log.record_hash;
      }
    }
    // Kalau logChain kosong, itu bukan "tidak konsisten" — cuma belum ada data distribusi

    const isValid = productChainValid && logChainValid;

    return new Response(
      JSON.stringify({
        valid: isValid,
        message: isValid ? "Terverifikasi ✅" : "Data Tidak Konsisten ⚠️",
        product_versions: productChain.length,
        distribution_logs_checked: logChain?.length ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
