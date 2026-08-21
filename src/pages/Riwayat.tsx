import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { getGuestHistory } from "../lib/guestHistory";
import { GuestScanRecord } from "../types";
import BottomNav from "../components/BottomNav";

interface ServerHistoryItem {
  id: string;
  waktu_scan: string;
  product: { id: string; nama_produk: string };
  status?: string;
  total_score?: number;
}

const statusColor: Record<string, string> = {
  AMAN: "#3E7D3E",
  WASPADA: "#D4AF37",
  BERESIKO: "#C0392B",
  MENUNGGU_DATA: "#9CA3AF",
};

export default function Riwayat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [serverHistory, setServerHistory] = useState<ServerHistoryItem[]>([]);
  const [guestHistory, setGuestHistory] = useState<GuestScanRecord[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (user) loadServerHistory();
    else setGuestHistory(getGuestHistory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadServerHistory() {
    const { data } = await supabase
      .from("scan_history")
      .select("id, waktu_scan, product:products(id, nama_produk)")
      .order("waktu_scan", { ascending: false });

    const items: ServerHistoryItem[] = [];
    for (const row of data ?? []) {
      const { data: scoreData } = await supabase
        .from("risk_scores")
        .select("status, total_score")
        .eq("product_id", (row as any).product.id)
        .order("dihitung_pada", { ascending: false })
        .limit(1)
        .maybeSingle();
      items.push({ ...(row as any), status: scoreData?.status, total_score: scoreData?.total_score });
    }
    setServerHistory(items);
  }

  const filteredServer = serverHistory.filter((h) =>
    h.product.nama_produk.toLowerCase().includes(query.toLowerCase())
  );
  const filteredGuest = guestHistory.filter((h) =>
    h.nama_produk.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="app-frame pb-24">
      <div className="gradient-header px-6 pt-6 pb-4 text-white">
        <h1 className="font-heading text-lg font-bold">Riwayat Scan</h1>
      </div>

      <div className="px-6 py-4">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama produk..."
            className="w-full border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm"
          />
        </div>
      </div>

      {!user && (
        <div className="mx-6 mb-4 bg-safira-mosslight/10 text-xs text-gray-500 rounded-2xl p-3">
          Login untuk menyimpan riwayat secara permanen di semua perangkat. Riwayat di bawah hanya
          tersimpan di perangkat ini.
        </div>
      )}

      <div className="px-6 space-y-3">
        {user &&
          filteredServer.map((h) => (
            <HistoryCard
              key={h.id}
              nama={h.product.nama_produk}
              waktu={h.waktu_scan}
              status={h.status ?? "MENUNGGU_DATA"}
              skor={h.total_score ?? 0}
              onClick={() => navigate(`/hasil/${h.product.id}`)}
            />
          ))}

        {!user &&
          filteredGuest.map((h, i) => (
            <HistoryCard
              key={i}
              nama={h.nama_produk}
              waktu={h.waktu_scan}
              status={h.status}
              skor={h.total_score}
              onClick={() => navigate(`/hasil/${h.product_id}`)}
            />
          ))}

        {((user && filteredServer.length === 0) || (!user && filteredGuest.length === 0)) && (
          <p className="text-center text-gray-400 text-sm py-10">Belum ada riwayat scan.</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function HistoryCard({
  nama,
  waktu,
  status,
  skor,
  onClick,
}: {
  nama: string;
  waktu: string;
  status: string;
  skor: number;
  onClick: () => void;
}) {
  const color = statusColor[status] ?? statusColor.MENUNGGU_DATA;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-left"
    >
      <div>
        <p className="font-medium text-safira-dark">{nama}</p>
        <p className="text-xs text-gray-400">{new Date(waktu).toLocaleString("id-ID")}</p>
      </div>
      <span
        className="px-3 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {status === "MENUNGGU_DATA" ? "-" : `${Math.round(skor)} · ${status}`}
      </span>
    </button>
  );
}
