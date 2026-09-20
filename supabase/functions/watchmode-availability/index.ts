import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

  const apiKey = Deno.env.get("WATCHMODE_API_KEY");
  if (!apiKey) {
    return json({ error: "Availability provider is not configured.", code: "WATCHMODE_NOT_CONFIGURED" }, 503);
  }

  try {
    const body = await req.json();
    const titleName = String(body?.titleName ?? "").trim();
    const mediaType = body?.mediaType === "movie" ? "movie" : "tv";
    const region = String(body?.region ?? "US").toUpperCase();
    const year = Number(body?.year ?? 0);

    if (!titleName) return json({ error: "titleName is required" }, 400);
    if (!/^[A-Z]{2}$/.test(region)) return json({ error: "Invalid region" }, 400);

    const searchUrl = new URL("https://api.watchmode.com/v1/search/");
    searchUrl.searchParams.set("apiKey", apiKey);
    searchUrl.searchParams.set("search_field", "name");
    searchUrl.searchParams.set("search_value", titleName);

    const search = await fetchJson<{ title_results?: SearchResult[] }>(searchUrl.toString());
    const candidates = search.title_results ?? [];

    const exact = candidates.find((candidate) =>
      normalized(candidate.title ?? "") === normalized(titleName) &&
      (!candidate.type || candidate.type.toLowerCase().includes(mediaType === "movie" ? "movie" : "tv"))
    ) ?? candidates.find((candidate) => normalized(candidate.title ?? "") === normalized(titleName)) ?? candidates[0];

    if (!exact?.id) return json({ titleId: 0, titleName, sources: [], attributionRequired: true });

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
