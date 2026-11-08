#!/usr/bin/env node
/**
 * verify-vrm-morph-map.mjs — build-time check for the verified morph map.
 *
 * The avatar editor must never bind a slider to a bone / morph / mesh /
 * material that does not genuinely control the section the slider names.
 * This script is the check for that rule on the bundled models:
 *
 *   1. It reads the claim tables out of src/services/vrmMorphMap.ts
 *      (VERIFIED_CLAIMS + UNAVAILABLE_CONTROLS) by parsing the source.
 *   2. It parses the actual model files — vessel.vrm (binary glTF + VRM
 *      extension) and female_kunoichi.vrm (THREE.Object3D JSON) — and
 *      checks every claim resolves in the real file: the bone exists in
 *      the humanoid map, the morph target exists on the named mesh, the
 *      material exists, the group/mesh exists, the expression is registered.
 *   3. It also checks the negative facts the "unavailable" reasons rely on
 *      (e.g. vessel really has no bust/waist bone; kunoichi really has no
 *      morphs and all its matrices really are identity, i.e. its parts are
 *      stored unassembled at the origin).
 *
 * Run:  npm run verify:morph-map
 * Exit: 0 when every claim resolves, 1 otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];
const fail = (msg) => failures.push(msg);

function check(cond, msg) {
  if (!cond) fail(msg);
  return cond;
}

// ---------------------------------------------------------------------------
// 1. Read the claim tables out of the TypeScript source (single-line literals).
// ---------------------------------------------------------------------------
const tsSource = fs.readFileSync(path.join(root, 'src/services/vrmMorphMap.ts'), 'utf8');

const claimRe =
  /\{\s*model:\s*'([^']+)'\s*,\s*control:\s*'([^']+)'\s*,\s*kind:\s*'([^']+)'\s*,\s*target:\s*'([^']+)'\s*,\s*where:\s*'([^']+)'\s*\}/g;
const claims = [];
for (const m of tsSource.matchAll(claimRe)) {
  claims.push({ model: m[1], control: m[2], kind: m[3], target: m[4], where: m[5] });
}
check(claims.length > 0, 'No VERIFIED_CLAIMS could be parsed from src/services/vrmMorphMap.ts — did the literal format change?');

const unavailRe =
  /\{\s*model:\s*'([^']+)'\s*,\s*control:\s*'([^']+)'\s*,\s*reason:\s*'((?:[^'\\]|\\.)*)'\s*\}/g;
const unavailable = [];
for (const m of tsSource.matchAll(unavailRe)) {
  unavailable.push({ model: m[1], control: m[2], reason: m[3] });
}
check(unavailable.length > 0, 'No UNAVAILABLE_CONTROLS could be parsed from src/services/vrmMorphMap.ts.');

// A control must never be both claimed-verified and listed unavailable.
for (const u of unavailable) {
  if (claims.some((c) => c.model === u.model && c.control === u.control)) {
    fail(`${u.model} :: ${u.control} is both VERIFIED and UNAVAILABLE in the registry.`);
  }
}

// ---------------------------------------------------------------------------
// 2a. Parse vessel.vrm — binary glTF, JSON chunk holds the truth.
// ---------------------------------------------------------------------------
function readGlbJson(file) {
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 4).toString('ascii') !== 'glTF') throw new Error(`${file} is not a binary glTF file`);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
}

const vesselPath = path.join(root, 'public/assets/models/vessel.vrm');
const vessel = readGlbJson(vesselPath);
const vNodes = vessel.nodes || [];
const vMeshes = vessel.meshes || [];
const vMaterials = (vessel.materials || []).map((m) => m.name);
const vHumanoid = vessel.extensions?.VRMC_vrm?.humanoid?.humanBones || {};
const vBoneNames = new Set(Object.keys(vHumanoid));
const vExpressions = new Set(Object.keys(vessel.extensions?.VRMC_vrm?.expressions?.preset || {}));
const vMorphsByMesh = new Map();
for (const mesh of vMeshes) {
  vMorphsByMesh.set(mesh.name, new Set(mesh.extras?.targetNames || []));
}

// ---------------------------------------------------------------------------
// 2b. Parse female_kunoichi.vrm — THREE.Object3D JSON. Load it with three's
//     ObjectLoader (headless) so the check sees what the app will see.
// ---------------------------------------------------------------------------
const kunoPath = path.join(root, 'public/assets/models/female_kunoichi.vrm');
const kunoRaw = JSON.parse(fs.readFileSync(kunoPath, 'utf8'));
const { ObjectLoader } = await import('three');
const kunoScene = new ObjectLoader().parse(kunoRaw);
const kunoObjects = new Map(); // name -> object(s)
const kunoMaterials = new Set();
const kunoMeshes = [];
kunoScene.traverse((obj) => {
  if (obj.name) {
    if (!kunoObjects.has(obj.name)) kunoObjects.set(obj.name, []);
    kunoObjects.get(obj.name).push(obj);
  }
  if (obj.isMesh) {
    kunoMeshes.push(obj);
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) if (m?.name) kunoMaterials.add(m.name);
  }
});
const kunoHasMorphs = kunoMeshes.some(
  (m) => m.geometry?.morphAttributes && Object.keys(m.geometry.morphAttributes).length > 0,
);
// Every matrix in the file must be identity (parts stored at the origin).
let kunoNonIdentity = 0;
(function walk(o) {
  const m = o.matrix?.elements;
  if (m) {
    const ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    if (!m.every((v, i) => v === ident[i])) kunoNonIdentity++;
  }
  for (const c of o.children || []) walk(c);
})(kunoRaw.object);

// ---------------------------------------------------------------------------
// 3. Check every verified claim against the file it names.
// ---------------------------------------------------------------------------
const byModel = new Map();
for (const c of claims) {
  if (!byModel.has(c.model)) byModel.set(c.model, []);
  byModel.get(c.model).push(c);
}

function checkClaim(c) {
  const whereKind = c.where.split(':')[0];
  const whereName = c.where.slice(whereKind.length + 1);
  if (c.model === 'vessel.vrm') {
    if (c.kind === 'root') return check(true, '');
    if (c.kind === 'bone') {
      return check(vBoneNames.has(c.target), `vessel.vrm :: ${c.control}: bone '${c.target}' not in humanoid bones (${[...vBoneNames].join(', ')})`);
    }
    if (c.kind === 'morph') {
      const morphs = vMorphsByMesh.get(whereName);
      return check(
        morphs?.has(c.target),
        `vessel.vrm :: ${c.control}: morph '${c.target}' not on mesh '${whereName}' (has: ${[...(morphs || [])].join(', ') || 'none'})`,
      );
    }
    if (c.kind === 'material') {
      return check(
        vMaterials.some((n) => n.toLowerCase() === c.target.toLowerCase()),
        `vessel.vrm :: ${c.control}: material '${c.target}' not found (has: ${vMaterials.join(', ')})`,
      );
    }
    if (c.kind === 'mesh') {
      return check(
        vMeshes.some((m) => m.name === c.target),
        `vessel.vrm :: ${c.control}: mesh '${c.target}' not found`,
      );
    }
    if (c.kind === 'expression') {
      return check(
        vExpressions.has(c.target),
        `vessel.vrm :: ${c.control}: expression '${c.target}' not registered (has: ${[...vExpressions].join(', ')})`,
      );
    }
    return check(false, `vessel.vrm :: ${c.control}: unknown claim kind '${c.kind}'`);
  }
  if (c.model === 'female_kunoichi.vrm') {
    if (c.kind === 'root') return check(true, '');
    if (c.kind === 'group') {
      return check(
        kunoObjects.has(c.target),
        `female_kunoichi.vrm :: ${c.control}: group '${c.target}' not found`,
      );
    }
    if (c.kind === 'material') {
      return check(
        kunoMaterials.has(c.target),
        `female_kunoichi.vrm :: ${c.control}: material '${c.target}' not found (has: ${[...kunoMaterials].join(', ')})`,
      );
    }
    if (c.kind === 'mesh') {
      return check(
        kunoObjects.has(c.target),
        `female_kunoichi.vrm :: ${c.control}: mesh '${c.target}' not found`,
      );
    }
    return check(false, `female_kunoichi.vrm :: ${c.control}: unsupported claim kind '${c.kind}' for this file`);
  }
  return check(false, `${c.model} :: ${c.control}: unknown model in claims`);
}

for (const c of claims) checkClaim(c);

// ---------------------------------------------------------------------------
// 4. Check the negative facts the "unavailable" reasons rely on.
// ---------------------------------------------------------------------------
// vessel: no bust / waist / upperChest / eye / jaw bones at all.
for (const missing of ['bust', 'waist', 'upperChest', 'leftEye', 'rightEye', 'jaw']) {
  check(!vBoneNames.has(missing), `vessel.vrm: expected NO humanoid bone '${missing}', but it exists`);
}
// vessel: only the head mesh has morph targets.
for (const [name, morphs] of vMorphsByMesh) {
  if (name !== 'head') check(morphs.size === 0, `vessel.vrm: mesh '${name}' unexpectedly has ${morphs.size} morph targets`);
}
check((vMorphsByMesh.get('head') || new Set()).size === 43, `vessel.vrm: head mesh should have 43 morph targets, found ${(vMorphsByMesh.get('head') || new Set()).size}`);
// vessel: no morph named like eye spacing / chin.
const headMorphs = vMorphsByMesh.get('head') || new Set();
check(![...headMorphs].some((n) => /spacing|chin|jaw/i.test(n)), 'vessel.vrm: unexpected eye-spacing / chin morph on head mesh');
// kunoichi: no morphs anywhere; all matrices identity; eye groups are empty.
check(!kunoHasMorphs, 'female_kunoichi.vrm: expected NO morph targets, but some mesh has morphAttributes');
check(kunoNonIdentity === 0, `female_kunoichi.vrm: expected ALL matrices to be identity, but ${kunoNonIdentity} are not`);
for (const eyeGroup of ['leftEye', 'rightEye']) {
  const objs = kunoObjects.get(eyeGroup) || [];
  check(objs.length === 1, `female_kunoichi.vrm: expected one '${eyeGroup}' group, found ${objs.length}`);
  if (objs.length === 1) {
    check((objs[0].children || []).length === 0, `female_kunoichi.vrm: '${eyeGroup}' group is expected to be EMPTY (no eye meshes parented under it)`);
  }
}
// kunoichi: the three limb/torso cylinders are unnamed (no section identity).
const unnamedSuitCylinders = kunoMeshes.filter((m) => !m.name && m.material?.name === 'F00_000_Suit').length;
check(unnamedSuitCylinders >= 3, `female_kunoichi.vrm: expected >=3 unnamed Suit meshes, found ${unnamedSuitCylinders}`);

// ---------------------------------------------------------------------------
// 5. Print the verified / unavailable table (what the editor will show).
// ---------------------------------------------------------------------------
const controls = [...new Set([...claims.map((c) => c.control), ...unavailable.map((u) => u.control)])];
const statusFor = (model, control) => {
  const verifiedTargets = claims
    .filter((c) => c.model === model && c.control === control)
    .map((c) => `${c.kind}:${c.target}`)
    .join(', ');
  if (verifiedTargets) return { status: 'VERIFIED', detail: verifiedTargets };
  const u = unavailable.find((x) => x.model === model && x.control === control);
  return { status: 'UNAVAILABLE', detail: u ? u.reason : 'no claim and no reason recorded' };
};

console.log('');
for (const model of ['vessel.vrm', 'female_kunoichi.vrm']) {
  console.log(`== ${model} ==`);
  let v = 0;
  let u = 0;
  for (const control of controls) {
    const s = statusFor(model, control);
    if (s.status === 'VERIFIED') {
      v++;
      console.log(`  [VERIFIED]    ${control.padEnd(18)} ${s.detail}`);
    } else {
      u++;
      console.log(`  [UNAVAILABLE] ${control.padEnd(18)} ${s.detail}`);
    }
  }
  console.log(`  -- ${v} verified, ${u} unavailable`);
  console.log('');
}
for (const n of notes) console.log(`note: ${n}`);
console.log(`vessel.vrm: ${vBoneNames.size} humanoid bones, ${vMeshes.length} meshes, ${(vMorphsByMesh.get('head') || new Set()).size} head morphs, ${vMaterials.length} materials`);
console.log(`female_kunoichi.vrm: ${kunoMeshes.length} meshes, morphs: ${kunoHasMorphs ? 'YES' : 'none'}, non-identity matrices: ${kunoNonIdentity}`);
console.log(`claims checked: ${claims.length}, unavailable entries: ${unavailable.length}`);

if (failures.length > 0) {
  console.error(`\nFAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nOK — every verified morph-map claim resolves against the actual model files.');
