import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://ducere.vercel.app",
  "https://ducere-4ok3ot2ow-sapanaparam03-bot.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
]);

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://ducere.vercel.app",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response("Forbidden", { status: 403 });
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!token) return json({ error: "Authentication required." }, 401, origin);
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("delete-account: required Supabase environment variables are missing");
    return json({ error: "Account deletion is temporarily unavailable." }, 503, origin);
  }

  try {
    // Resolve the caller from their own access token; never accept a user ID from the browser.
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) return json({ error: "Your session is invalid or expired. Sign in again." }, 401, origin);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("delete-account: admin deletion failed", deleteError);
      return json({ error: "Account deletion failed. Please try again." }, 502, origin);
    }

    // Foreign keys with ON DELETE CASCADE remove the profile and archive rows.
    return json({ success: true }, 200, origin);
  } catch (error) {
    console.error("delete-account: unexpected failure", error);
    return json({ error: "Account deletion failed. Please try again." }, 500, origin);
  }
});
