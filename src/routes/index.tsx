import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListApiKeys } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Shield, LayoutDashboard, Sparkles, Image as ImageIcon, Download, Key } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const { access, user, signOut } = useAuth();
  const navigate = useNavigate();
  const listKeys = useServerFn(adminListApiKeys);

  const [posterType, setPosterType] = useState("anime");
  const [templateNum, setTemplateNum] = useState("1");
  const [titleName, setTitleName] = useState("");
  const [brandingText, setBrandingText] = useState("");
  const [selectedApiKey, setSelectedApiKey] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);

  const { data: keys = [] } = useQuery({
    queryKey: ["api_keys_dashboard"],
    queryFn: () => listKeys(),
    enabled: access === "admin" || access === "allowed",
  });

  // Access Logic: Agar allowed nahi hai toh hatao yaha se
  useEffect(() => {
    if (access === "guest") navigate({ to: "/login" });
    else if (access === "pending") navigate({ to: "/request-access" });
  }, [access, navigate]);

  useEffect(() => {
    if (keys.length > 0 && !selectedApiKey) setSelectedApiKey(keys[0].key);
  }, [keys, selectedApiKey]);

  if (access !== "admin" && access !== "allowed") {
    return <div className="flex min-h-screen items-center justify-center bg-[#09090b]"><Loader2 className="h-8 w-8 animate-spin text-[#ff1e27]" /></div>;
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleName) return toast.error("Please enter a Title/Name");
    if (!selectedApiKey) return toast.error("Please provide an API Key");

    setIsGenerating(true);
    setGeneratedImgUrl(null);

    try {
      const formData = new FormData();
      if (brandingText) formData.append("branding_text", brandingText);

      const response = await fetch(`/api/v2/templates/${posterType}/${templateNum}/${encodeURIComponent(titleName)}`, {
        method: "POST",
        headers: { "X-API-Key": selectedApiKey, "X-Bot-Id": "WEB_DASHBOARD" },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(errData.error || "Server error");
      }

      const blob = await response.blob();
      setGeneratedImgUrl(URL.createObjectURL(blob));
      toast.success("Poster rendered successfully!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 selection:bg-[#ff1e27] selection:text-white">
      <header className="border-b border-neutral-800 bg-[#0c0c0e]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-[#ff1e27]" />
            <div>
              <h1 className="text-xl font-bold">PosterForge Studio</h1>
              <p className="text-xs text-neutral-500 font-mono">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-3">
            {access === "admin" && (
              <Link to="/admin">
                <Button variant="outline" size="sm" className="bg-neutral-900 border-neutral-800 hover:text-white"><Shield className="h-4 w-4 mr-2 text-[#ff1e27]" /> Admin</Button>
              </Link>
            )}
            <Button variant="destructive" size="sm" onClick={signOut} className="bg-[#ff1e27] text-white">Logout</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-[#0c0c0e] border-neutral-800 shadow-xl">
            <CardHeader className="border-b border-neutral-900 pb-4">
              <CardTitle className="text-lg flex items-center gap-2"><LayoutDashboard className="h-4 w-4 text-[#ff1e27]" /> Studio Parameters</CardTitle>
              <CardDescription>Select category and trigger rendering.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleGenerate} className="space-y-5">
                
                {/* All 6 Types Grid */}
                <div className="space-y-2">
                  <Label className="text-xs text-neutral-400">POSTER CATEGORY</Label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-950 rounded-lg border border-neutral-800">
                    {["anime", "manga", "movie", "tvseries", "code", "fanart"].map((type) => (
                      <button
                        key={type} type="button" onClick={() => setPosterType(type)}
                        className={`py-2 text-xs font-medium rounded-md capitalize transition-all ${
                          posterType === type ? "bg-[#ff1e27] text-white" : "text-neutral-400 hover:bg-neutral-900"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-neutral-400">Template ID</Label>
                    <Input type="number" min="1" max="100" value={templateNum} onChange={(e) => setTemplateNum(e.target.value)} className="bg-neutral-950 border-neutral-800 h-9 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-400">Target Search Query</Label>
                    <Input placeholder="e.g. Naruto" value={titleName} onChange={(e) => setTitleName(e.target.value)} className="bg-neutral-950 border-neutral-800 h-9 mt-1" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-neutral-400">Custom Branding Text</Label>
                  <Input placeholder="@MyAwesomeBot" value={brandingText} onChange={(e) => setBrandingText(e.target.value)} className="bg-neutral-950 border-neutral-800 h-9 mt-1" />
                </div>

                <div className="border-t border-neutral-900 pt-4">
                  <Label className="text-xs text-neutral-400 flex items-center gap-1"><Key className="h-3 w-3 text-[#ff1e27]" /> License Key</Label>
                  {keys.length > 0 ? (
                    <select value={selectedApiKey} onChange={(e) => setSelectedApiKey(e.target.value)} className="w-full mt-1.5 h-9 bg-neutral-950 border border-neutral-800 rounded-md text-xs px-3 text-neutral-200 outline-none">
                      {keys.map((k: any) => <option key={k.id} value={k.key}>{k.label}</option>)}
                    </select>
                  ) : (
                    <Input type="password" value={selectedApiKey} onChange={(e) => setSelectedApiKey(e.target.value)} className="bg-neutral-950 border-neutral-800 h-9 mt-1" />
                  )}
                </div>

                <Button type="submit" disabled={isGenerating} className="w-full bg-[#ff1e27] hover:bg-[#d6131b] text-white py-2 rounded-md transition-all">
                  {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate Poster</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Image Render Section */}
        <div className="lg:col-span-7">
          <Card className="bg-[#0c0c0e] border-neutral-800 h-full min-h-[500px] flex flex-col overflow-hidden shadow-xl">
            <CardHeader className="border-b border-neutral-900 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="h-4 w-4 text-neutral-400" /> Render View</CardTitle>
              {generatedImgUrl && (
                <a href={generatedImgUrl} download={`${posterType}-${titleName}.jpg`}>
                  <Button size="sm" variant="outline" className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white"><Download className="h-4 w-4 mr-1" /> Save</Button>
                </a>
              )}
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center p-6 relative">
              {isGenerating && (
                <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-[#ff1e27]" />
                  <p className="text-sm font-mono text-neutral-300 animate-pulse">Running Python Fetchers & Compiling...</p>
                </div>
              )}
              {generatedImgUrl ? (
                <img src={generatedImgUrl} alt="Output" className="max-w-md w-full h-auto rounded-lg shadow-2xl border border-neutral-800" />
              ) : (
                <p className="text-sm text-neutral-500">Configure parameters and hit generate.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
