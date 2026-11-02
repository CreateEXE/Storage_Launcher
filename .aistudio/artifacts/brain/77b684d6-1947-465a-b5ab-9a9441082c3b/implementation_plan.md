# Implementation Plan - Rebuilding Raven Kunoichi Female 3D VRM Avatar & Viewer Centering

Fix the 3D model rendering for `Raven_Kunoichi_Female.vrm` by replacing the crude primitive geometry with a full procedural 3D GLTF/VRM avatar model generator that outputs a stylized anime character mesh (matching all specified features: 5'7" curvy build, large chest, green narrow eyes, inwardly arching brows, blunt bangs with a high wild ponytail, black lipstick, dark kunoichi outfit, armor pads, and high boots). In addition, normalize 3D viewport positioning, auto-centering, camera reset, and live parameter sync in `Viewer3D`, `AvatarEditor`, and `AssetBrowser`.

## User Intent & Target Hardware
- **User Preference**: High-detail stylized 3D anime character mesh for Raven Kunoichi (Female 5'7") loaded by default in the 3D Viewer.
- **Target Hardware**: Motorola Moto G Power 2025 (MediaTek Dimensity 6300, Mali-G57 MC2 GPU, 8 GB RAM, 120 Hz display).

## Planned Changes

### 1. High-Fidelity Female VRM/GLTF Model Generator
- **Script & Utility**: Upgrade `src/scripts/generateFemaleVrmDirect.cjs` and create `src/utils/vrmMeshGenerator.ts` for browser-side and pre-rendered model generation.
- **Anatomy & Styling**:
  - **Head & Face**: Stylized anime head mesh with tapered chin, narrow emerald green anime eyes (`#22c55e`), dark eyeliner, inwardly arching eyebrows, dark lipstick (`#18181b`), and ears.
  - **Hair**: Blunt bangs across forehead, side framing hair locks, high ponytail with neon band accent, and rear hair cap.
  - **Body & Outfit**: 5'7" female proportions, slim waist, hips, enlarged bust/chest, dark kunoichi combat suit with accent trim, shoulder armor pads, wrist wraps, leg armor, and knee-high boots.
  - **GLTF/VRM Rig Structure**: Map mesh groups into standard humanoid VRM bone hierarchy (`hips`, `spine`, `chest`, `neck`, `head`, `leftEye`, `rightEye`, `leftUpperArm`, `rightUpperArm`, `leftLowerArm`, `rightLowerArm`, `leftUpperLeg`, `rightUpperLeg`, `leftLowerLeg`, `rightLowerLeg`) so `three-vrm` processes it as a native humanoid VRM avatar.

### 2. Viewport Auto-Centering & Normalization in `Viewer3D.tsx`
- Set `Raven Kunoichi (Female 5'7")` as the default model when opening `Viewer3D`.
- Fix bounding-box calculation and root placement so models align strictly at `(0, 0, 0)` on the floor grid without horizontal drift or floating off-center.
- Update `handleResetCamera` to point directly at `(0, 1.1, 0)` with dead-center zero yaw (`theta = 0.0`) facing the user.
- Ensure multi-touch pan, pinch-zoom, and 1-finger orbit remain smooth and responsive on 120 Hz displays.

### 3. Avatar Editor & Asset Browser Integration
- Ensure all sliders in `AvatarEditor` (bust size, height, waist, eyes, colors) directly alter bone scales and material colors in real time.
- Enforce outfit mutual exclusivity in `AssetBrowser.tsx` so equipping new clothes/outfit sets hides or replaces previous clothing submeshes completely.
- Fix `.vrm` export in `AvatarEditor.tsx` to output the high-fidelity GLTF/VRM model payload with embedded metadata.

## Verification & Build
- Run `lint_applet` (`tsc --noEmit`) to verify zero TypeScript or syntax errors.
- Run `compile_applet` to confirm the Vite applet compiles cleanly.
- Verify 3D model rendering, default model loading, camera reset, and outfit changes in the preview window.
