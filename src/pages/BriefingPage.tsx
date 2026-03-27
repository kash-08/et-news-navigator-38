import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Article = {
  title: string;
  description: string;
  content: string;
  source: string;
  publishedAt: string;
  url: string;
};

type BriefingData = {
  articles: Article[];
  summaryData: any;
  claimsData: any;
  consensusData: any;
  timelineData: any;
  impactData: any;
};

const STAGES = [
  { key: "fetch", label: "Fetching live news sources..." },
  { key: "summary", label: "Writing your 60-second summary..." },
  { key: "claims", label: "Extracting key claims..." },
  { key: "consensus", label: "Checking what sources agree on..." },
  { key: "timeline", label: "Building the story timeline..." },
  { key: "impact", label: "Analysing real-world impact..." },
];

const QA_STARTERS = [
  "How does this affect me financially?",
  "What happens next?",
  "Explain this in simple terms",
];

function buildContext(articles: Article[]) {
  return articles
    .map(
      (a, i) => `SOURCE ${i + 1}: ${a.source}\nPublished: ${new Date(a.publishedAt).toDateString()}\nHeadline: ${a.title}\nSummary: ${a.description}\nContent: ${a.content}\n---`
    )
    .join("\n");
}

export default function BriefingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const topic = searchParams.get("topic") || "";

  const [stage, setStage] = useState<string>("fetch");
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qaMessages, setQaMessages] = useState<{ role: string; text: string }[]>([]);
  const [qaInput, setQaInput] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Record<string, boolean>>({});
  const qaEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (topic) runPipeline();
  }, [topic]);

  useEffect(() => {
    qaEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qaMessages]);

  const markStage = (s: string) => {
    setCompletedStages((prev) => [...prev, s]);
  };

  async function callAI(promptType: string, context: string) {
    const { data, error } = await supabase.functions.invoke("ai-briefing", {
      body: { topic, context, promptType },
    });
    if (error) throw error;
    return data;
  }

  async function runPipeline() {
    try {
      setStage("fetch");
      const { data: newsData, error: newsErr } = await supabase.functions.invoke("fetch-news", {
        body: { topic },
      });

      let articles: Article[] = [];
      let context = "";
      if (newsErr || !newsData?.articles?.length) {
        console.warn("News fetch failed, continuing with empty context");
      } else {
        articles = newsData.articles;
        context = buildContext(articles);
      }
      markStage("fetch");

      const sections = ["summary", "claims", "consensus", "timeline", "impact"];
      const results: Record<string, any> = {};

      for (const section of sections) {
        setStage(section);
        try {
          results[section] = await callAI(section, context);
        } catch (e) {
          console.error(`Failed ${section}:`, e);
          setSectionErrors((prev) => ({ ...prev, [section]: true }));
          results[section] = null;
        }
        markStage(section);
      }

      setBriefing({
        articles,
        summaryData: results.summary,
        claimsData: results.claims,
        consensusData: results.consensus,
        timelineData: results.timeline,
        impactData: results.impact,
      });
      setStage("done");
    } catch (e: any) {
      setError(e.message || "Pipeline failed");
    }
  }

  async function handleQA(question: string) {
    if (!question.trim() || !briefing) return;
    setQaInput("");
    setQaMessages((prev) => [...prev, { role: "user", text: question }]);
    setQaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-briefing", {
        body: { topic, context: JSON.stringify(briefing), promptType: "qa", question },
      });
      if (error) throw error;
      setQaMessages((prev) => [...prev, { role: "assistant", text: data?.answer || data || "No answer available." }]);
    } catch {
      setQaMessages((prev) => [...prev, { role: "assistant", text: "Couldn't generate an answer. Try rephrasing your question." }]);
    }
    setQaLoading(false);
  }

  const progressPercent = (completedStages.length / STAGES.length) * 100;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center">
          <p className="font-body text-destructive mb-4">{error}</p>
          <button onClick={() => navigate("/")} className="font-mono text-sm text-primary hover:underline">
            ← Back to Today's Stories
          </button>
        </div>
      </div>
    );
  }

  // Processing state
  if (stage !== "done") {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-1 bg-secondary">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="max-w-md mx-auto px-6 pt-20 text-center">
          <h2 className="font-headline text-2xl font-bold text-foreground mb-10">{topic}</h2>
          <div className="space-y-4 text-left">
            {STAGES.map((s) => {
              const isDone = completedStages.includes(s.key);
              const isActive = stage === s.key && !isDone;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  {isDone ? (
                    <span className="text-primary text-sm">✓</span>
                  ) : isActive ? (
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot inline-block" />
                  ) : (
                    <span className="w-2 h-2 rounded-full border border-border inline-block" />
                  )}
                  <span className={`font-body text-sm ${isDone ? "text-muted-foreground" : isActive ? "text-foreground font-medium" : "text-muted-foreground/50"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="font-mono text-xs text-muted-foreground mt-10">
            Grounding your briefing in live news — usually takes 20–30 seconds
          </p>
        </div>
      </div>
    );
  }

  // Briefing view
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[860px] mx-auto px-6 py-8">
        <button onClick={() => navigate("/")} className="font-mono text-xs text-muted-foreground hover:text-foreground mb-6 block">
          ← Back to Today's Stories
        </button>

        <h1 className="font-headline text-3xl font-bold text-foreground mb-8">{topic}</h1>

        <div className="border-l-4 border-primary pl-6 space-y-10">
          {/* Summary */}
          {briefing?.summaryData ? (
            <section className="animate-fade-in-up">
              <SectionHeader label="THE BRIEFING" />
              <p className="font-body text-lg font-semibold text-foreground leading-relaxed mb-2">
                {briefing.summaryData.firstSentence}
              </p>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                {briefing.summaryData.summary}
              </p>
              {briefing.summaryData.statsChips && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {briefing.summaryData.statsChips.map((chip: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-secondary font-mono text-xs text-muted-foreground rounded">
                      {chip}
                    </span>
                  ))}
                </div>
              )}
            </section>
          ) : sectionErrors.summary ? <SectionError /> : null}

          <hr className="border-border" />

          {/* Claims */}
          {briefing?.claimsData?.claims ? (
            <section className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
              <SectionHeader label="KEY CLAIMS" />
              <div className="space-y-3">
                {briefing.claimsData.claims.map((claim: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-b-0">
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${claim.type === "FACT" ? "bg-success/10 text-success" : claim.type === "OPINION" ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"}`}>
                      {claim.type}
                    </span>
                    <div className="flex-1">
                      <p className="font-body text-sm text-foreground">{claim.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] text-muted-foreground">{claim.source}</span>
                        <ConfidenceDots level={claim.confidence} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : sectionErrors.claims ? <SectionError /> : null}

          <hr className="border-border" />

          {/* Consensus */}
          {briefing?.consensusData?.consensus ? (
            <section className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
              <SectionHeader label="SOURCE CONSENSUS" />
              <div className="space-y-2">
                {briefing.consensusData.consensus.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-sm mt-0.5 ${item.uncertain ? "text-warning" : "text-primary"}`}>
                      {item.uncertain ? "⚠" : "✓"}
                    </span>
                    <p className="font-body text-sm text-foreground">{item.point}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : sectionErrors.consensus ? <SectionError /> : null}

          <hr className="border-border" />

          {/* Timeline */}
          {briefing?.timelineData?.events ? (
            <section className="animate-fade-in-up" style={{ animationDelay: "600ms" }}>
              <SectionHeader label="STORY TIMELINE" />
              <div className="space-y-4 ml-2">
                {briefing.timelineData.events.map((evt: any, i: number, arr: any[]) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`rounded-full ${evt.impact === "HIGH" ? "bg-primary w-3 h-3" : evt.impact === "MEDIUM" ? "bg-warning w-2.5 h-2.5" : "bg-muted-foreground/40 w-2 h-2"} ${i === arr.length - 1 ? "w-3.5 h-3.5" : ""} shrink-0 mt-1`} />
                      {i < arr.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="pb-4">
                      <span className="font-mono text-xs font-medium text-primary">{evt.date}</span>
                      <p className="font-body text-sm text-foreground mt-0.5">{evt.event}</p>
                      <span className="font-mono text-[10px] text-muted-foreground">{evt.impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : sectionErrors.timeline ? <SectionError /> : null}

          <hr className="border-border" />

          {/* Impact */}
          {briefing?.impactData?.impacts ? (
            <section className="animate-fade-in-up" style={{ animationDelay: "800ms" }}>
              <SectionHeader label="WHAT THIS MEANS FOR YOU" />
              <div className="bg-callout border-l-4 border-primary p-4 rounded-r-md space-y-3">
                {briefing.impactData.impacts.map((imp: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="font-body text-sm font-semibold text-foreground shrink-0">{imp.audience} →</span>
                    <span className="font-body text-sm text-muted-foreground">{imp.effect}</span>
                  </div>
                ))}
                <p className="font-mono text-[10px] text-muted-foreground mt-2">
                  Disclaimer: Analysis based on available news sources. Not financial advice.
                </p>
              </div>
            </section>
          ) : sectionErrors.impact ? <SectionError /> : null}

          <hr className="border-border" />

          {/* Predictions */}
          {briefing?.impactData?.predictions ? (
            <section className="animate-fade-in-up" style={{ animationDelay: "1000ms" }}>
              <SectionHeader label="WHAT TO WATCH NEXT" />
              <div className="grid md:grid-cols-3 gap-3">
                {briefing.impactData.predictions.map((pred: any, i: number) => (
                  <div key={i} className="border border-border bg-background rounded-md p-4">
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${pred.likelihood === "LIKELY" ? "bg-success/10 text-success" : pred.likelihood === "POSSIBLE" ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"}`}>
                      {pred.likelihood}
                    </span>
                    <p className="font-mono text-[10px] text-muted-foreground mt-2">{pred.timeframe}</p>
                    <p className="font-headline text-sm font-semibold text-foreground mt-1">{pred.text}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <hr className="border-border" />

          {/* Q&A */}
          <section className="animate-fade-in-up" style={{ animationDelay: "1200ms" }}>
            <SectionHeader label="ASK THE BRIEFING" />
            <p className="font-body text-sm text-muted-foreground italic mb-4">
              Have a question? Ask anything — answers are grounded in the live articles above.
            </p>

            {qaMessages.length === 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {QA_STARTERS.map((q) => (
                  <button key={q} onClick={() => handleQA(q)} className="px-3 py-1.5 bg-secondary font-mono text-xs text-secondary-foreground rounded-full hover:bg-border transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
              {qaMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm font-body ${msg.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-background border border-border text-foreground"}`}>
                    {msg.role === "assistant" && (
                      <span className="font-mono text-[10px] text-primary font-medium mr-1">ET</span>
                    )}
                    {msg.text}
                  </div>
                </div>
              ))}
              {qaLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 bg-background border border-border rounded-lg font-body text-sm text-muted-foreground">
                    <span className="font-mono text-[10px] text-primary font-medium mr-1">ET</span>
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={qaEndRef} />
            </div>

            <div className="flex gap-2">
              <input
                value={qaInput}
                onChange={(e) => setQaInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQA(qaInput)}
                placeholder="Ask a follow-up question..."
                className="flex-1 px-3 py-2 border border-border rounded-md font-body text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={() => handleQA(qaInput)}
                disabled={qaLoading}
                className="px-4 py-2 bg-primary text-primary-foreground font-body text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Ask ▸
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-2 h-2 bg-primary rounded-sm" />
      <span className="font-mono text-xs tracking-widest text-primary uppercase">{label}</span>
    </div>
  );
}

function SectionError() {
  return (
    <div className="py-4 text-center">
      <p className="font-body text-sm text-muted-foreground">Could not load this section.</p>
    </div>
  );
}

function ConfidenceDots({ level }: { level: string }) {
  const filled = level === "HIGH" ? 3 : level === "MEDIUM" ? 2 : 1;
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3].map((n) => (
        <span key={n} className={`w-1.5 h-1.5 rounded-full ${n <= filled ? "bg-primary" : "bg-border"}`} />
      ))}
    </span>
  );
}
