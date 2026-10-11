import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, configured } from "../../lib/supabase";
import { State } from "../../components/ui";
export const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  configured: boolean;
}>({ session: null, loading: true, configured });
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const cache = useQueryClient();
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === "SIGNED_OUT") cache.clear();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [cache]);
  return (
    <AuthContext.Provider value={{ session, loading, configured }}>
      {children}
    </AuthContext.Provider>
  );
}
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <State loading />;
  if (!auth.session)
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  return children;
}
