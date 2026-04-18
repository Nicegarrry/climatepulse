-- ============================================================================
-- Podcast seed data: voice profiles, characters, formats, themed schedule,
-- and the starter flagship backlog.
--
-- Run after: migrate-podcast-evolution.sql
-- Idempotent via ON CONFLICT.
--
-- NOTE on voice IDs: the Gemini prebuilt voice catalogue evolves; admins can
-- edit voice_profiles.provider_voice_id via the admin UI without schema change.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- voice_profiles (Gemini multi-speaker TTS prebuilt voices)
-- ----------------------------------------------------------------------------
INSERT INTO voice_profiles (id, provider, provider_voice_id, display_name, accent, gender, notes) VALUES
  ('gemini-aoede',   'gemini-tts', 'Aoede',   'Aoede — breezy feminine',   'en-AU', 'female',  'Warm, big-picture. Used by daily host "Sarah".'),
  ('gemini-charon',  'gemini-tts', 'Charon',  'Charon — informative male', 'en-AU', 'male',    'Data-driven, precise. Used by daily analyst "James".'),
  ('gemini-leda',    'gemini-tts', 'Leda',    'Leda — youthful feminine',  'en-AU', 'female',  'Pace, enthusiasm. Flagship cohost Maya Chen.'),
  ('gemini-puck',    'gemini-tts', 'Puck',    'Puck — thoughtful male',    'en-GB', 'male',    'Depth, caution, dry wit. Flagship cohost Dr James Okafor.'),
  ('gemini-sulafat', 'gemini-tts', 'Sulafat', 'Sulafat — descriptive feminine', 'en',   'female',  'Sensory, atmospheric. Correspondent Priya Ramanathan.'),
  ('gemini-kore',    'gemini-tts', 'Kore',    'Kore — firm neutral',       'en',    'neutral', 'Comparative international lens. Correspondent Marco Silva.'),
  ('gemini-fenrir',  'gemini-tts', 'Fenrir',  'Fenrir — eccentric male',   'en-GB', 'male',    'Enthusiastic technical dive. Correspondent Dr Felix Ashworth.'),
  ('gemini-zephyr',  'gemini-tts', 'Zephyr',  'Zephyr — gruff older male', 'en-AU', 'male',    'Hard-nosed commercial realism. Correspondent Geoff Harrington.')
ON CONFLICT (id) DO UPDATE SET
  provider = EXCLUDED.provider,
  provider_voice_id = EXCLUDED.provider_voice_id,
  display_name = EXCLUDED.display_name,
  accent = EXCLUDED.accent,
  gender = EXCLUDED.gender,
  notes = EXCLUDED.notes;

-- ----------------------------------------------------------------------------
-- podcast_characters
-- ----------------------------------------------------------------------------
INSERT INTO podcast_characters (id, role, display_name, short_name, bio, voice_profile_id, tone_prompt, typical_lines) VALUES
  (
    'sarah-daily', 'host_daily', 'Sarah', 'Sarah',
    'ClimatePulse Daily host. Big-picture, qualitative thinker. Australian, sceptical by default, pushes back on corporate announcements.',
    'gemini-aoede',
    'Direct and incisive. Occasionally sceptical. Energised Australian delivery, never ponderous.',
    ARRAY[
      'Let''s get into it.',
      'But what does this actually change?',
      'That''s the part the headline misses.'
    ]
  ),
  (
    'james-daily', 'host_daily', 'James (Daily)', 'James',
    'ClimatePulse Daily analyst. Data-driven, precise. Australian. Anchors every claim in a specific number.',
    'gemini-charon',
    'Measured where numbers matter, brisk where colour is needed. Emphasise specific magnitudes.',
    ARRAY[
      'The specific number here is…',
      'Compared with the same period last year…',
      'That math doesn''t quite hold up.'
    ]
  ),
  (
    'maya-chen', 'host_flagship', 'Maya Chen', 'Maya',
    'Sydney-raised tech/VC climate investor. Engineering + finance at UNSW, early-stage climate tech VC. Numbers-driven but genuinely excited about the transition.',
    'gemini-leda',
    'Fast-paced, optimistic but evidence-driven. Loves unit economics. Will make confident calls and own them when wrong. Animated when numbers align.',
    ARRAY[
      'Okay but the capex curve on this is bananas.',
      'I''m going to go out on a limb and say…',
      'Three years ago nobody would have signed that PPA.'
    ]
  ),
  (
    'james-okafor', 'host_flagship', 'Dr James Okafor', 'James',
    'Climate science PhD from Oxford (atmospheric feedback loops). Postdoc in battery electrochemistry. Now at Monash on large-scale storage. Field time on glaciers, in mines, in ag research stations.',
    'gemini-puck',
    'Thoughtful, dry wit. Willing to slow the conversation to get something right. Pushes back when optimism outruns thermodynamics.',
    ARRAY[
      'That''s true, but the thermodynamics…',
      'I want to push back on that slightly.',
      'The IPCC actually modelled this scenario and…'
    ]
  ),
  (
    'priya-ramanathan', 'correspondent', 'Priya Ramanathan', 'Priya',
    'Former environmental journalist with a travel-writing sensibility. Takes listeners to specific places — literal site visits, ambient reporting.',
    'gemini-sulafat',
    'Sensory, atmospheric, descriptive. Present tense. Lets silence and environment carry the moment.',
    ARRAY[
      'I''m standing at the base of what will become…',
      'The wind here is — you can hear it — relentless.',
      'Let me describe what I''m seeing.'
    ]
  ),
  (
    'marco-silva', 'correspondent', 'Marco Silva', 'Marco',
    'International energy-policy journalist based in Lisbon. Covers COP, Brussels, Beijing, Texas. Brings comparative angles: "here''s how Europe is handling this".',
    'gemini-kore',
    'Brisk, comparative. Three things to know. Clean handoffs from one geography to the next.',
    ARRAY[
      'Marco here, coming to you from…',
      'What''s fascinating is how differently this is playing out in…',
      'Three things to know about what Germany just announced.'
    ]
  ),
  (
    'felix-ashworth', 'correspondent', 'Dr Felix Ashworth', 'Felix',
    'Fictional technical polymath. Perovskites, solid-state batteries, geothermal thermodynamics — loves the weeds. Slightly obsessive about accuracy.',
    'gemini-fenrir',
    'Eccentric, enthusiastic, audibly enjoying the technical detail. Draw pictures with words.',
    ARRAY[
      'Right, so the thing people get wrong about this is…',
      'Let me actually draw this out — imagine a…',
      'This is where it gets genuinely exciting.'
    ]
  ),
  (
    'geoff-harrington', 'correspondent', 'Geoff Harrington', 'Geoff',
    'Former resources/infrastructure executive turned reluctant commentator. Seen multiple energy cycles. Sceptical of hype, government timelines, and anyone who can''t produce a balance sheet.',
    'gemini-zephyr',
    'Gruff, direct, older Australian. Cuts through jargon. When he concedes a point it means something.',
    ARRAY[
      'Look, I''m going to be the bloke who says…',
      'This sounds great in theory. Who''s paying for it?',
      'Alright, fair enough, that''s a good point.'
    ]
  )
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  display_name = EXCLUDED.display_name,
  short_name = EXCLUDED.short_name,
  bio = EXCLUDED.bio,
  voice_profile_id = EXCLUDED.voice_profile_id,
  tone_prompt = EXCLUDED.tone_prompt,
  typical_lines = EXCLUDED.typical_lines;

-- ----------------------------------------------------------------------------
-- podcast_formats (8 Main Piece formats for the flagship)
-- ----------------------------------------------------------------------------
INSERT INTO podcast_formats (id, display_name, description, emotional_register, typical_cadence, is_experimental, script_prompt_template) VALUES
  (
    'dinner_table', 'Dinner Table Debate',
    'Multiple AI personas representing different stakeholders argue a live issue. Maya and James facilitate.',
    'conflict, intellectual heat', 'monthly', FALSE,
    'Construct a round-table with 4–6 distinct personas (stakeholder label + brief bio each). They argue, interrupt, and concede points. Maya moderates and pulls threads; James tests claims against data. Target emotional arc: heat → insight → unresolved tension.'
  ),
  (
    'fireside', 'Fireside Chat',
    'Intimate, slow exploration of an idea with the hosts plus one correspondent.',
    'intimate, contemplative', 'monthly', FALSE,
    'Pace is patient. Long turns. Hosts + one correspondent. One idea, deeply turned over. Allow silences. End on a single unresolved question, not a thesis.'
  ),
  (
    'what_if', 'What-If History',
    'Counterfactual exploration — what if Australia built X instead of Y.',
    'intellectually surprising', 'quarterly', FALSE,
    'Pick a concrete past decision. Narrate the alternative path with economic, grid, political, and emissions consequences. Return to present to say what this teaches us. Speculate plausibly; flag where confidence drops.'
  ),
  (
    'location_tour', 'Location Tour',
    'Priya takes us somewhere specific — site, region, facility. Immersive reporting.',
    'immersive, sensory', 'monthly', FALSE,
    'Priya leads. Ambient description in present tense. Hosts interject with data and context. Include 3–5 "here is what I am seeing / hearing / smelling" beats. End back in studio with a reflection.'
  ),
  (
    'technical_deep_dive', 'Technical Deep Dive',
    'Felix walks through a technology in rigorous but accessible detail.',
    'educational, curious', 'monthly', FALSE,
    'Felix leads with a physical/chemical mental model. Maya interjects with "so what does this cost" and James checks thermodynamics. Build from basics to frontier in 4 layers.'
  ),
  (
    'awards_show', 'Awards Show / Comedy',
    'Satirical awards — Climate Capex of the Year, Worst PPA, Most Optimistic Timeline.',
    'playful, light', 'quarterly', TRUE,
    'Announcer voice. 6–8 category awards. Nominees introduced with arch bio. Winners "accept" via fictional acceptance speech. Keep specifics real — satire targets behaviour, not facts.'
  ),
  (
    'fictional_interview', 'Fictional Interview',
    'Interview a fictional stakeholder — a 2050 grid engineer, a Pilbara hydrogen plant operations manager.',
    'creative, character-driven', 'experimental', TRUE,
    'Maya conducts the interview. Felix drops in to stress-test technical plausibility. The fictional character must have a coherent worldview and should sometimes refuse to answer things they wouldn''t know.'
  ),
  (
    'scale_travel', 'Scale Travel',
    'Imaginative journey across scales — inside a battery cell, orbital view of Australia''s grid.',
    'imaginative', 'experimental', TRUE,
    'Narrator-led (Priya or a host). Clear scale shifts announced explicitly. Physics must hold. Felix confirms accuracy; Maya grounds in practical implications; James brings numbers.'
  )
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  emotional_register = EXCLUDED.emotional_register,
  typical_cadence = EXCLUDED.typical_cadence,
  is_experimental = EXCLUDED.is_experimental,
  script_prompt_template = EXCLUDED.script_prompt_template;

-- ----------------------------------------------------------------------------
-- themed_schedule (3 starter themed days; others disabled until we scale)
-- ----------------------------------------------------------------------------
INSERT INTO themed_schedule (id, theme_slug, title, day_of_week, local_time, cornerstone_character_id, default_ensemble_ids, domain_filter, min_significance, prompt_template_path, enabled) VALUES
  ('nem_monday',       'nem_monday',       'NEM Monday',       1, '07:00', 'maya-chen',    ARRAY['geoff-harrington'],                 ARRAY['energy-grid','energy-generation'],              55.0, 'prompts/podcast/nem-monday.md',       TRUE),
  ('battery_tuesday',  'battery_tuesday',  'Battery Tuesday',  2, '07:00', 'james-okafor', ARRAY['felix-ashworth'],                   ARRAY['energy-storage','critical-minerals'],           55.0, 'prompts/podcast/battery-tuesday.md',  TRUE),
  ('markets_friday',   'markets_friday',   'Markets Friday',   5, '17:00', 'maya-chen',    ARRAY['geoff-harrington'],                 ARRAY['finance','carbon-emissions'],                    55.0, 'prompts/podcast/markets-friday.md',   TRUE),
  ('transport_wednesday','transport_wednesday','Transport Wednesday',3,'07:00','maya-chen', ARRAY['felix-ashworth'],                   ARRAY['transport'],                                     55.0, 'prompts/podcast/transport-wednesday.md', FALSE),
  ('policy_thursday',  'policy_thursday',  'Policy Thursday',  4, '07:00', 'james-okafor', ARRAY['marco-silva'],                      ARRAY['policy'],                                        55.0, 'prompts/podcast/policy-thursday.md',  FALSE)
ON CONFLICT (id) DO UPDATE SET
  theme_slug = EXCLUDED.theme_slug,
  title = EXCLUDED.title,
  day_of_week = EXCLUDED.day_of_week,
  local_time = EXCLUDED.local_time,
  cornerstone_character_id = EXCLUDED.cornerstone_character_id,
  default_ensemble_ids = EXCLUDED.default_ensemble_ids,
  domain_filter = EXCLUDED.domain_filter,
  min_significance = EXCLUDED.min_significance,
  prompt_template_path = EXCLUDED.prompt_template_path,
  enabled = EXCLUDED.enabled;

-- ----------------------------------------------------------------------------
-- flagship_episodes starter backlog (from podcast.md)
-- Fixed deterministic IDs so re-seeding won't duplicate.
-- ----------------------------------------------------------------------------
INSERT INTO flagship_episodes (id, title, concept, format_id, status, complexity, assigned_characters) VALUES
  ('flagship-starter-01', 'The Dinner Table at 2035',           'Six AI personas — coal-town mayor, battery factory worker, climate scientist, Treasury analyst, farmer, teenager — debate how the transition actually went.',                   'dinner_table',        'idea',      3, ARRAY['maya-chen','james-okafor']),
  ('flagship-starter-02', 'Inside a Battery Cell',              'Priya "shrinks" and tours a lithium-ion cell during a discharge cycle. Felix provides technical commentary.',                                                                 'scale_travel',        'idea',      4, ARRAY['priya-ramanathan','felix-ashworth','james-okafor']),
  ('flagship-starter-03', 'The Kurri Kurri Counterfactual',     'What if Kurri Kurri had been built as 1 GW solar+storage instead of gas? Walk through economics, grid impact, politics.',                                                     'what_if',             'idea',      2, ARRAY['maya-chen','james-okafor','geoff-harrington']),
  ('flagship-starter-04', 'From Copenhagen',                    'Marco tours Denmark''s grid, offshore wind, and heat networks, drawing parallels to Australia.',                                                                              'location_tour',       'idea',      2, ARRAY['marco-silva','maya-chen']),
  ('flagship-starter-05', 'The Snowy 2.0 You''ll Never See',    'Priya inside the tunnels describing what''s actually being built. Geoff on whether it''ll ever be worth it.',                                                                  'location_tour',       'idea',      3, ARRAY['priya-ramanathan','geoff-harrington','maya-chen']),
  ('flagship-starter-06', 'Capex of the Year',                  'Satirical awards for best/worst climate capital deployment of the year.',                                                                                                    'awards_show',         'idea',      3, ARRAY['maya-chen','james-okafor','geoff-harrington']),
  ('flagship-starter-07', 'The Pilbara 2050',                   'Maya interviews the fictional operations manager of a Pilbara hydrogen hub in 2050. Felix stress-tests tech plausibility.',                                                    'fictional_interview', 'idea',      3, ARRAY['maya-chen','felix-ashworth']),
  ('flagship-starter-08', 'Electrons Through Australia',        'Follow one electron from a Pilbara solar panel through the grid to a Sydney kettle. Physics accurate.',                                                                        'scale_travel',        'idea',      4, ARRAY['maya-chen','james-okafor','felix-ashworth']),
  ('flagship-starter-09', 'What Germany Got Wrong',             'Hosts + Marco honestly examine Energiewende — what worked, what didn''t, lessons for Australia.',                                                                              'fireside',            'idea',      2, ARRAY['maya-chen','james-okafor','marco-silva']),
  ('flagship-starter-10', 'The Agriculture Episode We Keep Avoiding', 'James leads. Why climate discussion skips agriculture. What the numbers actually look like.',                                                                           'fireside',            'idea',      2, ARRAY['james-okafor','maya-chen']),
  ('flagship-starter-11', 'Offshore Wind at the Dinner Table',  'Coastal resident, fishing-industry rep, developer, local MP, marine scientist debate offshore wind in Gippsland.',                                                              'dinner_table',        'idea',      3, ARRAY['maya-chen','james-okafor']),
  ('flagship-starter-12', 'Geoff Got Convinced',                'Geoff walks through the one thing that made him change his mind on the transition. Or didn''t. Could go either way.',                                                          'fireside',            'idea',      2, ARRAY['geoff-harrington','maya-chen','james-okafor'])
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  concept = EXCLUDED.concept,
  format_id = EXCLUDED.format_id,
  complexity = EXCLUDED.complexity,
  assigned_characters = EXCLUDED.assigned_characters;

COMMIT;
