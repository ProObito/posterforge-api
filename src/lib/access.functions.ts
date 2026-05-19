import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { Resend } from 'resend'; 

// Vercel me .env variable set karna hoga RESEND_API_KEY ka
const resend = new Resend(process.env.RESEND_API_KEY);

export const submitAccessRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email(), telegram_username: z.string().optional(), reason: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    // 1. Save Request to DB
    const { error } = await supabaseAdmin
      .from("access_requests")
      .insert({
        email: data.email,
        telegram_username: data.telegram_username,
        reason: data.reason,
        status: "pending"
      });

    if (error) throw new Error(error.message);

    // 2. Alert the Admin (uffobitoxe@gmail.com) via Email
    try {
      await resend.emails.send({
        from: 'PosterForge <onboarding@resend.dev>', // Keep onboarding@resend.dev if using free resend tier without custom domain
        to: 'uffobitoxe@gmail.com', // Aapki id
        subject: `New Access Request from ${data.email}`,
        html: `
          <h3>PosterForge API - New Request</h3>
          <p><strong>User Email:</strong> ${data.email}</p>
          <p><strong>Telegram:</strong> ${data.telegram_username ? `@${data.telegram_username}` : 'Not provided'}</p>
          <p><strong>Reason:</strong> ${data.reason || 'None'}</p>
          <br>
          <a href="https://your-vercel-domain.vercel.app/admin" style="background:#ff1e27;color:#fff;padding:10px 15px;text-decoration:none;border-radius:5px;">Go to Admin Panel</a>
        `
      });
    } catch (mailErr) {
      console.log("Failed to send notification email:", mailErr);
      // DB me save ho gaya hai toh request pass karenge, crash nahi karenge
    }

    return { ok: true };
  });
