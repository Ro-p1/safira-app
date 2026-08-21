// ============================================================
// Edge Function: calculate-risk-score
// Dipicu oleh Database Webhook setiap ada INSERT baru ke distribution_logs.
// Menghitung skor risiko rule-based (bukan ML) dari data nyata,
// lalu insert row baru ke risk_scores (insert-only, bukan update).
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Opsional — kalau tidak diset, otomatis fallback ke narasi template lokal
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface WebhookPayload {
  type: string;
  table: string;
  record: { product_id: string };
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();
    const productId = payload.record.product_id;

    // 1. Ambil data produk + kategori
    const { data: product, error: productErr } = await supabase
      .from("products")
      .select("*, product_categories(*)")
      .eq("id", productId)
      .single();

    if (productErr || !product) {
      return new Response(JSON.stringify({ error: "Produk tidak ditemukan" }), { status: 404 });
    }

    const category = product.product_categories;

    // 2. Ambil semua distribution_logs produk ini, urut waktu
    const { data: logs } = await supabase
      .from("distribution_logs")
      .select("*")
      .eq("product_id", productId)
      .order("waktu_dicatat", { ascending: true });

    const distributionLogs = logs ?? [];

    // ============================================================
    // FRESHNESS SCORE (bobot 30%) — makin lama dari tanggal panen
    // dibanding masa simpan wajar, makin tinggi skor risiko (0-100)
    // ============================================================
    const hariSejakPanen =
      (Date.now() - new Date(product.tanggal_panen).getTime()) / (1000 * 60 * 60 * 24);
    const freshnessScore = Math.min(
      100,
      Math.max(0, (hariSejakPanen / category.masa_simpan_wajar_hari) * 100)
    );

    // ============================================================
    // STORAGE SCORE (bobot 25%) — deviasi suhu & kelembapan dari
    // rentang aman kategori, dirata-ratakan dari semua log
    // ============================================================
    let storageScore = 0;
    if (distributionLogs.length > 0) {
      const deviasiList = distributionLogs.map((log: any) => {
        const suhuDeviasi =
          log.suhu < category.suhu_aman_min
            ? category.suhu_aman_min - log.suhu
            : log.suhu > category.suhu_aman_max
            ? log.suhu - category.suhu_aman_max
            : 0;
        const kelembapanDeviasi =
          log.kelembapan < category.kelembapan_aman_min
            ? category.kelembapan_aman_min - log.kelembapan
            : log.kelembapan > category.kelembapan_aman_max
            ? log.kelembapan - category.kelembapan_aman_max
            : 0;
        // Normalisasi kasar: tiap 1 derajat/persen deviasi = +10 poin risiko
        return Math.min(100, suhuDeviasi * 10 + kelembapanDeviasi * 2);
      });
      storageScore = deviasiList.reduce((a: number, b: number) => a + b, 0) / deviasiList.length;
    }

    // ============================================================
    // DISTRIBUTION SCORE (bobot 25%) — lama transit & jumlah titik
    // ============================================================
    let distributionScore = 0;
    if (distributionLogs.length > 0) {
      const jamTransit =
        (new Date(distributionLogs[distributionLogs.length - 1].waktu_dicatat).getTime() -
          new Date(product.dibuat_pada).getTime()) /
        (1000 * 60 * 60);
      // Asumsi wajar: distribusi normal < 48 jam, makin lama makin berisiko
      const skorWaktu = Math.min(100, (jamTransit / 48) * 60);
      // Makin banyak titik transit tanpa masalah = agak menambah risiko kontaminasi silang
      const skorTitik = Math.min(40, distributionLogs.length * 8);
      distributionScore = Math.min(100, skorWaktu + skorTitik);
    }

    // ============================================================
    // COMPLIANCE SCORE (bobot 10%) — makin lengkap sertifikasi,
    // makin RENDAH skor risiko
    // ============================================================
    const jumlahSertifikasi = (product.sertifikasi ?? []).length;
    const complianceScore = Math.max(0, 100 - jumlahSertifikasi * 30);

    // ============================================================
    // HISTORICAL RISK SCORE (bobot 10%) — persentase produk lain
    // dari producer yang sama yang PERNAH berstatus BERESIKO
    // ============================================================
    const { data: producerProducts } = await supabase
      .from("products")
      .select("id")
      .eq("producer_id", product.producer_id)
      .neq("id", productId);

    let historicalScore = 0;
    if (producerProducts && producerProducts.length > 0) {
      const productIds = producerProducts.map((p: any) => p.id);
      const { data: pastScores } = await supabase
        .from("risk_scores")
        .select("product_id, status")
        .in("product_id", productIds);

      const produkPernahBeresiko = new Set(
        (pastScores ?? []).filter((s: any) => s.status === "BERESIKO").map((s: any) => s.product_id)
      );
      historicalScore = (produkPernahBeresiko.size / producerProducts.length) * 100;
    }
    // Kalau producer belum punya produk lain sama sekali, historicalScore tetap 0 (default aman)

    // ============================================================
    // TOTAL SCORE (weighted sum) & STATUS
    // ============================================================
    const totalScore =
      freshnessScore * 0.3 +
      storageScore * 0.25 +
      distributionScore * 0.25 +
      complianceScore * 0.1 +
      historicalScore * 0.1;

    const status = totalScore <= 30 ? "AMAN" : totalScore <= 60 ? "WASPADA" : "BERESIKO";

    // ============================================================
    // CATATAN AI — default template lokal, opsional pakai Anthropic
    // ============================================================
    let catatanAi = "";
    let aiStatus: "local" | "ai" | "failed" = "local";

    const komponen = [
      { nama: "Kesegaran", skor: freshnessScore },
      { nama: "Penyimpanan", skor: storageScore },
      { nama: "Distribusi", skor: distributionScore },
      { nama: "Kepatuhan", skor: complianceScore },
      { nama: "Riwayat Risiko", skor: historicalScore },
    ];
    const komponenTertinggi = komponen.reduce((a, b) => (b.skor > a.skor ? b : a));

    if (status === "AMAN") {
      catatanAi = "Produk layak dikonsumsi, seluruh indikator berada di rentang aman.";
    } else if (status === "WASPADA") {
      catatanAi = `Perlu pengecekan lebih lanjut, terutama pada aspek ${komponenTertinggi.nama.toLowerCase()} yang paling berkontribusi terhadap skor risiko.`;
    } else {
      catatanAi = `Produk terindikasi berisiko tinggi, dipicu terutama oleh aspek ${komponenTertinggi.nama.toLowerCase()}. Tidak direkomendasikan untuk dikonsumsi.`;
    }

    if (ANTHROPIC_API_KEY) {
      try {
        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 150,
            messages: [
              {
                role: "user",
                content: `Produk pangan "${product.nama_produk}" (kategori ${category.nama_kategori}) punya skor risiko keamanan pangan ${totalScore.toFixed(0)}/100 berstatus ${status}. Breakdown: Kesegaran ${freshnessScore.toFixed(0)}, Penyimpanan ${storageScore.toFixed(0)}, Distribusi ${distributionScore.toFixed(0)}, Kepatuhan ${complianceScore.toFixed(0)}, Riwayat Risiko ${historicalScore.toFixed(0)}. Tulis 1-2 kalimat rekomendasi singkat dalam Bahasa Indonesia untuk konsumen, langsung ke poin tanpa basa-basi.`,
              },
            ],
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const text = aiData.content?.find((c: any) => c.type === "text")?.text;
          if (text) {
            catatanAi = text.trim();
            aiStatus = "ai";
          }
        } else {
          aiStatus = "failed";
        }
      } catch {
        aiStatus = "failed";
        // catatanAi tetap pakai template lokal di atas
      }
    }

    // ============================================================
    // INSERT row baru ke risk_scores (insert-only, bukan update)
    // ============================================================
    const { error: insertErr } = await supabase.from("risk_scores").insert({
      product_id: productId,
      freshness_score: freshnessScore,
      storage_score: storageScore,
      distribution_score: distributionScore,
      compliance_score: complianceScore,
      historical_score: historicalScore,
      total_score: totalScore,
      status,
      catatan_ai: catatanAi,
      ai_status: aiStatus,
    });

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, total_score: totalScore, status }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
