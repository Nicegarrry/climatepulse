import pool from "@/lib/db";

export interface VoiceProfile {
  id: string;
  provider: "gemini" | "lyria" | "gemini-tts";
  provider_voice_id: string;
  display_name: string;
  language: string;
  accent: string | null;
  gender: "female" | "male" | "neutral" | "other" | null;
  notes: string | null;
  active: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { byId: Map<string, VoiceProfile>; loadedAt: number } | null = null;

async function load(): Promise<Map<string, VoiceProfile>> {
  const { rows } = await pool.query<VoiceProfile>(
    `SELECT id, provider, provider_voice_id, display_name, language, accent,
            gender, notes, active
     FROM voice_profiles`
  );
  const byId = new Map<string, VoiceProfile>();
  for (const r of rows) byId.set(r.id, r);
  return byId;
}

async function getCache() {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.byId;
  const byId = await load();
  cache = { byId, loadedAt: Date.now() };
  return byId;
}

export async function getVoiceProfile(id: string): Promise<VoiceProfile | null> {
  const byId = await getCache();
  return byId.get(id) ?? null;
}

export async function listVoiceProfiles(provider?: VoiceProfile["provider"]): Promise<VoiceProfile[]> {
  const byId = await getCache();
  const all = Array.from(byId.values()).filter((v) => v.active);
  return provider ? all.filter((v) => v.provider === provider) : all;
}

export function invalidateVoiceCache() {
  cache = null;
}
