#!/usr/bin/env node
/**
 * smoke-morph-map.mjs — headless runtime test of services/vrmMorphMap.ts.
 *
 * The file check (verify-vrm-morph-map.mjs) proves the registry claims
 * resolve against the real model files. This script proves the runtime code
 * itself behaves: inspectModel resolves the same targets, and
 * applyVerifiedMorphs moves ONLY the named section — it asserts the
 * cross-talk cases explicitly (chest/spine/hips scales stay 1 when
 * bust/waist/hip values are applied, the decoy `body_nm` material is never
 * tinted, hair never scales with the head on vessel, height is uniform).
 *
 * Run:  npx tsx scripts/smoke-morph-map.mjs
 * Exit: 0 when every assertion passes, 1 otherwise.
 */
import * as THREE from 'three';
import { ObjectLoader } from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectModel, applyVerifiedMorphs } from '../src/services/vrmMorphMap.ts';
import { DEFAULT_AVATAR_PARAMS } from '../src/types/avatar.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
let checks = 0;
function check(cond, label, extra = '') {
  checks++;
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label} ${extra}`);
  }
}
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const status = (map, id) => map.resolutions.find((r) => r.id === id)?.status;

// ---------------------------------------------------------------------------
// 1. Real kunoichi file through the real ObjectLoader path.
// ---------------------------------------------------------------------------
console.log('\n== kunoichi (real file, Object3D JSON) ==');
{
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'public/assets/models/female_kunoichi.vrm'), 'utf8'));
  const group = new ObjectLoader().parse(raw);
  const map = inspectModel(group, null, 'female_kunoichi.vrm');
  check(status(map, 'bustSize') === 'verified', 'bustSize verified');
  check(status(map, 'headScale') === 'verified', 'headScale verified');
  check(status(map, 'skinColor') === 'verified', 'skinColor verified');
  check(status(map, 'legLength') === 'unavailable', 'legLength unavailable (unnamed cylinders)');
  check(status(map, 'eyeSpacing') === 'unavailable', 'eyeSpacing unavailable (no left/right identity)');
  check(status(map, 'expression') === 'unavailable', 'expression unavailable (no morphs)');
  check(status(map, 'waistWidth') === 'unavailable', 'waistWidth unavailable');

  const bust = group.getObjectByName('Bust_Group');
  const head = group.getObjectByName('head');
  const hips = group.getObjectByName('hips');
  const params = { ...DEFAULT_AVATAR_PARAMS, bustSize: 1.5, headScale: 1.1, legLength: 1.3, waistWidth: 0.7 };
  applyVerifiedMorphs(map, params);
  check(approx(bust.scale.x, 1.5), 'bust group scaled to 1.5', `got ${bust.scale.x}`);
  check(approx(head.scale.x, 1.1), 'head group scaled to 1.1', `got ${head.scale.x}`);
  check(approx(hips.scale.x, 1), 'hips untouched by waist/leg values', `got ${hips.scale.x}`);
  // Apply defaults again: absolute application must reset, never accumulate.
  applyVerifiedMorphs(map, DEFAULT_AVATAR_PARAMS);
  check(approx(bust.scale.x, 1), 'bust group resets to 1 on defaults');
  check(approx(head.scale.x, 1), 'head group resets to 1 on defaults');
}

// ---------------------------------------------------------------------------
// 2. Fake VRM with vessel's structure: bones, head morphs, exact materials.
// ---------------------------------------------------------------------------
console.log('\n== vessel-like fake VRM (bones + morphs + materials) ==');
{
  const scene = new THREE.Group();
  scene.name = 'vessel-fake';
  const mk = (name, x = 0, y = 0, z = 0) => {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(x, y, z);
    return o;
  };
  const hips = mk('hips', 0, 1.0, 0);
  const spine = mk('spine', 0, 0.1, 0);
  const chest = mk('chest', 0, 0.15, 0);
  const neck = mk('neck', 0, 0.2, 0);
  const headBone = mk('head', 0, 0.1, 0);
  const shoulderL = mk('shoulder.L', 0.15, 0.15, 0);
  const shoulderR = mk('shoulder.R', -0.15, 0.15, 0);
  const upperArmL = mk('upper_arm.L', 0.05, 0, 0);
  const forearmL = mk('forearm.L', 0, -0.25, 0);
  const upperArmR = mk('upper_arm.R', -0.05, 0, 0);
  const forearmR = mk('forearm.R', 0, -0.25, 0);
  const thighL = mk('thigh.L', 0.08, -0.05, 0);
  const shinL = mk('shin.L', 0, -0.4, 0);
  const thighR = mk('thigh.R', -0.08, -0.05, 0);
  const shinR = mk('shin.R', 0, -0.4, 0);
  scene.add(hips);
  hips.add(spine, thighL, thighR);
  spine.add(chest);
  chest.add(neck, shoulderL, shoulderR);
  neck.add(headBone);
  shoulderL.add(upperArmL);
  upperArmL.add(forearmL);
  shoulderR.add(upperArmR);
  upperArmR.add(forearmR);
  thighL.add(shinL);
  thighR.add(shinR);

  const boneMap = {
    hips, spine, chest, neck, head: headBone,
    leftShoulder: shoulderL, rightShoulder: shoulderR,
    leftUpperArm: upperArmL, leftLowerArm: forearmL,
    rightUpperArm: upperArmR, rightLowerArm: forearmR,
    leftUpperLeg: thighL, leftLowerLeg: shinL,
    rightUpperLeg: thighR, rightLowerLeg: shinR,
  };
  const fakeVrm = {
    scene,
    humanoid: {
      getNormalizedBoneNode: (n) => boneMap[n] || null,
      getRawBoneNode: (n) => boneMap[n] || null,
    },
    expressionManager: {
      getExpression: (n) => (['happy', 'angry', 'sad', 'surprised', 'blink', 'neutral'].includes(n) ? {} : null),
      setValue: () => {},
    },
  };

  // Head mesh with the real vessel morph names; hair as a separate mesh;
  // a decoy material named body_nm that must NEVER be tinted as skin.
  const headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  const bodyBakeMat = new THREE.MeshStandardMaterial({ name: 'body_bake', color: 0xffffff });
  const eyeMat = new THREE.MeshStandardMaterial({ name: 'eye', color: 0xffffff });
  const headMesh = new THREE.Mesh(headGeo, [bodyBakeMat, eyeMat]);
  headMesh.name = 'head';
  headMesh.morphTargetDictionary = {
    eye_black_big: 0, eye_black_small: 1, eye_brow_up: 2, eye_brow_down: 3, mouse_open: 4,
  };
  headMesh.morphTargetInfluences = [0, 0, 0, 0, 0];
  headBone.add(headMesh);
  const hairMat = new THREE.MeshStandardMaterial({ name: 'hair', color: 0xffffff });
  const hairMesh = new THREE.Mesh(new THREE.BufferGeometry(), hairMat);
  hairMesh.name = 'hair';
  headBone.add(hairMesh);
  const decoyMat = new THREE.MeshStandardMaterial({ name: 'body_nm', color: 0xffffff });
  const decoy = new THREE.Mesh(new THREE.BufferGeometry(), decoyMat);
  decoy.name = 'wear';
  chest.add(decoy);
  const accentMat = new THREE.MeshStandardMaterial({ name: 'green_emit', color: 0xffffff });
  const accent = new THREE.Mesh(new THREE.BufferGeometry(), accentMat);
  accent.name = 'wear_accent';
  chest.add(accent);

  const map = inspectModel(scene, fakeVrm, 'vessel.vrm');
  for (const id of ['shoulderWidth', 'legLength', 'legThickness', 'armLength', 'armThickness', 'eyeScale', 'browRaise', 'mouthOpen', 'skinColor', 'hairColor', 'eyeColor', 'accentNeonColor', 'expression', 'headScale', 'height']) {
    check(status(map, id) === 'verified', `${id} verified`);
  }
  for (const id of ['bustSize', 'waistWidth', 'hipWidth', 'eyeSpacing', 'chinWidth', 'hairstyle', 'outfit', 'coatColor', 'innerColor', 'bootsColor', 'hairHighlightColor']) {
    check(status(map, id) === 'unavailable', `${id} unavailable`);
  }

  const params = {
    ...DEFAULT_AVATAR_PARAMS,
    height: 1.2, headScale: 1.1, bustSize: 1.6, waistWidth: 0.7, hipWidth: 1.4,
    shoulderWidth: 1.25, legLength: 1.2, legThickness: 1.15, armLength: 1.1, armThickness: 0.9,
    eyeScale: 1.4, browRaise: 0.5, mouthOpen: 0.8, skinColor: '#00ff00', hairColor: '#0000ff',
  };
  applyVerifiedMorphs(map, params);

  // Height is UNIFORM root scale, not a Y-only stretch.
  check(approx(scene.scale.x, 1.2) && approx(scene.scale.y, 1.2) && approx(scene.scale.z, 1.2),
    'height scales root uniformly (x=y=z=1.2)', `got ${scene.scale.x},${scene.scale.y},${scene.scale.z}`);
  // Head mesh scales; hair mesh (separate node) does not.
  check(approx(headMesh.scale.x, 1.1), 'head mesh scaled to 1.1', `got ${headMesh.scale.x}`);
  check(approx(hairMesh.scale.x, 1), 'hair mesh untouched by headScale', `got ${hairMesh.scale.x}`);
  // The old cross-talk: bust/waist/hip values must NOT move chest/spine/hips.
  check(approx(chest.scale.x, 1) && approx(chest.scale.z, 1), 'chest untouched by bustSize', `got ${chest.scale.x},${chest.scale.z}`);
  check(approx(spine.scale.x, 1), 'spine untouched by waistWidth', `got ${spine.scale.x}`);
  check(approx(hips.scale.x, 1), 'hips untouched by hipWidth', `got ${hips.scale.x}`);
  // Shoulder width moves shoulder bones outward only.
  check(approx(shoulderL.position.x, 0.17), 'left shoulder moved outward +0.02', `got ${shoulderL.position.x}`);
  check(approx(shoulderR.position.x, -0.17), 'right shoulder moved outward -0.02', `got ${shoulderR.position.x}`);
  check(approx(chest.scale.x, 1), 'chest still untouched after shoulderWidth');
  // Legs: thigh + shin scaled in Y; torso untouched.
  check(approx(thighL.scale.y, 1.2) && approx(shinL.scale.y, 1.2), 'thigh+shin scaled in Y', `got ${thighL.scale.y},${shinL.scale.y}`);
  check(approx(thighL.scale.x, 1.15), 'thigh scaled in X by legThickness', `got ${thighL.scale.x}`);
  // Arms: upper + fore scaled; head untouched.
  check(approx(upperArmL.scale.y, 1.1) && approx(forearmL.scale.y, 1.1), 'upper+fore arm scaled in Y');
  check(approx(upperArmL.scale.x, 0.9), 'upper arm scaled in X by armThickness');
  check(approx(headBone.scale.x, 1), 'head bone untouched by arm/leg sliders');
  // Eye morphs: only the eye morphs move.
  check(approx(headMesh.morphTargetInfluences[0], 1), 'eye_black_big = 1 at eyeScale 1.4', `got ${headMesh.morphTargetInfluences[0]}`);
  check(approx(headMesh.morphTargetInfluences[1], 0), 'eye_black_small = 0 at eyeScale 1.4');
  check(approx(headMesh.morphTargetInfluences[2], 0.5), 'eye_brow_up = 0.5 at browRaise 0.5');
  check(approx(headMesh.morphTargetInfluences[4], 0.8), 'mouse_open = 0.8 at mouthOpen 0.8');
  // Colors: exact material match only — body_nm decoy untouched.
  check(bodyBakeMat.color.getHexString() === '00ff00', 'body_bake tinted green', `got ${bodyBakeMat.color.getHexString()}`);
  check(hairMat.color.getHexString() === '0000ff', 'hair tinted blue', `got ${hairMat.color.getHexString()}`);
  check(decoyMat.color.getHexString() === 'ffffff', 'body_nm decoy NOT tinted', `got ${decoyMat.color.getHexString()}`);

  // Reset: apply defaults, everything returns to base (absolute, not cumulative).
  applyVerifiedMorphs(map, DEFAULT_AVATAR_PARAMS);
  check(approx(scene.scale.x, 1) && approx(thighL.scale.y, 1) && approx(shoulderL.position.x, 0.15),
    'reset to base on defaults');
  check(approx(headMesh.morphTargetInfluences[0], 0) && approx(headMesh.morphTargetInfluences[2], 0),
    'morphs reset to 0 on defaults');
  // Eye scale below 1.0 uses the small morph, not the big one.
  applyVerifiedMorphs(map, { ...DEFAULT_AVATAR_PARAMS, eyeScale: 0.7 });
  check(approx(headMesh.morphTargetInfluences[1], 1), 'eye_black_small = 1 at eyeScale 0.7');
  check(approx(headMesh.morphTargetInfluences[0], 0), 'eye_black_big = 0 at eyeScale 0.7');
}

console.log(`\n${checks} checks, ${failures} failure(s)`);
if (failures > 0) process.exit(1);
console.log('OK — morph map probe + apply behave with no cross-talk.');
