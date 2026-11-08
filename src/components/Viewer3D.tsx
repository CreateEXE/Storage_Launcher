import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BoxSelect,
  Minus,
  Square,
  X,
  ChevronDown,
  Move,
  ZoomIn,
  ZoomOut,
  Camera,
  Maximize2,
  Play,
  Pause,
  Sparkles,
  Check,
  Upload,
  Info,
  Smile,
  AlertCircle,
  FileBox,
  FolderOpen,
  RefreshCw,
  Box,
  Layers,
  FileUp,
  HardDrive
} from 'lucide-react';
import { FileItem } from '../types';
import { AvatarParameters, DEFAULT_AVATAR_PARAMS } from '../types/avatar';
import { FileManagerService } from '../services/fileManager';

interface Viewer3DProps {
  file?: FileItem;
  avatarParams?: AvatarParameters;
  onAvatarParamsChange?: (newParams: AvatarParameters) => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
  onOpenAvatarEditor?: () => void;
  onOpenAnimationStudio?: () => void;
}

interface VrmMetaInfo {
  title: string;
  author: string;
  version: string;
  license: string;
  permission: string;
  commercial: string;
  format: string;
  meshesCount?: number;
  bonesCount?: number;
}

export const Viewer3D: React.FC<Viewer3DProps> = ({
  file,
  avatarParams = DEFAULT_AVATAR_PARAMS,
  onAvatarParamsChange,
  onMinimize,
  onMaximize,
  onClose,
  isMaximized = false,
  onOpenAvatarEditor,
  onOpenAnimationStudio
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  // Blob URLs created for loaded models. GLTFLoader fetches them
  // asynchronously, so they must not be revoked immediately — instead
  // revoke the previous one when the next model loads, and the current
  // one on unload / unmount. Previously they were never revoked.
  const modelBlobUrlRef = useRef<string | null>(null);
  const revokeModelBlobUrl = () => {
    if (modelBlobUrlRef.current) {
      try { URL.revokeObjectURL(modelBlobUrlRef.current); } catch {}
      modelBlobUrlRef.current = null;
    }
  };
  const gltfSceneRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fs = FileManagerService.getInstance();
  const [showNativeStoragePicker, setShowNativeStoragePicker] = useState<boolean>(false);
  const [nativePickerDir, setNativePickerDir] = useState<string>(fs.getNativeRootPath());
  const [nativePickerFiles, setNativePickerFiles] = useState<FileItem[]>([]);
  const [isLoadingNativeFiles, setIsLoadingNativeFiles] = useState<boolean>(false);

  useEffect(() => {
    if (showNativeStoragePicker) {
      setIsLoadingNativeFiles(true);
      const timer = setTimeout(() => {
        try {
          const list = fs.getFilesByPath(nativePickerDir);
          setNativePickerFiles(list);
        } catch (e) {
          console.warn('Failed to load native picker directory:', e);
          setNativePickerFiles([]);
        } finally {
          setIsLoadingNativeFiles(false);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [showNativeStoragePicker, nativePickerDir]);

  // UI state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<'select' | 'move' | 'zoom'>('select');
  const [snapshotTaken, setSnapshotTaken] = useState<boolean>(false);
  const [showMetaModal, setShowMetaModal] = useState<boolean>(false);
  const [showExpressionsPanel, setShowExpressionsPanel] = useState<boolean>(false);
  const [activeExpression, setActiveExpression] = useState<string>('neutral');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);

  const [vrmMeta, setVrmMeta] = useState<VrmMetaInfo | null>(null);
  const [loadingState, setLoadingState] = useState<{
    isLoading: boolean;
    progress: number;
    error: string | null;
    fileName: string;
  }>({
    isLoading: false,
    progress: 0,
    error: null,
    fileName: file?.name || 'Load Avatar'
  });

  // Global Unhandled Rejection Trap for Async 3D Loaders
  useEffect(() => {
    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      console.warn('3D Loader trapped unhandled promise rejection:', e.reason);
      e.preventDefault();
      setModelLoaded(false);
      setLoadingState((prev) => ({
        ...prev,
        isLoading: false,
        error: `Model Loader Exception: ${e.reason?.message || String(e.reason) || 'Could not parse 3D file structure'}`
      }));
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  // Camera Orbit, Pan & Multi-Touch State
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const initialMidpointRef = useRef<{ x: number; y: number } | null>(null);

  const cameraThetaRef = useRef(0.0);
  const cameraPhiRef = useRef(0.08);
  const cameraDistanceRef = useRef(3.5);
  const cameraTargetRef = useRef(new THREE.Vector3(0.0, 1.1, 0.0));

  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const theta = cameraThetaRef.current;
    const phi = Math.max(-0.4, Math.min(1.2, cameraPhiRef.current));
    const dist = Math.max(0.8, Math.min(14.0, cameraDistanceRef.current));

    const x = cameraTargetRef.current.x + dist * Math.sin(theta) * Math.cos(phi);
    const y = cameraTargetRef.current.y + dist * Math.sin(phi);
    const z = cameraTargetRef.current.z + dist * Math.cos(theta) * Math.cos(phi);

    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(cameraTargetRef.current);
  }, []);

  const avatarParamsRef = useRef<AvatarParameters>(avatarParams);

  // Helper to recolor a Three.js material safely
  const setMaterialColorSafe = (mat: any, colorHex: string, emissiveHex?: string) => {
    try {
      if (!mat || !colorHex) return;
      if (mat.color && typeof mat.color.set === 'function') {
        mat.color.set(colorHex);
      }
      if (emissiveHex && mat.emissive && typeof mat.emissive.set === 'function') {
        mat.emissive.set(emissiveHex);
      }
      if (mat.uniforms) {
        if (mat.uniforms.litFactor?.value?.set) mat.uniforms.litFactor.value.set(colorHex);
        if (mat.uniforms.shadeColor?.value?.set) mat.uniforms.shadeColor.value.set(colorHex);
      }
      mat.needsUpdate = true;
    } catch {}
  };

  // Traverses model scene and applies skin, hair, eye, outfit, and neon colors
  const applyMaterialColorsToScene = useCallback((root: THREE.Object3D, params: AvatarParameters) => {
    try {
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

          const meshName = (mesh.name || '').toLowerCase();

          materials.forEach((mat) => {
            if (!mat) return;
            const matName = (mat.name || '').toLowerCase();
            const combined = `${meshName} ${matName}`;

            if (
              combined.includes('skin') ||
              combined.includes('body') ||
              combined.includes('face') ||
              combined.includes('head') ||
              combined.includes('arm') ||
              combined.includes('leg') ||
              combined.includes('hand') ||
              combined.includes('torso')
            ) {
              setMaterialColorSafe(mat, params.skinColor);
            } else if (
              combined.includes('hair') ||
              combined.includes('bangs') ||
              combined.includes('ponytail') ||
              combined.includes('twintail') ||
              combined.includes('spiky') ||
              combined.includes('bob') ||
              combined.includes('strand')
            ) {
              setMaterialColorSafe(mat, params.hairColor);
            } else if (
              combined.includes('eye') ||
              combined.includes('iris') ||
              combined.includes('pupil') ||
              combined.includes('cornea')
            ) {
              setMaterialColorSafe(mat, params.eyeColor);
            } else if (
              combined.includes('coat') ||
              combined.includes('jacket') ||
              combined.includes('outfit') ||
              combined.includes('cloth') ||
              combined.includes('dress') ||
              combined.includes('tunic') ||
              combined.includes('uniform') ||
              combined.includes('robe') ||
              combined.includes('suit') ||
              combined.includes('hoodie')
            ) {
              setMaterialColorSafe(mat, params.coatColor);
            } else if (
              combined.includes('inner') ||
              combined.includes('shirt') ||
              combined.includes('ribbon') ||
              combined.includes('collar') ||
              combined.includes('top')
            ) {
              setMaterialColorSafe(mat, params.innerColor);
            } else if (
              combined.includes('boot') ||
              combined.includes('shoe') ||
              combined.includes('footwear') ||
              combined.includes('sock')
            ) {
              setMaterialColorSafe(mat, params.bootsColor);
            } else if (
              combined.includes('neon') ||
              combined.includes('glow') ||
              combined.includes('emission') ||
              combined.includes('accent') ||
              combined.includes('cyber')
            ) {
              setMaterialColorSafe(mat, params.accentNeonColor, params.accentNeonColor);
            }
          });
        }
      });
    } catch (err) {
      console.warn('Material recoloring warning:', err);
    }
  }, []);

  // Procedurally attaches 3D accessories (ears, horns, headphones) to the model head bone
  const update3DAccessories = useCallback((vrm: VRM | null, rootScene: THREE.Group | null, params: AvatarParameters) => {
    try {
      const targetRoot = vrm ? vrm.scene : rootScene;
      if (!targetRoot) return;

      // Find existing accessory group or head bone
      let headBone: THREE.Object3D | null = null;
      if (vrm && vrm.humanoid) {
        try {
          if (typeof vrm.humanoid.getRawBoneNode === 'function') {
            headBone = vrm.humanoid.getRawBoneNode('head');
          }
          if (!headBone && typeof vrm.humanoid.getNormalizedBoneNode === 'function') {
            headBone = vrm.humanoid.getNormalizedBoneNode('head');
          }
        } catch {}
      }

      if (!headBone) {
        targetRoot.traverse((obj) => {
          if (!headBone && (obj.name.toLowerCase().includes('head') || obj.name.toLowerCase().includes('neck'))) {
            headBone = obj;
          }
        });
      }

      const attachParent = headBone || targetRoot;

      // Remove previous procedural accessory group
      const existingAcc = attachParent.getObjectByName('PROCEDURAL_ACCESSORY_GROUP');
      if (existingAcc) {
        attachParent.remove(existingAcc);
      }

      if (params.accessory === 'none' || !params.accessory) return;

      const accGroup = new THREE.Group();
      accGroup.name = 'PROCEDURAL_ACCESSORY_GROUP';

      const scale = params.earSize || 1.0;
      const neonMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(params.accentNeonColor),
        emissive: new THREE.Color(params.accentNeonColor),
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.8
      });

      const hairMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(params.hairColor),
        roughness: 0.5
      });

      if (params.accessory === 'cat_ears') {
        const earGeo = new THREE.ConeGeometry(0.06 * scale, 0.16 * scale, 4);
        const leftEar = new THREE.Mesh(earGeo, hairMat);
        leftEar.position.set(0.09 * scale, 0.22 * scale, 0.02);
        leftEar.rotation.z = -0.2;

        const rightEar = new THREE.Mesh(earGeo, hairMat);
        rightEar.position.set(-0.09 * scale, 0.22 * scale, 0.02);
        rightEar.rotation.z = 0.2;

        accGroup.add(leftEar);
        accGroup.add(rightEar);
      } else if (params.accessory === 'kitsune') {
        const earGeo = new THREE.ConeGeometry(0.08 * scale, 0.22 * scale, 5);
        const leftEar = new THREE.Mesh(earGeo, hairMat);
        leftEar.position.set(0.12 * scale, 0.25 * scale, 0.01);
        leftEar.rotation.z = -0.35;

        const rightEar = new THREE.Mesh(earGeo, hairMat);
        rightEar.position.set(-0.12 * scale, 0.25 * scale, 0.01);
        rightEar.rotation.z = 0.35;

        accGroup.add(leftEar);
        accGroup.add(rightEar);
      } else if (params.accessory === 'elf_ears') {
        const earGeo = new THREE.ConeGeometry(0.04 * scale, 0.18 * scale, 4);
        const leftEar = new THREE.Mesh(earGeo, neonMat);
        leftEar.position.set(0.13 * scale, 0.05, -0.02);
        leftEar.rotation.z = -1.2;

        const rightEar = new THREE.Mesh(earGeo, neonMat);
        rightEar.position.set(-0.13 * scale, 0.05, -0.02);
        rightEar.rotation.z = 1.2;

        accGroup.add(leftEar);
        accGroup.add(rightEar);
      } else if (params.accessory === 'cyber_horns') {
        const hornGeo = new THREE.ConeGeometry(0.035 * scale, 0.24 * scale, 6);
        const leftHorn = new THREE.Mesh(hornGeo, neonMat);
        leftHorn.position.set(0.08 * scale, 0.22 * scale, 0.06);
        leftHorn.rotation.x = -0.3;
        leftHorn.rotation.z = -0.2;

        const rightHorn = new THREE.Mesh(hornGeo, neonMat);
        rightHorn.position.set(-0.08 * scale, 0.22 * scale, 0.06);
        rightHorn.rotation.x = -0.3;
        rightHorn.rotation.z = 0.2;

        accGroup.add(leftHorn);
        accGroup.add(rightHorn);
      } else if (params.accessory === 'headphones') {
        const bandGeo = new THREE.TorusGeometry(0.15 * scale, 0.015, 8, 24, Math.PI);
        const band = new THREE.Mesh(bandGeo, neonMat);
        band.position.set(0, 0.18 * scale, 0);
        band.rotation.x = Math.PI / 2;

        const cupGeo = new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 0.03, 16);
        const leftCup = new THREE.Mesh(cupGeo, neonMat);
        leftCup.position.set(0.14 * scale, 0.04, 0);
        leftCup.rotation.z = Math.PI / 2;

        const rightCup = new THREE.Mesh(cupGeo, neonMat);
        rightCup.position.set(-0.14 * scale, 0.04, 0);
        rightCup.rotation.z = Math.PI / 2;

        accGroup.add(band);
        accGroup.add(leftCup);
        accGroup.add(rightCup);
      }

      attachParent.add(accGroup);
    } catch (err) {
      console.warn('3D Accessory attachment warning:', err);
    }
  }, []);

  // Helper to re-apply skeletal morphs on raw bone nodes safely
  const applySkeletalMorphs = useCallback((vrm: VRM, params: AvatarParameters) => {
    try {
      if (!vrm || !vrm.humanoid) return;
      const h = vrm.humanoid;

      const getBoneNode = (name: any) => {
        try {
          if (typeof h.getRawBoneNode === 'function') {
            const raw = h.getRawBoneNode(name);
            if (raw) return raw;
          }
          if (typeof h.getNormalizedBoneNode === 'function') {
            const norm = h.getNormalizedBoneNode(name);
            if (norm) return norm;
          }
        } catch {
          // ignore individual bone retrieval errors
        }
        return null;
      };

      const headNode = getBoneNode('head');
      if (headNode && headNode.scale) headNode.scale.setScalar(params.headScale);

      const chestNode = getBoneNode('chest') || getBoneNode('upperChest');
      if (chestNode && chestNode.scale) {
        chestNode.scale.x = params.shoulderWidth;
        chestNode.scale.z = params.bustSize;
      }

      const spineNode = getBoneNode('spine');
      if (spineNode && spineNode.scale) {
        spineNode.scale.x = params.waistWidth;
        spineNode.scale.z = params.waistWidth;
      }

      const hipsNode = getBoneNode('hips');
      if (hipsNode && hipsNode.scale) {
        hipsNode.scale.x = params.hipWidth;
        hipsNode.scale.z = params.hipWidth;
      }

      const leftLeg = getBoneNode('leftUpperLeg');
      const rightLeg = getBoneNode('rightUpperLeg');
      if (leftLeg && leftLeg.scale) leftLeg.scale.y = params.legLength;
      if (rightLeg && rightLeg.scale) rightLeg.scale.y = params.legLength;
    } catch (err) {
      console.warn('Skeletal morph warning:', err);
    }
  }, []);

  const applyAvatarParametersToVrm = useCallback(
    (vrm: VRM | null, gltfGroup: THREE.Group | null, params: AvatarParameters) => {
      try {
        if (!vrm && !gltfGroup) return;
        const targetRoot = vrm ? vrm.scene : gltfGroup;
        if (!targetRoot) return;

        if (targetRoot.scale) {
          targetRoot.scale.set(1.0, params.height, 1.0);
        }

        if (vrm) {
          applySkeletalMorphs(vrm, params);
        }

        // Apply material recoloring & 3D accessories
        applyMaterialColorsToScene(targetRoot, params);
        update3DAccessories(vrm, gltfGroup, params);

        if (vrm && vrm.expressionManager && typeof vrm.expressionManager.setValue === 'function') {
          const presets = ['smile', 'wink', 'angry', 'sad', 'surprised', 'happy', 'neutral', 'blink'];
          presets.forEach((p) => {
            try {
              vrm.expressionManager?.setValue(p, 0);
            } catch {}
          });

          try {
            if (params.expression === 'smile') vrm.expressionManager.setValue('happy', 1.0);
            else if (params.expression === 'wink') vrm.expressionManager.setValue('blink', 1.0);
            else if (params.expression === 'fierce') vrm.expressionManager.setValue('angry', 0.85);
            else if (params.expression === 'surprised') vrm.expressionManager.setValue('surprised', 1.0);
            else if (params.expression === 'neutral') vrm.expressionManager.setValue('neutral', 1.0);
          } catch {}
        }
      } catch (err) {
        console.warn('Apply params warning:', err);
      }
    },
    [applySkeletalMorphs, applyMaterialColorsToScene, update3DAccessories]
  );

  useEffect(() => {
    avatarParamsRef.current = avatarParams;
    applyAvatarParametersToVrm(vrmRef.current, gltfSceneRef.current, avatarParams);
  }, [avatarParams, applyAvatarParametersToVrm]);

  // Center & Fit Loaded Model Bounds
  const normalizeAndCenterModel = useCallback((modelGroup: THREE.Group, name: string) => {
    try {
      const scene = sceneRef.current;
      if (!scene) return;

      modelGroup.traverse((obj) => {
        obj.frustumCulled = false;
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      scene.add(modelGroup);
      gltfSceneRef.current = modelGroup;
      applyAvatarParametersToVrm(null, modelGroup, avatarParamsRef.current);

      const box = new THREE.Box3().setFromObject(modelGroup);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      modelGroup.position.x = -center.x;
      modelGroup.position.z = -center.z;
      if (box.min.y !== undefined && isFinite(box.min.y)) {
        modelGroup.position.y = -box.min.y;
      }

      const focalY = size.y > 0 ? size.y * 0.55 : 1.1;
      cameraTargetRef.current.set(0.0, focalY > 0 ? focalY : 1.1, 0.0);
      cameraDistanceRef.current = Math.max(2.2, size.y * 1.65);
      cameraThetaRef.current = 0.0;
      cameraPhiRef.current = 0.08;
      updateCameraPosition();

      setVrmMeta({
        title: name,
        author: '3D Mesh Model',
        version: '1.0',
        license: 'Standard License',
        permission: 'Allowed',
        commercial: 'Allowed',
        format: name.endsWith('.obj') ? 'Wavefront OBJ' : '3D Model',
        meshesCount: modelGroup.children.length || 1
      });

      setModelLoaded(true);
      setLoadingState({ isLoading: false, progress: 100, error: null, fileName: name });
    } catch (err: any) {
      console.error('Error normalizing model:', err);
      setModelLoaded(false);
      setLoadingState({
        isLoading: false,
        progress: 0,
        error: `Model structure error: ${err.message || 'Could not display 3D mesh'}`,
        fileName: name
      });
    }
  }, [applyAvatarParametersToVrm, updateCameraPosition]);

  // Main 3D File Loader Function (Guarded with Error Protection)
  const loadModelFromUrl = useCallback((url: string, name: string) => {
    // The previous model's blob URL has already been fetched by now;
    // revoke it before tracking the new one.
    if (modelBlobUrlRef.current && modelBlobUrlRef.current !== url) {
      try { URL.revokeObjectURL(modelBlobUrlRef.current); } catch {}
      modelBlobUrlRef.current = null;
    }
    if (url.startsWith('blob:')) modelBlobUrlRef.current = url;
    setLoadingState({ isLoading: true, progress: 0, error: null, fileName: name });

    const scene = sceneRef.current;
    if (!scene) return;

    try {
      // Dispose existing models safely
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        try {
          VRMUtils.deepDispose(vrmRef.current.scene);
        } catch {}
        vrmRef.current = null;
      }
      if (gltfSceneRef.current) {
        scene.remove(gltfSceneRef.current);
        gltfSceneRef.current = null;
      }
      if (mixerRef.current) {
        try {
          mixerRef.current.stopAllAction();
        } catch {}
        mixerRef.current = null;
      }
    } catch (e) {
      console.warn('Cleanup warning:', e);
    }

    const nameLower = name.toLowerCase();

    // 1. WAVEFRONT OBJ LOADER
    if (nameLower.endsWith('.obj')) {
      try {
        const objLoader = new OBJLoader();
        objLoader.load(
          url,
          (objGroup) => {
            normalizeAndCenterModel(objGroup, name);
          },
          (xhr) => {
            if (xhr.total > 0) {
              const pct = Math.round((xhr.loaded / xhr.total) * 100);
              setLoadingState((prev) => ({ ...prev, progress: pct }));
            }
          },
          (err) => {
            console.error('OBJ Load Error:', err);
            setModelLoaded(false);
            setLoadingState({
              isLoading: false,
              progress: 0,
              error: 'Could not parse .obj model file. Please select a valid 3D file.',
              fileName: name
            });
          }
        );
      } catch (err: any) {
        setModelLoaded(false);
        setLoadingState({
          isLoading: false,
          progress: 0,
          error: `OBJ loader error: ${err.message}`,
          fileName: name
        });
      }
      return;
    }

    // 2. VRM & GLTF LOADER
    try {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));

      loader.load(
        url,
        (gltf) => {
          try {
            const loadedVrm = gltf.userData.vrm as VRM | undefined;

            if (loadedVrm) {
              try {
                VRMUtils.rotateVRM0(loadedVrm);
              } catch (e) {
                console.warn('VRM0 rotate warning:', e);
              }

              loadedVrm.scene.traverse((obj) => {
                obj.frustumCulled = false;
                if ((obj as THREE.Mesh).isMesh) {
                  obj.castShadow = true;
                  obj.receiveShadow = true;
                }
              });

              scene.add(loadedVrm.scene);
              vrmRef.current = loadedVrm;
              applyAvatarParametersToVrm(loadedVrm, null, avatarParamsRef.current);

              const box = new THREE.Box3().setFromObject(loadedVrm.scene);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());

              loadedVrm.scene.position.x = -center.x;
              loadedVrm.scene.position.z = -center.z;
              if (box.min.y !== undefined && isFinite(box.min.y)) {
                loadedVrm.scene.position.y = -box.min.y;
              }

              const focalY = size.y > 0 ? size.y * 0.55 : 1.1;
              cameraTargetRef.current.set(0.0, focalY > 0 ? focalY : 1.1, 0.0);
              cameraDistanceRef.current = Math.max(2.2, size.y * 1.65);
              cameraThetaRef.current = 0.0;
              cameraPhiRef.current = 0.08;
              updateCameraPosition();

              const meta = loadedVrm.meta as any;
              setVrmMeta({
                title: meta?.name || meta?.title || name,
                author: Array.isArray(meta?.authors) ? meta.authors.join(', ') : (meta?.author || 'VRM Author'),
                version: meta?.version || '1.0',
                license: meta?.licenseName || meta?.licenseUrl || 'Standard License',
                permission: meta?.avatarPermission || meta?.allowedUser || 'Everyone',
                commercial: meta?.commercialUsage || meta?.commercialUssage || 'Allowed',
                format: meta?.metaVersion === '0' ? 'VRM 0.0' : 'VRM 1.0',
                meshesCount: gltf.scenes?.[0]?.children.length || 1,
                bonesCount: loadedVrm.humanoid ? Object.keys(loadedVrm.humanoid.humanBones || {}).length : 0
              });

              setModelLoaded(true);
              setLoadingState({ isLoading: false, progress: 100, error: null, fileName: name });
            } else {
              normalizeAndCenterModel(gltf.scene, name);
            }
          } catch (vrmParseErr: any) {
            console.error('VRM internal processing error:', vrmParseErr);
            setModelLoaded(false);
            setLoadingState({
              isLoading: false,
              progress: 0,
              error: `3D model parse error: ${vrmParseErr.message || 'Invalid format'}`,
              fileName: name
            });
          }
        },
        (xhr) => {
          if (xhr.total > 0) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            setLoadingState((prev) => ({ ...prev, progress: pct }));
          }
        },
        (err: any) => {
          // JSON config / ObjectLoader fallback attempt
          fetch(url)
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status} loading ${name}`);
              return res.json();
            })
            .then((jsonData) => {
              if (jsonData.parameters) {
                // Serialized Avatar Config JSON
                if (onAvatarParamsChange) onAvatarParamsChange(jsonData.parameters);
                setVrmMeta({
                  title: name,
                  author: 'VRM Studio Config',
                  version: '1.0',
                  license: 'Custom',
                  permission: 'Allowed',
                  commercial: 'Allowed',
                  format: 'VRM Config JSON'
                });
                setModelLoaded(true);
                setLoadingState({ isLoading: false, progress: 100, error: null, fileName: name });
                return;
              }
              const objectLoader = new THREE.ObjectLoader();
              const parsedGroup = objectLoader.parse(jsonData) as THREE.Group;
              normalizeAndCenterModel(parsedGroup, name);
            })
            .catch(() => {
              console.warn('3D Load Error:', err);
              setModelLoaded(false);
              setLoadingState({
                isLoading: false,
                progress: 0,
                error: `Could not load "${name}". Please drop a valid .vrm, .glb, .gltf, or .obj 3D model file.`,
                fileName: name
              });
            });
        }
      );
    } catch (loaderErr: any) {
      console.error('Loader instantiation failure:', loaderErr);
      setModelLoaded(false);
      setLoadingState({
        isLoading: false,
        progress: 0,
        error: `Loader error: ${loaderErr.message || 'Failed to initialize 3D loader'}`,
        fileName: name
      });
    }
  }, [applyAvatarParametersToVrm, normalizeAndCenterModel, onAvatarParamsChange, updateCameraPosition]);

  // Three.js Canvas Mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      alpha: false
    });
    renderer.setClearColor(0x080c14, 1.0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080c14, 0.05);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCameraPosition();

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0x4ba3e3, 0x080d1a, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.8);
    keyLight.position.set(2.5, 4.0, 3.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(-2.5, 3.0, -3.0);
    scene.add(rimLight);

    const gridGroup = new THREE.Group();
    const gridHelper = new THREE.GridHelper(16, 32, 0x38bdf8, 0x172a45);
    gridHelper.position.y = 0.001;
    (gridHelper.material as THREE.LineBasicMaterial).transparent = true;
    (gridHelper.material as THREE.LineBasicMaterial).opacity = 0.6;
    gridGroup.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(24, 24);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x090e1a,
      roughness: 0.4,
      metalness: 0.6
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    gridGroup.add(groundMesh);
    scene.add(gridGroup);

    // Initial file auto-load check
    if (file && (file.type === 'VRM' || file.type === 'glTF' || file.name.endsWith('.vrm') || file.name.endsWith('.glb') || file.name.endsWith('.gltf') || file.name.endsWith('.obj') || file.name.endsWith('.json'))) {
      try {
        let targetUrl = `/assets/models/${file.name}`;
        if (file.content) {
          if (file.content.startsWith('data:') || file.content.startsWith('http://') || file.content.startsWith('https://') || file.content.startsWith('blob:')) {
            targetUrl = file.content;
          } else {
            targetUrl = URL.createObjectURL(new Blob([file.content], { type: 'application/octet-stream' }));
          }
        }
        loadModelFromUrl(targetUrl, file.name);
      } catch (err) {
        console.warn('Auto-load URL creation error:', err);
      }
    }

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const canvas = renderer.domElement;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('WebGL Context Lost - Pausing 3D render loop');
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };

    const handleContextRestored = () => {
      console.info('WebGL Context Restored - Resuming 3D render loop');
      clock = new THREE.Clock();
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    let clock = new THREE.Clock();
    let animTime = 0;

    const animate = () => {
      const dt = clock.getDelta();
      animTime += dt;

      if (vrmRef.current) {
        vrmRef.current.update(dt);

        if (isPlaying && vrmRef.current.humanoid) {
          const headNode = vrmRef.current.humanoid.getNormalizedBoneNode('head');
          const chestNode = vrmRef.current.humanoid.getNormalizedBoneNode('chest');
          if (chestNode) {
            chestNode.position.y = Math.sin(animTime * 2.0) * 0.003;
            chestNode.rotation.x = Math.sin(animTime * 1.5) * 0.01;
          }
          if (headNode) {
            headNode.rotation.y = Math.sin(animTime * 0.8) * 0.025;
            headNode.rotation.z = Math.cos(animTime * 1.2) * 0.012;
          }
        }
      }

      if (mixerRef.current) {
        mixerRef.current.update(dt);
      }

      renderer.render(scene, camera);
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      resizeObserver.disconnect();
      revokeModelBlobUrl();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [file, loadModelFromUrl, updateCameraPosition]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const blobUrl = URL.createObjectURL(selectedFile);
    loadModelFromUrl(blobUrl, selectedFile.name);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // 1. OS dropped files
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const blobUrl = URL.createObjectURL(droppedFile);
      loadModelFromUrl(blobUrl, droppedFile.name);
      return;
    }

    // 2. FileExplorer dragged items
    const jsonStr = e.dataTransfer.getData('application/json');
    const textPath = e.dataTransfer.getData('text/plain');

    if (jsonStr) {
      try {
        const item: FileItem = JSON.parse(jsonStr);
        const content = fs.readFileContent(item.path, true);
        if (!content || !(content.startsWith('data:') || content.startsWith('blob:'))) {
          // A file:// / content:// path is not loadable data — the
          // WebView blocks file access from file URLs, and a path string
          // is not model bytes. Fail visibly instead of a silent load error.
          setLoadingState({ isLoading: false, progress: 0, error: `Could not read model data for "${item.name}".`, fileName: item.name });
          return;
        }
        loadModelFromUrl(content, item.name);
        return;
      } catch (err) {
        // readFileContent throws on oversize / unreadable files: show the
        // real reason instead of swallowing it (previously `catch {}`).
        const itemName = (() => { try { return (JSON.parse(jsonStr) as FileItem).name; } catch { return 'model'; } })();
        setLoadingState({ isLoading: false, progress: 0, error: err instanceof Error ? err.message : `Could not read model data for "${itemName}".`, fileName: itemName });
        return;
      }
    }

    if (textPath) {
      const fileName = textPath.split('/').pop() || 'model.vrm';
      try {
        const content = fs.readFileContent(textPath, true);
        if (!content || !(content.startsWith('data:') || content.startsWith('blob:'))) {
          setLoadingState({ isLoading: false, progress: 0, error: `Could not read model data for "${fileName}".`, fileName });
          return;
        }
        loadModelFromUrl(content, fileName);
      } catch (err) {
        setLoadingState({ isLoading: false, progress: 0, error: err instanceof Error ? err.message : `Could not read model data for "${fileName}".`, fileName });
      }
    }
  };

  const handleUnloadModel = () => {
    revokeModelBlobUrl();
    const scene = sceneRef.current;
    if (scene) {
      if (vrmRef.current) {
        scene.remove(vrmRef.current.scene);
        VRMUtils.deepDispose(vrmRef.current.scene);
        vrmRef.current = null;
      }
      if (gltfSceneRef.current) {
        scene.remove(gltfSceneRef.current);
        gltfSceneRef.current = null;
      }
    }
    setModelLoaded(false);
    setVrmMeta(null);
    setLoadingState({ isLoading: false, progress: 0, error: null, fileName: 'No Model Loaded' });
  };

  const setVrmExpression = (presetName: string) => {
    if (vrmRef.current?.expressionManager) {
      const presets = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'blink', 'aa', 'ee', 'ih', 'oh', 'ou'];
      presets.forEach((p) => {
        vrmRef.current?.expressionManager?.setValue(p, 0);
      });
      if (presetName !== 'neutral') {
        vrmRef.current.expressionManager.setValue(presetName, 1.0);
      }
      setActiveExpression(presetName);
    }
  };

  // MULTI-TOUCH GESTURE ENGINE
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      initialPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      initialMidpointRef.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    e.stopPropagation();

    const prevPos = activePointersRef.current.get(e.pointerId)!;
    const dx = e.clientX - prevPos.x;
    const dy = e.clientY - prevPos.y;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const numPointers = activePointersRef.current.size;

    if (numPointers === 1) {
      if (activeTool === 'move') {
        const factor = 0.003 * cameraDistanceRef.current;
        cameraTargetRef.current.x -= dx * factor * Math.cos(cameraThetaRef.current);
        cameraTargetRef.current.z += dx * factor * Math.sin(cameraThetaRef.current);
        cameraTargetRef.current.y += dy * factor;
      } else {
        cameraThetaRef.current -= dx * 0.006;
        cameraPhiRef.current += dy * 0.006;
      }
      updateCameraPosition();
    } else if (numPointers === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const distDx = pts[1].x - pts[0].x;
      const distDy = pts[1].y - pts[0].y;
      const currentDist = Math.sqrt(distDx * distDx + distDy * distDy);

      if (initialPinchDistRef.current !== null) {
        const deltaDist = currentDist - initialPinchDistRef.current;
        cameraDistanceRef.current = Math.max(0.8, Math.min(14.0, cameraDistanceRef.current - deltaDist * 0.008));
        initialPinchDistRef.current = currentDist;
      }

      const currentMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      if (initialMidpointRef.current !== null) {
        const midDx = currentMid.x - initialMidpointRef.current.x;
        const midDy = currentMid.y - initialMidpointRef.current.y;

        const factor = 0.003 * cameraDistanceRef.current;
        cameraTargetRef.current.x -= midDx * factor * Math.cos(cameraThetaRef.current);
        cameraTargetRef.current.z += midDx * factor * Math.sin(cameraThetaRef.current);
        cameraTargetRef.current.y += midDy * factor;

        initialMidpointRef.current = currentMid;
      }

      updateCameraPosition();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    activePointersRef.current.delete(e.pointerId);

    if (activePointersRef.current.size < 2) {
      initialPinchDistRef.current = null;
      initialMidpointRef.current = null;
    }

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    cameraDistanceRef.current += e.deltaY * 0.0025;
    updateCameraPosition();
  };

  const handleZoom = (direction: 'in' | 'out') => {
    const delta = direction === 'in' ? -0.4 : 0.4;
    cameraDistanceRef.current = Math.max(1.0, Math.min(12.0, cameraDistanceRef.current + delta));
    updateCameraPosition();
  };

  const handleResetCamera = () => {
    cameraThetaRef.current = 0.0;
    cameraPhiRef.current = 0.08;
    const targetRoot = vrmRef.current ? vrmRef.current.scene : gltfSceneRef.current;
    if (targetRoot) {
      const box = new THREE.Box3().setFromObject(targetRoot);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      targetRoot.position.x = -center.x + targetRoot.position.x;
      targetRoot.position.z = -center.z + targetRoot.position.z;

      const focalY = size.y > 0 ? size.y * 0.55 : 1.1;
      cameraTargetRef.current.set(0.0, focalY, 0.0);
      cameraDistanceRef.current = Math.max(2.2, size.y * 1.65);
    } else {
      cameraTargetRef.current.set(0.0, 1.1, 0.0);
      cameraDistanceRef.current = 3.5;
    }
    updateCameraPosition();
  };

  const handleTakeSnapshot = () => {
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${loadingState.fileName.replace(/\.[^/.]+$/, '')}_vrm_snapshot_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      setSnapshotTaken(true);
      setTimeout(() => setSnapshotTaken(false), 2000);
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-[#080c14] border border-[#172a45] rounded-sm overflow-hidden select-none">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".vrm,.glb,.gltf,.obj,.json"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* 3D Viewer Header */}
      <div className="h-8 bg-[#030712] border-b border-[#1e293b] flex items-center justify-between px-3 z-10 shrink-0">
        <div className="flex items-center space-x-2">
          <BoxSelect className="w-4 h-4 text-[#38bdf8]" />
          <span className="text-xs font-bold text-slate-100 tracking-tight">
            3D Viewer: {modelLoaded ? loadingState.fileName : 'Load Avatar'}
          </span>
          {modelLoaded && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#091b30] text-cyan-300 border border-cyan-500/40 font-mono-code">
              PBR Active
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-[#0f172a] rounded transition-colors"
              title="Minimize"
            >
              <Minus className="w-3 h-3" />
            </button>
          )}
          {onMaximize && (
            <button
              onClick={onMaximize}
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-[#0f172a] rounded transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              <Square className="w-3 h-3" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-red-400 hover:bg-[#0f172a] rounded transition-colors"
              title="Close"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar Sub-Header */}
      <div className="h-7 bg-[#060b14] border-b border-[#1e293b] flex items-center justify-between px-3 z-10 shrink-0 text-[11px]">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-0.5 rounded bg-[#091b30] hover:bg-[#0f2a4a] text-cyan-200 border border-[#38bdf8]/50 text-[10px] flex items-center gap-1 transition-all font-semibold shadow-[0_0_10px_rgba(56,189,248,0.2)]"
            title="Upload local 3D model file"
          >
            <Upload className="w-2.5 h-2.5 text-[#38bdf8]" />
            <span>Load 3D File</span>
          </button>

          {modelLoaded && (
            <button
              onClick={handleUnloadModel}
              className="px-2 py-0.5 rounded bg-[#0b1322] hover:bg-[#142138] text-slate-300 border border-[#1e293b] text-[10px] flex items-center gap-1 transition-colors font-medium"
              title="Unload current model and return to file picker"
            >
              <RefreshCw className="w-2.5 h-2.5 text-slate-400" />
              <span>Unload</span>
            </button>
          )}

          {vrmMeta && modelLoaded && (
            <button
              onClick={() => setShowMetaModal(!showMetaModal)}
              className={`px-2 py-0.5 rounded border text-[10px] flex items-center gap-1 transition-colors ${
                showMetaModal
                  ? 'bg-[#091b30] text-cyan-200 border-[#38bdf8]/60 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                  : 'bg-[#060b14] text-slate-300 border-[#1e293b] hover:text-white'
              }`}
            >
              <Info className="w-2.5 h-2.5 text-[#38bdf8]" />
              <span>Metadata</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          {modelLoaded && (
            <button
              onClick={() => setShowExpressionsPanel(!showExpressionsPanel)}
              className={`px-2 py-0.5 rounded border text-[10px] flex items-center gap-1 transition-colors ${
                showExpressionsPanel
                  ? 'bg-[#091b30] text-cyan-200 border-[#38bdf8]/60'
                  : 'bg-[#060b14] text-slate-300 border-[#1e293b] hover:text-white'
              }`}
              title="Test Blendshape Expressions"
            >
              <Smile className="w-2.5 h-2.5 text-[#38bdf8]" />
              <span>Expressions</span>
            </button>
          )}

          {/* Always visible when the editor is available: the Avatar
              Morph Editor edits avatarParams and needs no loaded model.
              It used to be gated on modelLoaded too, so whenever no model
              was loaded (e.g. a device-storage read failed) the editor
              had no entry point at all in the viewer. Expressions and
              Animations below stay gated — those genuinely need a model. */}
          {onOpenAvatarEditor && (
            <button
              onClick={onOpenAvatarEditor}
              className="px-2.5 py-0.5 rounded bg-[#091b30] hover:bg-[#0f2a4a] text-white border border-[#38bdf8]/50 text-[10px] flex items-center gap-1 transition-all font-semibold shadow-[0_0_8px_rgba(56,189,248,0.2)]"
              title="Open Morph Editor"
            >
              <Sparkles className="w-2.5 h-2.5 text-[#38bdf8]" />
              <span>Edit Avatar</span>
            </button>
          )}

          {onOpenAnimationStudio && modelLoaded && (
            <button
              onClick={onOpenAnimationStudio}
              className="px-2.5 py-0.5 rounded bg-[#091b30] hover:bg-[#0f2a4a] text-white border border-[#38bdf8]/50 text-[10px] flex items-center gap-1 transition-all font-semibold shadow-[0_0_8px_rgba(56,189,248,0.2)]"
              title="Open Animation Studio"
            >
              <Play className="w-2.5 h-2.5 text-[#38bdf8]" />
              <span>Animations</span>
            </button>
          )}
        </div>
      </div>

      {/* VRM Expressions Bar */}
      {showExpressionsPanel && modelLoaded && (
        <div className="bg-[#050a14] border-b border-[#1e293b] px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto text-[10px] z-10 shrink-0">
          <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
            <Smile className="w-3 h-3 text-[#38bdf8]" /> Blendshape Morphs:
          </span>
          {[
            { id: 'neutral', label: 'Neutral' },
            { id: 'happy', label: 'Happy' },
            { id: 'angry', label: 'Angry' },
            { id: 'sad', label: 'Sad' },
            { id: 'relaxed', label: 'Relaxed' },
            { id: 'surprised', label: 'Surprised' },
            { id: 'blink', label: 'Blink' },
            { id: 'aa', label: 'Ah' },
            { id: 'ee', label: 'Ee' },
            { id: 'ih', label: 'Ih' },
            { id: 'oh', label: 'Oh' },
            { id: 'ou', label: 'Ou' }
          ].map((exp) => (
            <button
              key={exp.id}
              onClick={() => setVrmExpression(exp.id)}
              className={`px-2 py-0.5 rounded border transition-all shrink-0 font-mono-code ${
                activeExpression === exp.id
                  ? 'bg-[#38bdf8] text-slate-950 font-bold border-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                  : 'bg-[#08101e] text-slate-300 border-[#1e293b] hover:bg-[#0e1a2f]'
              }`}
            >
              {exp.label}
            </button>
          ))}
        </div>
      )}

      {/* 3D Viewport Canvas Container */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative flex-1 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden touch-none"
        style={{ touchAction: 'none' }}
      >
        {/* Loading overlay */}
        {loadingState.isLoading && (
          <div className="absolute inset-0 bg-[#030712]/90 backdrop-blur-md z-20 flex flex-col items-center justify-center p-4">
            <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-[#38bdf8] rounded-full animate-spin mb-3 shadow-[0_0_20px_rgba(56,189,248,0.4)]" />
            <div className="text-sm font-bold text-slate-100">
              Loading 3D Model...
            </div>
            <div className="text-xs text-[#38bdf8] font-mono-code mt-1">
              {loadingState.fileName}
            </div>
            <div className="w-48 bg-[#091120] h-1.5 rounded-full mt-3 overflow-hidden border border-[#1e293b]">
              <div
                className="bg-[#38bdf8] h-full transition-all duration-300 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                style={{ width: `${loadingState.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Empty State / File Loader Overlay */}
        {!modelLoaded && !loadingState.isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-[#030712]/92 backdrop-blur-2xl">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`w-full max-w-md p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center text-center ${
                isDragOver
                  ? 'border-[#38bdf8] bg-[#091c33]/90 shadow-[0_0_30px_rgba(56,189,248,0.4)] scale-102'
                  : 'border-[#1e293b] bg-[#060c18]/90 hover:border-[#38bdf8]/70 hover:bg-[#0a162b] shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_15px_rgba(56,189,248,0.15)]'
              }`}
            >
              <div className="p-3.5 rounded-2xl bg-[#091e36] text-[#38bdf8] border border-[#38bdf8]/40 mb-3.5 shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                <FileUp className="w-8 h-8" />
              </div>

              <h3 className="text-sm font-black text-slate-100 mb-1 tracking-tight uppercase">
                Load Avatar / 3D Model File
              </h3>
              <p className="text-xs text-slate-400 mb-4 max-w-xs leading-relaxed">
                Drag and drop your <span className="text-cyan-300 font-semibold">.vrm</span>, <span className="text-cyan-300 font-semibold">.glb</span>, <span className="text-cyan-300 font-semibold">.gltf</span>, or <span className="text-cyan-300 font-semibold">.obj</span> avatar file here, or browse device storage.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-[0_0_16px_rgba(56,189,248,0.35)] transition-all hover:scale-102 active:scale-98"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>System File Picker</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fs.isNativeDeviceStorage()) {
                      setShowNativeStoragePicker(true);
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-[#0b1b30] hover:bg-[#122a4a] text-cyan-300 border border-cyan-500/50 font-bold text-xs flex items-center gap-2 transition-all hover:scale-102 active:scale-98 shadow-md"
                >
                  <HardDrive className="w-4 h-4 text-cyan-400" />
                  <span>Browse Device Storage</span>
                </button>
              </div>

              <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-400 font-mono-code">
                <span className="px-2 py-0.5 rounded bg-[#091120] border border-[#1e293b] text-cyan-300">.VRM 0.0 / 1.0</span>
                <span className="px-2 py-0.5 rounded bg-[#091120] border border-[#1e293b] text-cyan-300">.GLB / glTF</span>
                <span className="px-2 py-0.5 rounded bg-[#091120] border border-[#1e293b] text-cyan-300">.OBJ</span>
              </div>
            </div>

            {loadingState.error && (
              <div className="mt-4 p-3 rounded-lg bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-start gap-2 max-w-md shadow-xl">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{loadingState.error}</span>
              </div>
            )}
          </div>
        )}

        {/* Viewport Floating Tools Bar */}
        {modelLoaded && (
          <div className="absolute top-3 left-3 bg-[#030712]/90 border border-[#1e293b] rounded-lg p-1 shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_1px_rgba(56,189,248,0.2)] backdrop-blur-2xl flex flex-col space-y-1 z-10">
            <button
              onClick={() => setActiveTool('select')}
              className={`p-1.5 rounded-md transition-all ${
                activeTool === 'select'
                  ? 'bg-[#091b30] text-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.3)] border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-[#0f172a]'
              }`}
              title="Orbit Camera Tool"
            >
              <Box className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setActiveTool('move')}
              className={`p-1.5 rounded-md transition-all ${
                activeTool === 'move'
                  ? 'bg-[#091b30] text-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.3)] border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-[#0f172a]'
              }`}
              title="Pan Tool"
            >
              <Move className="w-3.5 h-3.5" />
            </button>

            <div className="h-px bg-[#1e293b] my-0.5" />

            <button
              onClick={() => handleZoom('in')}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#0f172a] rounded-md transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleZoom('out')}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#0f172a] rounded-md transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <div className="h-px bg-[#1e293b] my-0.5" />

            <button
              onClick={handleTakeSnapshot}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#0f172a] rounded-md transition-colors relative"
              title="Capture Snapshot"
            >
              <Camera className="w-3.5 h-3.5" />
              {snapshotTaken && (
                <span className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5">
                  <Check className="w-2 h-2 text-black" />
                </span>
              )}
            </button>

            <button
              onClick={handleResetCamera}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#0f172a] rounded-md transition-colors"
              title="Reset Camera Centering"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Metadata Modal */}
        {showMetaModal && vrmMeta && (
          <div className="absolute top-3 right-3 w-64 bg-[#0a111e]/95 border border-[#172a45] rounded-md p-3 shadow-xl z-20 text-[11px] backdrop-blur-md">
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-[#172a45]">
              <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
                <FileBox className="w-3.5 h-3.5" />
                <span>3D Model Metadata</span>
              </div>
              <button
                onClick={() => setShowMetaModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-1.5 text-slate-200">
              <div>
                <span className="text-slate-400">Title:</span>{' '}
                <span className="font-semibold text-white">{vrmMeta.title}</span>
              </div>
              <div>
                <span className="text-slate-400">Author:</span> {vrmMeta.author}
              </div>
              <div>
                <span className="text-slate-400">Format:</span>{' '}
                <span className="px-1 py-0.5 bg-[#0e3a6a] text-cyan-300 rounded text-[10px] font-mono">
                  {vrmMeta.format}
                </span>
              </div>
              <div>
                <span className="text-slate-400">License:</span> {vrmMeta.license}
              </div>

              {vrmMeta.bonesCount !== undefined && (
                <div className="pt-1.5 border-t border-[#172a45]/80 flex justify-between text-[10px] text-slate-400">
                  <span>Bones: {vrmMeta.bonesCount}</span>
                  <span>Meshes: {vrmMeta.meshesCount}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Native Device Storage Model Picker Modal */}
        {showNativeStoragePicker && (
          <div className="absolute inset-0 bg-[#030712]/95 backdrop-blur-2xl z-40 p-4 flex flex-col animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e293b] mb-3">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-cyan-400" />
                <span className="font-extrabold text-sm text-slate-100 uppercase tracking-wide">
                  Native Storage Model Browser
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#091b30] text-emerald-400 border border-emerald-500/40 font-mono-code">
                  /sdcard
                </span>
              </div>
              <button
                onClick={() => setShowNativeStoragePicker(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#0f172a]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Native Path Bar */}
            <div className="flex items-center justify-between bg-[#060c18] border border-[#1e293b] rounded-xl px-3 py-1.5 mb-3 font-mono-code text-xs text-cyan-300">
              <span className="truncate">{nativePickerDir}</span>
              <button
                onClick={() => {
                  const parent = nativePickerDir.substring(0, nativePickerDir.lastIndexOf('/')) || fs.getNativeRootPath();
                  setNativePickerDir(parent);
                }}
                className="px-2 py-0.5 bg-[#0e2744] hover:bg-[#163860] border border-cyan-500/40 text-cyan-200 rounded-md text-[10px] shrink-0 ml-2"
              >
                Up Dir ⬆
              </button>
            </div>

            {/* File & Folder Directory Grid/List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
              {isLoadingNativeFiles ? (
                <div className="p-6 text-center text-cyan-400 font-mono-code text-xs animate-pulse">
                  Querying directory contents...
                </div>
              ) : nativePickerFiles.length === 0 ? (
                <div className="p-6 text-center text-slate-400 font-mono-code text-xs">
                  Directory is empty or access pending permission.
                </div>
              ) : (
                nativePickerFiles.map((item) => {
                  const is3DModel = item.type === 'VRM' || item.type === 'glTF' || item.name.endsWith('.vrm') || item.name.endsWith('.glb') || item.name.endsWith('.gltf') || item.name.endsWith('.obj') || item.name.endsWith('.json');

                  return (
                    <div
                      key={item.path}
                      onClick={() => {
                        if (item.isFolder) {
                          setNativePickerDir(item.path);
                        } else if (is3DModel) {
                          try {
                            const content = fs.readFileContent(item.path, true);
                            if (!content || !(content.startsWith('data:') || content.startsWith('blob:'))) {
                              setLoadingState({ isLoading: false, progress: 0, error: `Could not read model data for "${item.name}".`, fileName: item.name });
                            } else {
                              loadModelFromUrl(content, item.name);
                            }
                          } catch (err) {
                            // readFileContent throws on oversize /
                            // unreadable files: show the real reason in
                            // the viewer instead of failing silently.
                            setLoadingState({ isLoading: false, progress: 0, error: err instanceof Error ? err.message : `Could not read model data for "${item.name}".`, fileName: item.name });
                          }
                          setShowNativeStoragePicker(false);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        item.isFolder
                          ? 'bg-[#071120] border-[#1e293b] hover:border-amber-400/60 hover:bg-[#0e1d36] text-slate-200'
                          : is3DModel
                          ? 'bg-[#07182c] border-cyan-500/50 hover:border-cyan-400 hover:bg-[#0d2a4d] text-cyan-200 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                          : 'bg-[#050812] border-[#1e293b]/50 text-slate-500 opacity-60'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        {item.isFolder ? (
                          <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <FileBox className="w-4 h-4 text-cyan-400 shrink-0" />
                        )}
                        <span className="font-semibold text-xs truncate">{item.name}</span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 font-mono-code text-[10px]">
                        <span className="text-slate-400">{item.size}</span>
                        {is3DModel && (
                          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/40">
                            LOAD 3D
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
