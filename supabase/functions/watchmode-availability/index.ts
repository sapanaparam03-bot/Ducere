import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SearchResult = { id?: number; title?: string; type?: string; year?: number };
type Source = { source_id?: number; name?: string; type?: string; region?: string; web_url?: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Watchmode returned ${response.status}`);
  return response.json() as Promise<T>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\\s+(.+)$/i)?.[1];
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !supabaseUrl || !anonKey) return json({ error: "Authentication required." }, 401);

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Please sign in to check availability." }, 401);

    const apiKey = Deno.env.get("WATCHMODE_API_KEY");
    if (!apiKey) {
      return json({ error: "Availability provider is not configured.", code: "WATCHMODE_NOT_CONFIGURED" }, 503);
    }

    const body = await req.json();
    const titleName = String(body?.titleName ?? "").trim();
    const mediaType = body?.mediaType;
    const region = String(body?.region ?? "US").toUpperCase();
    const year = Number(body?.year ?? 0);

    if (!titleName || titleName.length > 200) return json({ error: "titleName must be between 1 and 200 characters" }, 400);
    if (mediaType !== "movie" && mediaType !== "tv") return json({ error: "Invalid mediaType" }, 400);
    if (!/^[A-Z]{2}$/.test(region)) return json({ error: "Invalid region" }, 400);
    if (year !== 0 && (!Number.isInteger(year) || year < 1800 || year > 2200)) return json({ error: "Invalid year" }, 400);

    const searchUrl = new URL("https://api.watchmode.com/v1/search/");
    searchUrl.searchParams.set("apiKey", apiKey);
    searchUrl.searchParams.set("search_field", "name");
    searchUrl.searchParams.set("search_value", titleName);

    const search = await fetchJson<{ title_results?: SearchResult[] }>(searchUrl.toString());
    const candidates = search.title_results ?? [];

    const exactCandidates = candidates.filter((candidate) =>
      Boolean(candidate.id) &&
      normalized(candidate.title ?? "") === normalized(titleName) &&
      (!candidate.type || candidate.type.toLowerCase().includes(mediaType === "movie" ? "movie" : "tv"))
    );

    // Never show a different title's providers just because it ranked first in search.
    // When Watchmode supplies a year, prefer an exact year match; if the year conflicts,
    // return no result rather than falsely labeling another release as verified.
    const exact = year > 0
      ? exactCandidates.find((candidate) => candidate.year === year) ??
        (exactCandidates.some((candidate) => Number(candidate.year) > 0) ? undefined : exactCandidates[0])
      : exactCandidates[0];

    if (!exact?.id) {
      return json({
        titleId: 0,
        titleName,
        sources: [],
        attributionRequired: true,
        message: "No exact title match was found for this region.",
      });
    }

    const sourceUrl = new URL(`https://api.watchmode.com/v1/title/${exact.id}/sources/`);
    sourceUrl.searchParams.set("apiKey", apiKey);
    sourceUrl.searchParams.set("regions", region);

    const rawSources = await fetchJson<Source[]>(sourceUrl.toString());
    const sources = (Array.isArray(rawSources) ? rawSources : [])
      .filter((source) => !source.region || source.region.toUpperCase() === region)
      .map((source) => ({
        name: source.name ?? "Streaming service",
        kind: source.type === "free" ? "free" : source.type === "sub" ? "streaming" : source.type === "rent" ? "rent" : source.type === "buy" ? "buy" : "info",
        url: source.web_url,
        sourceId: source.source_id,
        region,
        verified: true as const,
      }));

    return json({ titleId: exact.id, titleName: exact.title ?? titleName, sources, attributionRequired: true });
  } catch (error) {
    console.error("watchmode-availability", error);
    return json({ error: "Availability lookup failed.", code: "WATCHMODE_LOOKUP_FAILED" }, 502);
  }
});
