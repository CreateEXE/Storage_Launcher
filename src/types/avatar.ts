export interface AvatarParameters {
  // Body Morph Sliders
  height: number;          // 0.8 to 1.25
  headScale: number;       // 0.85 to 1.2
  bustSize: number;        // 0.6 to 1.6
  shoulderWidth: number;   // 0.8 to 1.3
  waistWidth: number;      // 0.7 to 1.3
  hipWidth: number;        // 0.8 to 1.4
  legLength: number;       // 0.8 to 1.3
  legThickness: number;    // 0.8 to 1.3
  armLength: number;       // 0.8 to 1.3
  armThickness: number;    // 0.8 to 1.3

  // Face Sliders
  eyeScale: number;        // 0.7 to 1.4
  eyeSpacing: number;      // -0.03 to 0.03
  browRaise: number;       // -1 (down) to 1 (up); VRM brow morphs only
  mouthOpen: number;       // 0 to 1; VRM mouth morph only
  chinWidth: number;       // 0.8 to 1.2

  // Colors
  skinColor: string;
  hairColor: string;
  hairHighlightColor: string;
  eyeColor: string;
  coatColor: string;
  innerColor: string;
  accentNeonColor: string;
  bootsColor: string;

  // Selections
  hairstyle: 'twintails' | 'bobcut' | 'longwaves' | 'spiky' | 'ponytail' | 'short';
  outfit: 'cyber_jacket' | 'mmo_tunic' | 'school_uniform' | 'combat_suit' | 'hoodie';
  expression: 'neutral' | 'smile' | 'wink' | 'fierce' | 'surprised';
  /**
   * Expression blend weights, keyed by VRM expression name
   * ('happy', 'angry', 'sad', 'relaxed', 'surprised', 'blink', 'aa',
   * 'ee', 'ih', 'oh', 'ou', 'neutral'). Each weight is 0–1 and several
   * presets can be active at once — this is the single source of truth
   * for expressions. The legacy single-choice `expression` field is kept
   * for saved presets: when `expressionBlends` is empty, the effective
   * blend is derived from it (see getExpressionBlends).
   */
  expressionBlends: Record<string, number>;
}

/**
 * Editor expression ids map to the VRM preset names the model registers.
 * (The viewer also drives VRM presets directly — 'sad', 'relaxed', 'aa',
 * 'ee', 'ih', 'oh', 'ou' — which have no editor id; those live in
 * `expressionBlends` under their own VRM name.)
 */
export const EXPRESSION_VRM_NAME: Record<AvatarParameters['expression'], string> = {
  neutral: 'neutral',
  smile: 'happy',
  wink: 'blink',
  fierce: 'angry',
  surprised: 'surprised',
};

/** Editor expression id for a VRM preset name, when one exists. */
export const EXPRESSION_EDITOR_ID: Record<string, AvatarParameters['expression'] | undefined> = {
  neutral: 'neutral',
  happy: 'smile',
  blink: 'wink',
  angry: 'fierce',
  surprised: 'surprised',
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The effective expression blend map for a set of params. Explicit
 * `expressionBlends` win; when they are empty (e.g. an old preset that
 * only stored the single-choice `expression`), the blend is derived from
 * that choice — 'fierce' at 0.85, matching the old single-preset weight,
 * everything else at full weight. Never returns a weight outside 0–1.
 */
export function getExpressionBlends(params: AvatarParameters): Record<string, number> {
  const out: Record<string, number> = {};
  const blends = params.expressionBlends || {};
  for (const [name, w] of Object.entries(blends)) {
    const v = clamp01(Number(w) || 0);
    if (v > 0) out[name] = v;
  }
  if (Object.keys(out).length > 0) return out;
  if (params.expression && params.expression !== 'neutral') {
    out[EXPRESSION_VRM_NAME[params.expression]] = params.expression === 'fierce' ? 0.85 : 1;
  }
  return out;
}

/**
 * Defensive merge for params loaded from anywhere (persisted state, preset
 * files, older saves): fill in any missing keys from the defaults, make
 * sure `expressionBlends` is an object, and derive it from the legacy
 * single-choice `expression` when it is missing so old presets still
 * show their expression.
 */
export function normalizeAvatarParams(params: Partial<AvatarParameters> | null | undefined): AvatarParameters {
  // Drop legacy keys from saves made before the procedural accessories
  // were removed ('accessory' / 'earSize' — cone/torus/cylinder ears,
  // horns and headphones). They no longer exist on AvatarParameters;
  // stripping them stops old saves re-introducing dead keys.
  const { accessory: _removedAccessory, earSize: _removedEarSize, ...rest } =
    (params || {}) as Partial<AvatarParameters> & { accessory?: unknown; earSize?: unknown };
  void _removedAccessory;
  void _removedEarSize;
  const merged: AvatarParameters = { ...DEFAULT_AVATAR_PARAMS, ...rest };
  if (!merged.expressionBlends || typeof merged.expressionBlends !== 'object') {
    merged.expressionBlends = {};
  }
  if (Object.keys(merged.expressionBlends).length === 0 && merged.expression && merged.expression !== 'neutral') {
    merged.expressionBlends = {
      [EXPRESSION_VRM_NAME[merged.expression]]: merged.expression === 'fierce' ? 0.85 : 1,
    };
  }
  return merged;
}

export const DEFAULT_AVATAR_PARAMS: AvatarParameters = {
  height: 1.0,
  headScale: 1.0,
  bustSize: 1.0,
  shoulderWidth: 1.0,
  waistWidth: 1.0,
  hipWidth: 1.0,
  legLength: 1.0,
  legThickness: 1.0,
  armLength: 1.0,
  armThickness: 1.0,

  eyeScale: 1.0,
  eyeSpacing: 0.0,
  browRaise: 0,
  mouthOpen: 0,
  chinWidth: 1.0,

  skinColor: '#ffe0bd',
  hairColor: '#6bb5f8',
  hairHighlightColor: '#a5f3fc',
  eyeColor: '#1d4ed8',
  coatColor: '#121b2d',
  innerColor: '#f1f5f9',
  accentNeonColor: '#38bdf8',
  bootsColor: '#0f172a',

  hairstyle: 'twintails',
  outfit: 'cyber_jacket',
  expression: 'neutral',
  expressionBlends: {}
};

export interface AvatarPreset {
  id: string;
  name: string;
  desc: string;
  origin: string; // "Custom Cast" | "Alchemia Story" | "Termux Native"
  params: AvatarParameters;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'cyber-humanoid',
    name: 'Cyber Humanoid',
    desc: 'Default cybernetic anime avatar parameters',
    origin: 'Termux Native',
    params: { ...DEFAULT_AVATAR_PARAMS }
  },
  {
    id: 'alchemia-mage',
    name: 'Alchemia Sorceress',
    desc: 'Fantasy MMO alchemist with elf ears and mystic robes',
    origin: 'Alchemia Story',
    params: {
      ...DEFAULT_AVATAR_PARAMS,
      height: 0.95,
      headScale: 1.05,
      bustSize: 0.9,
      skinColor: '#fff1e6',
      hairColor: '#c084fc',
      hairHighlightColor: '#f472b6',
      eyeColor: '#9333ea',
      coatColor: '#3b0764',
      innerColor: '#fae8ff',
      accentNeonColor: '#e879f9',
      bootsColor: '#2e1065',
      hairstyle: 'longwaves',
      outfit: 'mmo_tunic',
      expression: 'smile'
    }
  },
  {
    id: 'custom-cast-idol',
    name: 'Custom Cast Pop Idol',
    desc: 'Vibrant twin-tailed idol with upbeat school uniform',
    origin: 'Custom Cast',
    params: {
      ...DEFAULT_AVATAR_PARAMS,
      height: 0.92,
      headScale: 1.08,
      bustSize: 1.15,
      skinColor: '#ffd8be',
      hairColor: '#f472b6',
      hairHighlightColor: '#fbcfe8',
      eyeColor: '#ec4899',
      coatColor: '#1e1b4b',
      innerColor: '#ffffff',
      accentNeonColor: '#fb7185',
      bootsColor: '#312e81',
      hairstyle: 'twintails',
      outfit: 'school_uniform',
      expression: 'wink'
    }
  },
  {
    id: 'cyber-striker',
    name: 'Chimera Striker',
    desc: 'Armored combat spec with cyber horns and neon emerald glow',
    origin: 'Termux Native',
    params: {
      ...DEFAULT_AVATAR_PARAMS,
      height: 1.12,
      bustSize: 1.25,
      shoulderWidth: 1.15,
      waistWidth: 0.95,
      hipWidth: 1.1,
      legLength: 1.15,
      skinColor: '#f8d5ba',
      hairColor: '#0284c7',
      hairHighlightColor: '#38bdf8',
      eyeColor: '#10b981',
      coatColor: '#0f172a',
      innerColor: '#020617',
      accentNeonColor: '#22c55e',
      bootsColor: '#020617',
      hairstyle: 'spiky',
      outfit: 'combat_suit',
      expression: 'fierce'
    }
  },
  {
    id: 'shadow-kunoichi',
    name: 'Shadow Kunoichi',
    desc: 'Tactical ninja avatar with dark aesthetic and green eyes',
    origin: 'Termux Native',
    params: {
      ...DEFAULT_AVATAR_PARAMS,
      height: 1.05,
      headScale: 0.95,
      bustSize: 1.55,
      shoulderWidth: 0.95,
      waistWidth: 0.82,
      hipWidth: 1.35,
      legLength: 1.10,
      armThickness: 0.90,
      eyeScale: 0.88,
      eyeSpacing: -0.005,
      chinWidth: 0.92,
          skinColor: '#fceade',
      hairColor: '#111827',
      hairHighlightColor: '#374151',
      eyeColor: '#10b981',
      coatColor: '#090d16',
      innerColor: '#1f2937',
      accentNeonColor: '#059669',
      bootsColor: '#030712',
      hairstyle: 'ponytail',
      outfit: 'combat_suit',
      expression: 'fierce'
    }
  }
];
