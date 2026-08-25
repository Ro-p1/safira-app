import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { ArrowLeft, MapPin, Truck, Thermometer, Droplet, Link2, ShieldCheck } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabase";
import { Product, DistributionLog, ProductCategory, RiskScore } from "../types";
import BottomNav from "../components/BottomNav";

// Leaflet + bundler modern (Vite) butuh path ikon default di-set ulang manual,
// kalau tidak marker bawaan akan tampil rusak/hilang.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type GeoPoint = {
  lat: number;
  lng: number;
  label: string;
  sub: string;
  time: string;
  isWarning: boolean;
  isStart: boolean;
};

function truckDivIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="background:#1F3D2E;width:34px;height:34px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid white;">
             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
             </svg>
           </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function stopDivIcon(isWarning: boolean, isStart: boolean) {
  const bg = isWarning ? "#EF4444" : isStart ? "#1F3D2E" : "#7C9A6E";
  return L.divIcon({
    className: "",
    html: `<div style="background:${bg};width:16px;height:16px;border-radius:9999px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [32, 32] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((p) => `${p.lat},${p.lng}`).join("|")]);
  return null;
}

// Warna & label status — disamakan persis dengan Hasil Analisis, supaya
// badge "STATUS" di sini gak lagi pakai perhitungan sendiri yang cuma
// ngecek 1 titik terakhir (Aman/Waspada doang, gak pernah bisa BERESIKO).
const STATUS_COLOR: Record<string, string> = {
  AMAN: "#3E7D3E",
  WASPADA: "#D4AF37",
  BERESIKO: "#C0392B",
  MENUNGGU_DATA: "#9CA3AF",
};
const STATUS_LABEL: Record<string, string> = {
  AMAN: "Aman",
  WASPADA: "Waspada",
  BERESIKO: "Beresiko",
  MENUNGGU_DATA: "Menunggu Data",
};

export default function Tracking() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [logs, setLogs] = useState<DistributionLog[]>([]);
  const [score, setScore] = useState<RiskScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Rute yang benar-benar ngikutin jalan (bukan garis lurus tembus).
  // Diambil dari OSRM (layanan routing publik gratis, tanpa API key).
  // Kalau gagal/masih diproses, fallback-nya tetap garis lurus supaya
  // peta gak kosong.
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);

  useEffect(() => {
    const points: { lat: number; lng: number }[] = [];
    if (product?.produksi_lat != null && product?.produksi_lng != null) {
      points.push({ lat: product.produksi_lat, lng: product.produksi_lng });
    }
    logs.forEach((log) => {
      if (log.lat != null && log.lng != null) points.push({ lat: log.lat, lng: log.lng });
    });

    if (points.length < 2) {
      setRouteCoords(null);
      return;
    }

    let cancelled = false;
    // OSRM minta format lng,lat (kebalikan dari lat,lng yang biasa dipakai di app ini).
    const coordsParam = points.map((p) => `${p.lng},${p.lat}`).join(";");
    fetch(`https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const coords = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
        if (Array.isArray(coords) && coords.length > 1) {
          // GeoJSON balikin [lng, lat], Leaflet butuh [lat, lng] — dibalik dulu.
          setRouteCoords(coords.map((c) => [c[1], c[0]] as [number, number]));
        } else {
          setRouteCoords(null);
        }
      })
      .catch(() => {
        if (!cancelled) setRouteCoords(null);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.produksi_lat, product?.produksi_lng, logs.map((l) => `${l.lat},${l.lng}`).join("|")]);

  async function load() {
    setLoading(true);
    const { data: productData } = await supabase
      .from("products")
      .select("*, product_categories(*)")
      .eq("id", productId)
      .single();

    // Ambil SEMUA versi produk ini (hasil "Ajukan Koreksi Data" bikin baris
    // baru tapi qr_code_value-nya tetap sama) — supaya titik distribusi dan
    // titik produksi dari versi-versi sebelumnya tetap kebaca di peta,
    // bukan cuma nempel ke 1 ID versi yang paling baru.
    let allVersionIds = [productId];
    let effectiveProduct = productData;
    if (productData?.qr_code_value) {
      const { data: versions } = await supabase
        .from("products")
        .select("id, produksi_lat, produksi_lng, dibuat_pada")
        .eq("qr_code_value", productData.qr_code_value)
        .order("dibuat_pada", { ascending: false });
      if (versions && versions.length > 0) {
        allVersionIds = versions.map((v) => v.id);
        // Kalau versi terbaru gak punya koordinat produksi (misal abis
        // dikoreksi tapi datanya kosong), pakai koordinat dari versi
        // sebelumnya yang masih punya, biar titik produksi gak hilang.
        if (productData.produksi_lat == null || productData.produksi_lng == null) {
          const withCoords = versions.find((v) => v.produksi_lat != null && v.produksi_lng != null);
          if (withCoords) {
            effectiveProduct = {
              ...productData,
              produksi_lat: withCoords.produksi_lat,
              produksi_lng: withCoords.produksi_lng,
            };
          }
        }
      }
    }

    setProduct(effectiveProduct);
    setCategory(productData?.product_categories ?? null);

    const { data: scoreData } = await supabase
      .from("risk_scores")
      .select("*")
      .in("product_id", allVersionIds)
      .order("dihitung_pada", { ascending: false })
      .limit(1)
      .maybeSingle();
    setScore(scoreData);

    const { data: logData } = await supabase
      .from("distribution_logs")
      .select("*")
      .in("product_id", allVersionIds)
      .order("waktu_dicatat", { ascending: true });

    setLogs(logData ?? []);
    setLoading(false);
  }

  if (loading) {
    return <div className="app-frame flex items-center justify-center min-h-screen">Memuat...</div>;
  }

  if (!product) {
    return <div className="app-frame p-6">Produk tidak ditemukan.</div>;
  }

  function isLogWarning(log: DistributionLog) {
    return !!(
      category &&
      (log.suhu < category.suhu_aman_min ||
        log.suhu > category.suhu_aman_max ||
        log.kelembapan < category.kelembapan_aman_min ||
        log.kelembapan > category.kelembapan_aman_max)
    );
  }

  // Bangun titik-titik peta dari data yang PUNYA koordinat saja.
  const geoPoints: GeoPoint[] = [];
  if (product.produksi_lat != null && product.produksi_lng != null) {
    geoPoints.push({
      lat: product.produksi_lat,
      lng: product.produksi_lng,
      label: product.nama_produk,
      sub: product.lokasi_produksi,
      time: product.dibuat_pada,
      isWarning: false,
      isStart: true,
    });
  }
  logs.forEach((log) => {
    if (log.lat != null && log.lng != null) {
      geoPoints.push({
        lat: log.lat,
        lng: log.lng,
        label: log.lokasi_transit,
        sub: `${log.suhu}°C · ${log.kelembapan}% RH · ${log.nama_petugas}`,
        time: log.waktu_dicatat,
        isWarning: isLogWarning(log),
        isStart: false,
      });
    }
  });

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const currentPoint = geoPoints.length > 0 ? geoPoints[geoPoints.length - 1] : null;
  const hasWarningNow = latestLog ? isLogWarning(latestLog) : false;

  const chartData = logs.map((log, i) => ({
    label: `T${i + 1}`,
    suhu: log.suhu,
    kelembapan: log.kelembapan,
  }));

  const suhuRata =
    logs.length > 0 ? (logs.reduce((sum, l) => sum + l.suhu, 0) / logs.length).toFixed(1) : "-";
  const lembabRata =
    logs.length > 0 ? (logs.reduce((sum, l) => sum + l.kelembapan, 0) / logs.length).toFixed(0) : "-";

  const durasiJam =
    logs.length > 0
      ? (
          (new Date(logs[logs.length - 1].waktu_dicatat).getTime() -
            new Date(product.dibuat_pada).getTime()) /
          (1000 * 60 * 60)
        ).toFixed(1)
      : "0";

  return (
    <div className="app-frame pb-24">
      {/* Peta */}
      <div className="relative">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-[1000] bg-white rounded-full w-10 h-10 flex items-center justify-center shadow-md"
        >
          <ArrowLeft size={20} className="text-safira-dark" />
        </button>

        {geoPoints.length > 0 ? (
          <div className="h-72 w-full">
            <MapContainer
              center={[geoPoints[0].lat, geoPoints[0].lng]}
              zoom={13}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds points={geoPoints} />
              {geoPoints.length > 1 && (
                <Polyline
                  // Pakai rute jalan (routeCoords) kalau sudah didapat dari OSRM;
                  // kalau belum/gagal, sementara tampilkan garis lurus dulu.
                  positions={routeCoords ?? geoPoints.map((p) => [p.lat, p.lng])}
                  pathOptions={{ color: "#1F3D2E", weight: 4, opacity: 0.85 }}
                />
              )}
              {geoPoints.map((p, i) => {
                const isLast = i === geoPoints.length - 1;
                return (
                  <Marker
                    key={i}
                    position={[p.lat, p.lng]}
                    icon={isLast ? truckDivIcon() : stopDivIcon(p.isWarning, p.isStart)}
                  >
                    <Popup>
                      <p className="font-semibold text-sm">{p.label}</p>
                      <p className="text-xs text-gray-500">{p.sub}</p>
                      <p className="text-[10px] text-gray-400">{new Date(p.time).toLocaleString("id-ID")}</p>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        ) : (
          <div className="h-56 w-full bg-safira-mosslight/10 flex flex-col items-center justify-center text-center px-8">
            <MapPin size={28} className="text-safira-moss mb-2" />
            <p className="text-sm text-gray-500">
              Peta belum tersedia. Titik lokasi produksi/distribusi produk ini belum punya koordinat GPS.
            </p>
          </div>
        )}
      </div>

      {/* Kartu info seperti bottom sheet */}
      <div className="-mt-6 relative z-10 bg-white rounded-t-3xl shadow-lg">
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
        </div>

        <div className="gradient-header mx-4 mt-3 rounded-2xl px-5 py-4 text-white">
          <p className="text-xs text-white/70">{currentPoint ? "Posisi terkini" : "Produk"}</p>
          <h1 className="font-heading text-xl font-bold">{product.nama_produk}</h1>
          <p className="text-sm text-white/80">{currentPoint?.label ?? product.lokasi_produksi}</p>
        </div>

        <div className="px-5 pt-4 grid grid-cols-2 gap-3">
          <InfoStat
            icon={<Thermometer size={16} />}
            label="Suhu"
            value={latestLog ? `${latestLog.suhu}°C` : "-"}
            warn={hasWarningNow}
          />
          <InfoStat
            icon={<Droplet size={16} />}
            label="Lembab"
            value={latestLog ? `${latestLog.kelembapan}%` : "-"}
            warn={hasWarningNow}
          />
          <InfoStat icon={<Link2 size={16} />} label="Blockchain" value={`${logs.length + 1} rekaman`} />
          <InfoStat
            icon={<ShieldCheck size={16} />}
            label="Status"
            value={score ? STATUS_LABEL[score.status] ?? score.status : "Menunggu Data"}
            warn={score ? score.status !== "AMAN" : false}
          />
        </div>

        {latestLog && (
          <div className="px-5 pt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-safira-mosslight/30 flex items-center justify-center text-safira-dark">
              <Truck size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-safira-dark">{latestLog.nama_petugas}</p>
              <p className="text-xs text-gray-400">Petugas pencatat titik terakhir</p>
            </div>
          </div>
        )}

        <div className="px-5 pt-5 pb-2">
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<MapPin size={18} />} value={logs.length.toString()} label="Titik Transit" />
            <StatCard icon={<Truck size={18} />} value={`${durasiJam} jam`} label="Durasi" />
            <StatCard icon={<Thermometer size={18} />} value={`${suhuRata}°C`} label="Suhu Rata-rata" />
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
            <h3 className="font-heading font-semibold text-safira-dark mb-1">Pelacakan Berkala</h3>
            {category && (
              <p className="text-xs text-gray-400 mb-4">
                Rentang aman kategori {category.nama_kategori}: {category.suhu_aman_min}°C – {category.suhu_aman_max}°C
                {" · "}Kelembapan rata-rata {lembabRata}%
              </p>
            )}
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="suhu" stroke="#1F3D2E" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 py-8 text-center">
                Belum ada catatan distribusi untuk produk ini.
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
            <h3 className="font-heading font-semibold text-safira-dark mb-4">Rute Perjalanan (Rekam Blockchain)</h3>
            <div className="space-y-4">
              <RouteStep
                label={product.nama_produk}
                sub={product.lokasi_produksi}
                time={product.dibuat_pada}
                hash={product.record_hash}
                color="bg-safira-dark"
              />
              {logs.map((log) => (
                <RouteStep
                  key={log.id}
                  label={log.lokasi_transit}
                  sub={`${log.suhu}°C · ${log.kelembapan}% RH · ${log.nama_petugas}`}
                  time={log.waktu_dicatat}
                  hash={log.record_hash}
                  color={isLogWarning(log) ? "bg-red-500" : "bg-safira-mosslight"}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-6">
          <button
            onClick={() => navigate(`/hasil/${product.id}`)}
            className="gradient-btn w-full py-4 rounded-2xl text-white font-semibold shadow-lg"
          >
            Lihat Hasil Analisis AI
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

function InfoStat({
  icon,
  label,
  value,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 flex items-center gap-3 ${
        warn ? "bg-red-50" : "bg-safira-mosslight/10"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0 ${
          warn ? "bg-red-500" : "bg-safira-dark"
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-gray-400 uppercase">{label}</p>
        <p className="text-sm font-bold text-safira-dark">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-col items-center gap-1 shadow-sm">
      <div className="text-safira-moss">{icon}</div>
      <span className="font-heading font-bold text-safira-dark">{value}</span>
      <span className="text-[10px] text-gray-400 uppercase text-center">{label}</span>
    </div>
  );
}

function RouteStep({
  label,
  sub,
  time,
  hash,
  color,
}: {
  label: string;
  sub: string;
  time: string;
  hash: string;
  color: string;
}) {
  return (
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-full ${color} flex-shrink-0 flex items-center justify-center text-white`}>
        <Truck size={14} />
      </div>
      <div>
        <p className="font-medium text-sm text-safira-dark">{label}</p>
        <p className="text-xs text-gray-500">{sub}</p>
        <p className="text-[10px] text-gray-400">
          {new Date(time).toLocaleString("id-ID")} · {hash.slice(0, 8)}...{hash.slice(-6)}
        </p>
      </div>
    </div>
  );
}
