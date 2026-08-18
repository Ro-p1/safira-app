import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diset. Salin .env.example ke .env dan isi dengan kredensial project Supabase kamu."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
