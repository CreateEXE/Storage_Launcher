/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { DesktopIcons } from './components/DesktopIcons';
import { DesktopCustomizerModal } from './components/DesktopCustomizerModal';
import { LiveWallpaper } from './components/LiveWallpaper';
import { Viewer3D } from './components/Viewer3D';
import { FileExplorer } from './components/FileExplorer';
import { TerminalPanel } from './components/TerminalPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { AvatarEditor } from './components/AvatarEditor';
import { AssetBrowser } from './components/AssetBrowser';
import { AnimationStudioWindow } from './components/AnimationStudioWindow';
import { ColorPickerWindow } from './components/ColorPickerWindow';
import { CodeEditorWindow } from './components/CodeEditorWindow';
import { WindowFrame } from './components/WindowFrame';
import { WindowTaskbar } from './components/WindowTaskbar';
import { NodeLinkOverlay } from './components/NodeLinkOverlay';
import { SettingsModal } from './components/SettingsModal';
import { ContextMenu, ContextMenuState } from './components/ContextMenu';
import { ToastNotificationStack } from './components/ToastNotificationStack';
import { FileManagerService } from './services/fileManager';
import { FileTypeDetector } from './services/fileInspector';
import { FileItem } from './types';
import { WindowNode, WindowType } from './types/window';
import { AvatarParameters, DEFAULT_AVATAR_PARAMS } from './types/avatar';
import {
  DesktopCustomization,
  DEFAULT_CUSTOMIZATION
} from './types/customization';

export default function App() {
  const fs = FileManagerService.getInstance();

  // Desktop Personalization & Customization
  const [customization, setCustomization] = useState<DesktopCustomization>(() => {
    try {
      const saved = localStorage.getItem('savage_desktop_customization');
      return saved ? JSON.parse(saved) : DEFAULT_CUSTOMIZATION;
    } catch {
      return DEFAULT_CUSTOMIZATION;
    }
  });
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  const handleCustomizationChange = (updated: DesktopCustomization) => {
    setCustomization(updated);
    try {
      localStorage.setItem('savage_desktop_customization', JSON.stringify(updated));
    } catch {}
  };

  // Global Runtime Exception & Promise Rejection Safeguard
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.warn('Trapped global runtime JS error:', event.error || event.message);
      event.preventDefault();
    };

    const handleGlobalRejection = (event: PromiseRejectionEvent) => {
      console.warn('Trapped global promise rejection:', event.reason);
      event.preventDefault();
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleGlobalRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleGlobalRejection);
    };
  }, []);

  // Sessions & Orientation
  const [sessionTabs, setSessionTabs] = useState<string[]>(['Main Workspace']);
  const [activeSessionTab, setActiveSessionTab] = useState<string>('Main Workspace');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isLandscapeLocked, setIsLandscapeLocked] = useState<boolean>(false);

  // Hidden Developer Mode (Termux Integration unlocked via 7 taps on build number in Settings)
  const [isDeveloperModeUnlocked, setIsDeveloperModeUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('savage_developer_mode_unlocked') === 'true';
    } catch {
      return false;
    }
  });

  const handleUnlockDeveloperMode = () => {
    setIsDeveloperModeUnlocked(true);
    try {
      localStorage.setItem('savage_developer_mode_unlocked', 'true');
    } catch {}
  };

  const handleLockDeveloperMode = () => {
    setIsDeveloperModeUnlocked(false);
    try {
      localStorage.setItem('savage_developer_mode_unlocked', 'false');
    } catch {}
  };

  // Files & Inspector selection
  const [files, setFiles] = useState<FileItem[]>(fs.getFiles());
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  // Avatar Morph & Color State
  const [avatarParams, setAvatarParams] = useState<AvatarParameters>(DEFAULT_AVATAR_PARAMS);

  // Animation Studio playback state
  const [selectedAnim, setSelectedAnim] = useState<string>('idle');
  const [animPlaying, setAnimPlaying] = useState<boolean>(true);
  const [animProgress, setAnimProgress] = useState<number>(0.35);
  const [animSpeed, setAnimSpeed] = useState<number>(1.0);

  // Window Node System: initially EMPTY out of the gate for a clean, minimalist desktop!
  const [windows, setWindows] = useState<WindowNode[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

  const nextZIndexRef = useRef(20);
  const desktopContainerRef = useRef<HTMLDivElement>(null);

  // Context Menu & Long Press 0.5s state
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    target: { type: 'desktop' }
  });

  const desktopLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const desktopTouchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handlePointerDownDesktop = (e: React.PointerEvent) => {
    const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
    if (targetTag === 'button' || targetTag === 'input' || targetTag === 'textarea' || targetTag === 'a') {
      return;
    }

    desktopTouchStartPosRef.current = { x: e.clientX, y: e.clientY };
    if (desktopLongPressTimerRef.current) clearTimeout(desktopLongPressTimerRef.current);

    desktopLongPressTimerRef.current = setTimeout(() => {
      setContextMenuState({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        target: { type: 'desktop' }
      });
    }, 500);
  };

  const handlePointerMoveDesktop = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - desktopTouchStartPosRef.current.x);
    const dy = Math.abs(e.clientY - desktopTouchStartPosRef.current.y);
    if (dx > 6 || dy > 6) {
      if (desktopLongPressTimerRef.current) clearTimeout(desktopLongPressTimerRef.current);
    }
  };

  const handlePointerUpDesktop = () => {
    if (desktopLongPressTimerRef.current) clearTimeout(desktopLongPressTimerRef.current);
  };

  const handleContextMenuDesktop = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuState({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      target: { type: 'desktop' }
    });
  };

  // Subscribe to real-time filesystem changes
  useEffect(() => {
    const unsubscribe = fs.subscribe(() => {
      const updated = fs.getFiles();
      setFiles(updated);
      if (selectedFile) {
        const stillExists = updated.find((f) => f.path === selectedFile.path);
        setSelectedFile(stillExists || null);
      }
    });
    return unsubscribe;
  }, [selectedFile, fs]);

  // Helper to recursively collect all descendant window IDs in node hierarchy
  const getAllDescendantIds = (rootId: string, allWindows: WindowNode[]): string[] => {
    const result: string[] = [];
    const queue = [rootId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = allWindows.filter((w) => w.parentId === currentId);
      for (const child of children) {
        if (!result.includes(child.id)) {
          result.push(child.id);
          queue.push(child.id);
        }
      }
    }
    return result;
  };

  // Helper to collect all ancestor window IDs
  const getAllAncestorIds = (childId: string, allWindows: WindowNode[]): string[] => {
    const result: string[] = [];
    let current = allWindows.find((w) => w.id === childId);
    while (current && current.parentId) {
      if (result.includes(current.parentId)) break;
      result.push(current.parentId);
      current = allWindows.find((w) => w.id === current!.parentId);
    }
    return result;
  };

  // Bring window to front (and bring all its child nodes with it, keeping children in front)
  const focusWindow = (id: string) => {
    setActiveWindowId(id);
    setWindows((prev) => {
      const target = prev.find((w) => w.id === id);
      if (!target) return prev;

      const descendantIds = getAllDescendantIds(id, prev);
      let nextZ = nextZIndexRef.current + 1;
      const zMap = new Map<string, number>();
      zMap.set(id, nextZ++);
      descendantIds.forEach((childId) => {
        zMap.set(childId, nextZ++);
      });
      nextZIndexRef.current = nextZ;

      const allBranchIds = new Set([id, ...descendantIds]);

      return prev.map((w) => {
        if (allBranchIds.has(w.id)) {
          return {
            ...w,
            zIndex: zMap.get(w.id) ?? w.zIndex,
            isMinimized: false
          };
        }
        return w;
      });
    });
  };

  // Open or Spawn a Window (with Parent/Child Linkage)
  const openWindow = (
    type: WindowType,
    options?: {
      parentId?: string;
      file?: FileItem;
      title?: string;
      payload?: any;
    }
  ) => {
    // Check if an identical window is already open
    const existing = windows.find((w) => {
      if (options?.file) return w.file?.id === options.file.id && w.type === type;
      if (options?.parentId && w.type === type && w.parentId === options.parentId) return true;
      if (!options?.file && !options?.parentId && w.type === type) return true;
      return false;
    });

    if (existing) {
      focusWindow(existing.id);
      return existing.id;
    }

    const newId = `win-${type}-${Date.now().toString(36)}`;
    nextZIndexRef.current += 2;

    const isPhone = window.innerWidth < 640;

    // Smart phone-optimized placement & sizing
    let initialW = 460;
    let initialH = 480;

    if (type === 'file_explorer') {
      initialW = isPhone ? Math.min(window.innerWidth - 16, 520) : 560;
      initialH = isPhone ? Math.min(window.innerHeight - 90, 520) : 480;
    } else if (type === 'viewer_3d') {
      initialW = isPhone ? Math.min(window.innerWidth - 16, 480) : 520;
      initialH = isPhone ? Math.min(window.innerHeight - 90, 560) : 520;
    } else if (type === 'inspector') {
      initialW = isPhone ? Math.min(window.innerWidth - 16, 440) : 420;
      initialH = isPhone ? Math.min(window.innerHeight - 90, 540) : 520;
    } else if (type === 'avatar_editor') {
      initialW = isPhone ? Math.min(window.innerWidth - 16, 360) : 340;
      initialH = isPhone ? Math.min(window.innerHeight - 90, 520) : 500;
    } else if (type === 'asset_browser') {
      initialW = isPhone ? Math.min(window.innerWidth - 16, 440) : 480;
      initialH = isPhone ? Math.min(window.innerHeight - 90, 520) : 500;
    } else if (type === 'color_picker') {
      initialW = isPhone ? Math.min(window.innerWidth - 16, 320) : 300;
      initialH = isPhone ? Math.min(window.innerHeight - 90, 400) : 380;
    } else if (type === 'animation_studio') {
      initialW = isPhone ? Math.min(window.innerWidth - 16, 340) : 330;
      initialH = isPhone ? Math.min(window.innerHeight - 90, 420) : 380;
    } else if (type === 'terminal') {
      initialW = isPhone ? Math.min(window.innerWidth - 16, 540) : 560;
      initialH = isPhone ? Math.min(window.innerHeight - 90, 420) : 400;
    } else if (type === 'code_editor') {
      initialW = isPhone ? Math.min(window.innerWidth - 16, 520) : 540;
      initialH = isPhone ? Math.min(window.innerHeight - 90, 480) : 460;
    }

    let initialX = Math.max(10, Math.floor((window.innerWidth - initialW) / 2));
    let initialY = Math.max(12, Math.floor((window.innerHeight - initialH - 50) / 2));

    // If spawned as child, position neatly adjacent to parent
    if (options?.parentId) {
      const parentWin = windows.find((w) => w.id === options.parentId);
      if (parentWin) {
        if (isPhone) {
          initialX = Math.max(8, parentWin.x + 20);
          initialY = Math.max(15, parentWin.y + 35);
        } else {
          initialX = Math.min(window.innerWidth - initialW - 20, parentWin.x + parentWin.width + 15);
          initialY = Math.max(15, parentWin.y + 10);
        }
      }
    }

    const newWin: WindowNode = {
      id: newId,
      title: options?.title || formatWindowTitle(type, options?.file),
      type,
      parentId: options?.parentId,
      childIds: [],
      x: Math.max(8, initialX),
      y: Math.max(8, initialY),
      width: initialW,
      height: initialH,
      zIndex: nextZIndexRef.current,
      isMinimized: false,
      isMaximized: false,
      file: options?.file,
      payload: options?.payload
    };

    setWindows((prev) => {
      const updated = prev.map((w) =>
        w.id === options?.parentId ? { ...w, childIds: [...w.childIds, newId] } : w
      );
      return [...updated, newWin];
    });

    setActiveWindowId(newId);
    return newId;
  };

  const formatWindowTitle = (type: WindowType, file?: FileItem): string => {
    switch (type) {
      case 'file_explorer':
        return 'Savage Storage: /storage/emulated/0';
      case 'viewer_3d':
        return `3D Viewer: ${file?.name || 'Load Avatar'}`;
      case 'avatar_editor':
        return `Avatar Morph: ${file?.name || 'Avatar Studio'}`;
      case 'asset_browser':
        return 'VRM Asset & Outfit Gallery';
      case 'animation_studio':
        return 'Animation Studio & Timeline';
      case 'color_picker':
        return 'Color Palette Studio';
      case 'inspector':
        return `Item Details & Inspector: ${file?.name || 'Device'}`;
      case 'terminal':
        return 'Termux Live Terminal';
      case 'code_editor':
        return `Editor: ${file?.name || 'buffer'}`;
      default:
        return 'Container Window';
    }
  };

  // Close window and all connected descendant child nodes
  const closeWindow = (id: string) => {
    setWindows((prev) => {
      const descendantIds = new Set(getAllDescendantIds(id, prev));
      const toRemove = new Set([id, ...descendantIds]);
      return prev
        .filter((w) => !toRemove.has(w.id))
        .map((w) => ({
          ...w,
          childIds: w.childIds.filter((cid) => !toRemove.has(cid))
        }));
    });
  };

  // Toggle Minimize:
  // When minimizing any parent, all child nodes are also minimized with it.
  // When restoring any parent, all associated child nodes are also restored.
  const toggleMinimizeWindow = (id: string) => {
    setWindows((prev) => {
      const target = prev.find((w) => w.id === id);
      if (!target) return prev;

      const willMinimize = !target.isMinimized;
      const descendantIds = new Set(getAllDescendantIds(id, prev));

      if (willMinimize) {
        return prev.map((w) => {
          if (w.id === id || descendantIds.has(w.id)) {
            return { ...w, isMinimized: true };
          }
          return w;
        });
      } else {
        const ancestorIds = new Set(getAllAncestorIds(id, prev));
        return prev.map((w) => {
          if (w.id === id || descendantIds.has(w.id) || ancestorIds.has(w.id)) {
            return { ...w, isMinimized: false };
          }
          return w;
        });
      }
    });
  };

  const toggleMaximizeWindow = (id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w))
    );
  };

  // Move window:
  // Decoupled: Windows now move independently regardless of parent/child status.
  const moveWindow = (id: string, x: number, y: number) => {
    setWindows((prev) => {
      const target = prev.find((w) => w.id === id);
      if (!target) return prev;
      if (target.x === x && target.y === y) return prev;

      return prev.map((w) => {
        if (w.id === id) {
          return { ...w, x, y };
        }
        return w;
      });
    });
  };

  const resizeWindow = (id: string, width: number, height: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, width, height } : w)));
  };

  const cascadeWindows = () => {
    setWindows((prev) =>
      prev.map((w, idx) => ({
        ...w,
        isMinimized: false,
        isMaximized: false,
        x: Math.min(window.innerWidth - 300, 20 + idx * 25),
        y: Math.min(window.innerHeight - 300, 20 + idx * 25),
        zIndex: 20 + idx
      }))
    );
  };

  const tileWindows = () => {
    const unminimized = windows.filter((w) => !w.isMinimized);
    if (unminimized.length === 0) return;
    const isPhone = window.innerWidth < 640;
    const cols = isPhone ? 1 : Math.min(unminimized.length, 3);
    const w = Math.floor((window.innerWidth - 20) / cols);
    const h = isPhone
      ? Math.floor((window.innerHeight - 60) / unminimized.length)
      : window.innerHeight - 90;

    setWindows((prev) =>
      prev.map((win) => {
        const idx = unminimized.findIndex((u) => u.id === win.id);
        if (idx === -1) return win;
        return {
          ...win,
          isMaximized: false,
          x: isPhone ? 10 : 10 + idx * w,
          y: isPhone ? 10 + idx * h : 15,
          width: isPhone ? window.innerWidth - 20 : w - 8,
          height: isPhone ? h - 8 : h
        };
      })
    );
  };

  const closeAllWindows = () => {
    setWindows([]);
  };

  // Open file handler with Deep Content Inspection:
  // Recognizes VRM avatars and 3D files EVEN IF renamed to .dat, .bin, .png, etc.!
  const handleOpenFile = (file: FileItem) => {
    setSelectedFile(file);
    const inspection = FileTypeDetector.inspect(file);

    if (inspection.is3DModel || inspection.isVRM || file.type === 'VRM' || file.type === 'glTF') {
      openWindow('viewer_3d', {
        file,
        title: inspection.isVRM
          ? `3D Viewer: ${file.name} (VRM Avatar)`
          : `3D Viewer: ${file.name}`
      });
    } else {
      openWindow('code_editor', { file, title: `Editor: ${file.name}` });
    }
  };

  // Dynamic Wallpaper Styling
  const getWallpaperStyle = (): React.CSSProperties => {
    if (customization.wallpaper === 'nihonga') {
      return {
        backgroundImage: `url('/assets/system/japanese_nihonga_painting_abou__10__19e79978.jpeg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    if (customization.wallpaper === 'custom' && customization.customWallpaperUrl) {
      return {
        backgroundImage: `url('${customization.customWallpaperUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    if (customization.wallpaper === 'midnight') {
      return {
        background: 'radial-gradient(circle at 50% 20%, #0d213f 0%, #060b14 70%)'
      };
    }
    if (customization.wallpaper === 'obsidian') {
      return {
        background: 'linear-gradient(135deg, #090e17 0%, #030508 100%)'
      };
    }
    if (customization.wallpaper === 'nebula') {
      return {
        background: 'radial-gradient(ellipse at bottom, #2e1065 0%, #080718 60%, #030209 100%)'
      };
    }
    return {
      backgroundImage: `url('/assets/system/japanese_nihonga_painting_abou__10__19e79978.jpeg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  };

  return (
    <div
      className={`flex flex-col w-screen h-screen bg-[#080c14] text-slate-100 overflow-hidden font-sans select-none text-xs ${
        isLandscapeLocked ? 'rotate-0 overflow-x-auto min-w-[760px]' : ''
      }`}
    >
      {/* Top Header Bar: Savage Storage by Oni Song */}
      <TopBar
        sessionTabs={sessionTabs}
        activeSessionTab={activeSessionTab}
        onSelectSessionTab={setActiveSessionTab}
        onCloseSessionTab={(tab, e) => {
          e.stopPropagation();
          if (sessionTabs.length > 1) {
            const nextTabs = sessionTabs.filter((t) => t !== tab);
            setSessionTabs(nextTabs);
            if (activeSessionTab === tab) setActiveSessionTab(nextTabs[0]);
          }
        }}
        onAddSessionTab={() => {
          const newSession = `Workspace ${sessionTabs.length + 1}`;
          setSessionTabs([...sessionTabs, newSession]);
          setActiveSessionTab(newSession);
        }}
        isLandscapeLocked={isLandscapeLocked}
        onToggleOrientationLock={() => setIsLandscapeLocked(!isLandscapeLocked)}
        showNodeLinks={customization.showNodeWires}
        onToggleNodeLinks={() =>
          handleCustomizationChange({
            ...customization,
            showNodeWires: !customization.showNodeWires
          })
        }
        accentColor={customization.accentColor}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
      />

      {/* Main Desktop Canvas */}
      <main
        ref={desktopContainerRef}
        onPointerDown={handlePointerDownDesktop}
        onPointerMove={handlePointerMoveDesktop}
        onPointerUp={handlePointerUpDesktop}
        onContextMenu={handleContextMenuDesktop}
        className="flex-1 overflow-hidden relative flex flex-col"
      >
        {/* DESKTOP BACKGROUND LAYER: Japanese Nihonga Painting, Live Waves & Leaves, Cyber Matrix, or user theme */}
        <LiveWallpaper
          wallpaper={customization.wallpaper}
          customWallpaperUrl={customization.customWallpaperUrl}
          accentColor={customization.accentColor}
        />

        {/* Minimalist Phone-Optimized Desktop Surface Icons & Dock */}
        <DesktopIcons
          layout={customization.desktopLayout}
          accentColor={customization.accentColor}
          showTerminal={isDeveloperModeUnlocked}
          onOpenStorage={() => openWindow('file_explorer')}
          onOpen3DViewer={() => {
            const modelToOpen =
              selectedFile &&
              (selectedFile.type === 'VRM' ||
                selectedFile.type === 'glTF' ||
                selectedFile.name.toLowerCase().endsWith('.vrm') ||
                selectedFile.name.toLowerCase().endsWith('.glb'))
                ? selectedFile
                : undefined;
            openWindow('viewer_3d', { file: modelToOpen });
          }}
          onOpenInspector={() => openWindow('inspector', { file: selectedFile || files[0] })}
          onOpenTerminal={() => openWindow('terminal')}
          onOpenCustomizer={() => setIsCustomizerOpen(true)}
        />

        {/* Visual Node Parent-Child Link Wires Layer */}
        <NodeLinkOverlay windows={windows} enabled={customization.showNodeWires} />

        {/* FLOATING FOREGROUND CONTAINERS LAYER */}
        {windows.map((win) => {
          const parentWin = win.parentId ? windows.find((w) => w.id === win.parentId) : undefined;

          return (
            <WindowFrame
              key={win.id}
              window={win}
              parentTitle={parentWin?.title}
              onFocus={() => focusWindow(win.id)}
              onMove={(x, y) => moveWindow(win.id, x, y)}
              onResize={(w, h) => resizeWindow(win.id, w, h)}
              onMinimize={() => toggleMinimizeWindow(win.id)}
              onMaximize={() => toggleMaximizeWindow(win.id)}
              onClose={() => closeWindow(win.id)}
              onContextMenuWindow={(winNode, x, y) =>
                setContextMenuState({
                  isOpen: true,
                  x,
                  y,
                  target: { type: 'window', windowNode: winNode }
                })
              }
              boundsRef={desktopContainerRef}
            >
              {/* 1. Device Storage Manager Window */}
              {win.type === 'file_explorer' && (
                <FileExplorer
                  files={files}
                  selectedFile={selectedFile}
                  onSelectFile={(f) => {
                    setSelectedFile(f);
                  }}
                  onOpenFile={handleOpenFile}
                  onContextMenuFile={(file, x, y) =>
                    setContextMenuState({
                      isOpen: true,
                      x,
                      y,
                      target: { type: 'file', file }
                    })
                  }
                />
              )}

              {/* 2. 3D Model & VRM Avatar Viewer Container */}
              {win.type === 'viewer_3d' && (
                <Viewer3D
                  file={win.file}
                  avatarParams={avatarParams}
                  onAvatarParamsChange={setAvatarParams}
                  onOpenAvatarEditor={() =>
                    openWindow('avatar_editor', {
                      parentId: win.id,
                      file: win.file,
                      title: `Avatar Morph: ${win.file?.name || 'Avatar Studio'}`
                    })
                  }
                  onOpenAnimationStudio={() =>
                    openWindow('animation_studio', {
                      parentId: win.id,
                      title: `Animation Studio: ${win.file?.name || 'Avatar Studio'}`
                    })
                  }
                />
              )}

              {/* 3. Avatar Morph Editor (Child of 3D Viewer) */}
              {win.type === 'avatar_editor' && (
                <AvatarEditor
                  params={avatarParams}
                  onChange={setAvatarParams}
                  onOpenColorPicker={(targetProp, targetLabel) =>
                    openWindow('color_picker', {
                      parentId: win.id,
                      title: targetLabel,
                      payload: { targetProp }
                    })
                  }
                  onOpenAssetBrowser={() =>
                    openWindow('asset_browser', {
                      parentId: win.id,
                      title: 'VRM Asset & Outfit Gallery'
                    })
                  }
                />
              )}

              {/* 4. VRM Asset & Outfit Gallery (Child of Avatar Editor) */}
              {win.type === 'asset_browser' && (
                <AssetBrowser
                  params={avatarParams}
                  onChange={setAvatarParams}
                  onClose={() => closeWindow(win.id)}
                />
              )}

              {/* 4. Animation Studio (Child of 3D Viewer) */}
              {win.type === 'animation_studio' && (
                <AnimationStudioWindow
                  selectedAnimation={selectedAnim}
                  onSelectAnimation={setSelectedAnim}
                  isPlaying={animPlaying}
                  onTogglePlay={() => setAnimPlaying(!animPlaying)}
                  timelineProgress={animProgress}
                  onSeek={setAnimProgress}
                  speed={animSpeed}
                  onChangeSpeed={setAnimSpeed}
                />
              )}

              {/* 5. Color Palette Studio (Child of Avatar Editor) */}
              {win.type === 'color_picker' && (
                <ColorPickerWindow
                  targetProp={win.payload?.targetProp || 'hairColor'}
                  targetLabel={win.title}
                  avatarParams={avatarParams}
                  onChangeColor={(prop, color) => {
                    setAvatarParams((prev) => ({ ...prev, [prop]: color }));
                  }}
                />
              )}

              {/* 6. Item Details & Deep File Inspector Container */}
              {win.type === 'inspector' && (
                <InspectorPanel
                  selectedFile={win.file || selectedFile || files[0]}
                  onOpenIn3DViewer={(f) => openWindow('viewer_3d', { file: f })}
                  onOpenInCodeEditor={(f) => openWindow('code_editor', { file: f })}
                />
              )}

              {/* 7. Code Editor Container */}
              {win.type === 'code_editor' && win.file && (
                <CodeEditorWindow
                  file={win.file}
                  onRunScript={() => {
                    openWindow('terminal');
                  }}
                />
              )}

              {/* 8. Live Termux Terminal Container */}
              {win.type === 'terminal' && <TerminalPanel />}
            </WindowFrame>
          );
        })}
      </main>

      {/* Running Windows Taskbar with Savage Start Menu */}
      <WindowTaskbar
        windows={windows}
        activeWindowId={activeWindowId}
        onFocusWindow={focusWindow}
        onToggleMinimize={toggleMinimizeWindow}
        onTileWindows={tileWindows}
        onCascadeWindows={cascadeWindows}
        onCloseAllWindows={closeAllWindows}
        onOpenStorage={() => openWindow('file_explorer')}
        onOpen3DViewer={() => {
          const modelToOpen =
            selectedFile &&
            (selectedFile.type === 'VRM' ||
              selectedFile.type === 'glTF' ||
              selectedFile.name.toLowerCase().endsWith('.vrm') ||
              selectedFile.name.toLowerCase().endsWith('.glb'))
              ? selectedFile
              : undefined;
          openWindow('viewer_3d', { file: modelToOpen });
        }}
        onOpenInspector={() => openWindow('inspector', { file: selectedFile || files[0] })}
        onOpenTerminal={() => openWindow('terminal')}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        accentColor={customization.accentColor}
        showTerminal={isDeveloperModeUnlocked}
      />

      {/* Desktop Customizer Modal */}
      <DesktopCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        customization={customization}
        onChange={handleCustomizationChange}
      />

      {/* Hardware & Storage Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isDeveloperModeUnlocked={isDeveloperModeUnlocked}
        onUnlockDeveloperMode={handleUnlockDeveloperMode}
        onLockDeveloperMode={handleLockDeveloperMode}
        onOpenTerminal={() => openWindow('terminal')}
      />

      {/* Context Sensitive Menu (0.5s Touch Long Press & Right Click) */}
      <ContextMenu
        state={contextMenuState}
        onClose={() => setContextMenuState((prev) => ({ ...prev, isOpen: false }))}
        onOpenStorage={() => openWindow('file_explorer')}
        onOpen3DViewer={(f) => openWindow('viewer_3d', { file: f })}
        onOpenInspector={(f) => openWindow('inspector', { file: f || selectedFile || files[0] })}
        onOpenTerminal={() => openWindow('terminal')}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
        onOpenCodeEditor={(f) => openWindow('code_editor', { file: f })}
        onOpenAvatarEditor={(f) => openWindow('avatar_editor', { file: f })}
        onOpenAnimationStudio={() => openWindow('animation_studio')}
        onTileWindows={tileWindows}
        onCascadeWindows={cascadeWindows}
        onCloseAllWindows={closeAllWindows}
        onDownloadFile={(f) => fs.downloadFile(f)}
        onRenameFile={(f) => {
          const newName = prompt(`Rename ${f.name} to:`, f.name);
          if (newName && newName.trim()) {
            fs.renameItem(f.path, newName.trim());
          }
        }}
        onDeleteFile={(f) => {
          if (confirm(`Delete ${f.name} permanently?`)) {
            fs.deleteItem(f.path);
          }
        }}
        onMinimizeWindow={toggleMinimizeWindow}
        onMaximizeWindow={toggleMaximizeWindow}
        onCloseWindow={closeWindow}
        onFocusWindow={focusWindow}
        showTerminal={isDeveloperModeUnlocked}
      />

      {/* Floating Non-Blocking Toast & Transfer Progress Notifications */}
      <ToastNotificationStack />
    </div>
  );
}
