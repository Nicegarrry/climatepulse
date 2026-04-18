import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

export const metadata: Metadata = {
  title: "ClimatePulse — The daily brief for Australia's energy transition",
  description:
    "ClimatePulse reads the policy drops, market moves, and project news shaping Australia's energy transition — then sends you only what matters. Built by someone who's worked inside it.",
  openGraph: {
    title: "ClimatePulse — The daily brief for Australia's energy transition",
    description:
      "Personalised daily climate & energy intelligence for Australian investors, analysts, and policy professionals. Five-minute read, delivered before 6am AEST.",
    type: "website",
  },
};

export default function Home() {
  return <Landing />;
}
