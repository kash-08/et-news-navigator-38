import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPTS: Record<string, (topic: string, context: string) => string> = {
  summary: (topic, context) => `
You are a senior business journalist at Economic Times.
Based ONLY on the following real news articles, write a briefing summary.

ARTICLES:
${context}

TOPIC: ${topic}

Respond in this exact JSON format only. No text outside JSON:
{
  "summary": "4-5 sentence plain English summary of the story",
  "firstSentence": "One bold impactful opening sentence",
  "statsChips": ["Stat 1", "Stat 2", "Stat 3"]
}

statsChips must be 3 short data points extracted from the articles (e.g. "Rate: 6.75%", "3rd consecutive hike", "Nov 2025").
`,

  claims: (topic, context) => `
You are a fact-extraction analyst.
Based ONLY on the following real news articles, extract key claims.

ARTICLES:
${context}

TOPIC: ${topic}

Respond in this exact JSON format only. No text outside JSON:
{
  "claims": [
    {
      "text": "The claim statement",
      "type": "FACT",
      "confidence": "HIGH",
      "source": "Source name from articles"
    }
  ]
}

type must be one of: "FACT", "OPINION", "PROJECTION"
confidence must be one of: "HIGH", "MEDIUM", "LOW"
Extract 5-7 claims. Only use information present in the articles above.
`,

  consensus: (topic, context) => `
You are a media analyst checking what multiple news sources agree on.
Based ONLY on the following real news articles, identify consensus points.

ARTICLES:
${context}

TOPIC: ${topic}

Respond in this exact JSON format only. No text outside JSON:
{
  "consensus": [
    { "point": "Something all or most sources agree on", "uncertain": false },
    { "point": "Something all or most sources agree on", "uncertain": false },
    { "point": "Something all or most sources agree on", "uncertain": false },
    { "point": "One area where sources differ or is unresolved", "uncertain": true }
  ]
}

Include 3-4 confirmed consensus points and 1 uncertain point at the end.
`,

  timeline: (topic, context) => `
You are a news historian building a story timeline.
Based ONLY on the following real news articles, extract a chronological timeline.

ARTICLES:
${context}

TOPIC: ${topic}

Respond in this exact JSON format only. No text outside JSON:
{
  "events": [
    {
      "date": "MMM YYYY",
      "event": "What happened",
      "impact": "HIGH"
    }
  ]
}

impact must be one of: "HIGH", "MEDIUM", "LOW"
Extract 5-6 chronological events from the articles. Most recent event last.
`,

  impact: (topic, context) => `
You are a financial analyst writing for everyday readers of Economic Times India.
Based ONLY on the following real news articles, explain real-world impact and predictions.

ARTICLES:
${context}

TOPIC: ${topic}

Respond in this exact JSON format only. No text outside JSON:
{
  "impacts": [
    { "audience": "Bold label e.g. Home loan borrowers", "effect": "Plain English impact in one sentence with specific numbers if available" }
  ],
  "predictions": [
    {
      "text": "One forward-looking prediction based on the articles",
      "likelihood": "LIKELY",
      "timeframe": "e.g. Next 30 days"
    }
  ]
}

impacts: 3-4 items. predictions: exactly 3 items.
likelihood must be one of: "LIKELY", "POSSIBLE", "UNLIKELY"
`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, context, promptType, question } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let prompt: string;
    let expectJson = true;

    if (promptType === "qa") {
      expectJson = false;
      prompt = `
You are a helpful news analyst for Economic Times readers.
A user read a briefing about "${topic}" and has a follow-up question.

BRIEFING DATA:
${context}

USER QUESTION: ${question}

Answer in 2-4 sentences maximum. Use plain English — no jargon.
Only use information present in the briefing data above.
If the answer is not in the briefing, say "This briefing doesn't cover that — try searching for a more specific topic."
Do not return JSON — return plain conversational text only.
`;
    } else {
      const promptFn = PROMPTS[promptType];
      if (!promptFn) throw new Error(`Unknown prompt type: ${promptType}`);
      prompt = promptFn(topic, context || "No articles available. Use your general knowledge.");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a senior journalist and analyst at Economic Times. Always respond precisely in the format requested." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    if (!expectJson) {
      return new Response(JSON.stringify({ answer: raw }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse JSON from response
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("JSON parse failed");
    }

    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-briefing error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
