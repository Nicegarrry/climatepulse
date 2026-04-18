import pool from "@/lib/db";
import type { VoiceProfile } from "./voice-registry";

export type CharacterRole =
  | "host_daily"
  | "host_flagship"
  | "ensemble"
  | "correspondent";

export interface PodcastCharacter {
  id: string;
  role: CharacterRole;
  display_name: string;
  short_name: string | null;
  bio: string;
  voice_profile_id: string | null;
  tone_prompt: string | null;
  typical_lines: string[];
  active: boolean;
}

export interface PodcastCharacterWithVoice extends PodcastCharacter {
  voice: VoiceProfile | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: {
  byId: Map<string, PodcastCharacterWithVoice>;
  byRole: Map<CharacterRole, PodcastCharacterWithVoice[]>;
  loadedAt: number;
} | null = null;

async function load(): Promise<{
  byId: Map<string, PodcastCharacterWithVoice>;
  byRole: Map<CharacterRole, PodcastCharacterWithVoice[]>;
}> {
  const { rows } = await pool.query<
    PodcastCharacter & {
      v_id: string | null;
      v_provider: VoiceProfile["provider"] | null;
      v_provider_voice_id: string | null;
      v_display_name: string | null;
      v_language: string | null;
      v_accent: string | null;
      v_gender: VoiceProfile["gender"] | null;
      v_notes: string | null;
      v_active: boolean | null;
    }
  >(
    `SELECT c.id, c.role, c.display_name, c.short_name, c.bio,
            c.voice_profile_id, c.tone_prompt, c.typical_lines, c.active,
            v.id AS v_id, v.provider AS v_provider, v.provider_voice_id AS v_provider_voice_id,
            v.display_name AS v_display_name, v.language AS v_language, v.accent AS v_accent,
            v.gender AS v_gender, v.notes AS v_notes, v.active AS v_active
     FROM podcast_characters c
     LEFT JOIN voice_profiles v ON v.id = c.voice_profile_id`
  );

  const byId = new Map<string, PodcastCharacterWithVoice>();
  const byRole = new Map<CharacterRole, PodcastCharacterWithVoice[]>();

  for (const r of rows) {
    const character: PodcastCharacterWithVoice = {
      id: r.id,
      role: r.role,
      display_name: r.display_name,
      short_name: r.short_name,
      bio: r.bio,
      voice_profile_id: r.voice_profile_id,
      tone_prompt: r.tone_prompt,
      typical_lines: r.typical_lines ?? [],
      active: r.active,
      voice: r.v_id
        ? {
            id: r.v_id,
            provider: r.v_provider!,
            provider_voice_id: r.v_provider_voice_id!,
            display_name: r.v_display_name!,
            language: r.v_language ?? "en",
            accent: r.v_accent,
            gender: r.v_gender,
            notes: r.v_notes,
            active: r.v_active ?? true,
          }
        : null,
    };
    byId.set(character.id, character);
    const bucket = byRole.get(character.role) ?? [];
    bucket.push(character);
    byRole.set(character.role, bucket);
  }

  return { byId, byRole };
}

async function getCache() {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;
  const { byId, byRole } = await load();
  cache = { byId, byRole, loadedAt: Date.now() };
  return cache;
}

export async function getCharacter(slug: string): Promise<PodcastCharacterWithVoice | null> {
  const c = await getCache();
  return c.byId.get(slug) ?? null;
}

export async function getCharacters(slugs: string[]): Promise<PodcastCharacterWithVoice[]> {
  const c = await getCache();
  return slugs.map((s) => c.byId.get(s)).filter((x): x is PodcastCharacterWithVoice => Boolean(x));
}

export async function listCharacters(role?: CharacterRole): Promise<PodcastCharacterWithVoice[]> {
  const c = await getCache();
  const bucket = role ? c.byRole.get(role) ?? [] : Array.from(c.byId.values());
  return bucket.filter((x) => x.active);
}

/**
 * Return the default host pair for a given tier. For daily this is
 * Sarah + James; for flagship it's Maya + Dr James Okafor.
 * Falls back to the first two host rows of the appropriate role if the
 * canonical slugs have been renamed in admin.
 */
export async function getDefaultHosts(
  tier: "daily" | "themed" | "flagship"
): Promise<PodcastCharacterWithVoice[]> {
  const c = await getCache();
  if (tier === "daily" || tier === "themed") {
    const sarah = c.byId.get("sarah-daily");
    const james = c.byId.get("james-daily");
    if (sarah && james) return [sarah, james];
    return (c.byRole.get("host_daily") ?? []).slice(0, 2);
  }
  const maya = c.byId.get("maya-chen");
  const okafor = c.byId.get("james-okafor");
  if (maya && okafor) return [maya, okafor];
  return (c.byRole.get("host_flagship") ?? []).slice(0, 2);
}

export function invalidateCharacterCache() {
  cache = null;
}
