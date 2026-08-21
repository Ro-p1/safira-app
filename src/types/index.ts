export interface ProductCategory {
  id: string;
  nama_kategori: string;
  suhu_aman_min: number;
  suhu_aman_max: number;
  kelembapan_aman_min: number;
  kelembapan_aman_max: number;
  masa_simpan_wajar_hari: number;
}

export interface Producer {
  id: string;
  user_id: string;
  nama: string;
  kontak: string;
  lokasi: string;
  status_verifikasi: "pending" | "approved" | "rejected";
  dibuat_pada: string;
}

export interface Product {
  id: string;
  producer_id: string;
  category_id: string;
  nama_produk: string;
  lokasi_produksi: string;
  produksi_lat: number | null;
  produksi_lng: number | null;
  tanggal_panen: string;
  metode_produksi: string | null;
  sertifikasi: string[];
  foto_url: string | null;
  qr_code_value: string;
  supersedes_id: string | null;
  prev_hash: string;
  record_hash: string;
  dibuat_pada: string;
  product_categories?: ProductCategory;
}

export interface DistributionLog {
  id: string;
  product_id: string;
  lokasi_transit: string;
  lat: number | null;
  lng: number | null;
  suhu: number;
  kelembapan: number;
  waktu_dicatat: string;
  nama_petugas: string;
  prev_hash: string;
  record_hash: string;
}

export type RiskStatus = "AMAN" | "WASPADA" | "BERESIKO" | "MENUNGGU_DATA";

export interface RiskScore {
  id: string;
  product_id: string;
  freshness_score: number;
  storage_score: number;
  distribution_score: number;
  compliance_score: number;
  historical_score: number;
  total_score: number;
  status: "AMAN" | "WASPADA" | "BERESIKO";
  catatan_ai: string | null;
  ai_status: "local" | "ai" | "failed";
  dihitung_pada: string;
}

export interface ScanHistoryItem {
  id: string;
  user_id: string | null;
  product_id: string;
  waktu_scan: string;
  product?: Product;
  risk_score?: RiskScore;
}

// Item riwayat yang disimpan di localStorage untuk guest
export interface GuestScanRecord {
  product_id: string;
  qr_code_value: string;
  nama_produk: string;
  status: string;
  total_score: number;
  waktu_scan: string;
  foto_url?: string | null;
}
