import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

function makeKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `pmk_${b64}`;
}

// ===== Access requests =====
export const adminListRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("access_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const adminDecideRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: req, error: fe } = await supabaseAdmin
      .from("access_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (fe || !req) throw new Error("Request not found");
    if (data.approve) {
      await supabaseAdmin
        .from("allowed_emails")
        .insert({ email: req.email, note: req.telegram_username ? `@${req.telegram_username}` : null })
        .then(() => {});
    }
    await supabaseAdmin
      .from("access_requests")
      .update({ status: data.approve ? "approved" : "denied" })
      .eq("id", data.id);
    return { ok: true };
  });

// ===== Allowed emails =====
export const adminListAllowedEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("allowed_emails")
      .select("*")
      .order("granted_at", { ascending: false });
    return data ?? [];
  });

export const adminAddAllowedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email(), note: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("allowed_emails")
      .insert({ email: data.email.toLowerCase(), note: data.note ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveAllowedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("allowed_emails").delete().eq("id", data.id);
    return { ok: true };
  });

// ===== Templates =====
export const adminListTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("templates")
      .select("*")
      .order("slug");
    return data ?? [];
  });

export const adminUpdateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        external_endpoint_url: z.string().url().nullable().optional(),
        active: z.boolean().optional(),
        display_name: z.string().max(120).optional(),
        description: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("templates")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== API keys =====
export const adminListApiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: keys } = await supabaseAdmin
      .from("api_keys")
      .select("*")
      .order("created_at", { ascending: false });
    if (!keys) return [];
    const { data: bots } = await supabaseAdmin
      .from("api_key_bots")
      .select("api_key_id, bot_id, last_seen_at");
    return keys.map((k) => ({
      ...k,
      bots: (bots ?? []).filter((b) => b.api_key_id === k.id),
    }));
  });

export const adminCreateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        label: z.string().min(1).max(100),
        customer_note: z.string().max(300).optional(),
        bot_limit: z.number().int().min(1).max(10000),
        allowed_template_slugs: z.array(z.string()).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const key = makeKey();
    const { error, data: row } = await supabaseAdmin
      .from("api_keys")
      .insert({
        key,
        label: data.label,
        customer_note: data.customer_note ?? null,
        bot_limit: data.bot_limit,
        allowed_template_slugs: data.allowed_template_slugs,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminUpdateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        active: z.boolean().optional(),
        bot_limit: z.number().int().min(1).max(10000).optional(),
        allowed_template_slugs: z.array(z.string()).optional(),
        label: z.string().min(1).max(100).optional(),
        customer_note: z.string().max(300).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("api_keys").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("api_keys").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminRemoveBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ api_key_id: z.string().uuid(), bot_id: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin
      .from("api_key_bots")
      .delete()
      .eq("api_key_id", data.api_key_id)
      .eq("bot_id", data.bot_id);
    return { ok: true };
  });

// ===== Logs =====
export const adminListLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("api_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });
