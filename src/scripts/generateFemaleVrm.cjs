const fs = require('fs');
const path = require('path');

class NodeFileReader {
  readAsDataURL(blob) {
    this.result = 'data:application/octet-stream;base64,';
    if (this.onload) this.onload({ target: this });
  }
  readAsArrayBuffer(blob) {
    this.result = new ArrayBuffer(0);
    if (this.onload) this.onload({ target: this });
  }
}
global.FileReader = NodeFileReader;

const THREE = require('three');
const { GLTFExporter } = require('three/examples/jsm/exporters/GLTFExporter.js');

function buildFemaleKunoichiScene() {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'VRM_Root';

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({
    name: 'F00_000_Skin',
    color: 0xffdfd3,
    roughness: 0.5,
    metalness: 0.05
  });

  const hairMat = new THREE.MeshStandardMaterial({
    name: 'F00_000_Hair',
    color: 0x111115, // Sleek black hair
    roughness: 0.3,
    metalness: 0.15
  });

  const eyeMat = new THREE.MeshStandardMaterial({
    name: 'F00_000_Eye',
    color: 0x22c55e, // Emerald Green narrow eyes
    roughness: 0.1,
    metalness: 0.4
  });

  const lipMat = new THREE.MeshStandardMaterial({
    name: 'F00_000_Face_Lipstick',
    color: 0x18181b, // Black aesthetic lipstick
    roughness: 0.4
  });

  const browMat = new THREE.MeshBasicMaterial({
    name: 'F00_000_Brows',
    color: 0x09090b
  });

  const outfitSuitMat = new THREE.MeshStandardMaterial({
    name: 'F00_000_Suit',
    color: 0x0f172a, // Dark ninja suit
    roughness: 0.4,
    metalness: 0.4
  });

  const armorMat = new THREE.MeshStandardMaterial({
    name: 'F00_000_Armor',
    color: 0x1e293b,
    roughness: 0.25,
    metalness: 0.8
  });

  const neonAccentMat = new THREE.MeshStandardMaterial({
    name: 'F00_000_AccentNeon',
    color: 0x00ffaa,
    emissive: 0x00ffaa,
    emissiveIntensity: 0.8,
    roughness: 0.2
  });

  // 1. HEAD & FACE GEOMETRY
  const headGroup = new THREE.Group();
  headGroup.name = 'Head_Container';
  headGroup.position.set(0, 1.55, 0);

  // Head base shape
  const headGeo = new THREE.SphereGeometry(0.13, 24, 24);
  headGeo.scale(1.0, 1.15, 1.05);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.name = 'Face_Mesh';
  headGroup.add(headMesh);

  // Chin & Jaw definition
  const chinGeo = new THREE.ConeGeometry(0.08, 0.09, 16);
  chinGeo.rotateX(Math.PI);
  chinGeo.scale(1.0, 1.0, 0.8);
  const chinMesh = new THREE.Mesh(chinGeo, skinMat);
  chinMesh.position.set(0, -0.11, 0.04);
  headGroup.add(chinMesh);

  // Eyes (Narrow Emerald Green anime eyes)
  const eyeLeftGeo = new THREE.SphereGeometry(0.026, 16, 16);
  eyeLeftGeo.scale(1.3, 0.7, 0.5);
  const eyeLeft = new THREE.Mesh(eyeLeftGeo, eyeMat);
  eyeLeft.name = 'leftEye';
  eyeLeft.position.set(-0.045, 0.015, 0.11);
  headGroup.add(eyeLeft);

  const eyeRight = eyeLeft.clone();
  eyeRight.name = 'rightEye';
  eyeRight.position.x = 0.045;
  headGroup.add(eyeRight);

  // Eyeliner / Dark Lash Lines
  const lashGeo = new THREE.TorusGeometry(0.03, 0.003, 8, 16, Math.PI * 0.75);
  lashGeo.rotateX(-Math.PI * 0.1);
  const lashLeft = new THREE.Mesh(lashGeo, hairMat);
  lashLeft.position.set(-0.045, 0.025, 0.112);
  lashLeft.rotation.z = -0.15;
  headGroup.add(lashLeft);

  const lashRight = lashLeft.clone();
  lashRight.position.x = 0.045;
  lashRight.rotation.z = 0.15;
  headGroup.add(lashRight);

  // Inwardly Arching Eyebrows
  const browShape = new THREE.Shape();
  browShape.moveTo(0, 0);
  browShape.lineTo(0.04, 0.008);
  browShape.lineTo(0.038, 0.014);
  browShape.lineTo(0, 0.004);
  browShape.closePath();
  const browExtrudeSettings = { depth: 0.002, bevelEnabled: false };
  const browGeo = new THREE.ExtrudeGeometry(browShape, browExtrudeSettings);

  const browLeft = new THREE.Mesh(browGeo, browMat);
  browLeft.position.set(-0.06, 0.042, 0.118);
  browLeft.rotation.z = 0.22;
  headGroup.add(browLeft);

  const browRight = new THREE.Mesh(browGeo, browMat);
  browRight.position.set(0.02, 0.042, 0.118);
  browRight.rotation.z = -0.22;
  headGroup.add(browRight);

  // Lips (Black Lipstick)
  const lipGeo = new THREE.BoxGeometry(0.032, 0.008, 0.015);
  const lipMesh = new THREE.Mesh(lipGeo, lipMat);
  lipMesh.position.set(0, -0.065, 0.118);
  headGroup.add(lipMesh);

  // 2. HAIR GEOMETRY (Blunt Bangs + High Wild Ponytail)
  const hairGroup = new THREE.Group();
  hairGroup.name = 'Hair_Group';

  // Blunt Bangs across forehead
  for (let i = -4; i <= 4; i++) {
    const xPos = i * 0.023;
    const strandGeo = new THREE.BoxGeometry(0.022, 0.07, 0.015);
    const strand = new THREE.Mesh(strandGeo, hairMat);
    strand.name = `hair_bang_${i}`;
    strand.position.set(xPos, 0.06, 0.115);
    strand.rotation.z = (Math.random() - 0.5) * 0.05;
    hairGroup.add(strand);
  }

  // Side framing hair locks
  const sideLockLeftGeo = new THREE.ConeGeometry(0.02, 0.18, 8);
  sideLockLeftGeo.rotateX(Math.PI);
  const sideLockLeft = new THREE.Mesh(sideLockLeftGeo, hairMat);
  sideLockLeft.position.set(-0.11, -0.01, 0.09);
  sideLockLeft.rotation.z = 0.2;
  hairGroup.add(sideLockLeft);

  const sideLockRight = sideLockLeft.clone();
  sideLockRight.position.x = 0.11;
  sideLockRight.rotation.z = -0.2;
  hairGroup.add(sideLockRight);

  // High Wild Ponytail tie ring
  const tieGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16);
  const tieMesh = new THREE.Mesh(tieGeo, neonAccentMat);
  tieMesh.position.set(0, 0.13, -0.07);
  tieMesh.rotation.x = Math.PI * 0.25;
  hairGroup.add(tieMesh);

  // High Wild Ponytail main flowing body
  const ponytailGroup = new THREE.Group();
  ponytailGroup.name = 'highPonytail';
  ponytailGroup.position.set(0, 0.14, -0.08);

  for (let p = 0; p < 7; p++) {
    const pGeo = new THREE.ConeGeometry(0.035, 0.38, 8);
    pGeo.rotateX(Math.PI * 0.65);
    const pMesh = new THREE.Mesh(pGeo, hairMat);
    const angle = (p / 7) * Math.PI * 0.8 - Math.PI * 0.4;
    pMesh.position.set(Math.sin(angle) * 0.03, -0.15, -Math.cos(angle) * 0.05 - p * 0.02);
    pMesh.rotation.y = angle * 0.5;
    pMesh.rotation.z = (Math.random() - 0.5) * 0.3;
    ponytailGroup.add(pMesh);
  }
  hairGroup.add(ponytailGroup);

  // Hair back cap
  const hairCapGeo = new THREE.SphereGeometry(0.135, 20, 20);
  hairCapGeo.scale(1.02, 1.05, 1.05);
  const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
  hairCap.position.set(0, 0.02, -0.01);
  hairGroup.add(hairCap);

  headGroup.add(hairGroup);
  rootGroup.add(headGroup);

  // 3. CURVY BODY (5'7" Female Torso, Large Bust, Small Waist, Curvy Hips)
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'Body_Container';

  // Torso / Suit Base
  const torsoGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.32, 20);
  const torsoMesh = new THREE.Mesh(torsoGeo, outfitSuitMat);
  torsoMesh.position.set(0, 1.25, 0);
  bodyGroup.add(torsoMesh);

  // Large Bust / Chest Mesh
  const bustGroup = new THREE.Group();
  bustGroup.name = 'Bust_Group';
  const breastGeo = new THREE.SphereGeometry(0.085, 20, 20);
  breastGeo.scale(1.0, 0.9, 1.1);

  const breastLeft = new THREE.Mesh(breastGeo, outfitSuitMat);
  breastLeft.position.set(-0.065, 1.31, 0.085);
  breastLeft.rotation.z = -0.15;
  bustGroup.add(breastLeft);

  const breastRight = new THREE.Mesh(breastGeo, outfitSuitMat);
  breastRight.position.set(0.065, 1.31, 0.085);
  breastRight.rotation.z = 0.15;
  bustGroup.add(breastRight);

  // Bust Neon Accent lines
  const bustAccentGeo = new THREE.TorusGeometry(0.07, 0.005, 8, 16, Math.PI);
  const bustAccentLeft = new THREE.Mesh(bustAccentGeo, neonAccentMat);
  bustAccentLeft.position.set(-0.065, 1.3, 0.12);
  bustGroup.add(bustAccentLeft);

  const bustAccentRight = new THREE.Mesh(bustAccentGeo, neonAccentMat);
  bustAccentRight.position.set(0.065, 1.3, 0.12);
  bustGroup.add(bustAccentRight);

  bodyGroup.add(bustGroup);

  // Corset / Small Waist Accent
  const waistGeo = new THREE.CylinderGeometry(0.088, 0.105, 0.18, 20);
  const waistMesh = new THREE.Mesh(waistGeo, armorMat);
  waistMesh.position.set(0, 1.05, 0);
  bodyGroup.add(waistMesh);

  // Curvy Hips & Kunoichi Belt
  const hipsGeo = new THREE.CylinderGeometry(0.11, 0.145, 0.2, 20);
  const hipsMesh = new THREE.Mesh(hipsGeo, outfitSuitMat);
  hipsMesh.position.set(0, 0.88, 0);
  bodyGroup.add(hipsMesh);

  const beltGeo = new THREE.TorusGeometry(0.14, 0.012, 12, 24);
  beltGeo.rotateX(Math.PI / 2);
  const beltMesh = new THREE.Mesh(beltGeo, neonAccentMat);
  beltMesh.position.set(0, 0.95, 0);
  bodyGroup.add(beltMesh);

  // 4. ARMS & LEGS (5'7" proportions with High Boots and Gloves)
  const armGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.46, 16);
  const leftArmMesh = new THREE.Mesh(armGeo, outfitSuitMat);
  leftArmMesh.position.set(0.19, 1.25, 0);
  leftArmMesh.rotation.z = -0.2;
  bodyGroup.add(leftArmMesh);

  const rightArmMesh = new THREE.Mesh(armGeo, outfitSuitMat);
  rightArmMesh.position.set(-0.19, 1.25, 0);
  rightArmMesh.rotation.z = 0.2;
  bodyGroup.add(rightArmMesh);

  // Hands & Black Nails
  const handGeo = new THREE.BoxGeometry(0.04, 0.05, 0.02);
  const leftHandMesh = new THREE.Mesh(handGeo, skinMat);
  leftHandMesh.position.set(0.28, 1.03, 0);
  bodyGroup.add(leftHandMesh);

  const rightHandMesh = new THREE.Mesh(handGeo, skinMat);
  rightHandMesh.position.set(-0.28, 1.03, 0);
  bodyGroup.add(rightHandMesh);

  // Black Nails
  for (let n = 0; n < 4; n++) {
    const nailGeo = new THREE.BoxGeometry(0.006, 0.01, 0.004);
    const nailLeft = new THREE.Mesh(nailGeo, lipMat);
    nailLeft.position.set(0.265 + n * 0.008, 0.995, 0.005);
    bodyGroup.add(nailLeft);

    const nailRight = new THREE.Mesh(nailGeo, lipMat);
    nailRight.position.set(-0.265 - n * 0.008, 0.995, 0.005);
    bodyGroup.add(nailRight);
  }

  // Legs & High Boots
  const legUpperGeo = new THREE.CylinderGeometry(0.068, 0.052, 0.44, 18);
  const legLowerGeo = new THREE.CylinderGeometry(0.052, 0.042, 0.44, 18);

  const leftLegUpper = new THREE.Mesh(legUpperGeo, outfitSuitMat);
  leftLegUpper.position.set(0.09, 0.66, 0);
  bodyGroup.add(leftLegUpper);

  const leftLegLower = new THREE.Mesh(legLowerGeo, armorMat);
  leftLegLower.position.set(0.09, 0.22, 0);
  bodyGroup.add(leftLegLower);

  const footGeo = new THREE.BoxGeometry(0.05, 0.04, 0.12);
  const leftFootMesh = new THREE.Mesh(footGeo, armorMat);
  leftFootMesh.position.set(0.09, 0.02, 0.03);
  bodyGroup.add(leftFootMesh);

  const rightLegUpper = new THREE.Mesh(legUpperGeo, outfitSuitMat);
  rightLegUpper.position.set(-0.09, 0.66, 0);
  bodyGroup.add(rightLegUpper);

  const rightLegLower = new THREE.Mesh(legLowerGeo, armorMat);
  rightLegLower.position.set(-0.09, 0.22, 0);
  bodyGroup.add(rightLegLower);

  const rightFootMesh = new THREE.Mesh(footGeo, armorMat);
  rightFootMesh.position.set(-0.09, 0.02, 0.03);
  bodyGroup.add(rightFootMesh);

  rootGroup.add(bodyGroup);

  return rootGroup;
}

function exportModel() {
  return new Promise((resolve, reject) => {
    const scene = buildFemaleKunoichiScene();
    const exporter = new GLTFExporter();

    exporter.parse(
      scene,
      (json) => {
        json.asset = json.asset || {};
        json.asset.generator = "AI Studio VRM Generator";
        json.extensionsUsed = json.extensionsUsed || [];
        if (!json.extensionsUsed.includes("VRM")) json.extensionsUsed.push("VRM");

        json.extensions = json.extensions || {};
        json.extensions.VRM = {
          exporterVersion: "0.0",
          specVersion: "0.0",
          meta: {
            title: "Raven Kunoichi (Female 5'7\")",
            version: "1.0",
            author: "AI Studio Cyberpunk Team",
            allowedUserName: "Everyone",
            commercialUssageName: "Allow",
            licenseName: "CC_BY"
          },
          humanoid: {
            humanBones: [
              { bone: "hips", node: 0, useDefaultValues: true },
              { bone: "spine", node: 1, useDefaultValues: true },
              { bone: "chest", node: 2, useDefaultValues: true },
              { bone: "neck", node: 3, useDefaultValues: true },
              { bone: "head", node: 4, useDefaultValues: true }
            ]
          }
        };

        const outputPath = path.join(__dirname, '../../public/assets/models/female_kunoichi.vrm');
        fs.writeFileSync(outputPath, JSON.stringify(json, null, 2));
        console.log(`Successfully generated Female Kunoichi VRM model file (${outputPath})`);
        resolve();
      },
      (err) => {
        console.error('Exporter parse error:', err);
        reject(err);
      },
      { binary: false }
    );
  });
}

exportModel().then(() => console.log("Done")).catch(console.error);
