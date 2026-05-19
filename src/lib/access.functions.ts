import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  email: z.string().trim().email().max(255),
  telegram_username: z.string().trim().min(1).max(64).optional().or(z.literal("")),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

async function notifyTelegram(text: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
    console.warn("Telegram not configured, skipping notification");
    return;
  }
  // Send to @ProObito via username — Telegram bot can only DM users that started it.
  // We post to chat_id="@ProObito" which works if the user has opened a chat with the bot.
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: "@ProObito",
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error("Telegram notify failed", res.status, await res.text());
    }
  } catch (e) {
    console.error("Telegram notify error", e);
  }
}

export const submitAccessRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("access_requests").insert({
      email: data.email.toLowerCase(),
      telegram_username: data.telegram_username || null,
      reason: data.reason || null,
    });
    if (error) throw new Error(error.message);

    const msg = [
      `🔔 <b>New access request</b>`,
      `📧 ${data.email}`,
      data.telegram_username ? `📱 @${data.telegram_username.replace(/^@/, "")}` : "",
      data.reason ? `📝 ${data.reason}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await notifyTelegram(msg);

    return { ok: true };
  });
