// ============================================================
// Edge Function: log-distribution
// Menerima catatan titik distribusi baru dari producer pemilik
// produk, menghitung record_hash di server, insert ke
// distribution_logs, lalu memicu perhitungan ulang skor risiko.
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

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Tidak ada token autentikasi" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sesi tidak valid" }), { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const { product_id, lokasi_transit, lat, lng, suhu, kelembapan, nama_petugas } = body;

    if (!product_id || !lokasi_transit || suhu === undefined || kelembapan === undefined || !nama_petugas) {
      return new Response(JSON.stringify({ error: "Field wajib belum lengkap" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    // Verifikasi pemanggil adalah producer pemilik produk ini
    const { data: product } = await supabase
      .from("products")
      .select("*, producers(user_id)")
      .eq("id", product_id)
      .single();

    if (!product || product.producers.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Anda bukan pemilik produk ini" }), { status: 403, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    // Ambil hash terakhir di rantai distribution_logs produk ini
    const { data: lastLog } = await supabase
      .from("distribution_logs")
      .select("record_hash")
      .eq("product_id", product_id)
      .order("waktu_dicatat", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prevHash = lastLog?.record_hash ?? "GENESIS";

    const hashInput = JSON.stringify({
      product_id,
      lokasi_transit,
      suhu,
      kelembapan,
      nama_petugas,
      prev_hash: prevHash,
    });
    const recordHash = await sha256(hashInput);

    const { data: inserted, error: insertErr } = await supabase
      .from("distribution_logs")
      .insert({
        product_id,
        lokasi_transit,
        lat: lat ?? null,
        lng: lng ?? null,
        suhu,
        kelembapan,
        nama_petugas,
        prev_hash: prevHash,
        record_hash: recordHash,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    // Panggil langsung calculate-risk-score (selain lewat Database Webhook,
    // ini jaga-jaga kalau webhook belum sempat diaktifkan manual di dashboard)
    try {
      await supabase.functions.invoke("calculate-risk-score", {
        body: { type: "INSERT", table: "distribution_logs", record: { product_id } },
      });
    } catch {
      // Tidak fatal — webhook (kalau aktif) akan tetap memicu perhitungan
    }

    return new Response(JSON.stringify({ success: true, log: inserted }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
