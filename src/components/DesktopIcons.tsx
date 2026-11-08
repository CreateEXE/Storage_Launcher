import React from 'react';
import {
  Folder,
  BoxSelect,
  SlidersHorizontal,
  Terminal,
  Palette,
  Sparkles,
  FileCode,
  HardDrive
} from 'lucide-react';
import { DesktopLayout, AccentColor, ACCENT_THEMES } from '../types/customization';

interface DesktopIconsProps {
  layout: DesktopLayout;
  accentColor: AccentColor;
  showTerminal?: boolean;
  onOpenStorage: () => void;
  onOpen3DViewer: () => void;
  onOpenInspector: () => void;
  onOpenTerminal: () => void;
  onOpenCustomizer: () => void;
}

export const DesktopIcons: React.FC<DesktopIconsProps> = ({
  layout,
  accentColor,
  showTerminal = false,
  onOpenStorage,
  onOpen3DViewer,
  onOpenInspector,
  onOpenTerminal,
  onOpenCustomizer
}) => {
  const theme = ACCENT_THEMES[accentColor];

  const items = [
    {
      id: 'storage',
      label: 'Oni\'s Storage Launcher',
      desc: 'Device files & scoped manager',
      icon: <Folder className="w-6 h-6 text-amber-400 fill-amber-400/80" />,
      onClick: onOpenStorage
    },
    {
      id: 'viewer_3d',
      label: '3D Avatar Studio',
      desc: 'VRM models & morph editor',
      icon: <BoxSelect className="w-6 h-6 text-[#38bdf8]" />,
      onClick: onOpen3DViewer
    },
    {
      id: 'inspector',
      label: 'File Inspector',
      desc: 'Deep magic bytes & icon retrieval',
      icon: <SlidersHorizontal className="w-6 h-6 text-emerald-400" />,
      onClick: onOpenInspector
    },
    ...(showTerminal
      ? [
          {
            id: 'terminal',
            label: 'Termux Console',
            desc: 'Developer shell environment',
            icon: <Terminal className="w-6 h-6 text-purple-400" />,
            onClick: onOpenTerminal
          }
        ]
      : []),
    {
      id: 'customizer',
      label: 'Personalize',
      desc: 'Wallpaper, colors & layout',
      icon: <Palette className="w-6 h-6 text-pink-400" />,
      onClick: onOpenCustomizer
    }
  ];

  if (layout === 'minimal') {
    // Pure minimal: no desktop surface icons, everything clean and accessible from taskbar
    return null;
  }

  if (layout === 'dock') {
    // Floating Dock centered at the bottom above taskbar
    return (
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 p-2 rounded-2xl bg-[#030712]/85 backdrop-blur-2xl border border-[#1e293b] shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_1px_rgba(56,189,248,0.3)]">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className="group relative flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#070e1c]/90 hover:bg-[#0c182e] border border-[#1e293b] hover:border-cyan-400/80 transition-all hover:-translate-y-1.5 active:translate-y-0 shadow-lg hover:shadow-[0_0_16px_rgba(56,189,248,0.3)]"
            title={item.label}
          >
            <div className="transition-transform group-hover:scale-110">{item.icon}</div>
            {/* Tooltip */}
            <span className="absolute -top-8 px-2 py-0.5 rounded-md bg-[#030712]/95 border border-[#1e293b] text-[10px] font-semibold text-cyan-200 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  // Classic Desktop Grid
  return (
    <div className="absolute top-3 left-3 z-15 flex flex-col gap-2.5 select-none pointer-events-auto max-w-[140px] sm:max-w-none">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick}
          className="group flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-2 p-2 rounded-xl hover:bg-[#071120]/80 border border-transparent hover:border-[#1e293b] backdrop-blur-[4px] transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        >
          <div className="w-11 h-11 rounded-xl bg-[#060b14]/90 border border-[#1e293b] flex items-center justify-center p-2 shadow-lg group-hover:scale-105 group-hover:border-cyan-400/60 group-hover:shadow-[0_0_12px_rgba(56,189,248,0.25)] transition-all">
            {item.icon}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-slate-100 text-[11px] leading-tight drop-shadow-md group-hover:text-cyan-300 transition-colors">
              {item.label}
            </span>
            <span className="hidden sm:inline text-[9px] text-slate-400 font-mono-code drop-shadow line-clamp-1">
              {item.desc}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
};
