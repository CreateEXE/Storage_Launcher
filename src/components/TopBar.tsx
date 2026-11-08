import React, { useState, useEffect } from 'react';
import { Plus, X, RotateCw, GitFork, HardDrive, Palette, Flame } from 'lucide-react';
import { AccentColor, ACCENT_THEMES } from '../types/customization';

interface TopBarProps {
  sessionTabs: string[];
  activeSessionTab: string;
  onSelectSessionTab: (tab: string) => void;
  onCloseSessionTab: (tab: string, e: React.MouseEvent) => void;
  onAddSessionTab: () => void;
  isLandscapeLocked?: boolean;
  onToggleOrientationLock?: () => void;
  showNodeLinks?: boolean;
  onToggleNodeLinks?: () => void;
  accentColor?: AccentColor;
  onOpenCustomizer?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  sessionTabs,
  activeSessionTab,
  onSelectSessionTab,
  onCloseSessionTab,
  onAddSessionTab,
  isLandscapeLocked = false,
  onToggleOrientationLock,
  showNodeLinks = true,
  onToggleNodeLinks,
  accentColor = 'cyan',
  onOpenCustomizer
}) => {
  const [timeStr, setTimeStr] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  const theme = ACCENT_THEMES[accentColor] || ACCENT_THEMES.cyan;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-9 bg-[#030712]/90 backdrop-blur-xl border-b border-[#1e293b] flex items-center justify-between px-3 text-xs select-none z-30 shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
      {/* Left: App Branding "Oni's Storage Launcher" by Oni Song */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 pr-3 border-r border-[#1e293b]">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center text-white shadow-[0_0_12px_rgba(56,189,248,0.4)] transition-transform hover:scale-105"
            style={{ backgroundColor: theme.hex }}
          >
            <Flame className="w-3 h-3 text-black fill-black" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-extrabold text-slate-100 tracking-tight text-[11px] sm:text-[12px] bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
              Oni's Storage Launcher
            </span>
            <span className="text-[8px] text-cyan-400 font-mono-code tracking-wider">
              by Oni Song
            </span>
          </div>
        </div>

        {/* Hardware Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#091120] border border-[#1e293b] text-[9px] font-mono-code text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Mali-G57 MC2 • 120 Hz</span>
        </div>

        {/* Workspace Session Tabs */}
        <div className="hidden sm:flex items-center space-x-1.5 overflow-x-auto no-scrollbar max-w-[40vw]">
          {sessionTabs.map((tab) => {
            const isActive = activeSessionTab === tab;
            return (
              <div
                key={tab}
                onClick={() => onSelectSessionTab(tab)}
                className={`group flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-[#0b1c33] text-white border-[#38bdf8]/60 shadow-[0_0_12px_rgba(56,189,248,0.25)] font-semibold'
                    : 'bg-[#060b14] text-slate-400 hover:text-slate-200 border-[#1e293b]/80 hover:border-[#334155]'
                }`}
              >
                <span className="text-[10px] flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: isActive ? theme.hex : '#475569' }}
                  />
                  {tab}
                </span>
                {sessionTabs.length > 1 && (
                  <button
                    onClick={(e) => onCloseSessionTab(tab, e)}
                    className="opacity-50 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-opacity"
                    title="Close session workspace"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={onAddSessionTab}
            className="w-5 h-5 flex items-center justify-center rounded-md bg-[#060b14] hover:bg-[#0e1c33] text-slate-300 hover:text-white border border-[#1e293b] transition-colors"
            title="Create New Workspace Session"
          >
            <Plus className="w-3 h-3 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Right: Personalize & Phone Quick Actions */}
      <div className="flex items-center space-x-2 text-slate-300 text-[11px]">
        {/* Personalize Button */}
        {onOpenCustomizer && (
          <button
            onClick={onOpenCustomizer}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#091b30] hover:bg-[#0f2a4a] text-cyan-300 border border-cyan-500/50 text-[10px] font-semibold transition-all shadow-[0_0_10px_rgba(56,189,248,0.2)]"
            title="Personalize Wallpaper & Accent Theme"
          >
            <Palette className="w-3 h-3 text-cyan-400" />
            <span className="hidden xs:inline">Personalize</span>
          </button>
        )}

        {/* Node Link Wire Toggle */}
        {onToggleNodeLinks && (
          <button
            onClick={onToggleNodeLinks}
            className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] transition-all ${
              showNodeLinks
                ? 'bg-[#091b30] text-cyan-300 border-[#38bdf8]/60 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                : 'bg-[#060b14] text-slate-500 border-[#1e293b]'
            }`}
            title="Toggle Visual Parent-Child Node Links"
          >
            <GitFork className="w-2.5 h-2.5 text-[#38bdf8]" />
            <span>Wires</span>
          </button>
        )}

        {/* Orientation Lock */}
        {onToggleOrientationLock && (
          <button
            onClick={onToggleOrientationLock}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] transition-colors ${
              isLandscapeLocked
                ? 'bg-[#091b30] text-cyan-300 border-[#38bdf8]/60'
                : 'bg-[#060b14] text-slate-400 border-[#1e293b] hover:text-white'
            }`}
            title="Lock Landscape Orientation"
          >
            <RotateCw className="w-2.5 h-2.5 text-[#38bdf8]" />
            <span className="hidden sm:inline">{isLandscapeLocked ? 'Landscape' : 'Rotate'}</span>
          </button>
        )}

        {/* Clock */}
        <div className="font-mono-code text-[10px] text-cyan-300 px-2 py-0.5 rounded bg-[#060b14] border border-[#1e293b] shadow-inner">
          {timeStr}
        </div>
      </div>
    </header>
  );
};
