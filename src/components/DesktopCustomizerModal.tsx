import React, { useState } from 'react';
import {
  X,
  Palette,
  Image as ImageIcon,
  Layout,
  Smartphone,
  Eye,
  Check,
  RotateCcw,
  Sliders,
  Sparkles
} from 'lucide-react';
import {
  DesktopCustomization,
  ACCENT_THEMES,
  AccentColor,
  WallpaperPreset,
  DesktopLayout,
  DEFAULT_CUSTOMIZATION
} from '../types/customization';

interface DesktopCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customization: DesktopCustomization;
  onChange: (updated: DesktopCustomization) => void;
}

export const DesktopCustomizerModal: React.FC<DesktopCustomizerModalProps> = ({
  isOpen,
  onClose,
  customization,
  onChange
}) => {
  const [customUrlInput, setCustomUrlInput] = useState(customization.customWallpaperUrl || '');

  if (!isOpen) return null;

  const wallpapers: { id: WallpaperPreset; label: string; desc: string; preview: string; isLive?: boolean }[] = [
    {
      id: 'nihonga_live',
      label: 'Live Nihonga Waves & Leaves',
      desc: 'Animated Nihonga painting with falling leaves & undulating waves',
      preview: '/assets/system/japanese_nihonga_painting_abou__10__19e79978.jpeg',
      isLive: true
    },
    {
      id: 'cyber_matrix',
      label: 'Live Cyber Neon Grid',
      desc: 'Glowing neon light streaks changing directions on tech grid',
      preview: 'radial-gradient(circle at 50% 50%, #0c1c38 0%, #050912 80%)',
      isLive: true
    },
    {
      id: 'nihonga',
      label: 'Static Nihonga Painting',
      desc: 'Authentic starry Nihonga artwork',
      preview: '/assets/system/japanese_nihonga_painting_abou__10__19e79978.jpeg'
    },
    {
      id: 'midnight',
      label: 'Cyber Midnight',
      desc: 'Technical navy grid with subtle star dust',
      preview: 'radial-gradient(circle at 50% 20%, #0d213f 0%, #060b14 70%)'
    },
    {
      id: 'obsidian',
      label: 'Obsidian Minimal',
      desc: 'Deep stealth matte black for battery savings',
      preview: 'linear-gradient(135deg, #090e17 0%, #030508 100%)'
    },
    {
      id: 'nebula',
      label: 'Violet Nebula',
      desc: 'Cosmic purple glow with deep space gradient',
      preview: 'radial-gradient(ellipse at bottom, #2e1065 0%, #080718 60%, #030209 100%)'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md select-none text-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#080d16] border border-[#1e3a5f] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-10 px-3 bg-[#0c1524] border-b border-[#172a45] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded bg-[#0e3a6a] text-cyan-400 border border-cyan-500/40">
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-semibold text-slate-100 text-xs">Savage Customizer</div>
              <div className="text-[10px] text-slate-400">Desktop personalization & phone layout</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-[#162338] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-3.5 overflow-y-auto space-y-4 text-slate-200">
          {/* 1. Wallpaper Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Desktop Wallpaper</span>
              </span>
              <span className="text-[10px] text-slate-400 capitalize">{customization.wallpaper}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {wallpapers.map((w) => {
                const isSelected = customization.wallpaper === w.id;
                const isImg = w.preview.startsWith('/');
                return (
                  <button
                    key={w.id}
                    onClick={() => onChange({ ...customization, wallpaper: w.id })}
                    className={`relative p-2 rounded-lg border text-left flex flex-col justify-between overflow-hidden transition-all h-20 ${
                      isSelected
                        ? 'border-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                        : 'border-[#172a45] hover:border-slate-500'
                    }`}
                  >
                    {/* Background Preview */}
                    <div
                      className="absolute inset-0 bg-cover bg-center -z-10"
                      style={isImg ? { backgroundImage: `url(${w.preview})` } : { background: w.preview }}
                    />
                    <div className="absolute inset-0 bg-black/40 -z-10" />

                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1 min-w-0 pr-1">
                        <span className="text-[10px] font-bold text-white drop-shadow truncate">{w.label}</span>
                        {w.isLive && (
                          <span className="text-[8px] font-extrabold px-1 py-0.2 rounded bg-cyan-500 text-slate-950 uppercase shrink-0 shadow-sm animate-pulse">
                            LIVE
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-cyan-500 text-black flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span className="text-[8px] text-slate-300/90 leading-tight drop-shadow truncate">
                      {w.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Image URL Option */}
            <div className="pt-1 flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Or paste custom image URL..."
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                className="flex-1 bg-[#050912] border border-[#172a45] rounded px-2 py-1 text-[10px] text-slate-200 outline-none font-mono-code focus:border-cyan-400"
              />
              <button
                onClick={() => {
                  if (customUrlInput.trim()) {
                    onChange({
                      ...customization,
                      wallpaper: 'custom',
                      customWallpaperUrl: customUrlInput.trim()
                    });
                  }
                }}
                className="px-2 py-1 rounded bg-[#0e3a6a] hover:bg-[#154c86] text-cyan-200 text-[10px] font-medium border border-cyan-500/30"
              >
                Apply URL
              </button>
            </div>
          </div>

          {/* 2. Accent Color Theme */}
          <div className="space-y-2 pt-2 border-t border-[#142338]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span>Accent Color Theme</span>
              </span>
              <span className="text-[10px] text-slate-400">
                {ACCENT_THEMES[customization.accentColor].name}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(ACCENT_THEMES) as AccentColor[]).map((cKey) => {
                const theme = ACCENT_THEMES[cKey];
                const isSelected = customization.accentColor === cKey;
                return (
                  <button
                    key={cKey}
                    onClick={() => onChange({ ...customization, accentColor: cKey })}
                    className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-white bg-[#101e35] shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                        : 'border-[#172a45] bg-[#070c16] hover:bg-[#0c1524]'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full mb-1 flex items-center justify-center border border-white/20"
                      style={{ backgroundColor: theme.hex }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-black stroke-[3]" />}
                    </span>
                    <span className="text-[9px] text-slate-300 font-medium truncate w-full text-center">
                      {theme.name.split(' ')[1] || theme.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Phone & Desktop Icon Layout */}
          <div className="space-y-2 pt-2 border-t border-[#142338]">
            <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
              <Layout className="w-3.5 h-3.5" />
              <span>Desktop Icons & Dock Style</span>
            </span>

            <div className="grid grid-cols-3 gap-2 text-[10px]">
              {(
                [
                  { id: 'grid', label: 'Classic Grid', desc: 'Top-left PC icons' },
                  { id: 'dock', label: 'Floating Dock', desc: 'Bottom centered dock' },
                  { id: 'minimal', label: 'Pure Minimal', desc: 'Clean taskbar only' }
                ] as const
              ).map((mode) => {
                const isSelected = customization.desktopLayout === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => onChange({ ...customization, desktopLayout: mode.id as DesktopLayout })}
                    className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-[#0e3a6a] border-cyan-400 text-white'
                        : 'bg-[#070c16] border-[#172a45] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-semibold text-slate-100">{mode.label}</span>
                    <span className="text-[8px] opacity-80">{mode.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Window Glassmorphism & Node Link Wires */}
          <div className="space-y-2 pt-2 border-t border-[#142338]">
            <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Window Experience</span>
            </span>

            <div className="flex items-center justify-between p-2 rounded bg-[#060a12] border border-[#172a45]">
              <div>
                <div className="text-[11px] font-medium text-slate-200">Parent-Child Node Link Wires</div>
                <div className="text-[9px] text-slate-400">Curved bezier lines linking parent and child popups</div>
              </div>
              <button
                onClick={() => onChange({ ...customization, showNodeWires: !customization.showNodeWires })}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                  customization.showNodeWires ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    customization.showNodeWires ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#060a12] border border-[#172a45]">
              <div>
                <div className="text-[11px] font-medium text-slate-200">Phone Touch Window Snapping</div>
                <div className="text-[9px] text-slate-400">Optimizes floating windows for one-handed phone use</div>
              </div>
              <button
                onClick={() =>
                  onChange({ ...customization, phoneCompactMode: !customization.phoneCompactMode })
                }
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                  customization.phoneCompactMode ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    customization.phoneCompactMode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 px-3 bg-[#0c1524] border-t border-[#172a45] flex items-center justify-between shrink-0">
          <button
            onClick={() => onChange(DEFAULT_CUSTOMIZATION)}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#0077d4] hover:bg-[#0088f0] text-white text-[11px] font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
