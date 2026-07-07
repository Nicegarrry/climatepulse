import type { Metadata } from "next";
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
  title: "Climate Pulse",
  description: "Climate Pulse is paused while we prepare what comes next.",
  openGraph: {
    title: "Climate Pulse",
    description: "Climate Pulse is paused while we prepare what comes next.",
    type: "website",
  },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getCaptureStatus(value: string | string[] | undefined) {
  const status = Array.isArray(value) ? value[0] : value;
  if (status === "success" || status === "error") return status;
  return "idle";
}

export default async function Home({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {};
  const captureStatus = getCaptureStatus(params.capture);

  return (
    <div className={`${interTight.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}>
      <Landing initialStatus={captureStatus} />
    </div>
  );
}
