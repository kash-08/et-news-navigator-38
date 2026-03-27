import { useState } from "react";
import { useNavigate } from "react-router-dom";

const TOPIC_CHIPS = [
  "Union Budget 2026",
  "RBI Rate Cut",
  "Jio vs Airtel",
  "Startup Funding Winter",
  "India-US Trade Deal",
];

const STORIES = [
  { category: "MARKETS", headline: "Sensex surges 800 points as FII inflows hit 3-month high amid global risk-on rally", summary: "Foreign institutional investors pour capital into Indian equities as global sentiment improves." },
  { category: "POLICY", headline: "RBI holds repo rate at 6.5% for fifth straight meeting; signals possible cut in Q1 2026", summary: "Central bank maintains status quo while inflation softens to 4.2% in latest readings." },
  { category: "TECH", headline: "Reliance Jio launches AI-powered 6G trials in Mumbai and Bengaluru corridors", summary: "India's largest telecom operator begins next-gen network testing in two metro cities." },
  { category: "STARTUP", headline: "Indian startup funding rebounds to $3.2B in Q3 2025 led by fintech and deeptech bets", summary: "Venture capital returns to Indian startups after a prolonged funding winter." },
  { category: "ECONOMY", headline: "India's GDP growth forecast upgraded to 7.2% by IMF on strong domestic consumption", summary: "International Monetary Fund raises India outlook citing robust consumer spending." },
  { category: "CORPORATE", headline: "Tata Motors eyes $2B EV plant in Pune as government extends PLI scheme benefits", summary: "Automaker plans major electric vehicle manufacturing facility under government incentives." },
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleExplore = () => {
    if (!query.trim()) return;
    navigate(`/briefing?topic=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Masthead */}
      <header className="px-6 pt-8 pb-0 max-w-5xl mx-auto">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
          NEWS NAVIGATOR
        </h1>
        <div className="h-[3px] bg-primary mt-2 mb-1" />
        <p className="font-mono text-xs text-muted-foreground tracking-wide">
          One topic. Every angle. No noise.
        </p>
      </header>

      {/* Hero Search */}
      <section className="max-w-2xl mx-auto px-6 mt-12 text-center">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleExplore()}
            placeholder="Search any business topic, company, or story..."
            className="flex-1 px-4 py-3 border border-border rounded-md font-body text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleExplore}
            className="px-6 py-3 bg-primary text-primary-foreground font-body font-semibold text-sm rounded-md hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            Explore ▸
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {TOPIC_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => { setQuery(chip); navigate(`/briefing?topic=${encodeURIComponent(chip)}`); }}
              className="px-3 py-1.5 bg-secondary text-secondary-foreground font-mono text-xs rounded-full hover:bg-border transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      </section>

      {/* Today's Stories */}
      <section className="max-w-5xl mx-auto px-6 mt-16 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-5 bg-primary rounded-sm" />
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Today's Top Stories
          </span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {STORIES.map((story, i) => (
            <article key={i} className="bg-card border border-border rounded-md p-5 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] font-medium text-primary tracking-widest">
                  {story.category}
                </span>
                <h3 className="font-headline text-base font-semibold text-foreground mt-1.5 leading-snug">
                  {story.headline}
                </h3>
                <p className="font-body text-xs text-muted-foreground mt-2 leading-relaxed">
                  {story.summary}
                </p>
              </div>
              <button
                onClick={() => navigate(`/briefing?topic=${encodeURIComponent(story.headline)}`)}
                className="mt-4 text-xs font-mono text-primary hover:underline self-start"
              >
                Navigate This Story ▸
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
