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
 *   2. It parses the actual bundled model file — vessel.vrm (binary glTF
 *      + VRM extension), the only bundled model since the blocky
 *      procedural placeholder female_kunoichi.vrm was removed — and checks
 *      every claim resolves in the real file: the bone exists in the
 *      humanoid map, the morph target exists on the named mesh, the
 *      material exists, the group/mesh exists, the expression is registered.
 *   3. It also checks the negative facts the "unavailable" reasons rely on
 *      (e.g. vessel really has no bust/waist bone).
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
for (const model of ['vessel.vrm']) {
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
console.log(`claims checked: ${claims.length}, unavailable entries: ${unavailable.length}`);

if (failures.length > 0) {
  console.error(`\nFAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nOK — every verified morph-map claim resolves against the actual model files.');
