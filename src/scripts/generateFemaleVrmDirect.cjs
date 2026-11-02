const fs = require('fs');
const path = require('path');
const THREE = require('three');

function createFemaleKunoichiModelGltf() {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'VRM_Female_RavenKunoichi';

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({ name: 'F00_000_Skin', color: 0xfce4ec, roughness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({ name: 'F00_000_Hair', color: 0x111115, roughness: 0.3 });
  const eyeIrisMat = new THREE.MeshStandardMaterial({ name: 'F00_000_Eye_Iris', color: 0x22c55e, roughness: 0.2, emissive: 0x22c55e, emissiveIntensity: 0.25 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ name: 'F00_000_Eye_White', color: 0xffffff });
  const lashMat = new THREE.MeshBasicMaterial({ name: 'F00_000_Lashes', color: 0x09090b });
  const browMat = new THREE.MeshBasicMaterial({ name: 'F00_000_Brows', color: 0x09090b });
  const lipMat = new THREE.MeshStandardMaterial({ name: 'F00_000_Lipstick', color: 0x18181b, roughness: 0.3 });
  const suitMat = new THREE.MeshStandardMaterial({ name: 'F00_000_Suit', color: 0x0f172a, roughness: 0.45 });
  const armorMat = new THREE.MeshStandardMaterial({ name: 'F00_000_Armor', color: 0x1e293b, roughness: 0.3 });
  const neonMat = new THREE.MeshStandardMaterial({ name: 'F00_000_NeonAccent', color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 0.85 });
  const nailMat = new THREE.MeshStandardMaterial({ name: 'F00_000_Nails', color: 0x18181b });

  // Humanoid Rig Structure
  const hipsNode = new THREE.Group();
  hipsNode.name = 'hips';
  hipsNode.position.set(0, 0.88, 0);
  rootGroup.add(hipsNode);

  const spineNode = new THREE.Group();
  spineNode.name = 'spine';
  spineNode.position.set(0, 0.18, 0);
  hipsNode.add(spineNode);

  const chestNode = new THREE.Group();
  chestNode.name = 'chest';
  chestNode.position.set(0, 0.22, 0);
  spineNode.add(chestNode);

  const neckNode = new THREE.Group();
  neckNode.name = 'neck';
  neckNode.position.set(0, 0.24, 0);
  chestNode.add(neckNode);

  const headNode = new THREE.Group();
  headNode.name = 'head';
  headNode.position.set(0, 0.12, 0);
  neckNode.add(headNode);

  const leftEyeNode = new THREE.Group();
  leftEyeNode.name = 'leftEye';
  leftEyeNode.position.set(-0.042, 0.015, 0.11);
  headNode.add(leftEyeNode);

  const rightEyeNode = new THREE.Group();
  rightEyeNode.name = 'rightEye';
  rightEyeNode.position.set(0.042, 0.015, 0.11);
  headNode.add(rightEyeNode);

  // Head Assembly
  const headContainer = new THREE.Group();
  headContainer.name = 'Head_Mesh_Group';

  const headGeo = new THREE.SphereGeometry(0.125, 24, 24);
  headGeo.scale(1.0, 1.18, 1.05);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.name = 'Face_Skin_Mesh';
  headContainer.add(headMesh);

  const chinGeo = new THREE.ConeGeometry(0.075, 0.09, 16);
  chinGeo.rotateX(Math.PI);
  chinGeo.scale(1.0, 1.0, 0.85);
  const chinMesh = new THREE.Mesh(chinGeo, skinMat);
  chinMesh.position.set(0, -0.115, 0.038);
  headContainer.add(chinMesh);

  // Eyes & Lashes
  const eyeWhiteGeo = new THREE.SphereGeometry(0.028, 16, 16);
  eyeWhiteGeo.scale(1.25, 0.72, 0.45);

  const eyeWhiteL = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  eyeWhiteL.position.set(-0.042, 0.012, 0.11);
  headContainer.add(eyeWhiteL);

  const eyeWhiteR = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
  eyeWhiteR.position.set(0.042, 0.012, 0.11);
  headContainer.add(eyeWhiteR);

  const irisGeo = new THREE.CircleGeometry(0.016, 16);
  const irisL = new THREE.Mesh(irisGeo, eyeIrisMat);
  irisL.name = 'eyeIrisLeft';
  irisL.position.set(-0.042, 0.012, 0.122);
  headContainer.add(irisL);

  const irisR = new THREE.Mesh(irisGeo, eyeIrisMat);
  irisR.name = 'eyeIrisRight';
  irisR.position.set(0.042, 0.012, 0.122);
  headContainer.add(irisR);

  // Eyelashes & Brows
  const lashGeo = new THREE.TorusGeometry(0.032, 0.0035, 8, 16, Math.PI * 0.72);
  const lashL = new THREE.Mesh(lashGeo, lashMat);
  lashL.position.set(-0.042, 0.022, 0.12);
  lashL.rotation.z = -0.18;
  headContainer.add(lashL);

  const lashR = new THREE.Mesh(lashGeo, lashMat);
  lashR.position.set(0.042, 0.022, 0.12);
  lashR.rotation.z = 0.18;
  headContainer.add(lashR);

  const browShape = new THREE.Shape();
  browShape.moveTo(-0.022, -0.003);
  browShape.lineTo(0.022, 0.006);
  browShape.lineTo(0.02, 0.011);
  browShape.lineTo(-0.022, 0.002);
  browShape.closePath();

  const browGeo = new THREE.ExtrudeGeometry(browShape, { depth: 0.003, bevelEnabled: false });

  const browL = new THREE.Mesh(browGeo, browMat);
  browL.position.set(-0.042, 0.04, 0.123);
  browL.rotation.z = 0.26;
  headContainer.add(browL);

  const browR = new THREE.Mesh(browGeo, browMat);
  browR.position.set(0.042, 0.04, 0.123);
  browR.rotation.z = -0.26;
  browR.scale.x = -1;
  headContainer.add(browR);

  const lipGeo = new THREE.BoxGeometry(0.034, 0.009, 0.016);
  const lipMesh = new THREE.Mesh(lipGeo, lipMat);
  lipMesh.position.set(0, -0.062, 0.122);
  headContainer.add(lipMesh);

  // Hair (Blunt Bangs + High Wild Ponytail)
  const hairGroup = new THREE.Group();
  hairGroup.name = 'Hair_Assembly';

  const hairCapGeo = new THREE.SphereGeometry(0.13, 20, 20);
  hairCapGeo.scale(1.02, 1.06, 1.06);
  const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
  hairCap.position.set(0, 0.02, -0.012);
  hairGroup.add(hairCap);

  for (let i = -5; i <= 5; i++) {
    const strandGeo = new THREE.BoxGeometry(0.022, 0.075, 0.014);
    const strand = new THREE.Mesh(strandGeo, hairMat);
    strand.position.set(i * 0.021, 0.055, 0.122);
    strand.rotation.x = 0.08;
    hairGroup.add(strand);
  }

  const sideLockGeo = new THREE.ConeGeometry(0.022, 0.22, 8);
  sideLockGeo.rotateX(Math.PI);

  const sideLockL = new THREE.Mesh(sideLockGeo, hairMat);
  sideLockL.position.set(-0.115, -0.03, 0.085);
  sideLockL.rotation.z = 0.18;
  hairGroup.add(sideLockL);

  const sideLockR = new THREE.Mesh(sideLockGeo, hairMat);
  sideLockR.position.set(0.115, -0.03, 0.085);
  sideLockR.rotation.z = -0.18;
  hairGroup.add(sideLockR);

  const tieRing = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.009, 12, 24), neonMat);
  tieRing.position.set(0, 0.145, -0.07);
  tieRing.rotation.x = Math.PI * 0.35;
  hairGroup.add(tieRing);

  const ponytailGroup = new THREE.Group();
  ponytailGroup.position.set(0, 0.15, -0.08);

  for (let p = 0; p < 9; p++) {
    const pGeo = new THREE.ConeGeometry(0.038, 0.42, 8);
    pGeo.rotateX(Math.PI * 0.68);
    const pMesh = new THREE.Mesh(pGeo, hairMat);
    const spread = (p / 8) * Math.PI - Math.PI * 0.5;
    pMesh.position.set(Math.sin(spread) * 0.045, -0.18, -Math.cos(spread) * 0.06 - p * 0.015);
    pMesh.rotation.y = spread * 0.6;
    ponytailGroup.add(pMesh);
  }
  hairGroup.add(ponytailGroup);

  headContainer.add(hairGroup);
  headNode.add(headContainer);

  // Body & Bust
  const torsoGeo = new THREE.CylinderGeometry(0.115, 0.088, 0.28, 16);
  const torsoMesh = new THREE.Mesh(torsoGeo, suitMat);
  chestNode.add(torsoMesh);

  const bustGroup = new THREE.Group();
  bustGroup.name = 'Bust_Group';

  const breastGeo = new THREE.SphereGeometry(0.088, 20, 20);
  breastGeo.scale(1.05, 0.92, 1.15);

  const breastL = new THREE.Mesh(breastGeo, suitMat);
  breastL.position.set(-0.062, 0.02, 0.085);
  breastL.rotation.z = -0.12;
  bustGroup.add(breastL);

  const breastR = new THREE.Mesh(breastGeo, suitMat);
  breastR.position.set(0.062, 0.02, 0.085);
  breastR.rotation.z = 0.12;
  bustGroup.add(breastR);

  chestNode.add(bustGroup);

  const waistGeo = new THREE.CylinderGeometry(0.088, 0.108, 0.18, 16);
  const waistMesh = new THREE.Mesh(waistGeo, suitMat);
  spineNode.add(waistMesh);

  const hipsGeo = new THREE.CylinderGeometry(0.11, 0.148, 0.18, 16);
  const hipsMesh = new THREE.Mesh(hipsGeo, suitMat);
  hipsNode.add(hipsMesh);

  // Save JSON
  const jsonOutput = rootGroup.toJSON();
  const outputPath = path.join(__dirname, '../../public/assets/models/female_kunoichi.vrm');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`Successfully generated Female Kunoichi 3D model file: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
}

createFemaleKunoichiModelGltf();
