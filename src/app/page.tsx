import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Inter_Tight, Newsreader, JetBrains_Mono } from "next/font/google";
import { Landing } from "@/components/landing/landing";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter-tight",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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

export default async function Home() {
  // Returning users (cookie set at /auth/callback) skip the landing entirely.
  // If their session is gone, /dashboard will bounce them to /login.
  const cookieStore = await cookies();
  if (cookieStore.get("cp_returning")?.value === "1") {
    redirect("/dashboard");
  }

  return (
    <div className={`${interTight.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}>
      <Landing />
    </div>
  );
}
