import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { access, user } = useAuth();

  if (access === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (access === "guest") {
    throw redirect({ to: "/login" });
  }
  if (access === "pending") {
    throw redirect({ to: "/request-access" });
  }
  if (access === "admin" || access === "allowed") {
    throw redirect({ to: "/endpoints" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <p className="text-muted-foreground">Loading {user?.email}...</p>
      </div>
    </div>
  );
}
