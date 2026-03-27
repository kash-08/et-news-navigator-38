import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic } = await req.json();
    if (!topic) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("NEWS_API_KEY");
    if (!apiKey) {
      // Return empty articles if no key configured
      return new Response(JSON.stringify({ articles: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "ok") {
      return new Response(JSON.stringify({ articles: [], error: data.message }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const articles = data.articles
      .filter((a: any) => a.content && a.description)
      .slice(0, 6)
      .map((a: any) => ({
        title: a.title,
        description: a.description,
        content: a.content?.slice(0, 500),
        source: a.source?.name || "Unknown",
        publishedAt: a.publishedAt,
        url: a.url,
      }));

    return new Response(JSON.stringify({ articles }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("fetch-news error:", error);
    return new Response(JSON.stringify({ articles: [], error: "Failed to fetch news" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
