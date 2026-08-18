import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { Producer } from "../types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  producer: Producer | null;
  loading: boolean;
  refreshProducer: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [producer, setProducer] = useState<Producer | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProducer(userId: string) {
    const { data } = await supabase.from("producers").select("*").eq("user_id", userId).maybeSingle();
    setProducer(data ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProducer(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProducer(session.user.id);
      } else {
        setProducer(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function refreshProducer() {
    if (session?.user) await loadProducer(session.user.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, producer, loading, refreshProducer, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
