import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitAccessRequest } from "@/lib/access.functions";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Send, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/request-access")({
  component: RequestAccess,
  head: () => ({
    meta: [
      { title: "Request Access — Poster Maker API" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function RequestAccess() {
  const { user, signOut } = useAuth();
  const submit = useServerFn(submitAccessRequest);
  const [email, setEmail] = useState(user?.email ?? "");
  const [tg, setTg] = useState("");
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await submit({ data: { email, telegram_username: tg, reason } });
      setSent(true);
      toast.success("Request sent to owner");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Request Access</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            This is a private API. Send your details to the owner to get whitelisted.
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <p className="font-medium">Request sent</p>
              <p className="text-sm text-muted-foreground">
                Contact the owner directly on Telegram:{" "}
                <a
                  href="https://t.me/ProObito"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary"
                >
                  t.me/ProObito
                </a>
              </p>
              {user && (
                <Button variant="outline" size="sm" onClick={signOut}>
                  <LogOut className="h-3 w-3 mr-1" /> Sign out
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label>Your Gmail</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                />
              </div>
              <div>
                <Label>Telegram Username</Label>
                <Input
                  value={tg}
                  onChange={(e) => setTg(e.target.value)}
                  placeholder="ProObito (without @)"
                />
              </div>
              <div>
                <Label>Why do you need access? (optional)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Send className="h-4 w-4 mr-2" />
                {loading ? "Sending..." : "Send Request"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Or DM the owner directly:{" "}
                <a
                  href="https://t.me/ProObito"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  t.me/ProObito
                </a>
              </p>
              {user && (
                <button
                  type="button"
                  onClick={signOut}
                  className="text-xs text-muted-foreground underline w-full text-center"
                >
                  Sign out ({user.email})
                </button>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
