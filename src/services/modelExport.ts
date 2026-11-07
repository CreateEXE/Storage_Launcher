/**
 * Honest model export.
 *
 * What this does: exports the currently loaded, morphed 3D model as a
 * binary .glb (glTF 2.0) using three.js GLTFExporter, and downloads it.
 *
 * What it does NOT do: it does NOT produce a .vrm file. A VRM file is a
 * glTF file plus the VRMC_vrm extension (humanoid bone map, expressions,
 * spring bones, meta, first-person data). GLTFExporter cannot write that
 * extension, so the exported .glb is valid glTF — it opens in any glTF
 * viewer and keeps the posed / scaled / recolored mesh — but it is NOT a
 * VRM and will not load as a VRM avatar in VRChat / VRM viewers. The old
 * editor wrote a JSON blob with a VRMC_vrm header and a made-up bone-node
 * table and called it ".vrm"; that file was not a valid VRM either, and
 * this service replaces that export instead of repeating it.
 *
 * The viewer registers its loaded scene here (vrm.scene or the loaded
 * group — never the whole viewer scene with its grid / lights); the editor
 * triggers the export from its Export button.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

interface RegisteredModel {
  scene: THREE.Object3D;
  baseName: string;
}

let registered: RegisteredModel | null = null;

export function registerExportableModel(scene: THREE.Object3D, baseName: string): void {
  registered = { scene, baseName };
}

export function clearExportableModel(): void {
  registered = null;
}

export function hasExportableModel(): boolean {
  return registered !== null;
}

export type ModelExportResult =
  | { ok: true; fileName: string; note: string }
  | { ok: false; reason: string };

export async function exportCurrentModelAsGlb(): Promise<ModelExportResult> {
  if (!registered) {
    return {
      ok: false,
      reason: 'No 3D model is loaded in the viewer yet. Load a model first, then export.',
    };
  }
  try {
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(registered.scene, { binary: true });
    if (!(result instanceof ArrayBuffer)) {
      return { ok: false, reason: 'The exporter returned JSON instead of binary GLB data.' };
    }
    const cleanBase = registered.baseName.replace(/\.[^/.]+$/, '') || 'avatar';
    const fileName = `${cleanBase}_custom.glb`;
    const blob = new Blob([result], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return {
      ok: true,
      fileName,
      note: 'Valid glTF 2.0 (.glb). This is NOT a .vrm — VRM humanoid data, expressions and spring bones are not carried over by the glTF exporter.',
    };
  } catch (err) {
    return {
      ok: false,
      reason: `GLB export failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
