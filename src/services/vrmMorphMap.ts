/**
 * Verified VRM morph map — the single source of truth for which editor
 * sliders actually do what they claim on the loaded model.
 *
 * BACKGROUND — why this file exists
 * ---------------------------------
 * The old editor bound sliders to bones by guesswork, and the guesses were
 * wrong in ways that morph the wrong body section:
 *   - `bustSize` was applied as `chest.scale.z` — the chest bone is the
 *     parent of the shoulders, neck and head, so it widened the whole torso
 *     and scaled the arms and head with it.
 *   - `waistWidth` was applied as `spine.scale.x/z` — the spine is the
 *     parent of the chest, so it also widened the chest, arms and head.
 *   - `hipWidth` was applied as `hips.scale.x/z` — the hips bone is the
 *     skeleton root, so it also scaled the spine and both legs.
 *   - `height` was applied as a Y-only root stretch (`scale.set(1, h, 1)`),
 *     which distorts proportions instead of changing height.
 *   - Colors were matched by substring (`combined.includes('body')`),
 *     which tinted the outfit normal-map material `body_nm`, the robot-arm
 *     materials `arm_mat` / `arm_plastic`, and the eye materials (the head
 *     mesh name matched the skin branch before the eye branch was reached).
 *
 * RULE (user requirement)
 * -----------------------
 * Every slider must morph ONLY the body section it names, with no
 * cross-talk to other parts. A slider is bound only to a bone / morph
 * target / mesh / material that was verified — by reading the actual model
 * file — to control exactly that section. A slider whose target cannot be
 * verified on the loaded model is DISABLED in the UI with the reason why,
 * never silently bound to a wrong bone.
 *
 * HOW VERIFICATION WORKS
 * ----------------------
 * 1. Offline (this file + `scripts/verify-vrm-morph-map.mjs`): the bundled
 *    models were parsed directly from their files. The findings are recorded
 *    in VERIFIED_CLAIMS / UNAVAILABLE_CONTROLS below, and the script
 *    re-checks every claim against the files on demand.
 * 2. At runtime (`inspectModel`): the loaded scene is probed again — the
 *    humanoid bones, morph-target dictionaries, mesh names and material
 *    names are resolved live. A control is `verified` only if its target
 *    resolves in the live scene; otherwise it is `unavailable` with a
 *    reason. Every resolution is logged to the console and surfaced in the
 *    editor's "Mapping" tab.
 * 3. Application (`applyVerifiedMorphs`): each verified applier writes
 *    ONLY its own axes / morph indices / materials, absolutely, from the
 *    base transform captured at inspection time. Controls that share a bone
 *    (legLength writes Y, legThickness writes X/Z) compose instead of
 *    wiping each other, values never accumulate, and unverified controls
 *    are never applied at all.
 *
 * OFFLINE FINDINGS (from parsing the bundled model files)
 * -------------------------------------------------------
 * vessel.vrm — real VRM 1.0 ("Seed-san", VirtualCast). 51 humanoid bones:
 * hips, spine, chest, neck, head, shoulders, upper/lower arms, hands,
 * fingers, upper/lower legs, feet, toes. NO waist bone, NO bust bone, NO
 * upperChest, NO eye bones, NO jaw bone. 5 meshes: hair, hair_tail, head,
 * robo_arm, wear. ONLY the head mesh has morph targets (43): eye_close,
 * blink_L/R, eye_open, eye_smile, eye_brow_up/down (+L/R), eye_small,
 * eye_black_big/small, eye_star, eye_V, eye_zitome, eye_angry, cheek,
 * cheek_pop, mouse_open (note the model's own spelling), mouth_wide/short,
 * lip_a/i/u/e/o/w, lip_up/down, face_happy/angry/sad/relax/surprise,
 * look_up/down/left/right. Materials: hair, huku_bake, body_bake, eye,
 * eye_trans, arm_mat, arm_plastic, green_emit, body_nm, wear_metal,
 * armgear_plastic, robo_face, glass, backpack_metal, backpack_nm,
 * backpack_plastic, anim_logo. The "wear" mesh is a single skinned mesh
 * (12 primitives) covering body + outfit together — there is no separate
 * bust / waist / hip mesh section to scale.
 *
 * female_kunoichi.vrm — NOT a VRM at all. It is a THREE.Object3D JSON dump
 * (generator "Object3D.toJSON"). It has named groups hips / spine / chest /
 * neck / head, empty leftEye / rightEye groups, a Head_Mesh_Group
 * (Face_Skin_Mesh, eye whites, eyeIrisLeft/Right, hair assembly), a
 * Bust_Group, and three unnamed Suit cylinders under chest / spine / hips.
 * It has NO morphs, NO skinning, NO expressions, and — critically — EVERY
 * object matrix in the file is the identity matrix, so every part is stored
 * at the origin, overlapping. The limb cylinders are unnamed and cannot be
 * told apart as arm vs leg. Only group-isolated targets (head group,
 * Bust_Group) and material-name targets (Skin / Hair / Eye_Iris / Suit /
 * NeonAccent) are verifiable on this file.
 */
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { AvatarParameters } from '../types/avatar';

// ---------------------------------------------------------------------------
// Editor control table — every slider / color / choice the editor offers.
// `id` is the AvatarParameters key (or the choice key). The morph map
// resolves each of these against the loaded model; the editor renders a
// control enabled only when its resolution is `verified`.
// ---------------------------------------------------------------------------
export type MorphControlKind = 'slider' | 'color' | 'choice';
export type MorphSection = 'body' | 'face' | 'hair' | 'outfit' | 'colors';

export interface MorphControlDef {
  id: string;
  label: string;
  section: MorphSection;
  kind: MorphControlKind;
  min?: number;
  max?: number;
  step?: number;
  choices?: Array<{ id: string; label: string }>;
}

export const EDITOR_CONTROLS: MorphControlDef[] = [
  { id: 'height', label: 'Overall Height', section: 'body', kind: 'slider', min: 0.8, max: 1.25, step: 0.01 },
  { id: 'headScale', label: 'Head Size', section: 'body', kind: 'slider', min: 0.85, max: 1.2, step: 0.01 },
  { id: 'bustSize', label: 'Bust Size', section: 'body', kind: 'slider', min: 0.6, max: 1.6, step: 0.01 },
  { id: 'shoulderWidth', label: 'Shoulder Width', section: 'body', kind: 'slider', min: 0.8, max: 1.3, step: 0.01 },
  { id: 'waistWidth', label: 'Waist Width', section: 'body', kind: 'slider', min: 0.7, max: 1.3, step: 0.01 },
  { id: 'hipWidth', label: 'Hip Width', section: 'body', kind: 'slider', min: 0.8, max: 1.4, step: 0.01 },
  { id: 'legLength', label: 'Leg Length', section: 'body', kind: 'slider', min: 0.8, max: 1.3, step: 0.01 },
  { id: 'legThickness', label: 'Leg Thickness', section: 'body', kind: 'slider', min: 0.8, max: 1.3, step: 0.01 },
  { id: 'armLength', label: 'Arm Length', section: 'body', kind: 'slider', min: 0.8, max: 1.3, step: 0.01 },
  { id: 'armThickness', label: 'Arm Thickness', section: 'body', kind: 'slider', min: 0.8, max: 1.3, step: 0.01 },
  { id: 'eyeScale', label: 'Eye Size', section: 'face', kind: 'slider', min: 0.7, max: 1.4, step: 0.01 },
  { id: 'eyeSpacing', label: 'Eye Spacing', section: 'face', kind: 'slider', min: -0.03, max: 0.03, step: 0.002 },
  { id: 'browRaise', label: 'Brow Raise', section: 'face', kind: 'slider', min: -1, max: 1, step: 0.05 },
  { id: 'mouthOpen', label: 'Mouth Open', section: 'face', kind: 'slider', min: 0, max: 1, step: 0.05 },
  { id: 'chinWidth', label: 'Chin / Jaw Width', section: 'face', kind: 'slider', min: 0.8, max: 1.2, step: 0.01 },
  { id: 'earSize', label: 'Accessory Size', section: 'face', kind: 'slider', min: 0.6, max: 1.5, step: 0.02 },
  { id: 'expression', label: 'Expression', section: 'face', kind: 'choice', choices: [
    { id: 'neutral', label: 'Neutral' },
    { id: 'smile', label: 'Smile' },
    { id: 'wink', label: 'Wink' },
    { id: 'fierce', label: 'Fierce' },
    { id: 'surprised', label: 'Surprised' },
  ] },
  { id: 'hairstyle', label: 'Hairstyle', section: 'hair', kind: 'choice', choices: [
    { id: 'twintails', label: 'Twin Tails' },
    { id: 'bobcut', label: 'Cute Bob Cut' },
    { id: 'longwaves', label: 'Long Waves (MMO)' },
    { id: 'spiky', label: 'Cyber Spiky' },
    { id: 'ponytail', label: 'High Ponytail' },
    { id: 'short', label: 'Short Crop' },
  ] },
  { id: 'hairColor', label: 'Hair Color', section: 'hair', kind: 'color' },
  { id: 'hairHighlightColor', label: 'Hair Highlights', section: 'hair', kind: 'color' },
  { id: 'outfit', label: 'Outfit', section: 'outfit', kind: 'choice', choices: [
    { id: 'cyber_jacket', label: 'Cyber Jacket & Shorts' },
    { id: 'mmo_tunic', label: 'Alchemia Sorcery Robe' },
    { id: 'school_uniform', label: 'Custom Cast Uniform' },
    { id: 'combat_suit', label: 'Vanguard Exosuit' },
    { id: 'hoodie', label: 'Street Tech Hoodie' },
  ] },
  { id: 'accessory', label: 'Headwear / Ears', section: 'outfit', kind: 'choice', choices: [
    { id: 'cat_ears', label: 'Cat Ears' },
    { id: 'kitsune', label: 'Fox Ears' },
    { id: 'elf_ears', label: 'Elf Ears' },
    { id: 'cyber_horns', label: 'Cyber Horns' },
    { id: 'headphones', label: 'Headphones' },
    { id: 'none', label: 'None' },
  ] },
  { id: 'coatColor', label: 'Outfit Color', section: 'outfit', kind: 'color' },
  { id: 'innerColor', label: 'Inner Top Color', section: 'outfit', kind: 'color' },
  { id: 'bootsColor', label: 'Boots Color', section: 'outfit', kind: 'color' },
  { id: 'accentNeonColor', label: 'Neon Accent', section: 'outfit', kind: 'color' },
  { id: 'skinColor', label: 'Skin Tone', section: 'colors', kind: 'color' },
  { id: 'eyeColor', label: 'Eye Iris Color', section: 'colors', kind: 'color' },
];

// ---------------------------------------------------------------------------
// Offline-verified claims. One line per claim, kept in a rigid shape on
// purpose: scripts/verify-vrm-morph-map.mjs parses these lines with a regex
// and re-checks each one against the actual model files. Do not reformat
// them (no multi-line entries, no extra fields before `where`).
//   kind: 'root' | 'bone' | 'morph' | 'material' | 'mesh' | 'group' | 'expression'
//   where: 'root' | 'bone:<name>' | 'mesh:<name>' | 'material:<name>'
//          | 'group:<name>' | 'expression:<name>'
// ---------------------------------------------------------------------------
export const VERIFIED_CLAIMS: Array<{ model: string; control: string; kind: string; target: string; where: string }> = [
  { model: 'vessel.vrm', control: 'height', kind: 'root', target: 'scene root', where: 'root' },
  { model: 'vessel.vrm', control: 'headScale', kind: 'mesh', target: 'head', where: 'mesh:head' },
  { model: 'vessel.vrm', control: 'eyeScale', kind: 'morph', target: 'eye_black_big', where: 'mesh:head' },
  { model: 'vessel.vrm', control: 'eyeScale', kind: 'morph', target: 'eye_black_small', where: 'mesh:head' },
  { model: 'vessel.vrm', control: 'browRaise', kind: 'morph', target: 'eye_brow_up', where: 'mesh:head' },
  { model: 'vessel.vrm', control: 'browRaise', kind: 'morph', target: 'eye_brow_down', where: 'mesh:head' },
  { model: 'vessel.vrm', control: 'mouthOpen', kind: 'morph', target: 'mouse_open', where: 'mesh:head' },
  { model: 'vessel.vrm', control: 'shoulderWidth', kind: 'bone', target: 'leftShoulder', where: 'bone:leftShoulder' },
  { model: 'vessel.vrm', control: 'shoulderWidth', kind: 'bone', target: 'rightShoulder', where: 'bone:rightShoulder' },
  { model: 'vessel.vrm', control: 'armLength', kind: 'bone', target: 'leftUpperArm', where: 'bone:leftUpperArm' },
  { model: 'vessel.vrm', control: 'armLength', kind: 'bone', target: 'leftLowerArm', where: 'bone:leftLowerArm' },
  { model: 'vessel.vrm', control: 'armLength', kind: 'bone', target: 'rightUpperArm', where: 'bone:rightUpperArm' },
  { model: 'vessel.vrm', control: 'armLength', kind: 'bone', target: 'rightLowerArm', where: 'bone:rightLowerArm' },
  { model: 'vessel.vrm', control: 'armThickness', kind: 'bone', target: 'leftUpperArm', where: 'bone:leftUpperArm' },
  { model: 'vessel.vrm', control: 'armThickness', kind: 'bone', target: 'leftLowerArm', where: 'bone:leftLowerArm' },
  { model: 'vessel.vrm', control: 'armThickness', kind: 'bone', target: 'rightUpperArm', where: 'bone:rightUpperArm' },
  { model: 'vessel.vrm', control: 'armThickness', kind: 'bone', target: 'rightLowerArm', where: 'bone:rightLowerArm' },
  { model: 'vessel.vrm', control: 'legLength', kind: 'bone', target: 'leftUpperLeg', where: 'bone:leftUpperLeg' },
  { model: 'vessel.vrm', control: 'legLength', kind: 'bone', target: 'leftLowerLeg', where: 'bone:leftLowerLeg' },
  { model: 'vessel.vrm', control: 'legLength', kind: 'bone', target: 'rightUpperLeg', where: 'bone:rightUpperLeg' },
  { model: 'vessel.vrm', control: 'legLength', kind: 'bone', target: 'rightLowerLeg', where: 'bone:rightLowerLeg' },
  { model: 'vessel.vrm', control: 'legThickness', kind: 'bone', target: 'leftUpperLeg', where: 'bone:leftUpperLeg' },
  { model: 'vessel.vrm', control: 'legThickness', kind: 'bone', target: 'leftLowerLeg', where: 'bone:leftLowerLeg' },
  { model: 'vessel.vrm', control: 'legThickness', kind: 'bone', target: 'rightUpperLeg', where: 'bone:rightUpperLeg' },
  { model: 'vessel.vrm', control: 'legThickness', kind: 'bone', target: 'rightLowerLeg', where: 'bone:rightLowerLeg' },
  { model: 'vessel.vrm', control: 'skinColor', kind: 'material', target: 'body_bake', where: 'material:body_bake' },
  { model: 'vessel.vrm', control: 'hairColor', kind: 'material', target: 'hair', where: 'material:hair' },
  { model: 'vessel.vrm', control: 'eyeColor', kind: 'material', target: 'eye', where: 'material:eye' },
  { model: 'vessel.vrm', control: 'eyeColor', kind: 'material', target: 'eye_trans', where: 'material:eye_trans' },
  { model: 'vessel.vrm', control: 'accentNeonColor', kind: 'material', target: 'green_emit', where: 'material:green_emit' },
  { model: 'vessel.vrm', control: 'expression', kind: 'expression', target: 'happy', where: 'expression:happy' },
  { model: 'vessel.vrm', control: 'expression', kind: 'expression', target: 'angry', where: 'expression:angry' },
  { model: 'vessel.vrm', control: 'expression', kind: 'expression', target: 'sad', where: 'expression:sad' },
  { model: 'vessel.vrm', control: 'expression', kind: 'expression', target: 'surprised', where: 'expression:surprised' },
  { model: 'vessel.vrm', control: 'expression', kind: 'expression', target: 'blink', where: 'expression:blink' },
  { model: 'vessel.vrm', control: 'expression', kind: 'expression', target: 'neutral', where: 'expression:neutral' },
  { model: 'vessel.vrm', control: 'accessory', kind: 'bone', target: 'head', where: 'bone:head' },
  { model: 'vessel.vrm', control: 'earSize', kind: 'bone', target: 'head', where: 'bone:head' },
  { model: 'female_kunoichi.vrm', control: 'height', kind: 'root', target: 'scene root', where: 'root' },
  { model: 'female_kunoichi.vrm', control: 'headScale', kind: 'group', target: 'head', where: 'group:head' },
  { model: 'female_kunoichi.vrm', control: 'bustSize', kind: 'group', target: 'Bust_Group', where: 'group:Bust_Group' },
  { model: 'female_kunoichi.vrm', control: 'eyeScale', kind: 'material', target: 'F00_000_Eye_White', where: 'material:F00_000_Eye_White' },
  { model: 'female_kunoichi.vrm', control: 'eyeScale', kind: 'mesh', target: 'eyeIrisLeft', where: 'mesh:eyeIrisLeft' },
  { model: 'female_kunoichi.vrm', control: 'eyeScale', kind: 'mesh', target: 'eyeIrisRight', where: 'mesh:eyeIrisRight' },
  { model: 'female_kunoichi.vrm', control: 'skinColor', kind: 'material', target: 'F00_000_Skin', where: 'material:F00_000_Skin' },
  { model: 'female_kunoichi.vrm', control: 'hairColor', kind: 'material', target: 'F00_000_Hair', where: 'material:F00_000_Hair' },
  { model: 'female_kunoichi.vrm', control: 'eyeColor', kind: 'material', target: 'F00_000_Eye_Iris', where: 'material:F00_000_Eye_Iris' },
  { model: 'female_kunoichi.vrm', control: 'accentNeonColor', kind: 'material', target: 'F00_000_NeonAccent', where: 'material:F00_000_NeonAccent' },
  { model: 'female_kunoichi.vrm', control: 'coatColor', kind: 'material', target: 'F00_000_Suit', where: 'material:F00_000_Suit' },
  { model: 'female_kunoichi.vrm', control: 'accessory', kind: 'group', target: 'head', where: 'group:head' },
  { model: 'female_kunoichi.vrm', control: 'earSize', kind: 'group', target: 'head', where: 'group:head' },
];

// Controls that were checked and deliberately NOT bound, with the reason.
// The editor renders these disabled with this exact reason.
export const UNAVAILABLE_CONTROLS: Array<{ model: string; control: string; reason: string }> = [
  { model: 'vessel.vrm', control: 'bustSize', reason: 'No bust bone or bust mesh on this model. Scaling the chest bone would also widen the torso, arms and head.' },
  { model: 'vessel.vrm', control: 'waistWidth', reason: 'No waist bone on this model. Scaling the spine would also scale the chest, head and arms.' },
  { model: 'vessel.vrm', control: 'hipWidth', reason: 'The hips bone is the skeleton root — scaling it would also scale the spine and both legs.' },
  { model: 'vessel.vrm', control: 'eyeSpacing', reason: 'No eye bones and no eye-spacing morph on this model.' },
  { model: 'vessel.vrm', control: 'chinWidth', reason: 'No jaw or chin bone and no chin morph on this model.' },
  { model: 'vessel.vrm', control: 'hairstyle', reason: 'This model ships with a single hair mesh — there are no alternate hairstyles to swap to.' },
  { model: 'vessel.vrm', control: 'outfit', reason: 'This model ships with a single outfit mesh — there are no alternate outfits to swap to.' },
  { model: 'vessel.vrm', control: 'coatColor', reason: 'No single coat material — the outfit mesh mixes wear_metal, backpack, glass and skin materials.' },
  { model: 'vessel.vrm', control: 'innerColor', reason: 'No inner / shirt material on this model.' },
  { model: 'vessel.vrm', control: 'bootsColor', reason: 'No boots / shoes material on this model.' },
  { model: 'vessel.vrm', control: 'hairHighlightColor', reason: 'No hair-highlight material on this model.' },
  { model: 'female_kunoichi.vrm', control: 'shoulderWidth', reason: 'No shoulder bones or shoulder groups on this model.' },
  { model: 'female_kunoichi.vrm', control: 'waistWidth', reason: 'No waist group — the torso is a single unnamed cylinder, so there is no waist-only section.' },
  { model: 'female_kunoichi.vrm', control: 'hipWidth', reason: 'The hips group is the root of the whole body — scaling it would scale everything.' },
  { model: 'female_kunoichi.vrm', control: 'legLength', reason: 'Leg meshes are unnamed cylinders — a leg cannot be told apart from a torso cylinder.' },
  { model: 'female_kunoichi.vrm', control: 'legThickness', reason: 'Leg meshes are unnamed cylinders — a leg cannot be told apart from a torso cylinder.' },
  { model: 'female_kunoichi.vrm', control: 'armLength', reason: 'No arm groups or arm meshes on this model.' },
  { model: 'female_kunoichi.vrm', control: 'armThickness', reason: 'No arm groups or arm meshes on this model.' },
  { model: 'female_kunoichi.vrm', control: 'eyeSpacing', reason: 'Both eye meshes are stored at the origin with no left/right identity, so a spacing offset cannot be verified to move the correct eye.' },
  { model: 'female_kunoichi.vrm', control: 'browRaise', reason: 'No morph targets on this model.' },
  { model: 'female_kunoichi.vrm', control: 'mouthOpen', reason: 'No morph targets on this model.' },
  { model: 'female_kunoichi.vrm', control: 'chinWidth', reason: 'No jaw or chin bone and no morph targets on this model.' },
  { model: 'female_kunoichi.vrm', control: 'expression', reason: 'No expressions or morph targets on this model.' },
  { model: 'female_kunoichi.vrm', control: 'hairstyle', reason: 'No alternate hairstyle meshes on this model.' },
  { model: 'female_kunoichi.vrm', control: 'outfit', reason: 'No alternate outfit meshes on this model.' },
  { model: 'female_kunoichi.vrm', control: 'innerColor', reason: 'No inner / shirt material on this model.' },
  { model: 'female_kunoichi.vrm', control: 'bootsColor', reason: 'No boots / shoes material on this model.' },
  { model: 'female_kunoichi.vrm', control: 'hairHighlightColor', reason: 'No hair-highlight material on this model.' },
];

/** Per-model caveats that apply to the whole model, shown in the Mapping tab. */
export const MODEL_NOTES: Record<string, string> = {
  'female_kunoichi.vrm':
    'This file is not a real VRM — it is a THREE.Object3D JSON dump, and every part in it is stored at the origin (all matrices are identity), so the parts overlap instead of forming a posed body. Only group-isolated targets (head, Bust_Group) and material colors are verifiable here.',
  'vessel.vrm':
    'Real VRM 1.0 (Seed-san). The body and outfit share one skinned "wear" mesh, so there is no separate bust / waist / hip section to morph — those sliders are disabled on purpose.',
};

/**
 * Material roles, verified per bundled model. Colors are applied ONLY to the
 * materials listed here (exact name match, case-insensitive) — never by
 * substring, which used to tint the outfit normal-map material `body_nm`,
 * the robot-arm materials, and the eyes.
 */
const MODEL_MATERIAL_ROLES: Record<string, Partial<Record<'skin' | 'hair' | 'eye' | 'accent' | 'outfit', string[]>>> = {
  'vessel.vrm': {
    skin: ['body_bake'],
    hair: ['hair'],
    eye: ['eye', 'eye_trans'],
    accent: ['green_emit'],
    // No single outfit/coat material: the wear mesh mixes wear_metal,
    // backpack_*, glass, armgear_* and skin materials.
  },
  'female_kunoichi.vrm': {
    skin: ['F00_000_Skin'],
    hair: ['F00_000_Hair'],
    eye: ['F00_000_Eye_Iris'],
    accent: ['F00_000_NeonAccent'],
    outfit: ['F00_000_Suit'],
  },
};

// ---------------------------------------------------------------------------
// Runtime probe result
// ---------------------------------------------------------------------------
export interface MorphResolution {
  id: string;
  status: 'verified' | 'unavailable';
  /** Human-readable resolved target, e.g. "humanoid bone 'leftUpperLeg' (node 130)". */
  target: string;
  /** Why it is verified (note) or unavailable (reason). Shown in the UI. */
  reason: string;
  /** Applies the absolute parameter value. Resets to the base transform first. Only present when verified. */
  apply?: (params: AvatarParameters) => void;
}

export interface MorphMap {
  modelName: string;
  modelKind: 'vrm' | 'object3d' | 'gltf';
  modelNote?: string;
  resolutions: MorphResolution[];
  /** Verified VRM expression preset names (empty for non-VRM models). */
  expressionNames: string[];
  logLines: string[];
}

export interface MorphMapSummary {
  modelName: string;
  modelKind: string;
  modelNote?: string;
  controls: Array<{ id: string; status: 'verified' | 'unavailable'; target: string; reason: string }>;
}

export function toMorphMapSummary(map: MorphMap | null): MorphMapSummary | null {
  if (!map) return null;
  return {
    modelName: map.modelName,
    modelKind: map.modelKind,
    modelNote: map.modelNote,
    controls: map.resolutions.map((r) => ({
      id: r.id,
      status: r.status,
      target: r.target,
      reason: r.reason,
    })),
  };
}

export function logMorphMap(map: MorphMap): void {
  // The verification log — this is the "test the mapping in the build" output
  // at runtime: every slider, its resolved target, or why it is disabled.
  console.log(`[MorphMap] model=${map.modelName} kind=${map.modelKind}`);
  if (map.modelNote) console.log(`[MorphMap] note: ${map.modelNote}`);
  for (const line of map.logLines) console.log(`[MorphMap] ${line}`);
}

// ---------------------------------------------------------------------------
// Probe helpers
// ---------------------------------------------------------------------------
type BoneGetter = (name: string) => THREE.Object3D | null;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function setMaterialColorSafe(mat: THREE.Material, colorHex: string, emissiveHex?: string): void {
  try {
    const m = mat as unknown as Record<string, unknown>;
    const color = m.color as { set?: (c: string) => void } | undefined;
    if (color && typeof color.set === 'function') color.set(colorHex);
    if (emissiveHex) {
      const emissive = m.emissive as { set?: (c: string) => void } | undefined;
      if (emissive && typeof emissive.set === 'function') emissive.set(emissiveHex);
    }
    const uniforms = m.uniforms as Record<string, { value?: { set?: (c: string) => void } }> | undefined;
    if (uniforms) {
      if (uniforms.litFactor?.value?.set) uniforms.litFactor.value.set(colorHex);
      if (uniforms.shadeColor?.value?.set) uniforms.shadeColor.value.set(colorHex);
    }
    (mat as { needsUpdate?: boolean }).needsUpdate = true;
  } catch {
    // A material that cannot be recolored is left alone; never crash the viewer.
  }
}

function meshMaterials(mesh: THREE.Mesh): THREE.Material[] {
  if (!mesh.material) return [];
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) out.push(obj as THREE.Mesh);
  });
  return out;
}

function materialsNamed(root: THREE.Object3D, names: string[]): THREE.Material[] {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  const found: THREE.Material[] = [];
  for (const mesh of collectMeshes(root)) {
    for (const mat of meshMaterials(mesh)) {
      if (mat && wanted.has((mat.name || '').toLowerCase()) && !found.includes(mat)) {
        found.push(mat);
      }
    }
  }
  return found;
}

function hasMeshDescendant(obj: THREE.Object3D): boolean {
  let found = false;
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) found = true;
  });
  return found;
}

/** The head mesh of a VRM: the skinned mesh carrying the eye morph targets. */
export function findHeadMesh(root: THREE.Object3D): THREE.Mesh | null {
  let byMorph: THREE.Mesh | null = null;
  let byName: THREE.Mesh | null = null;
  for (const mesh of collectMeshes(root)) {
    const dict = (mesh as THREE.Mesh & { morphTargetDictionary?: Record<string, number> }).morphTargetDictionary;
    if (dict && ('eye_black_big' in dict || 'blink_L' in dict || 'eye_close' in dict)) {
      byMorph = mesh;
      break;
    }
    if (!byName && mesh.name.toLowerCase() === 'head') byName = mesh;
  }
  return byMorph || byName;
}

/**
 * The morph targets the face sliders drive on the head mesh. The viewer
 * snapshots these influences around expression application: expression
 * presets and face sliders share these morph indices, and the sliders
 * always win on the morphs they drive — so a 'surprised' expression never
 * silently overwrites a brow raise the user set with the slider.
 */
export const SLIDER_FACE_MORPHS = ['eye_black_big', 'eye_black_small', 'eye_brow_up', 'eye_brow_down', 'mouse_open'];

function morphIndex(mesh: THREE.Mesh, morphName: string): number | null {
  const dict = (mesh as THREE.Mesh & { morphTargetDictionary?: Record<string, number> }).morphTargetDictionary;
  if (!dict) return null;
  const idx = dict[morphName];
  return typeof idx === 'number' ? idx : null;
}

function setMorph(mesh: THREE.Mesh, morphName: string, weight: number): void {
  const idx = morphIndex(mesh, morphName);
  const influences = (mesh as THREE.Mesh & { morphTargetInfluences?: number[] }).morphTargetInfluences;
  if (idx !== null && influences && idx < influences.length) {
    influences[idx] = clamp(weight, 0, 1);
  }
}

// ---------------------------------------------------------------------------
// inspectModel — probe the loaded scene and resolve every editor control.
// ---------------------------------------------------------------------------
export function inspectModel(root: THREE.Object3D, vrm: VRM | null, modelName: string): MorphMap {
  const isVrm = !!vrm;
  const modelKind: MorphMap['modelKind'] = isVrm ? 'vrm' : modelName.toLowerCase().endsWith('.json') ? 'object3d' : 'gltf';
  const logLines: string[] = [];
  const resolutions: MorphResolution[] = [];
  const expressionNames: string[] = [];

  const getBone: BoneGetter = (name) => {
    if (!vrm || !vrm.humanoid) return null;
    try {
      const h = vrm.humanoid as unknown as {
        getNormalizedBoneNode?: (n: string) => THREE.Object3D | null;
        getRawBoneNode?: (n: string) => THREE.Object3D | null;
      };
      return h.getNormalizedBoneNode?.(name) || h.getRawBoneNode?.(name) || null;
    } catch {
      return null;
    }
  };

  const getGroup = (name: string): THREE.Object3D | null => {
    const found = root.getObjectByName(name);
    return found || null;
  };

  const verified = (id: string, target: string, reason: string, apply: (params: AvatarParameters) => void): void => {
    resolutions.push({ id, status: 'verified', target, reason, apply });
    logLines.push(`${id}: VERIFIED -> ${target}`);
  };
  const unavailable = (id: string, reason: string): void => {
    resolutions.push({ id, status: 'unavailable', target: '', reason });
    logLines.push(`${id}: UNAVAILABLE — ${reason}`);
  };

  const boneList = (names: string[]): Array<{ node: THREE.Object3D; baseScale: THREE.Vector3; basePosition: THREE.Vector3 }> | null => {
    const out: Array<{ node: THREE.Object3D; baseScale: THREE.Vector3; basePosition: THREE.Vector3 }> = [];
    for (const n of names) {
      const node = getBone(n);
      if (!node) return null;
      out.push({ node, baseScale: node.scale.clone(), basePosition: node.position.clone() });
    }
    return out;
  };

  const applyBoneScale = (
    bones: Array<{ node: THREE.Object3D; baseScale: THREE.Vector3; basePosition: THREE.Vector3 }>,
    axes: 'y' | 'xz',
    value: (params: AvatarParameters) => number,
  ) => (params: AvatarParameters) => {
    // Write ONLY this control's axes, absolutely, from the captured base.
    // Several controls share the same bones (legLength writes Y while
    // legThickness writes X/Z), so a full scale reset here would wipe the
    // sibling control's effect — that is exactly the cross-talk bug this
    // file exists to prevent. Absolute per-axis writes compose cleanly and
    // never accumulate: value 1.0 always restores the base axis.
    const v = value(params);
    for (const b of bones) {
      if (axes === 'y') {
        b.node.scale.y = b.baseScale.y * v;
      } else {
        b.node.scale.x = b.baseScale.x * v;
        b.node.scale.z = b.baseScale.z * v;
      }
    }
  };

  const materialRole = (role: 'skin' | 'hair' | 'eye' | 'accent' | 'outfit'): string[] | null => {
    const perModel = MODEL_MATERIAL_ROLES[modelName];
    if (perModel?.[role]) return perModel[role] as string[];
    // Generic fallback for unknown models: conservative exact-name matching.
    const generic: Record<string, string[]> = {
      skin: ['skin'],
      hair: ['hair'],
      eye: ['eye', 'iris'],
      accent: ['neon', 'accent', 'glow', 'emit'],
      outfit: ['coat', 'jacket', 'suit', 'outfit', 'cloth'],
    };
    return generic[role] || null;
  };

  const resolveColorControl = (
    id: string,
    role: 'skin' | 'hair' | 'eye' | 'accent' | 'outfit',
    paramKey: 'skinColor' | 'hairColor' | 'eyeColor' | 'accentNeonColor' | 'coatColor',
    unavailableReason: string,
  ): void => {
    const names = materialRole(role);
    if (!names) {
      unavailable(id, unavailableReason);
      return;
    }
    const mats = materialsNamed(root, names);
    if (mats.length === 0) {
      unavailable(id, unavailableReason);
      return;
    }
    const label = mats.map((m) => `'${m.name}'`).join(', ');
    verified(id, `material(s) ${label} (exact name match)`, `Tints only ${label}.`, (params) => {
      const hex = params[paramKey];
      const emissive = role === 'accent' ? hex : undefined;
      for (const mat of mats) setMaterialColorSafe(mat, hex, emissive);
    });
  };

  // -- Height: uniform root scale. A Y-only stretch is NOT height — it
  //    distorts every proportion. Uniform scale changes size, nothing else.
  {
    const base = root.scale.clone();
    verified(
      'height',
      'whole model (uniform root scale x = y = z)',
      'Uniform scale: changes size without distorting any section.',
      (params) => {
        root.scale.copy(base).multiplyScalar(clamp(params.height, 0.8, 1.25));
      },
    );
  }

  // -- Head size
  if (isVrm) {
    const headMesh = findHeadMesh(root);
    if (headMesh) {
      const base = headMesh.scale.clone();
      verified(
        'headScale',
        `skinned mesh '${headMesh.name}' (face + eyes only; hair is a separate mesh)`,
        'Scales the face/eye mesh only — the hair meshes are separate nodes, and the viewer scales them by the same factor so the hair follows the head.',
        (params) => {
          headMesh.scale.copy(base).multiplyScalar(clamp(params.headScale, 0.85, 1.2));
        },
      );
    } else {
      const headBone = getBone('head');
      if (headBone) {
        const base = headBone.scale.clone();
        verified(
          'headScale',
          `humanoid bone 'head'`,
          'No separable head mesh on this model, so the head bone is used. Hair is attached to the head, so it scales with the head.',
          (params) => {
            headBone.scale.copy(base).multiplyScalar(clamp(params.headScale, 0.85, 1.2));
          },
        );
      } else {
        unavailable('headScale', 'No head mesh or head bone found on this model.');
      }
    }
  } else {
    const headGroup = getGroup('head');
    if (headGroup) {
      const base = headGroup.scale.clone();
      verified(
        'headScale',
        `group 'head' (head section, including its attached hair and eyes)`,
        'Scales the head group only. Hair is part of the head assembly here, so it scales with the head.',
        (params) => {
          headGroup.scale.copy(base).multiplyScalar(clamp(params.headScale, 0.85, 1.2));
        },
      );
    } else {
      unavailable('headScale', 'No head mesh, head bone, or head group found on this model.');
    }
  }

  // -- Bust size: only a dedicated bust target is acceptable. Chest/spine
  //    scaling is NOT bust scaling — it moves the torso, arms and head.
  if (!isVrm) {
    const bustGroup = getGroup('Bust_Group') || getGroup('bust');
    if (bustGroup) {
      const base = bustGroup.scale.clone();
      verified(
        'bustSize',
        `group '${bustGroup.name}' (bust meshes only)`,
        'Scales only the meshes parented under the bust group.',
        (params) => {
          bustGroup.scale.copy(base).multiplyScalar(clamp(params.bustSize, 0.6, 1.6));
        },
      );
    } else {
      unavailable('bustSize', 'No bust group or bust mesh on this model.');
    }
  } else {
    unavailable(
      'bustSize',
      'No bust bone or bust mesh on this model. Scaling the chest bone would also widen the torso, arms and head.',
    );
  }

  // -- Shoulder width: move the shoulder bones outward. Chest scaling is NOT
  //    shoulder width — it widens the torso and scales the head/arms.
  if (isVrm) {
    const bones = boneList(['leftShoulder', 'rightShoulder']);
    if (bones) {
      const [left, right] = bones;
      const leftSign = left.basePosition.x !== 0 ? Math.sign(left.basePosition.x) : 1;
      const rightSign = right.basePosition.x !== 0 ? Math.sign(right.basePosition.x) : -1;
      verified(
        'shoulderWidth',
        `humanoid bones 'leftShoulder' / 'rightShoulder' (position.x offset outward)`,
        'Moves each shoulder bone away from the body center. Torso vertices are not weighted to the shoulder bones, so the chest does not widen.',
        (params) => {
          const offset = (clamp(params.shoulderWidth, 0.8, 1.3) - 1) * 0.08;
          left.node.position.copy(left.basePosition);
          right.node.position.copy(right.basePosition);
          left.node.position.x = left.basePosition.x + leftSign * offset;
          right.node.position.x = right.basePosition.x + rightSign * offset;
        },
      );
    } else {
      unavailable('shoulderWidth', 'No shoulder bones on this model.');
    }
  } else {
    unavailable('shoulderWidth', 'No shoulder bones or shoulder groups on this model.');
  }

  // -- Waist / hip width: there is no waist-only or hip-only bone or mesh on
  //    either bundled model. Spine/hips scaling propagates to the chest,
  //    head, arms and legs, so these are disabled rather than mis-bound.
  //    (A model that ships a group literally named 'waist' gets a verified
  //    waist binding; same for a standalone 'hips'/'pelvis' mesh.)
  {
    const waistGroup = !isVrm ? getGroup('waist') : null;
    if (waistGroup) {
      const base = waistGroup.scale.clone();
      verified('waistWidth', `group 'waist' (waist section only)`, 'Scales only the waist group.', (params) => {
        waistGroup.scale.copy(base);
        waistGroup.scale.x = base.x * clamp(params.waistWidth, 0.7, 1.3);
        waistGroup.scale.z = base.z * clamp(params.waistWidth, 0.7, 1.3);
      });
    } else {
      unavailable(
        'waistWidth',
        isVrm
          ? 'No waist bone on this model. Scaling the spine would also scale the chest, head and arms.'
          : 'No waist group — the torso is a single unnamed cylinder, so there is no waist-only section.',
      );
    }
    const hipMesh = !isVrm
      ? collectMeshes(root).find((m) => m.name.toLowerCase() === 'hips' || m.name.toLowerCase() === 'pelvis')
      : undefined;
    if (hipMesh) {
      const base = hipMesh.scale.clone();
      verified('hipWidth', `mesh '${hipMesh.name}' (hip section only)`, 'Scales only the hip mesh.', (params) => {
        hipMesh.scale.copy(base);
        hipMesh.scale.x = base.x * clamp(params.hipWidth, 0.8, 1.4);
        hipMesh.scale.z = base.z * clamp(params.hipWidth, 0.8, 1.4);
      });
    } else {
      unavailable(
        'hipWidth',
        isVrm
          ? 'The hips bone is the skeleton root — scaling it would also scale the spine and both legs.'
          : 'The hips group is the root of the whole body — scaling it would scale everything.',
      );
    }
  }

  // -- Arm / leg length & thickness: scale the limb bones along their own
  //    axes. Each segment is scaled once (thigh scales the thigh segment and
  //    carries the shin down; shin scales the shin segment), so the limb
  //    lengthens without touching the torso.
  const limbControl = (
    id: string,
    boneNames: string[],
    axes: 'y' | 'xz',
    paramKey: 'legLength' | 'legThickness' | 'armLength' | 'armThickness',
    min: number,
    max: number,
    sectionLabel: string,
  ): void => {
    if (!isVrm) {
      unavailable(id, `No ${sectionLabel} groups or ${sectionLabel} meshes on this model.`);
      return;
    }
    const bones = boneList(boneNames);
    if (!bones) {
      unavailable(id, `Missing ${sectionLabel} bones on this model.`);
      return;
    }
    const names = boneNames.map((n) => `'${n}'`).join(', ');
    verified(
      id,
      `humanoid bones ${names} (scale.${axes === 'y' ? 'y' : 'x/z'} only)`,
      `Scales only the ${sectionLabel} bones; the torso and head are untouched.`,
      applyBoneScale(bones, axes, (p) => clamp(p[paramKey], min, max)),
    );
  };
  limbControl('legLength', ['leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg'], 'y', 'legLength', 0.8, 1.3, 'leg');
  limbControl('legThickness', ['leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg'], 'xz', 'legThickness', 0.8, 1.3, 'leg');
  limbControl('armLength', ['leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm'], 'y', 'armLength', 0.8, 1.3, 'arm');
  limbControl('armThickness', ['leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm'], 'xz', 'armThickness', 0.8, 1.3, 'arm');

  // -- Face morphs (VRM only — the head mesh morph targets are per-vertex,
  //    so each morph moves only its own facial region).
  if (isVrm) {
    const headMesh = findHeadMesh(root);
    if (headMesh) {
      const bigIdx = morphIndex(headMesh, 'eye_black_big');
      const smallIdx = morphIndex(headMesh, 'eye_black_small');
      if (bigIdx !== null && smallIdx !== null) {
        verified(
          'eyeScale',
          `morphs 'eye_black_big' / 'eye_black_small' on mesh '${headMesh.name}' (eye region only)`,
          'Eye morphs move only eye vertices. Above 1.0 grows the iris, below 1.0 shrinks it.',
          (params) => {
            const v = clamp(params.eyeScale, 0.7, 1.4);
            setMorph(headMesh, 'eye_black_big', clamp((v - 1) / 0.4, 0, 1));
            setMorph(headMesh, 'eye_black_small', clamp((1 - v) / 0.3, 0, 1));
          },
        );
      } else {
        unavailable('eyeScale', 'No eye-size morph targets on this model.');
      }
      const browUp = morphIndex(headMesh, 'eye_brow_up');
      const browDown = morphIndex(headMesh, 'eye_brow_down');
      if (browUp !== null && browDown !== null) {
        verified(
          'browRaise',
          `morphs 'eye_brow_up' / 'eye_brow_down' on mesh '${headMesh.name}' (brow region only)`,
          'Brow morphs move only brow vertices.',
          (params) => {
            const v = clamp(params.browRaise, -1, 1);
            setMorph(headMesh, 'eye_brow_up', Math.max(v, 0));
            setMorph(headMesh, 'eye_brow_down', Math.max(-v, 0));
          },
        );
      } else {
        unavailable('browRaise', 'No brow morph targets on this model.');
      }
      if (morphIndex(headMesh, 'mouse_open') !== null) {
        verified(
          'mouthOpen',
          `morph 'mouse_open' on mesh '${headMesh.name}' (mouth region only)`,
          "Mouth morph moves only mouth vertices. (The model's own spelling is 'mouse_open'.)",
          (params) => setMorph(headMesh, 'mouse_open', clamp(params.mouthOpen, 0, 1)),
        );
      } else {
        unavailable('mouthOpen', 'No mouth-open morph target on this model.');
      }
    } else {
      unavailable('eyeScale', 'No head mesh with morph targets on this model.');
      unavailable('browRaise', 'No head mesh with morph targets on this model.');
      unavailable('mouthOpen', 'No head mesh with morph targets on this model.');
    }
    unavailable('eyeSpacing', 'No eye bones and no eye-spacing morph on this model.');
    unavailable('chinWidth', 'No jaw or chin bone and no chin morph on this model.');
  } else {
    // Object3D / generic glTF: eyes are separate meshes, identified by
    // material name (eye whites) and mesh name (irises).
    const eyeMeshes: Array<{ obj: THREE.Object3D; baseScale: THREE.Vector3 }> = [];
    for (const mesh of collectMeshes(root)) {
      const matNames = meshMaterials(mesh).map((m) => (m.name || '').toLowerCase());
      const isEyeWhite = matNames.some((n) => n === 'f00_000_eye_white');
      const isIris = mesh.name === 'eyeIrisLeft' || mesh.name === 'eyeIrisRight';
      if (isEyeWhite || isIris) {
        eyeMeshes.push({ obj: mesh, baseScale: mesh.scale.clone() });
      }
    }
    if (eyeMeshes.length > 0) {
      verified(
        'eyeScale',
        `${eyeMeshes.length} eye mesh(es) by material 'F00_000_Eye_White' / mesh names 'eyeIrisLeft'/'eyeIrisRight'`,
        'Scales only the eye meshes.',
        (params) => {
          const v = clamp(params.eyeScale, 0.7, 1.4);
          for (const e of eyeMeshes) e.obj.scale.copy(e.baseScale).multiplyScalar(v);
        },
      );
    } else {
      unavailable('eyeScale', 'No eye meshes found on this model.');
    }
    unavailable(
      'eyeSpacing',
      'Both eye meshes are stored at the origin with no left/right identity, so a spacing offset cannot be verified to move the correct eye.',
    );
    unavailable('browRaise', 'No morph targets on this model.');
    unavailable('mouthOpen', 'No morph targets on this model.');
    unavailable('chinWidth', 'No jaw or chin bone and no morph targets on this model.');
  }

  // -- Accessory size: the procedural accessory group is attached to the head
  //    bone/group by the viewer; earSize only scales that group, never the
  //    model itself. Verified whenever a head anchor exists.
  {
    const anchor = isVrm ? getBone('head') : getGroup('head');
    if (anchor) {
      verified(
        'earSize',
        `procedural accessory group attached to the ${isVrm ? "humanoid bone 'head'" : "group 'head'"}`,
        'Scales the procedural ears / horns / headphones only — the model itself is untouched.',
        // The viewer applies this when it rebuilds the accessory group.
        () => {},
      );
    } else {
      unavailable('earSize', 'No head bone or head group to attach accessories to.');
    }
  }

  // -- Expressions: only VRM expressions the model actually registers.
  if (isVrm && vrm?.expressionManager) {
    const wanted = ['neutral', 'smile', 'wink', 'fierce', 'surprised'];
    // Editor expression ids map to VRM preset names.
    const vrmNameFor: Record<string, string> = {
      neutral: 'neutral',
      smile: 'happy',
      wink: 'blink',
      fierce: 'angry',
      surprised: 'surprised',
    };
    const found: string[] = [];
    for (const id of wanted) {
      try {
        if (vrm.expressionManager.getExpression(vrmNameFor[id])) found.push(id);
      } catch {
        // getExpression is safe to probe; a miss just means unsupported.
      }
    }
    expressionNames.push(...found);
    if (found.length > 0) {
      verified(
        'expression',
        `VRM expressions: ${found.join(', ')} (via expressionManager)`,
        'Expressions drive only the face morphs the model registered.',
        () => {},
      );
    } else {
      unavailable('expression', 'This model registers no usable expressions.');
    }
  } else {
    unavailable('expression', 'No expressions or morph targets on this model.');
  }

  // -- Hairstyle / outfit swaps: there are no alternate meshes on either
  //    bundled model, so these are never bound to a fake swap.
  unavailable(
    'hairstyle',
    'This model ships with a single hair mesh — there are no alternate hairstyles to swap to.',
  );
  unavailable(
    'outfit',
    'This model ships with a single outfit mesh — there are no alternate outfits to swap to.',
  );

  // -- Accessory choice: procedural, anchored to the head. Verified when the
  //    head anchor exists (checked above for earSize).
  {
    const anchor = isVrm ? getBone('head') : getGroup('head');
    if (anchor) {
      verified(
        'accessory',
        `procedural accessory attached to the ${isVrm ? "humanoid bone 'head'" : "group 'head'"}`,
        'Accessories are procedural meshes added to the head — they do not alter the model.',
        () => {},
      );
    } else {
      unavailable('accessory', 'No head bone or head group to attach accessories to.');
    }
  }

  // -- Colors (exact material-name match only — see header comment).
  resolveColorControl('skinColor', 'skin', 'skinColor', 'No skin material found on this model.');
  resolveColorControl('hairColor', 'hair', 'hairColor', 'No hair material found on this model.');
  resolveColorControl('eyeColor', 'eye', 'eyeColor', 'No eye material found on this model.');
  resolveColorControl('accentNeonColor', 'accent', 'accentNeonColor', 'No accent / emissive material found on this model.');
  resolveColorControl(
    'coatColor',
    'outfit',
    'coatColor',
    isVrm
      ? 'No single coat material — the outfit mesh mixes wear_metal, backpack, glass and skin materials.'
      : 'No outfit / coat material found on this model.',
  );
  unavailable('innerColor', 'No inner / shirt material on this model.');
  unavailable('bootsColor', 'No boots / shoes material on this model.');
  unavailable('hairHighlightColor', 'No hair-highlight material on this model.');

  // Keep resolutions in EDITOR_CONTROLS order so the UI and log are stable.
  const order = new Map(EDITOR_CONTROLS.map((c, i) => [c.id, i]));
  resolutions.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

  return {
    modelName,
    modelKind,
    modelNote: MODEL_NOTES[modelName],
    resolutions,
    expressionNames,
    logLines,
  };
}

/** Apply every verified resolution; unverified controls are never applied. */
export function applyVerifiedMorphs(map: MorphMap | null, params: AvatarParameters): void {
  if (!map) return;
  for (const r of map.resolutions) {
    if (r.status === 'verified' && r.apply) {
      try {
        r.apply(params);
      } catch (err) {
        console.warn(`[MorphMap] failed to apply ${r.id}:`, err);
      }
    }
  }
}

/** Look up one control's resolution in a summary (for the editor UI). */
export function controlStatus(
  summary: MorphMapSummary | null,
  id: string,
): { status: 'verified' | 'unavailable'; target: string; reason: string } {
  const found = summary?.controls.find((c) => c.id === id);
  if (!found) {
    return {
      status: 'unavailable',
      target: '',
      reason: 'No model is loaded in the 3D viewer yet — load a model to verify this control.',
    };
  }
  return found;
}
