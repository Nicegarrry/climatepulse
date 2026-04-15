import type { PodcastEpisode, PodcastScript } from "./types";

export const MOCK_PODCAST_SCRIPT: PodcastScript = {
  title: "ClimatePulse Daily — Grid Pressure & Lithium Slides",
  turns: [
    {
      speaker: "host",
      text: "Welcome to ClimatePulse Daily for Tuesday the 15th of April. Today we're looking at Victoria's curtailment crisis deepening, lithium prices hitting new lows, and what that means for Australia's storage ambitions.",
    },
    {
      speaker: "analyst",
      text: "And the numbers today tell a really striking story, Sarah. Record renewable generation sitting alongside record curtailment — it's a contradiction that's starting to cost real money.",
    },
    {
      speaker: "host",
      text: "That's the thread running through everything today. We're generating more clean energy than ever, but we literally can't get it to where it's needed. Let's start with today's daily number.",
    },
    {
      speaker: "analyst",
      text: "34.2 gigawatts of renewable generation yesterday. That's the highest April weekday on record — up 7.5% on the 30-day average. On paper, that's a triumph.",
    },
    {
      speaker: "host",
      text: "But there's a catch, isn't there, James.",
    },
    {
      speaker: "analyst",
      text: "A big one. Western Victoria's solar curtailment hit 18.3% yesterday — that's the fourth consecutive day above 15%. So we're generating record renewables but physically can't move the electrons where they need to go.",
    },
    {
      speaker: "host",
      text: "And this is becoming more than just a grid operations problem? I mean, this is starting to change how developers think about where to build.",
    },
    {
      speaker: "analyst",
      text: "Exactly right. We're now seeing it show up in financial models. If you can't guarantee dispatch, the economics of new projects in that corridor shift significantly. The Western Renewables Link won't be done until late 2028 at the earliest, and that timeline just slipped again after contractor disputes.",
    },
    {
      speaker: "host",
      text: "So for anyone making investment decisions in Victorian renewables right now, this is the single biggest risk factor.",
    },
    {
      speaker: "analyst",
      text: "Without question. And it connects directly to our second story.",
    },
    {
      speaker: "host",
      text: "Lithium.",
    },
    {
      speaker: "analyst",
      text: "Lithium carbonate dropped below 900 dollars a tonne — that's a 14-month low, down about 22% since the start of the year.",
    },
    {
      speaker: "host",
      text: "Now on the surface, cheaper lithium should be good news for storage, right? Cheaper batteries, more grid-scale storage, which is exactly what we need to solve that curtailment problem.",
    },
    {
      speaker: "analyst",
      text: "That's the theory. But here's the problem — if the transmission bottleneck means you can't utilise that storage effectively, the value proposition weakens on both sides. Cheaper inputs don't help if the revenue case is broken.",
    },
    {
      speaker: "host",
      text: "And for Australia's critical minerals strategy more broadly, what does this price slide mean?",
    },
    {
      speaker: "analyst",
      text: "It's compounding the pressure significantly. We've got processing facilities in Western Australia that were built assuming lithium above 1,200 a tonne. At sub-900, the margins are getting very thin.",
    },
    {
      speaker: "host",
      text: "So pulling this together — we've got record renewable generation that we can't fully use, falling commodity prices that should help but are instead creating their own problems, and investment decisions being deferred because of infrastructure uncertainty. What should people be watching this week?",
    },
    {
      speaker: "analyst",
      text: "Two things. First, AEMO's updated curtailment forecasts due Thursday — that'll tell us if this is a seasonal spike or a structural shift. And second, watch for any movement on the Western Renewables Link timeline. Any further delays and we could see project cancellations, not just deferrals.",
    },
    {
      speaker: "host",
      text: "Transmission, commodities, and capital all pulling in different directions. That's ClimatePulse Daily. See you tomorrow.",
    },
  ],
  estimated_duration_seconds: 300,
  word_count: 580,
};

// Minimal silent WAV (44 bytes header + 2 bytes of silence) as base64
const SILENT_WAV_BASE64 =
  "UklGRi4AAABXQVZFZm10IBAAAAABAAEARKwAABCxAgACABAAZGF0YQoAAAAA";

export const MOCK_PODCAST_EPISODE: PodcastEpisode = {
  id: "podcast-mock-1",
  briefing_date: new Date().toISOString().split("T")[0],
  user_id: null,
  script: MOCK_PODCAST_SCRIPT,
  audio_url: `data:audio/wav;base64,${SILENT_WAV_BASE64}`,
  audio_duration_seconds: 300,
  audio_size_bytes: 46,
  audio_format: "wav",
  generated_at: new Date().toISOString(),
};
