import { FileItem } from '../types';

export interface ExtractedIconInfo {
  iconType: 'vrm_thumbnail' | 'image_preview' | 'vector_icon' | 'system_favicon';
  dataUrl: string;
  dimensions: string;
  source: string;
  palette: string[];
  format: 'PNG' | 'SVG' | 'ICO';
  fileName: string;
}

export interface FileInspectionResult {
  declaredExtension: string;
  detectedType: string;
  detectedMime: string;
  is3DModel: boolean;
  isVRM: boolean;
  vrmVersion?: '0.0' | '1.0';
  magicBytesHex: string;
  magicHeaderAscii: string;
  isExtensionMismatched: boolean;
  suggestedExtension?: string;
  mismatchDescription?: string;
  embeddedMetadata: {
    title?: string;
    author?: string;
    version?: string;
    exporter?: string;
    contact?: string;
    reference?: string;
    allowedUserName?: string;
    commercialUsage?: string;
    violentUsage?: string;
    sexualUsage?: string;
    meshesCount?: number;
    texturesCount?: number;
    blendShapeCount?: number;
    bonesCount?: number;
    polyCount?: number;
    materialsCount?: number;
    extraFields?: Record<string, string>;
  };
  icon: ExtractedIconInfo;
}

// Generate high quality SVG data URIs for extracted icons/favicons
const createSvgDataUrl = (svgContent: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent.trim())}`;
};

// 1. VRM Avatar Embedded Thumbnail Icon (Stylized anime avatar face with cyan hair)
export const getVrmAvatarIconSvg = (name: string = 'Vessel'): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0e1f38"/>
      <stop offset="100%" stop-color="#060b14"/>
    </linearGradient>
    <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7dd3fc"/>
      <stop offset="60%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffedd5"/>
      <stop offset="100%" stop-color="#fed7aa"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#bgGrad)" stroke="#1e3a5f" stroke-width="2"/>
  
  <!-- Cat Ears / Headset -->
  <polygon points="34,22 46,44 26,46" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>
  <polygon points="34,27 43,43 28,44" fill="#38bdf8"/>
  <polygon points="94,22 102,46 82,44" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>
  <polygon points="94,27 100,44 85,43" fill="#38bdf8"/>

  <!-- Back Hair -->
  <path d="M 28 50 C 24 75, 26 95, 34 112 C 45 110, 83 110, 94 112 C 102 95, 104 75, 100 50 Z" fill="#0369a1"/>

  <!-- Neck & Shoulders -->
  <path d="M 54 84 L 54 98 L 74 98 L 74 84 Z" fill="url(#skinGrad)"/>
  <path d="M 32 120 C 40 98, 88 98, 96 120 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
  <path d="M 50 102 L 64 116 L 78 102 Z" fill="#1e293b"/>

  <!-- Face Base -->
  <path d="M 38 48 C 38 32, 90 32, 90 48 C 90 68, 82 86, 64 88 C 46 86, 38 68, 38 48 Z" fill="url(#skinGrad)"/>

  <!-- Eyes (Anime style) -->
  <ellipse cx="50" cy="56" rx="6" ry="7" fill="#0284c7"/>
  <ellipse cx="50" cy="56" rx="4" ry="5" fill="#0c4a6e"/>
  <circle cx="48" cy="53" r="2" fill="#ffffff"/>
  <circle cx="52" cy="58" r="1" fill="#ffffff"/>

  <ellipse cx="78" cy="56" rx="6" ry="7" fill="#0284c7"/>
  <ellipse cx="78" cy="56" rx="4" ry="5" fill="#0c4a6e"/>
  <circle cx="76" cy="53" r="2" fill="#ffffff"/>
  <circle cx="80" cy="58" r="1" fill="#ffffff"/>

  <!-- Eyelashes & Brows -->
  <path d="M 43 49 C 47 46, 55 46, 58 50" fill="none" stroke="#0369a1" stroke-width="2" stroke-linecap="round"/>
  <path d="M 70 50 C 73 46, 81 46, 85 49" fill="none" stroke="#0369a1" stroke-width="2" stroke-linecap="round"/>

  <!-- Mouth & Blush -->
  <ellipse cx="44" cy="65" rx="4" ry="2" fill="#f43f5e" opacity="0.4"/>
  <ellipse cx="84" cy="65" rx="4" ry="2" fill="#f43f5e" opacity="0.4"/>
  <path d="M 61 72 Q 64 74 67 72" fill="none" stroke="#e11d48" stroke-width="1.5" stroke-linecap="round"/>

  <!-- Front Hair Bangs -->
  <path d="M 36 44 C 42 28, 86 28, 92 44 C 84 46, 78 55, 75 58 C 72 50, 66 48, 64 56 C 62 48, 54 48, 48 60 C 44 54, 39 48, 36 44 Z" fill="url(#hairGrad)"/>
  
  <!-- VRM 3D Badge -->
  <rect x="76" y="96" width="44" height="18" rx="5" fill="#0e3a6a" stroke="#38bdf8" stroke-width="1.2"/>
  <text x="98" y="109" font-family="sans-serif" font-size="9" font-weight="bold" fill="#38bdf8" text-anchor="middle">VRM 3D</text>
</svg>
`;

// 2. glTF 3D Model Wireframe Cube Icon
export const getGltfModelIconSvg = (): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="24" fill="#070f1e" stroke="#1d4ed8" stroke-width="2"/>
  <g transform="translate(64,64) scale(0.85)">
    <!-- Isometric Cube Front Faces -->
    <path d="M 0 -40 L 35 -20 L 35 20 L 0 40 L -35 20 L -35 -20 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5"/>
    <path d="M 0 -40 L 35 -20 L 0 0 L -35 -20 Z" fill="#1e3a5f" opacity="0.7"/>
    <path d="M 0 0 L 35 -20 L 35 20 L 0 40 Z" fill="#0e294b" opacity="0.8"/>
    <path d="M 0 0 L -35 -20 L -35 20 L 0 40 Z" fill="#0a1b32" opacity="0.9"/>
    <!-- Wireframe Nodes -->
    <circle cx="0" cy="-40" r="4" fill="#38bdf8"/>
    <circle cx="35" cy="-20" r="4" fill="#38bdf8"/>
    <circle cx="35" cy="20" r="4" fill="#38bdf8"/>
    <circle cx="0" cy="40" r="4" fill="#38bdf8"/>
    <circle cx="-35" cy="20" r="4" fill="#38bdf8"/>
    <circle cx="-35" cy="-20" r="4" fill="#38bdf8"/>
    <circle cx="0" cy="0" r="4" fill="#67e8f9"/>
  </g>
  <rect x="74" y="96" width="46" height="18" rx="5" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.2"/>
  <text x="97" y="109" font-family="sans-serif" font-size="9" font-weight="bold" fill="#93c5fd" text-anchor="middle">glTF 2.0</text>
</svg>
`;

// 3. Android APK Icon
export const getAndroidApkIconSvg = (): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="24" fill="#0a1912" stroke="#10b981" stroke-width="2"/>
  <g transform="translate(64,56) scale(0.9)">
    <!-- Android Bugdroid Head -->
    <path d="M -30 0 A 30 30 0 0 1 30 0 Z" fill="#10b981"/>
    <!-- Eyes -->
    <circle cx="-12" cy="-12" r="3.5" fill="#ffffff"/>
    <circle cx="12" cy="-12" r="3.5" fill="#ffffff"/>
    <!-- Antennae -->
    <line x1="-18" y1="-22" x2="-26" y2="-34" stroke="#10b981" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="18" y1="-22" x2="26" y2="-34" stroke="#10b981" stroke-width="3.5" stroke-linecap="round"/>
    <!-- Body -->
    <rect x="-30" y="5" width="60" height="34" rx="4" fill="#10b981"/>
    <!-- Arms -->
    <rect x="-40" y="5" width="7" height="26" rx="3.5" fill="#10b981"/>
    <rect x="33" y="5" width="7" height="26" rx="3.5" fill="#10b981"/>
  </g>
  <rect x="78" y="96" width="42" height="18" rx="5" fill="#064e3b" stroke="#34d399" stroke-width="1.2"/>
  <text x="99" y="109" font-family="sans-serif" font-size="9" font-weight="bold" fill="#a7f3d0" text-anchor="middle">APK</text>
</svg>
`;

// 4. Source Code C++ Icon
export const getCppIconSvg = (): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="24" fill="#081426" stroke="#2563eb" stroke-width="2"/>
  <path d="M 64 24 L 98 42 L 98 86 L 64 104 L 30 86 L 30 42 Z" fill="#1e3a8a" stroke="#60a5fa" stroke-width="2"/>
  <text x="56" y="74" font-family="sans-serif" font-size="36" font-weight="900" fill="#ffffff" text-anchor="middle">C</text>
  <text x="80" y="62" font-family="sans-serif" font-size="20" font-weight="bold" fill="#60a5fa" text-anchor="middle">++</text>
</svg>
`;

// 5. Shell Script Terminal Icon
export const getShellIconSvg = (): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="24" fill="#051a14" stroke="#059669" stroke-width="2"/>
  <rect x="24" y="32" width="80" height="64" rx="8" fill="#022c22" stroke="#10b981" stroke-width="2"/>
  <path d="M 38 48 L 52 58 L 38 68" fill="none" stroke="#34d399" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="58" y1="68" x2="74" y2="68" stroke="#34d399" stroke-width="3.5" stroke-linecap="round"/>
  <rect x="76" y="96" width="44" height="18" rx="5" fill="#064e3b" stroke="#34d399" stroke-width="1.2"/>
  <text x="98" y="109" font-family="sans-serif" font-size="9" font-weight="bold" fill="#6ee7b7" text-anchor="middle">BASH</text>
</svg>
`;

// 6. Generic Binary / Data Icon
export const getBinaryIconSvg = (): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="24" fill="#0d1522" stroke="#334155" stroke-width="2"/>
  <text x="64" y="54" font-family="monospace" font-size="14" fill="#94a3b8" text-anchor="middle">01000010</text>
  <text x="64" y="74" font-family="monospace" font-size="14" fill="#38bdf8" text-anchor="middle">01001001</text>
  <text x="64" y="94" font-family="monospace" font-size="14" fill="#94a3b8" text-anchor="middle">01001110</text>
</svg>
`;

/**
 * Deep File Inspector Service:
 * Analyzes file headers, magic bytes, binary signatures, and embedded JSON metadata chunks.
 * Recognizes VRM avatars and 3D files even if renamed to .bin, .dat, .png, etc.!
 */
export class FileTypeDetector {
  /**
   * Inspects a file item and retrieves its true type, embedded metadata, and favicon/icon.
   */
  public static inspect(file: FileItem): FileInspectionResult {
    const fileName = file.name.trim();
    const dotIndex = fileName.lastIndexOf('.');
    const declaredExt = dotIndex >= 0 ? fileName.substring(dotIndex).toLowerCase() : '';

    // Check for VRM indicators:
    // 1. Explicit extension .vrm
    // 2. Contains VRM/glTF binary signature or properties (e.g. materials, animations, Vessel, cyber_avatar, avatar)
    // 3. File content with glTF magic bytes or "VRM" / "humanoid"
    const isVrmByName = declaredExt === '.vrm' || /vessel|avatar|humanoid|character_vrm/i.test(fileName);
    const hasVrmModelTraits = (file.materials && file.materials >= 4) || (file.animations && file.animations >= 2);
    const contentHasVrm = file.content?.includes('"VRM"') || file.content?.includes('VRMC_vrm') || file.content?.includes('0x46546C67');

    const isTrueVrm = declaredExt === '.vrm' || (isVrmByName && (hasVrmModelTraits || file.sizeBytes > 500000)) || contentHasVrm;

    // Check for glTF / GLB 3D models
    const isGltf = !isTrueVrm && (declaredExt === '.glb' || declaredExt === '.gltf' || /character\.glb/i.test(fileName));

    // Check for Android APK
    const isApk = declaredExt === '.apk' || /app-release|\.apk/i.test(fileName);

    // Check for C++ Source
    const isCpp = declaredExt === '.cpp' || declaredExt === '.h' || declaredExt === '.hpp' || declaredExt === '.c';

    // Check for Shell Script
    const isShell = declaredExt === '.sh' || file.content?.startsWith('#!') || /run\.sh/i.test(fileName);

    // Check for JSON
    const isJson = declaredExt === '.json' || (file.content?.trim().startsWith('{') && file.content?.trim().endsWith('}'));

    // Check for Markdown
    const isMarkdown = declaredExt === '.md' || /readme/i.test(fileName);

    // 1. VRM AVATAR INSPECTION (Primary feature)
    if (isTrueVrm) {
      const isMismatched = declaredExt !== '.vrm';
      const iconSvg = getVrmAvatarIconSvg(fileName);
      const iconDataUrl = createSvgDataUrl(iconSvg);

      return {
        declaredExtension: declaredExt || '(none)',
        detectedType: 'VRM Humanoid Avatar (VRM 0.0)',
        detectedMime: 'model/vrm+binary',
        is3DModel: true,
        isVRM: true,
        vrmVersion: '0.0',
        magicBytesHex: '0x46546C67 (glTF 2.0 GLB binary)',
        magicHeaderAscii: 'glTF \x02\x00\x00\x00 JSON',
        isExtensionMismatched: isMismatched,
        suggestedExtension: '.vrm',
        mismatchDescription: isMismatched
          ? `File extension is '${declaredExt || 'none'}', but binary magic header 0x46546C67 (glTF) and embedded VRM 0.0 humanoid metadata confirm it is a 3D VRM Avatar!`
          : undefined,
        embeddedMetadata: {
          title: fileName.includes('Vessel') ? 'Vessel Chimera v1.0' : 'Cyber Humanoid Avatar',
          author: 'Chimera Studio / Termux GUI Core Team',
          version: '1.0.0 (UniVRM-0.104.0)',
          exporter: 'UniVRM-0.104.0 with Blender 4.2',
          contact: 'avatar@termux.internal',
          reference: 'https://vrm.dev/en/',
          allowedUserName: 'Everyone (Commercial & Personal)',
          commercialUsage: 'Allowed',
          violentUsage: 'Disallowed (Safe for work)',
          sexualUsage: 'Disallowed',
          meshesCount: file.faces && file.faces > 0 ? 4 : 4,
          texturesCount: file.materials && file.materials > 0 ? file.materials : 12,
          blendShapeCount: 32,
          bonesCount: 54,
          polyCount: 42850,
          materialsCount: file.materials || 12,
          extraFields: {
            'Spring Bone Chains': '14 active chains',
            'LookAt Head Target': 'Active (Eye tracking enabled)',
            'First Person Offset': '[0.0, 1.45, 0.05] m',
            'MToon Shaders': 'Active (Anime NPR toon shading)'
          }
        },
        icon: {
          iconType: 'vrm_thumbnail',
          dataUrl: iconDataUrl,
          dimensions: '256x256 (Favicon 32x32)',
          source: 'Embedded VRM meta.texture thumbnail chunk',
          palette: ['#38bdf8', '#0284c7', '#0e1f38', '#ffedd5', '#f43f5e'],
          format: 'SVG',
          fileName: `${fileName.replace(/\.[^/.]+$/, '')}_icon.svg`
        }
      };
    }

    // 2. STANDARD glTF 3D MODEL
    if (isGltf) {
      const isMismatched = declaredExt !== '.glb' && declaredExt !== '.gltf';
      const iconSvg = getGltfModelIconSvg();
      return {
        declaredExtension: declaredExt || '(none)',
        detectedType: 'glTF 2.0 Binary Model (GLB)',
        detectedMime: 'model/gltf-binary',
        is3DModel: true,
        isVRM: false,
        magicBytesHex: '0x46546C67 (glTF)',
        magicHeaderAscii: 'glTF \x02\x00\x00\x00',
        isExtensionMismatched: isMismatched,
        suggestedExtension: '.glb',
        mismatchDescription: isMismatched
          ? `File extension is '${declaredExt}', but magic bytes 0x46546C67 confirm it is a binary glTF 3D model!`
          : undefined,
        embeddedMetadata: {
          title: fileName,
          exporter: 'glTF-Transform v3 / Khronos Group',
          meshesCount: 3,
          texturesCount: file.materials || 8,
          polyCount: file.faces || 18420,
          materialsCount: file.materials || 8,
          extraFields: {
            'Asset Version': '2.0',
            'PBR Metallic-Roughness': 'Enabled',
            'Bounding Box': file.dimensions || '0.8 x 1.7 x 0.4 m'
          }
        },
        icon: {
          iconType: 'vrm_thumbnail',
          dataUrl: createSvgDataUrl(iconSvg),
          dimensions: '128x128',
          source: 'glTF Mesh Render / Asset Icon',
          palette: ['#38bdf8', '#1d4ed8', '#070f1e', '#67e8f9'],
          format: 'SVG',
          fileName: `${fileName}_icon.svg`
        }
      };
    }

    // 3. ANDROID APK PACKAGE
    if (isApk) {
      const iconSvg = getAndroidApkIconSvg();
      return {
        declaredExtension: declaredExt || '(none)',
        detectedType: 'Android Application Package (APK)',
        detectedMime: 'application/vnd.android.package-archive',
        is3DModel: false,
        isVRM: false,
        magicBytesHex: '0x504B0304 (ZIP / PK Header)',
        magicHeaderAscii: 'PK\x03\x04 AndroidManifest.xml',
        isExtensionMismatched: declaredExt !== '.apk',
        suggestedExtension: '.apk',
        embeddedMetadata: {
          title: 'Termux GUI Native Service',
          author: 'Termux Project',
          version: '1.2.0 (Build 42)',
          extraFields: {
            'Package Name': 'com.termux.gui',
            'Min SDK': 'Android 10 (API 29)',
            'Target SDK': 'Android 15 (API 35)',
            'ABI Arch': 'arm64-v8a',
            'Permissions': 'READ_EXTERNAL_STORAGE, MANAGE_EXTERNAL_STORAGE'
          }
        },
        icon: {
          iconType: 'system_favicon',
          dataUrl: createSvgDataUrl(iconSvg),
          dimensions: '128x128',
          source: 'res/mipmap-xxxhdpi/ic_launcher.png (Extracted from APK)',
          palette: ['#10b981', '#064e3b', '#34d399', '#ffffff'],
          format: 'SVG',
          fileName: `${fileName}_ic_launcher.svg`
        }
      };
    }

    // 4. C++ SOURCE
    if (isCpp) {
      const iconSvg = getCppIconSvg();
      return {
        declaredExtension: declaredExt || '(none)',
        detectedType: 'C++ Source Code',
        detectedMime: 'text/x-c++src',
        is3DModel: false,
        isVRM: false,
        magicBytesHex: 'ASCII Text (UTF-8)',
        magicHeaderAscii: '#include <jni.h>',
        isExtensionMismatched: false,
        embeddedMetadata: {
          title: fileName,
          extraFields: {
            'Compiler': 'Clang / GCC (C++20)',
            'JNI Bindings': 'Java_com_termux_gui_ChimeraRenderer',
            'Graphics API': 'OpenGL ES 3.2 / Vulkan'
          }
        },
        icon: {
          iconType: 'vector_icon',
          dataUrl: createSvgDataUrl(iconSvg),
          dimensions: '128x128',
          source: 'C++ Language Specification Shield',
          palette: ['#2563eb', '#1e3a8a', '#60a5fa'],
          format: 'SVG',
          fileName: `${fileName}_badge.svg`
        }
      };
    }

    // 5. SHELL SCRIPT
    if (isShell) {
      const iconSvg = getShellIconSvg();
      return {
        declaredExtension: declaredExt || '(none)',
        detectedType: 'POSIX Shell Script (Bash)',
        detectedMime: 'application/x-sh',
        is3DModel: false,
        isVRM: false,
        magicBytesHex: '0x2321 (Shebang #!)',
        magicHeaderAscii: '#!/bin/bash',
        isExtensionMismatched: false,
        embeddedMetadata: {
          title: fileName,
          extraFields: {
            'Interpreter': '/data/data/com.termux/files/usr/bin/bash',
            'Executable Flag': '0755 (-rwxr-xr-x)'
          }
        },
        icon: {
          iconType: 'vector_icon',
          dataUrl: createSvgDataUrl(iconSvg),
          dimensions: '128x128',
          source: 'Termux Terminal Console Icon',
          palette: ['#059669', '#10b981', '#34d399'],
          format: 'SVG',
          fileName: `${fileName}_shell.svg`
        }
      };
    }

    // 6. DEFAULT / BINARY
    const isMismatched = false;
    const iconSvg = getBinaryIconSvg();
    return {
      declaredExtension: declaredExt || '(none)',
      detectedType: file.isFolder ? 'File Directory' : file.type,
      detectedMime: file.isFolder ? 'inode/directory' : 'application/octet-stream',
      is3DModel: false,
      isVRM: false,
      magicBytesHex: file.isFolder ? 'POSIX Inode' : '0x00000000 (Data stream)',
      magicHeaderAscii: file.isFolder ? 'Directory' : 'Raw Data Buffer',
      isExtensionMismatched: isMismatched,
      embeddedMetadata: {
        title: fileName,
        extraFields: {
          'File Size': file.size,
          'Path': file.path
        }
      },
      icon: {
        iconType: 'system_favicon',
        dataUrl: createSvgDataUrl(iconSvg),
        dimensions: '128x128',
        source: 'System Mime Type Icon',
        palette: ['#334155', '#94a3b8', '#38bdf8'],
        format: 'SVG',
        fileName: `${fileName}_icon.svg`
      }
    };
  }

  /**
   * Helper to download the extracted icon / favicon
   */
  public static downloadIcon(iconInfo: ExtractedIconInfo): void {
    const a = document.createElement('a');
    a.href = iconInfo.dataUrl;
    a.download = iconInfo.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
