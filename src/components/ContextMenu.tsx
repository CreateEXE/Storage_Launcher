import React, { useEffect, useRef } from 'react';
import {
  Folder,
  BoxSelect,
  Sliders,
  Terminal,
  Palette,
  LayoutGrid,
  RotateCcw,
  X,
  RefreshCw,
  ExternalLink,
  Download,
  Edit2,
  Trash2,
  Minus,
  Square,
  Sparkles,
  Play,
  FileBox,
  FileCode,
  HardDrive
} from 'lucide-react';
import { FileItem } from '../types';
import { WindowNode } from '../types/window';

export type ContextMenuTarget =
  | { type: 'desktop' }
  | { type: 'file'; file: FileItem }
  | { type: 'window'; windowNode: WindowNode };

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  target: ContextMenuTarget;
}

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onOpenStorage: () => void;
  onOpen3DViewer: (file?: FileItem) => void;
  onOpenInspector: (file?: FileItem) => void;
  onOpenTerminal: () => void;
  onOpenCustomizer: () => void;
  onOpenCodeEditor: (file: FileItem) => void;
  onOpenAvatarEditor: (file?: FileItem) => void;
  onOpenAnimationStudio: () => void;
  onTileWindows: () => void;
  onCascadeWindows: () => void;
  onCloseAllWindows: () => void;
  onDownloadFile: (file: FileItem) => void;
  onRenameFile: (file: FileItem) => void;
  onDeleteFile: (file: FileItem) => void;
  onMinimizeWindow: (id: string) => void;
  onMaximizeWindow: (id: string) => void;
  onCloseWindow: (id: string) => void;
  onFocusWindow: (id: string) => void;
  showTerminal?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  state,
  onClose,
  onOpenStorage,
  onOpen3DViewer,
  onOpenInspector,
  onOpenTerminal,
  onOpenCustomizer,
  onOpenCodeEditor,
  onOpenAvatarEditor,
  onOpenAnimationStudio,
  onTileWindows,
  onCascadeWindows,
  onCloseAllWindows,
  onDownloadFile,
  onRenameFile,
  onDeleteFile,
  onMinimizeWindow,
  onMaximizeWindow,
  onCloseWindow,
  onFocusWindow,
  showTerminal = false
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();

    if (state.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [state.isOpen, onClose]);

  if (!state.isOpen) return null;

  const target = state.target;

  // Clamp positioning inside screen boundaries
  const menuWidth = 220;
  const menuHeight = 280;
  const clampedX = Math.min(window.innerWidth - menuWidth - 10, Math.max(10, state.x));
  const clampedY = Math.min(window.innerHeight - menuHeight - 10, Math.max(10, state.y));

  return (
    <div
      ref={menuRef}
      style={{ top: `${clampedY}px`, left: `${clampedX}px` }}
      className="fixed z-50 w-56 bg-[#080d16]/95 backdrop-blur-xl border border-[#1e3a5f] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.85)] p-1.5 text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* 1. DESKTOP CONTEXT MENU */}
      {target.type === 'desktop' && (
        <div className="space-y-0.5">
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-cyan-400 border-b border-[#172a45] mb-1">
            Desktop Options
          </div>

          <button
            onClick={() => {
              onOpenStorage();
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left"
          >
            <Folder className="w-3.5 h-3.5 text-amber-400" />
            <span>Open Device Storage</span>
          </button>

          <button
            onClick={() => {
              onOpen3DViewer();
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left"
          >
            <BoxSelect className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>3D Avatar Studio</span>
          </button>

          <button
            onClick={() => {
              onOpenInspector();
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Deep File Inspector</span>
          </button>

          {showTerminal && (
            <button
              onClick={() => {
                onOpenTerminal();
                onClose();
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] text-purple-300 hover:text-white transition-colors text-left"
            >
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              <span>Termux Console</span>
            </button>
          )}

          <button
            onClick={() => {
              onOpenCustomizer();
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left"
          >
            <Palette className="w-3.5 h-3.5 text-pink-400" />
            <span>Personalize Desktop & Live Background</span>
          </button>

          <div className="my-1 border-t border-[#172a45]" />

          <button
            onClick={() => {
              onTileWindows();
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left text-slate-300"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
            <span>Tile Open Windows</span>
          </button>

          <button
            onClick={() => {
              onCascadeWindows();
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left text-slate-300"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Cascade Windows</span>
          </button>

          <button
            onClick={() => {
              onCloseAllWindows();
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-950/60 hover:text-rose-300 transition-colors text-left text-slate-400"
          >
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>Close All Windows</span>
          </button>
        </div>
      )}

      {/* 2. FILE ITEM CONTEXT MENU */}
      {target.type === 'file' && (
        <div className="space-y-0.5">
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-cyan-400 border-b border-[#172a45] mb-1 truncate">
            {target.file.name}
          </div>

          {(target.file.type === 'VRM' ||
            target.file.type === 'glTF' ||
            target.file.name.toLowerCase().endsWith('.vrm') ||
            target.file.name.toLowerCase().endsWith('.glb')) ? (
            <>
              <button
                onClick={() => {
                  onOpen3DViewer(target.file);
                  onClose();
                }}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] text-cyan-300 font-medium transition-colors text-left"
              >
                <FileBox className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open in 3D Viewer</span>
              </button>

              <button
                onClick={() => {
                  onOpenAvatarEditor(target.file);
                  onClose();
                }}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span>Edit Avatar Morphs</span>
              </button>

              <button
                onClick={() => {
                  onOpenAnimationStudio();
                  onClose();
                }}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Animation Studio</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                onOpenCodeEditor(target.file);
                onClose();
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] text-cyan-300 font-medium transition-colors text-left"
            >
              <FileCode className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Open in Code Editor</span>
            </button>
          )}

          <button
            onClick={() => {
              onOpenInspector(target.file);
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Deep Inspect & Metadata</span>
          </button>

          <button
            onClick={() => {
              onDownloadFile(target.file);
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export to Device</span>
          </button>

          <div className="my-1 border-t border-[#172a45]" />

          <button
            onClick={() => {
              onRenameFile(target.file);
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left"
          >
            <Edit2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Rename File</span>
          </button>

          <button
            onClick={() => {
              onDeleteFile(target.file);
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 transition-colors text-left"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete File</span>
          </button>
        </div>
      )}

      {/* 3. WINDOW CONTEXT MENU */}
      {target.type === 'window' && (
        <div className="space-y-0.5">
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-cyan-400 border-b border-[#172a45] mb-1 truncate">
            {target.windowNode.title}
          </div>

          <button
            onClick={() => {
              onFocusWindow(target.windowNode.id);
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] text-white transition-colors text-left"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span>Bring to Front</span>
          </button>

          <button
            onClick={() => {
              onMinimizeWindow(target.windowNode.id);
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left"
          >
            <Minus className="w-3.5 h-3.5 text-slate-400" />
            <span>{target.windowNode.isMinimized ? 'Restore' : 'Minimize Window'}</span>
          </button>

          <button
            onClick={() => {
              onMaximizeWindow(target.windowNode.id);
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-[#0e2744] hover:text-white transition-colors text-left"
          >
            <Square className="w-3.5 h-3.5 text-slate-400" />
            <span>{target.windowNode.isMaximized ? 'Restore Size' : 'Maximize Window'}</span>
          </button>

          <div className="my-1 border-t border-[#172a45]" />

          <button
            onClick={() => {
              onCloseWindow(target.windowNode.id);
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 transition-colors text-left"
          >
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>Close Window</span>
          </button>
        </div>
      )}
    </div>
  );
};
