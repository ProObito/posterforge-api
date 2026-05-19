import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Yahan humne saare 6 types define kar diye hain
const VALID_TYPES = ["anime", "manga", "movie", "tvseries", "code", "fanart"];

export const Route = createFileRoute("/api/v2/templates/$type/$num/$name")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-API-Key, X-Bot-Id",
          },
        }),
      POST: async ({ request, params }) => {
        const startedAt = Date.now();
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        };

        // 1. Category Type Validation
        const type = params.type.toLowerCase();
        if (!VALID_TYPES.includes(type)) {
          return new Response(JSON.stringify({ error: "Invalid category. Allowed: anime, manga, movie, tvseries, code, fanart" }), {
            status: 400,
            headers: cors,
          });
        }

        // 2. Template Number Validation
        const num = parseInt(params.num, 10);
        if (!Number.isInteger(num) || num < 1 || num > 100) {
          return new Response(JSON.stringify({ error: "Invalid template number (1-100)" }), {
            status: 400,
            headers: cors,
          });
        }

        // Slug banega jaise: animeposter, animeposter2, codeposter, fanartposter3
        const slug = num === 1 ? `${type}poster` : `${type}poster${num}`;
        const targetName = decodeURIComponent(params.name);

        // 3. Header Extraction
        const apiKey = request.headers.get("x-api-key");
        const botId = request.headers.get("x-bot-id");
        if (!apiKey || !botId) {
          return new Response(JSON.stringify({ error: "Missing X-API-Key or X-Bot-Id header" }), {
            status: 401,
            headers: cors,
          });
        }

        // 4. API Key Database Auth
        const { data: keyRow } = await supabaseAdmin
          .from("api_keys")
          .select("*")
          .eq("key", apiKey)
          .eq("active", true)
          .maybeSingle();

        if (!keyRow) {
          return new Response(JSON.stringify({ error: "Invalid or revoked API key" }), { status: 401, headers: cors });
        }
        if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
          return new Response(JSON.stringify({ error: "API key has expired" }), { status: 401, headers: cors });
        }

        // 5. Licensed Template Check
        if (!keyRow.allowed_template_slugs?.includes(slug)) {
          await supabaseAdmin.from("api_logs").insert({
            api_key_id: keyRow.id, template_slug: slug, bot_id: botId, status: 403, error: "Template not licensed", duration_ms: Date.now() - startedAt,
          });
          return new Response(
            JSON.stringify({ error: `API key not licensed for template '${slug}'` }),
            { status: 403, headers: cors },
          );
        }

        // 6. Bot Limits Engine
        const { data: existingBot } = await supabaseAdmin
          .from("api_key_bots")
          .select("*")
          .eq("api_key_id", keyRow.id)
          .eq("bot_id", botId)
          .maybeSingle();

        if (!existingBot) {
          const { count } = await supabaseAdmin
            .from("api_key_bots")
            .select("*", { count: "exact", head: true })
            .eq("api_key_id", keyRow.id);

          if ((count ?? 0) >= keyRow.bot_limit) {
            await supabaseAdmin.from("api_logs").insert({
              api_key_id: keyRow.id, template_slug: slug, bot_id: botId, status: 429, error: `Bot limit ${keyRow.bot_limit} exceeded`, duration_ms: Date.now() - startedAt,
            });
            return new Response(
              JSON.stringify({ error: `Bot limit reached (${keyRow.bot_limit}). Contact @ProObito to upgrade.` }),
              { status: 429, headers: cors },
            );
          }
          await supabaseAdmin.from("api_key_bots").insert({ api_key_id: keyRow.id, bot_id: botId });
        } else {
          await supabaseAdmin.from("api_key_bots").update({ last_seen_at: new Date().toISOString() }).eq("id", existingBot.id);
        }

        // 7. Find Python Upstream URL
        const { data: tpl } = await supabaseAdmin.from("templates").select("*").eq("slug", slug).maybeSingle();

        if (!tpl || !tpl.active || !tpl.external_endpoint_url) {
          return new Response(JSON.stringify({ error: `Template '${slug}' inactive or not connected to render service.` }), { status: 502, headers: cors });
        }

        // 8. Forward to Python Server (Your python code will handle TMDB/MAL fetching based on title & category_type)
        let upstreamResponse: Response;
        try {
          const incomingForm = await request.formData();
          const outgoingForm = new FormData();

          // Title aur Category type hum Python ko bhej rahe hain
          outgoingForm.set("title", targetName);
          outgoingForm.set("template_slug", slug);
          outgoingForm.set("category_type", type); // 'anime', 'movie', 'fanart' etc.

          for (const [key, val] of incomingForm.entries()) {
            outgoingForm.append(key, val as any);
          }

          upstreamResponse = await fetch(tpl.external_endpoint_url, {
            method: "POST",
            body: outgoingForm,
          });
        } catch (err: any) {
          await supabaseAdmin.from("api_logs").insert({
            api_key_id: keyRow.id, template_slug: slug, bot_id: botId, status: 502, error: `Upstream failed: ${err?.message}`, duration_ms: Date.now() - startedAt,
          });
          return new Response(JSON.stringify({ error: "Render service unreachable" }), { status: 502, headers: cors });
        }

        // Log success
        await supabaseAdmin.from("api_logs").insert({
          api_key_id: keyRow.id, template_slug: slug, bot_id: botId, status: upstreamResponse.status, duration_ms: Date.now() - startedAt,
        });

        const contentType = upstreamResponse.headers.get("content-type") || "application/octet-stream";
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" },
        });
      },
    },
  },
});
