import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// POST /api/v2/templates/anime/:num/:name
// Headers:
//   X-API-Key: pmk_xxx
//   X-Bot-Id: <unique bot identifier>
// Body (multipart/form-data): branding_text, logo (file), cover_url, author, rating,
//   genres (csv or json), meta_text, synopsis, footer_text, button_text
export const Route = createFileRoute("/api/v2/templates/anime/$num/$name")({
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

        const num = parseInt(params.num, 10);
        if (!Number.isInteger(num) || num < 1 || num > 100) {
          return new Response(JSON.stringify({ error: "Invalid template number (1-100)" }), {
            status: 400,
            headers: cors,
          });
        }
        const slug = num === 1 ? "animeposter" : `animeposter${num}`;
        const animeName = decodeURIComponent(params.name);

        const apiKey = request.headers.get("x-api-key");
        const botId = request.headers.get("x-bot-id");
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "Missing X-API-Key header" }), {
            status: 401,
            headers: cors,
          });
        }
        if (!botId) {
          return new Response(JSON.stringify({ error: "Missing X-Bot-Id header" }), {
            status: 400,
            headers: cors,
          });
        }

        // Validate key
        const { data: keyRow } = await supabaseAdmin
          .from("api_keys")
          .select("*")
          .eq("key", apiKey)
          .eq("active", true)
          .maybeSingle();
        if (!keyRow) {
          return new Response(JSON.stringify({ error: "Invalid or revoked API key" }), {
            status: 401,
            headers: cors,
          });
        }
        if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
          return new Response(JSON.stringify({ error: "API key expired" }), {
            status: 401,
            headers: cors,
          });
        }
        if (!keyRow.allowed_template_slugs?.includes(slug)) {
          await supabaseAdmin.from("api_logs").insert({
            api_key_id: keyRow.id,
            template_slug: slug,
            bot_id: botId,
            status: 403,
            error: "template not in allowed list",
            duration_ms: Date.now() - startedAt,
          });
          return new Response(
            JSON.stringify({ error: `API key not licensed for template '${slug}'` }),
            { status: 403, headers: cors },
          );
        }

        // Bot registration / limit
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
              api_key_id: keyRow.id,
              template_slug: slug,
              bot_id: botId,
              status: 429,
              error: `bot limit ${keyRow.bot_limit} reached`,
              duration_ms: Date.now() - startedAt,
            });
            return new Response(
              JSON.stringify({
                error: `Bot limit reached (${keyRow.bot_limit}). Contact owner to upgrade.`,
              }),
              { status: 429, headers: cors },
            );
          }
          await supabaseAdmin
            .from("api_key_bots")
            .insert({ api_key_id: keyRow.id, bot_id: botId });
        } else {
          await supabaseAdmin
            .from("api_key_bots")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", existingBot.id);
        }

        // Template lookup
        const { data: tpl } = await supabaseAdmin
          .from("templates")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();
        if (!tpl || !tpl.active) {
          await supabaseAdmin.from("api_logs").insert({
            api_key_id: keyRow.id,
            template_slug: slug,
            bot_id: botId,
            status: 503,
            error: "template inactive",
            duration_ms: Date.now() - startedAt,
          });
          return new Response(JSON.stringify({ error: `Template '${slug}' inactive` }), {
            status: 503,
            headers: cors,
          });
        }
        if (!tpl.external_endpoint_url) {
          await supabaseAdmin.from("api_logs").insert({
            api_key_id: keyRow.id,
            template_slug: slug,
            bot_id: botId,
            status: 502,
            error: "no external_endpoint_url configured",
            duration_ms: Date.now() - startedAt,
          });
          return new Response(
            JSON.stringify({
              error: `Template '${slug}' is not connected to a render service yet.`,
            }),
            { status: 502, headers: cors },
          );
        }

        // Parse incoming multipart, inject title=animeName, forward to external
        let upstream: Response;
        try {
          const inForm = await request.formData();
          const outForm = new FormData();
          // Always set title from URL param (so bot doesn't have to)
          outForm.set("title", animeName);
          outForm.set("template_slug", slug);
          for (const [k, v] of inForm.entries()) {
            // Don't overwrite title if branding_text etc — keep all original fields
            outForm.append(k, v as any);
          }
          upstream = await fetch(tpl.external_endpoint_url, {
            method: "POST",
            body: outForm,
          });
        } catch (e: any) {
          await supabaseAdmin.from("api_logs").insert({
            api_key_id: keyRow.id,
            template_slug: slug,
            bot_id: botId,
            status: 502,
            error: `upstream fetch failed: ${e?.message ?? e}`,
            duration_ms: Date.now() - startedAt,
          });
          return new Response(
            JSON.stringify({ error: "Render service unreachable", detail: String(e?.message ?? e) }),
            { status: 502, headers: cors },
          );
        }

        await supabaseAdmin.from("api_logs").insert({
          api_key_id: keyRow.id,
          template_slug: slug,
          bot_id: botId,
          status: upstream.status,
          duration_ms: Date.now() - startedAt,
        });

        // Stream response back with same content-type
        const ct = upstream.headers.get("content-type") ?? "application/octet-stream";
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": ct,
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
