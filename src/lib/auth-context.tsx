import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AccessState = "loading" | "guest" | "pending" | "allowed" | "admin";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  access: AccessState;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  access: "loading",
  signOut: async () => {},
  refresh: async () => {},
});

async function resolveAccess(user: User | null): Promise<AccessState> {
  if (!user) return "guest";
  // Check admin role
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (roles?.some((r) => r.role === "admin")) return "admin";
  // Check allowed_emails
  const email = user.email?.toLowerCase();
  if (!email) return "pending";
  const { data: allowed } = await supabase
    .from("allowed_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  return allowed ? "allowed" : "pending";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<AccessState>("loading");

  const recompute = async (s: Session | null) => {
    setAccess(await resolveAccess(s?.user ?? null));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setTimeout(() => recompute(s), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      recompute(data.session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        access,
        signOut: async () => {
          await supabase.auth.signOut();
        },
        refresh: async () => recompute(session),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
