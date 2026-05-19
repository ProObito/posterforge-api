import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({
    meta: [
      { title: "Sign In — Poster Maker API" },
      { name: "description", content: "Admin access to Poster Maker API control panel." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function Login() {
  const { access } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (access === "admin" || access === "allowed") nav({ to: "/endpoints" });
    else if (access === "pending") nav({ to: "/request-access" });
  }, [access, nav]);

  const signIn = async () => {
    setLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      toast.error("Sign in failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Poster Maker API</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Restricted access. Sign in with an authorized Google account.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={signIn} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with Google"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Not authorized?{" "}
            <a href="/request-access" className="underline">
              Request access
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
