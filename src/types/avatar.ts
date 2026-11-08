export interface AvatarParameters {
  // Body Morph Sliders — every one of these is verified to drive the model.
  // Anything without a verified effect was removed, not left disabled.
  height: number;          // 0.8 to 1.25 — uniform root scale, anchored at the feet
  headScale: number;       // 0.85 to 1.2 — head only (counter-scaled against chest/hips)
  bustSize: number;        // 0.6 to 1.6 — chest depth only (head/arms counter-scaled)
  shoulderWidth: number;   // 0.8 to 1.3 — chest width only
  waistWidth: number;      // 0.7 to 1.3 — spine band only (chest/head/arms counter-scaled)
  hipWidth: number;        // 0.8 to 1.4 — hips band only (everything above counter-scaled)
  legLength: number;       // 0.8 to 1.3 — whole-leg length, feet stay on the floor
  armThickness: number;    // 0.8 to 1.3 — upper/lower arm width only
  weight: number;          // 0.8 to 1.4 — mesh deformation only, skeleton untouched (1.0 = original mesh)

  // Colors — each one recolours a real material on the loaded model.
  // Coat/inner/boots/neon colors were removed: no material on the model
  // matches them, so they did nothing. Hair highlight was never read.
  skinColor: string;
  hairColor: string;
  eyeColor: string;

  // Selections
  expression: 'neutral' | 'smile' | 'wink' | 'fierce' | 'surprised';
}

export const DEFAULT_AVATAR_PARAMS: AvatarParameters = {
  height: 1.0,
  headScale: 1.0,
  bustSize: 1.0,
  shoulderWidth: 1.0,
  waistWidth: 1.0,
  hipWidth: 1.0,
  legLength: 1.0,
  armThickness: 1.0,
  weight: 1.0,

  skinColor: '#ffe0bd',
  hairColor: '#6bb5f8',
  eyeColor: '#1d4ed8',

  expression: 'neutral'
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
    desc: 'Fantasy MMO alchemist with mystic robes',
    origin: 'Alchemia Story',
    params: {
      ...DEFAULT_AVATAR_PARAMS,
      height: 0.95,
      headScale: 1.05,
      bustSize: 0.9,
      skinColor: '#fff1e6',
      hairColor: '#c084fc',
      eyeColor: '#9333ea',
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
      eyeColor: '#ec4899',
      expression: 'wink'
    }
  },
  {
    id: 'cyber-striker',
    name: 'Chimera Striker',
    desc: 'Armored combat spec with emerald glow',
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
      eyeColor: '#10b981',
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
      skinColor: '#fceade',
      hairColor: '#111827',
      eyeColor: '#10b981',
      expression: 'fierce'
    }
  }
];
