import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  Terminal,
  BoxSelect,
  Sparkles,
  Sliders,
  FileCode,
  Palette,
  Play,
  RotateCcw,
  LayoutGrid,
  X,
  Search,
  Settings
} from 'lucide-react';
import { WindowNode } from '../types/window';
import { AccentColor, ACCENT_THEMES } from '../types/customization';

interface WindowTaskbarProps {
  windows: WindowNode[];
  activeWindowId: string | null;
  onFocusWindow: (id: string) => void;
  onToggleMinimize: (id: string) => void;
  onTileWindows: () => void;
  onCascadeWindows: () => void;
  onCloseAllWindows: () => void;
  onOpenStorage: () => void;
  onOpen3DViewer: () => void;
  onOpenInspector: () => void;
  onOpenTerminal: () => void;
  onOpenCustomizer: () => void;
  onOpenSettings: () => void;
  accentColor?: AccentColor;
  showTerminal?: boolean;
}

// Stylized Purple Fox Oni Mask with 2 Emerald Green Horns Logo Mark
const OniFoxLogoMark: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="purpleFoxGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#d8b4fe" />
        <stop offset="45%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#6b21a8" />
      </linearGradient>
      <linearGradient id="greenHornGrad" x1="0" y1="0" x2="0" y2="12" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4ade80" />
        <stop offset="60%" stopColor="#22c55e" />
        <stop offset="100%" stopColor="#15803d" />
      </linearGradient>
    </defs>

    {/* 2 Emerald Green Horns */}
    {/* Left Horn */}
    <path
      d="M7.5 8.5C6 5.5 4.5 3 2.5 1.5C4 4 5 7 6.2 9.5Z"
      fill="url(#greenHornGrad)"
      stroke="#86efac"
      strokeWidth="0.5"
    />
    {/* Right Horn */}
    <path
      d="M16.5 8.5C18 5.5 19.5 3 21.5 1.5C20 4 19 7 17.8 9.5Z"
      fill="url(#greenHornGrad)"
      stroke="#86efac"
      strokeWidth="0.5"
    />

    {/* Fox Ears Outer & Inner */}
    {/* Left Ear */}
    <path d="M4.5 9L6.5 3.5L9.5 8Z" fill="#581c87" stroke="#a855f7" strokeWidth="0.5" />
    <path d="M5.5 8L6.5 4.8L8 7.2Z" fill="#c084fc" />

    {/* Right Ear */}
    <path d="M19.5 9L17.5 3.5L14.5 8Z" fill="#581c87" stroke="#a855f7" strokeWidth="0.5" />
    <path d="M18.5 8L17.5 4.8L16 7.2Z" fill="#c084fc" />

    {/* Purple Fox Mask Face Base */}
    <path
      d="M4.5 9C7 7.5 17 7.5 19.5 9C21 12.5 18.5 16.5 16.5 19L12 23L7.5 19C5.5 16.5 3 12.5 4.5 9Z"
      fill="url(#purpleFoxGrad)"
      stroke="#e9d5ff"
      strokeWidth="0.6"
    />

    {/* Forehead Oni Crest / Diamond */}
    <polygon points="12,7 13.5,9.5 12,12 10.5,9.5" fill="#4ade80" opacity="0.95" />

    {/* Slanted Fox Oni Eyes */}
    {/* Left Eye */}
    <path d="M6.5 12.5C7.8 11.5 10 12 10.5 13.2C9.2 13.8 7.5 13.8 6.5 12.5Z" fill="#22c55e" stroke="#4ade80" strokeWidth="0.4" />
    <circle cx="8.2" cy="12.6" r="0.6" fill="#ffffff" />

    {/* Right Eye */}
    <path d="M17.5 12.5C16.2 11.5 14 12 13.5 13.2C14.8 13.8 16.5 13.8 17.5 12.5Z" fill="#22c55e" stroke="#4ade80" strokeWidth="0.4" />
    <circle cx="15.8" cy="12.6" r="0.6" fill="#ffffff" />

    {/* Fox Nose & Fangs */}
    <polygon points="11.2,16 12.8,16 12,17" fill="#1e1b4b" />
    {/* Left Fang */}
    <polygon points="9.5,17 10,19.2 10.6,17.2" fill="#86efac" />
    {/* Right Fang */}
    <polygon points="14.5,17 14,19.2 13.4,17.2" fill="#86efac" />

    {/* Cheek Whiskers */}
    <path d="M4 14C5.5 14.8 6.5 15.2 7.8 15" stroke="#d8b4fe" strokeWidth="0.5" strokeLinecap="round" />
    <path d="M20 14C18.5 14.8 17.5 15.2 16.2 15" stroke="#d8b4fe" strokeWidth="0.5" strokeLinecap="round" />
  </svg>
);

export const WindowTaskbar: React.FC<WindowTaskbarProps> = ({
  windows,
  activeWindowId,
  onFocusWindow,
  onToggleMinimize,
  onTileWindows,
  onCascadeWindows,
  onCloseAllWindows,
  onOpenStorage,
  onOpen3DViewer,
  onOpenInspector,
  onOpenTerminal,
  onOpenCustomizer,
  onOpenSettings,
  accentColor = 'cyan',
  showTerminal = false
}) => {
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const startMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when start menu opens
  useEffect(() => {
    if (isStartOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isStartOpen]);

  // Close start menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (startMenuRef.current && !startMenuRef.current.contains(e.target as Node)) {
        setIsStartOpen(false);
      }
    };
    if (isStartOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStartOpen]);

  // Predictive Auto-Complete Search Index
  const allSearchItems = [
    {
      id: 'app_storage',
      title: 'Device Storage Explorer',
      category: 'APP',
      keywords: 'storage file directory explorer scoped termux storage project files',
      icon: Folder,
      iconColor: 'text-amber-400',
      action: onOpenStorage
    },
    {
      id: 'app_3d_viewer',
      title: '3D Avatar Studio',
      category: 'APP',
      keywords: '3d viewer avatar vrm gltf model humanoid studio 3d render',
      icon: BoxSelect,
      iconColor: 'text-cyan-400',
      action: onOpen3DViewer
    },
    {
      id: 'app_inspector',
      title: 'Deep File Inspector',
      category: 'APP',
      keywords: 'inspector metadata magic bytes hex sniffer file details mime',
      icon: Sliders,
      iconColor: 'text-emerald-400',
      action: onOpenInspector
    },
    ...(showTerminal
      ? [
          {
            id: 'app_terminal',
            title: 'Termux CLI Console',
            category: 'APP',
            keywords: 'terminal cli console shell bash linux termux code',
            icon: Terminal,
            iconColor: 'text-purple-400',
            action: onOpenTerminal
          }
        ]
      : []),
    {
      id: 'app_customizer',
      title: 'Personalize Desktop & Wallpapers',
      category: 'APP',
      keywords: 'wallpaper theme customizer live background dock minimal accent color',
      icon: Palette,
      iconColor: 'text-pink-400',
      action: onOpenCustomizer
    },
    {
      id: 'app_settings',
      title: 'System Settings & Hardware',
      category: 'SETTING',
      keywords: 'settings hardware gpu refresh rate 120hz dimensity 6300 vulkan ram',
      icon: Settings,
      iconColor: 'text-cyan-300',
      action: onOpenSettings
    },
    {
      id: 'cmd_tile',
      title: 'Tile All Open Windows',
      category: 'ACTION',
      keywords: 'tile windows organize grid layout arrange windows side by side',
      icon: LayoutGrid,
      iconColor: 'text-cyan-400',
      action: onTileWindows
    },
    {
      id: 'cmd_cascade',
      title: 'Cascade All Windows',
      category: 'ACTION',
      keywords: 'cascade windows stack arrange layer windows',
      icon: RotateCcw,
      iconColor: 'text-[#38bdf8]',
      action: onCascadeWindows
    },
    {
      id: 'cmd_close_all',
      title: 'Close All Windows',
      category: 'ACTION',
      keywords: 'close all windows clear desktop shutdown app containers',
      icon: X,
      iconColor: 'text-rose-400',
      action: onCloseAllWindows
    }
  ];

  // Predictive search filter logic
  const filteredSuggestions = searchQuery.trim()
    ? allSearchItems.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.keywords.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allSearchItems;

  const handleKeyDownSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredSuggestions.length > 0) {
      filteredSuggestions[0].action();
      setIsStartOpen(false);
    }
  };

  const getWindowIcon = (type: WindowNode['type']) => {
    switch (type) {
      case 'viewer_3d':
        return <BoxSelect className="w-3 h-3 text-[#38bdf8]" />;
      case 'avatar_editor':
        return <Sparkles className="w-3 h-3 text-cyan-300" />;
      case 'animation_studio':
        return <Play className="w-3 h-3 text-emerald-400" />;
      case 'color_picker':
        return <Palette className="w-3 h-3 text-pink-400" />;
      case 'file_explorer':
        return <Folder className="w-3 h-3 text-amber-400" />;
      case 'terminal':
        return <Terminal className="w-3 h-3 text-[#38bdf8]" />;
      case 'inspector':
        return <Sliders className="w-3 h-3 text-cyan-400" />;
      case 'code_editor':
        return <FileCode className="w-3 h-3 text-blue-400" />;
      default:
        return <BoxSelect className="w-3 h-3 text-slate-400" />;
    }
  };

  return (
    <div className="relative z-40 select-none text-xs shrink-0">
      {/* Oni's Storage Launcher Start Menu Popup with Predictive Search */}
      {isStartOpen && (
        <div
          ref={startMenuRef}
          className="absolute bottom-10 left-2 w-88 max-w-[92vw] bg-[#030712]/96 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_25px_rgba(56,189,248,0.25)] overflow-hidden flex flex-col p-3 animate-in slide-in-from-bottom-3 duration-200 z-50"
        >
          {/* Header with PC Logo & System Badge */}
          <div className="p-2.5 border-b border-[#1e293b] flex items-center justify-between mb-2.5 bg-[#060e1a]/90 rounded-xl border border-purple-500/30">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-lg bg-[#140b24] border border-purple-500/50 shadow-[0_0_14px_rgba(168,85,247,0.4)]">
                <OniFoxLogoMark className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-slate-100 text-xs leading-tight tracking-wider uppercase flex items-center gap-1.5">
                  <span className="bg-gradient-to-r from-purple-300 via-purple-100 to-emerald-400 bg-clip-text text-transparent">Oni's Storage Launcher</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-[9px] text-purple-300 font-mono-code">
                  Predictive Search Engine Active
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsStartOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#0f172a] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Windows-style Predictive Search Input Bar */}
          <div className="relative mb-2.5">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDownSearch}
              placeholder="Type to search apps, files, or actions..."
              className="w-full pl-9 pr-3 py-2 bg-[#060b15] border border-cyan-500/40 focus:border-cyan-400 rounded-xl text-xs text-slate-100 outline-none placeholder:text-slate-500 shadow-inner font-mono-code transition-all focus:shadow-[0_0_12px_rgba(56,189,248,0.25)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white text-[10px]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Predictive Search Suggestions & Apps List */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5 no-scrollbar">
            {searchQuery && (
              <div className="text-[9px] font-bold text-cyan-400 tracking-wider uppercase px-1 mb-1 font-mono-code flex items-center justify-between">
                <span>Predictive Suggestions ({filteredSuggestions.length})</span>
                <span className="text-slate-500 font-normal">Press Enter to launch</span>
              </div>
            )}

            {filteredSuggestions.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs font-mono-code">
                No matching items for "{searchQuery}".
              </div>
            ) : (
              filteredSuggestions.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.action();
                      setIsStartOpen(false);
                    }}
                    className="w-full flex items-center space-x-3 p-2 rounded-xl bg-[#060c18] hover:bg-[#0d1c33] border border-[#1e293b] hover:border-cyan-500/50 text-slate-200 hover:text-white transition-all text-left group shadow-sm"
                  >
                    <div className="p-2 rounded-lg bg-[#091526] border border-[#172a45] group-hover:scale-105 transition-transform shrink-0">
                      <ItemIcon className={`w-4 h-4 ${item.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[11px] group-hover:text-cyan-300 transition-colors flex items-center justify-between">
                        <span className="truncate">{item.title}</span>
                        <span className="text-[8px] px-1.5 py-0.2 rounded bg-[#091e36] text-cyan-400 border border-cyan-500/30 shrink-0 font-mono-code">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono-code truncate">
                        {item.keywords}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="mt-2.5 pt-2 border-t border-[#1e293b] flex items-center justify-between px-1">
            <button
              onClick={() => {
                onOpenSettings();
                setIsStartOpen(false);
              }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400" />
              <span>System Settings</span>
            </button>
            <span className="text-[9px] font-mono-code text-cyan-400/80">Oni's Storage Launcher v2.5</span>
          </div>
        </div>
      )}

      {/* Taskbar Bar Surface */}
      <div className="h-8 bg-[#030712]/92 backdrop-blur-2xl border-t border-[#1e293b] px-2.5 flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.8)]">
        {/* Start Button with Purple Fox Oni Mask Logo Mark */}
        <button
          onClick={() => setIsStartOpen(!isStartOpen)}
          className={`relative flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-black transition-all mr-2 shrink-0 border overflow-hidden group shadow-lg ${
            isStartOpen
              ? 'bg-[#1b0d33] text-purple-200 border-purple-400 shadow-[0_0_18px_rgba(168,85,247,0.5)] scale-102'
              : 'bg-[#0b0615] text-slate-100 border-purple-900/50 hover:border-purple-400/80 hover:bg-[#160a2c] hover:shadow-[0_0_16px_rgba(168,85,247,0.4)]'
          }`}
          title="Oni's Storage Launcher Start Menu"
        >
          <div className="transition-transform group-hover:scale-110 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
            <OniFoxLogoMark className="w-4 h-4" />
          </div>
          <span className="tracking-wider uppercase font-extrabold text-[11px] bg-gradient-to-r from-purple-200 via-purple-100 to-emerald-400 bg-clip-text text-transparent">
            Start
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        {/* Running Window Pills / Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar flex-1 mr-2">
          {windows.map((win) => {
            const isActive = activeWindowId === win.id && !win.isMinimized;
            return (
              <button
                key={win.id}
                onClick={() => {
                  if (win.isMinimized) {
                    onToggleMinimize(win.id);
                    onFocusWindow(win.id);
                  } else if (activeWindowId === win.id) {
                    onToggleMinimize(win.id);
                  } else {
                    onFocusWindow(win.id);
                  }
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-all border shrink-0 ${
                  isActive
                    ? 'bg-[#091b30] text-white border-[#38bdf8]/70 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                    : win.isMinimized
                    ? 'bg-[#050912] text-slate-500 border-[#1e293b]/40 opacity-60'
                    : 'bg-[#070e1c] text-slate-300 border-[#1e293b] hover:text-white hover:bg-[#0d1a30]'
                }`}
              >
                {getWindowIcon(win.type)}
                <span className="truncate max-w-[100px] sm:max-w-[140px] tracking-tight">{win.title}</span>
                {win.parentId && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" title="Linked Child Node" />
                )}
                {win.childIds && win.childIds.length > 0 && (
                  <span
                    className="text-[9px] px-1 py-0 rounded bg-[#0b223d] text-cyan-300 font-mono-code border border-cyan-500/40"
                    title={`${win.childIds.length} connected child node(s)`}
                  >
                    +{win.childIds.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Window Layout Controls */}
        {windows.length > 0 && (
          <div className="flex items-center space-x-1 text-slate-400 shrink-0">
            <button
              onClick={onCascadeWindows}
              className="p-1 hover:text-white hover:bg-[#121c2e] rounded"
              title="Cascade Windows"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={onTileWindows}
              className="p-1 hover:text-white hover:bg-[#121c2e] rounded"
              title="Tile Windows"
            >
              <LayoutGrid className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={onCloseAllWindows}
              className="p-1 hover:text-red-400 hover:bg-[#121c2e] rounded"
              title="Close All Windows"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
