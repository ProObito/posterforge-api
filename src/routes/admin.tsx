import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  adminListRequests,
  adminDecideRequest,
  adminListAllowedEmails,
  adminAddAllowedEmail,
  adminRemoveAllowedEmail,
  adminListTemplates,
  adminUpdateTemplate,
  adminListApiKeys,
  adminCreateApiKey,
  adminUpdateApiKey,
  adminDeleteApiKey,
  adminRemoveBot,
  adminListLogs,
} from "@/lib/admin.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, Copy, Check, X, Shield, LogOut, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: Admin,
  head: () => ({
    meta: [
      { title: "Admin — Poster Maker API" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function Admin() {
  const { access, signOut, user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (access === "guest") nav({ to: "/login" });
    else if (access === "pending") nav({ to: "/request-access" });
    else if (access === "allowed") nav({ to: "/endpoints" });
  }, [access, nav]);

  if (access !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/endpoints">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Endpoints
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <Tabs defaultValue="keys" className="space-y-4">
          <TabsList>
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="allowed">Allowed Emails</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
          <TabsContent value="keys">
            <KeysTab />
          </TabsContent>
          <TabsContent value="templates">
            <TemplatesTab />
          </TabsContent>
          <TabsContent value="requests">
            <RequestsTab />
          </TabsContent>
          <TabsContent value="allowed">
            <AllowedTab />
          </TabsContent>
          <TabsContent value="logs">
            <LogsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ===== KEYS =====
function KeysTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListApiKeys);
  const listTpl = useServerFn(adminListTemplates);
  const create = useServerFn(adminCreateApiKey);
  const update = useServerFn(adminUpdateApiKey);
  const del = useServerFn(adminDeleteApiKey);
  const removeBot = useServerFn(adminRemoveBot);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api_keys"],
    queryFn: () => list(),
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: () => listTpl(),
  });

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [botLimit, setBotLimit] = useState(1);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: async () =>
      await create({
        data: {
          label,
          customer_note: note,
          bot_limit: botLimit,
          allowed_template_slugs: selectedSlugs,
        },
      }),
    onSuccess: (row: any) => {
      setCreatedKey(row.key);
      qc.invalidateQueries({ queryKey: ["api_keys"] });
      setLabel("");
      setNote("");
      setBotLimit(1);
      setSelectedSlugs([]);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">API Keys</h2>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setCreatedKey(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> New Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{createdKey ? "Key Created" : "New API Key"}</DialogTitle>
            </DialogHeader>
            {createdKey ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Save this key now — you won't see it again in full form (but it's stored in DB).
                </p>
                <div className="bg-muted rounded-md p-3 font-mono text-sm break-all">
                  {createdKey}
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(createdKey);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Label *</Label>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Client name"
                  />
                </div>
                <div>
                  <Label>Note</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div>
                  <Label>Bot Limit *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={botLimit}
                    onChange={(e) => setBotLimit(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    How many unique bots this key can be used from.
                  </p>
                </div>
                <div>
                  <Label>Allowed Templates</Label>
                  <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1 mt-1">
                    {templates.map((t: any) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedSlugs.includes(t.slug)}
                          onCheckedChange={(v) =>
                            setSelectedSlugs((prev) =>
                              v ? [...prev, t.slug] : prev.filter((s) => s !== t.slug),
                            )
                          }
                        />
                        <span className="font-mono text-xs">{t.slug}</span>
                        {!t.active && <Badge variant="secondary">inactive</Badge>}
                      </label>
                    ))}
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={!label || createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  {createMut.isPending ? "Creating..." : "Create Key"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <div className="space-y-3">
          {keys.length === 0 && (
            <p className="text-sm text-muted-foreground">No keys yet.</p>
          )}
          {keys.map((k: any) => (
            <Card key={k.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{k.label}</p>
                      {k.active ? (
                        <Badge>active</Badge>
                      ) : (
                        <Badge variant="destructive">revoked</Badge>
                      )}
                      <Badge variant="outline">
                        {k.bots.length}/{k.bot_limit} bots
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                      <span className="truncate">{k.key}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(k.key);
                          toast.success("Copied");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    {k.customer_note && (
                      <p className="text-xs text-muted-foreground">{k.customer_note}</p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {k.allowed_template_slugs.map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await update({ data: { id: k.id, active: !k.active } });
                        qc.invalidateQueries({ queryKey: ["api_keys"] });
                      }}
                    >
                      {k.active ? "Revoke" : "Reactivate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        if (!confirm("Delete this key permanently?")) return;
                        await del({ data: { id: k.id } });
                        qc.invalidateQueries({ queryKey: ["api_keys"] });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <EditKey k={k} templates={templates} />
                {k.bots.length > 0 && (
                  <div className="border-t pt-2">
                    <p className="text-xs font-medium mb-1">Registered bots:</p>
                    <div className="space-y-1">
                      {k.bots.map((b: any) => (
                        <div
                          key={b.bot_id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="font-mono">{b.bot_id}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={async () => {
                              await removeBot({
                                data: { api_key_id: k.id, bot_id: b.bot_id },
                              });
                              qc.invalidateQueries({ queryKey: ["api_keys"] });
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EditKey({ k, templates }: { k: any; templates: any[] }) {
  const qc = useQueryClient();
  const update = useServerFn(adminUpdateApiKey);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(k.bot_limit);
  const [slugs, setSlugs] = useState<string[]>(k.allowed_template_slugs);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-xs">
          Edit limit / templates
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Key: {k.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Bot Limit</Label>
            <Input
              type="number"
              min={1}
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <Label>Allowed Templates</Label>
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1 mt-1">
              {templates.map((t: any) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={slugs.includes(t.slug)}
                    onCheckedChange={(v) =>
                      setSlugs((prev) =>
                        v ? [...prev, t.slug] : prev.filter((s) => s !== t.slug),
                      )
                    }
                  />
                  <span className="font-mono text-xs">{t.slug}</span>
                </label>
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            onClick={async () => {
              await update({
                data: { id: k.id, bot_limit: limit, allowed_template_slugs: slugs },
              });
              qc.invalidateQueries({ queryKey: ["api_keys"] });
              toast.success("Saved");
              setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== TEMPLATES =====
function TemplatesTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListTemplates);
  const update = useServerFn(adminUpdateTemplate);
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => list(),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Set the external Python render URL for each template. Toggle active to enable.
      </p>
      <div className="space-y-2">
        {templates.map((t: any) => (
          <TemplateRow
            key={t.id}
            t={t}
            onSave={async (patch) => {
              await update({ data: { id: t.id, ...patch } });
              qc.invalidateQueries({ queryKey: ["templates"] });
              toast.success("Saved");
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateRow({
  t,
  onSave,
}: {
  t: any;
  onSave: (p: any) => Promise<void>;
}) {
  const [url, setUrl] = useState(t.external_endpoint_url ?? "");
  const [active, setActive] = useState(t.active);
  return (
    <Card>
      <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-32 flex-shrink-0">
          <p className="font-mono text-sm">{t.slug}</p>
          <p className="text-xs text-muted-foreground">{t.display_name}</p>
        </div>
        <Input
          placeholder="https://your-python-service.com/render"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} />
          <span className="text-xs">{active ? "on" : "off"}</span>
        </div>
        <Button
          size="sm"
          onClick={() => onSave({ external_endpoint_url: url || null, active })}
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

// ===== REQUESTS =====
function RequestsTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListRequests);
  const decide = useServerFn(adminDecideRequest);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["access_requests"],
    queryFn: () => list(),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No requests.</p>}
      {rows.map((r: any) => (
        <Card key={r.id}>
          <CardContent className="pt-4 flex items-start justify-between gap-3">
            <div className="space-y-1 text-sm min-w-0">
              <p className="font-medium">{r.email}</p>
              {r.telegram_username && (
                <p className="text-xs text-muted-foreground">
                  Telegram:{" "}
                  <a
                    href={`https://t.me/${r.telegram_username.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    @{r.telegram_username.replace(/^@/, "")}
                  </a>
                </p>
              )}
              {r.reason && <p className="text-xs">{r.reason}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <Badge
                variant={
                  r.status === "approved"
                    ? "default"
                    : r.status === "denied"
                      ? "destructive"
                      : "secondary"
                }
              >
                {r.status}
              </Badge>
              {r.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await decide({ data: { id: r.id, approve: true } });
                      qc.invalidateQueries({ queryKey: ["access_requests"] });
                      qc.invalidateQueries({ queryKey: ["allowed_emails"] });
                    }}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      await decide({ data: { id: r.id, approve: false } });
                      qc.invalidateQueries({ queryKey: ["access_requests"] });
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ===== ALLOWED EMAILS =====
function AllowedTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListAllowedEmails);
  const add = useServerFn(adminAddAllowedEmail);
  const remove = useServerFn(adminRemoveAllowedEmail);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["allowed_emails"],
    queryFn: () => list(),
  });
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-4 flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="email@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button
            onClick={async () => {
              try {
                await add({ data: { email, note: note || undefined } });
                setEmail("");
                setNote("");
                qc.invalidateQueries({ queryKey: ["allowed_emails"] });
              } catch (e: any) {
                toast.error(e?.message ?? "Failed");
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        rows.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="pt-4 flex items-center justify-between">
              <div className="text-sm">
                <p className="font-medium">{r.email}</p>
                {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  if (!confirm("Remove access?")) return;
                  await remove({ data: { id: r.id } });
                  qc.invalidateQueries({ queryKey: ["allowed_emails"] });
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ===== LOGS =====
function LogsTab() {
  const list = useServerFn(adminListLogs);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["api_logs"],
    queryFn: () => list(),
    refetchInterval: 10000,
  });
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-1 text-xs font-mono">
      {rows.length === 0 && <p className="text-muted-foreground">No requests yet.</p>}
      {rows.map((l: any) => (
        <div key={l.id} className="border rounded-md p-2 flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-muted-foreground">
            {new Date(l.created_at).toLocaleTimeString()}
          </span>
          <Badge variant={l.status >= 400 ? "destructive" : "default"}>{l.status}</Badge>
          <span>{l.template_slug}</span>
          <span className="text-muted-foreground">bot:{l.bot_id}</span>
          <span className="text-muted-foreground">{l.duration_ms}ms</span>
          {l.error && <span className="text-destructive">{l.error}</span>}
        </div>
      ))}
    </div>
  );
}
