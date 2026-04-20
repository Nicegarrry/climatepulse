export type PathSector =
  | "ENERGY — GRID"
  | "CARBON & EMISSIONS"
  | "CRITICAL MINERALS"
  | "FINANCE"
  | "POLICY"
  | "TRANSPORT";

export interface Chapter {
  title: string;
  dur: string;
  done?: boolean;
  current?: boolean;
}

export interface Path {
  id: string;
  title: string;
  scope: string;
  duration: string;
  chapters: number;
  sector: PathSector;
  inProgress: boolean;
  progress: number;
  chapterList?: Chapter[];
}

export interface Microsector {
  num: string;
  name: string;
  briefs: number;
  reviewed: number;
  fresh?: boolean;
  cold?: boolean;
  coming?: boolean;
}

export interface Concept {
  term: string;
  abbrev: string;
  eyebrow: string;
  summary: string;
  long: string;
  updated: string;
}

export type PodcastColor = "forest" | "plum" | "ochre" | "sky" | "clay";
export type PodcastKind = "DEEP DIVE" | "WEEKLY" | "DAILY";

export interface Podcast {
  id: string;
  kind: PodcastKind;
  duration: string;
  published: string;
  title: string;
  host: string;
  guest?: string;
  sector: string;
  color: PodcastColor;
  waveform: number[];
  progress: number;
}

export interface SectorPodcast {
  title: string;
  dur: string;
  date: string;
  kind: PodcastKind;
}
