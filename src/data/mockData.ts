import { FileItem, TreeNode, Model3DData } from '../types';

export const INITIAL_FILES: FileItem[] = [
  {
    id: 'f-assets',
    name: 'assets',
    size: '--',
    sizeBytes: 0,
    type: 'Folder',
    modified: '10/20 14:32',
    isFolder: true,
    path: '/storage/emulated/0/Projects/Chimera/assets',
    created: '10/17/2025 14:00'
  },
  {
    id: 'f-build',
    name: 'build',
    size: '--',
    sizeBytes: 0,
    type: 'Folder',
    modified: '10/19 22:17',
    isFolder: true,
    path: '/storage/emulated/0/Projects/Chimera/build',
    created: '10/18/2025 09:00'
  },
  {
    id: 'f-docs',
    name: 'docs',
    size: '--',
    sizeBytes: 0,
    type: 'Folder',
    modified: '10/18 09:44',
    isFolder: true,
    path: '/storage/emulated/0/Projects/Chimera/docs',
    created: '10/16/2025 11:20'
  },
  {
    id: 'f-src',
    name: 'src',
    size: '--',
    sizeBytes: 0,
    type: 'Folder',
    modified: '10/20 11:03',
    isFolder: true,
    path: '/storage/emulated/0/Projects/Chimera/src',
    created: '10/17/2025 10:15'
  },
  {
    id: 'f-tools',
    name: 'tools',
    size: '--',
    sizeBytes: 0,
    type: 'Folder',
    modified: '10/17 18:21',
    isFolder: true,
    path: '/storage/emulated/0/Projects/Chimera/tools',
    created: '10/15/2025 18:00'
  },
  {
    id: 'f-cmakelists',
    name: 'CMakeLists.txt',
    size: '2.4 KB',
    sizeBytes: 2423,
    type: 'Text',
    modified: '10/17 18:21',
    isFolder: false,
    path: '/storage/emulated/0/Projects/Chimera/CMakeLists.txt',
    dimensions: 'N/A',
    faces: 0,
    materials: 0,
    animations: 0,
    created: '10/17/2025 18:21',
    content: `cmake_minimum_required(VERSION 3.22.1)
project("chimera_engine")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenGLES REQUIRED)
find_package(Vulkan REQUIRED)

add_library(chimera SHARED
    src/main.cpp
    src/renderer.cpp
    src/vrm_parser.cpp
)

target_link_libraries(chimera
    android
    log
    GLESv3
    EGL
)`
  },
  {
    id: 'f-main-cpp',
    name: 'main.cpp',
    size: '8.7 KB',
    sizeBytes: 8873,
    type: 'C++ Source',
    modified: '10/20 11:02',
    isFolder: false,
    path: '/storage/emulated/0/Projects/Chimera/main.cpp',
    dimensions: 'N/A',
    faces: 0,
    materials: 0,
    animations: 0,
    created: '10/17/2025 18:21',
    content: `#include <jni.h>
#include <android/log.h>
#include <GLES3/gl3.h>

#define TAG "ChimeraNative"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)

extern "C" JNIEXPORT void JNICALL
Java_com_termux_gui_ChimeraRenderer_init(JNIEnv* env, jobject thiz, jint width, jint height) {
    LOGI("Chimera Engine 3D initialized: %dx%d viewport", width, height);
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
}

extern "C" JNIEXPORT void JNICALL
Java_com_termux_gui_ChimeraRenderer_step(JNIEnv* env, jobject thiz) {
    glClearColor(0.031f, 0.047f, 0.078f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
}`
  },
  {
    id: 'f-config-json',
    name: 'config.json',
    size: '1.2 KB',
    sizeBytes: 1191,
    type: 'JSON',
    modified: '10/18 12:16',
    isFolder: false,
    path: '/storage/emulated/0/Projects/Chimera/config.json',
    dimensions: 'N/A',
    faces: 0,
    materials: 0,
    animations: 0,
    created: '10/18/2025 12:16',
    content: `{
  "target": "arm64-v8a",
  "optimization": "O3",
  "renderer": "Vulkan/GLES3",
  "vrm": {
    "version": "0.0",
    "springBones": true,
    "lookAt": true,
    "expressionBlend": true
  },
  "display": {
    "fps": 120,
    "vsync": true,
    "resolution": "1080x2400"
  }
}`
  },
  {
    id: 'f-readme',
    name: 'README.md',
    size: '3.9 KB',
    sizeBytes: 3941,
    type: 'Markdown',
    modified: '10/18 09:44',
    isFolder: false,
    path: '/storage/emulated/0/Projects/Chimera/README.md',
    dimensions: 'N/A',
    faces: 0,
    materials: 0,
    animations: 0,
    created: '10/18/2025 09:44',
    content: `# Chimera Project
Termux Android Native Storage & Avatar System.

## Architecture
- VRM 0.0 / glTF 2.0 Realtime Mesh Pipeline
- Termux CLI bridge with bash session integration
- Android scoped storage mapper (/storage/emulated/0)
- Optimized for Mali-G57 MC2 & Dimensity 6300`
  },
  {
    id: 'f-vessel-vrm',
    name: 'Vessel.vrm',
    size: '13.6 MB',
    sizeBytes: 14260633,
    type: 'VRM',
    modified: '10/19 16:42',
    isFolder: false,
    path: '/storage/emulated/0/Projects/Chimera/VRM_Models/Vessel.vrm',
    dimensions: '0 x 0 x 0',
    faces: 42850,
    materials: 12,
    animations: 5,
    created: '10/19/2025 16:42'
  },
  {
    id: 'f-cyber-avatar-dat',
    name: 'cyber_avatar.dat',
    size: '11.8 MB',
    sizeBytes: 12384910,
    type: 'Binary',
    modified: '10/22 09:15',
    isFolder: false,
    path: '/storage/emulated/0/Projects/Chimera/cyber_avatar.dat',
    dimensions: '0.4 x 1.6 x 0.3 m',
    faces: 38400,
    materials: 10,
    animations: 4,
    created: '10/22/2025 09:15',
    content: 'glTF\x02\x00\x00\x00{"asset":{"version":"2.0"},"extensions":{"VRM":{"exporterVersion":"UniVRM-0.104.0","meta":{"title":"Cyber Humanoid","author":"Chimera Lab","texture":0}}}}'
  },
  {
    id: 'f-character-glb',
    name: 'character.glb',
    size: '6.8 MB',
    sizeBytes: 7130316,
    type: 'glTF',
    modified: '10/19 14:03',
    isFolder: false,
    path: '/storage/emulated/0/Projects/Chimera/character.glb',
    dimensions: '0.8 x 1.7 x 0.4 m',
    faces: 18420,
    materials: 8,
    animations: 3,
    created: '10/19/2025 14:03'
  },
  {
    id: 'f-apk-pkg',
    name: 'app-release.apk',
    size: '18.4 MB',
    sizeBytes: 19293798,
    type: 'Binary',
    modified: '10/21 17:30',
    isFolder: false,
    path: '/storage/emulated/0/Projects/Chimera/build/app-release.apk',
    dimensions: 'N/A',
    faces: 0,
    materials: 0,
    animations: 0,
    created: '10/21/2025 17:30',
    content: 'PK\x03\x04 AndroidManifest.xml classes.dex res/mipmap/ic_launcher.png'
  },
  {
    id: 'f-run-sh',
    name: 'run.sh',
    size: '1.1 KB',
    sizeBytes: 1123,
    type: 'Shell Script',
    modified: '10/17 19:50',
    isFolder: false,
    path: '/storage/emulated/0/Projects/Chimera/run.sh',
    dimensions: 'N/A',
    faces: 0,
    materials: 0,
    animations: 0,
    created: '10/17/2025 19:50',
    content: `#!/data/data/com.termux/files/usr/bin/bash
echo "[+] Starting Chimera Native Environment..."
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:./build
./build/chimera_bin --vrm ./VRM_Models/Vessel.vrm`
  }
];

export const FOLDER_TREE: TreeNode = {
  name: '/',
  path: '/',
  isOpen: true,
  children: [
    {
      name: 'storage',
      path: '/storage',
      isOpen: true,
      children: [
        {
          name: 'emulated',
          path: '/storage/emulated',
          isOpen: true,
          children: [
            {
              name: '0',
              path: '/storage/emulated/0',
              isOpen: true,
              children: [
                { name: 'Android', path: '/storage/emulated/0/Android', isOpen: false },
                { name: 'DCIM', path: '/storage/emulated/0/DCIM', isOpen: false },
                { name: 'Download', path: '/storage/emulated/0/Download', isOpen: false },
                { name: 'Movies', path: '/storage/emulated/0/Movies', isOpen: false },
                { name: 'Music', path: '/storage/emulated/0/Music', isOpen: false },
                { name: 'Notifications', path: '/storage/emulated/0/Notifications', isOpen: false },
                { name: 'Pictures', path: '/storage/emulated/0/Pictures', isOpen: false },
                {
                  name: 'Projects',
                  path: '/storage/emulated/0/Projects',
                  isOpen: true,
                  children: [
                    {
                      name: 'Chimera',
                      path: '/storage/emulated/0/Projects/Chimera',
                      isOpen: true,
                      isSelected: true,
                      children: [
                        { name: 'assets', path: '/storage/emulated/0/Projects/Chimera/assets' },
                        { name: 'build', path: '/storage/emulated/0/Projects/Chimera/build' },
                        { name: 'docs', path: '/storage/emulated/0/Projects/Chimera/docs' },
                        { name: 'src', path: '/storage/emulated/0/Projects/Chimera/src' },
                        { name: 'tools', path: '/storage/emulated/0/Projects/Chimera/tools' }
                      ]
                    },
                    { name: 'VRM_Models', path: '/storage/emulated/0/Projects/VRM_Models' },
                    { name: 'Scripts', path: '/storage/emulated/0/Projects/Scripts' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

export const VESSEL_MODEL_DATA: Model3DData = {
  id: 'vessel-vrm',
  name: 'Vessel.vrm',
  type: 'VRM 0.0',
  size: '13.6 MB',
  meshes: 4,
  textures: 12,
  animations: [
    { id: 'idle', name: 'Idle', duration: 3.2, speed: 1.0 },
    { id: 'walk', name: 'Walk', duration: 1.6, speed: 1.0 },
    { id: 'run', name: 'Run', duration: 1.0, speed: 1.2 },
    { id: 'wave', name: 'Wave', duration: 2.4, speed: 1.0 },
    { id: 'dance', name: 'Dance', duration: 4.8, speed: 1.1 },
    { id: 'sit', name: 'Sit', duration: 2.0, speed: 0.8 },
    { id: 'stand', name: 'Stand', duration: 1.5, speed: 1.0 }
  ],
  materials: [
    { name: 'M_Hair_Cyan', type: 'MToon / PBR', roughness: 0.35, metalness: 0.1, color: '#68b4f7' },
    { name: 'M_Coat_CyberNavy', type: 'PBR Fabric', roughness: 0.7, metalness: 0.2, color: '#16233d' },
    { name: 'M_Armor_White', type: 'PBR Metal', roughness: 0.25, metalness: 0.85, color: '#eef3fa' },
    { name: 'M_Boots_Leather', type: 'PBR Glossy', roughness: 0.3, metalness: 0.4, color: '#0d131f' },
    { name: 'M_NeonGlow_Cyan', type: 'Emissive', roughness: 0.1, metalness: 0.9, color: '#38bdf8' }
  ]
};

export const INITIAL_TERMINAL_OUTPUT = [
  { type: 'input', text: 'u0_a328@localhost:~/Projects/Chimera$ ls -la' },
  { type: 'text', text: 'total 56' },
  { type: 'dir', text: 'drwxrwx--x 6 u0_a328 u0_a328 4096 Oct 20 11:03 .' },
  { type: 'dir', text: 'drwx------ 5 u0_a328 u0_a328 4096 Oct 18 09:44 ..' },
  { type: 'dir', text: 'drwxrwx--x 2 u0_a328 u0_a328 4096 Oct 17 18:21 assets' },
  { type: 'dir', text: 'drwxrwx--x 3 u0_a328 u0_a328 4096 Oct 19 22:17 build' },
  { type: 'dir', text: 'drwxrwx--x 2 u0_a328 u0_a328 4096 Oct 18 09:44 docs' },
  { type: 'dir', text: 'drwxrwx--x 4 u0_a328 u0_a328 4096 Oct 20 11:02 src' },
  { type: 'file', text: '-rw-rw---- 1 u0_a328 u0_a328 2423 Oct 17 18:21 CMakeLists.txt' },
  { type: 'file', text: '-rw-rw---- 1 u0_a328 u0_a328 8873 Oct 20 11:02 main.cpp' },
  { type: 'file', text: '-rw-rw---- 1 u0_a328 u0_a328 1191 Oct 18 12:16 config.json' },
  { type: 'file', text: '-rw-rw---- 1 u0_a328 u0_a328 3941 Oct 18 09:44 README.md' },
  { type: 'exec', text: '-rwxrwx--x 1 u0_a328 u0_a328 1123 Oct 17 19:50 run.sh' }
];
