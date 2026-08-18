import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      navigate("/profil");
    }
  }

  return (
    <div className="app-frame">
      <div className="gradient-header px-6 pt-6 pb-4 text-white flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-heading text-lg font-bold">{mode === "login" ? "Masuk" : "Daftar"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-8 space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full border border-gray-200 rounded-2xl px-4 py-3"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={6}
          className="w-full border border-gray-200 rounded-2xl px-4 py-3"
        />
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl p-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="gradient-btn w-full py-4 rounded-2xl text-white font-semibold shadow-lg disabled:opacity-50"
        >
          {loading ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="w-full text-sm text-safira-dark text-center"
        >
          {mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
        </button>
      </form>
    </div>
  );
}
