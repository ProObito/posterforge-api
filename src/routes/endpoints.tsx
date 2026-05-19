import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Shield, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/endpoints")({
  component: Endpoints,
  head: () => ({
    meta: [
      { title: "API Endpoints — Poster Maker" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const exampleCurl = `curl -X POST "https://your-domain/api/v2/templates/anime/1/Naruto" \\
  -H "X-API-Key: pmk_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "X-Bot-Id: my-bot-username" \\
  -F "branding_text=@MangaCruise" \\
  -F "logo=@/path/to/logo.png" \\
  -F "cover_url=https://example.com/cover.jpg" \\
  -F "author=Masashi Kishimoto" \\
  -F "rating=9.2" \\
  -F "genres=Action,Shounen,Adventure" \\
  -F "meta_text=24 Episodes • 2002" \\
  -F "synopsis=Naruto Uzumaki, a young ninja..." \\
  -F "footer_text=FOR MORE VISIT @MANGA_CRUISE" \\
  -F "button_text=WATCH" \\
  --output poster.jpg`;

function Endpoints() {
  const { access, user, signOut } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (access === "guest") nav({ to: "/login" });
    else if (access === "pending") nav({ to: "/request-access" });
  }, [access, nav]);

  if (access === "loading" || access === "guest" || access === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success("Copied");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Poster Maker API</h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            {access === "admin" && (
              <Link to="/admin">
                <Button variant="default" size="sm">
                  <Shield className="h-4 w-4 mr-1" /> Admin
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">API Endpoints</h2>
          <p className="text-muted-foreground mt-1">
            Use your API key to generate posters. Each key is licensed to a specific number of bots.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Anime Poster — Dynamic Template</CardTitle>
              <Badge variant="secondary">POST</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-md p-3 font-mono text-sm flex items-center justify-between gap-2">
              <span className="break-all">
                /api/v2/templates/anime/<span className="text-primary">{"{num}"}</span>/
                <span className="text-primary">{"{name}"}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy("/api/v2/templates/anime/{num}/{name}")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium mb-2">Path params</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>
                    <code className="text-foreground">num</code> — template slot (1–100)
                  </li>
                  <li>
                    <code className="text-foreground">name</code> — anime title (URL-encoded)
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2">Required headers</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>
                    <code className="text-foreground">X-API-Key</code>
                  </li>
                  <li>
                    <code className="text-foreground">X-Bot-Id</code>
                  </li>
                </ul>
              </div>
            </div>

            <div className="text-sm">
              <p className="font-medium mb-2">Body (multipart/form-data)</p>
              <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                {[
                  "branding_text (text)",
                  "logo (file)",
                  "cover_url",
                  "author",
                  "rating",
                  "genres (csv)",
                  "meta_text",
                  "synopsis",
                  "footer_text",
                  "button_text",
                ].map((f) => (
                  <li key={f}>
                    <code className="text-foreground">{f}</code>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">Example</p>
                <Button size="sm" variant="ghost" onClick={() => copy(exampleCurl)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{exampleCurl}</pre>
            </div>

            <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
              <p>
                <strong>Responses:</strong>{" "}
                <code>200</code> image/jpeg • <code>401</code> bad key •{" "}
                <code>403</code> template not licensed • <code>429</code> bot limit reached •{" "}
                <code>502</code> render service down
              </p>
              <p>
                <strong>Template slugs:</strong> <code>animeposter</code>,{" "}
                <code>animeposter2</code> … <code>animeposter100</code>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground text-center">
          Need a key or extra bot slots? DM{" "}
          <a href="https://t.me/ProObito" className="underline" target="_blank" rel="noreferrer">
            @ProObito
          </a>
        </div>
      </main>
    </div>
  );
}
