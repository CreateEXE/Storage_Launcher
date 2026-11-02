import React, { useState } from 'react';
import { Palette, Check, Sparkles, Sliders } from 'lucide-react';
import { AvatarParameters } from '../types/avatar';

interface ColorPickerWindowProps {
  targetProp: keyof AvatarParameters;
  targetLabel: string;
  avatarParams: AvatarParameters;
  onChangeColor: (prop: keyof AvatarParameters, color: string) => void;
}

export const ColorPickerWindow: React.FC<ColorPickerWindowProps> = ({
  targetProp,
  targetLabel,
  avatarParams,
  onChangeColor
}) => {
  const currentColor = String((avatarParams as any)[targetProp] || '#6bb5f8');
  const [selectedHex, setSelectedHex] = useState(currentColor);

  const curatedPalettes: { name: string; colors: string[] }[] = [
    {
      name: 'Anime & Cyberpunk',
      colors: ['#6bb5f8', '#38bdf8', '#00f0ff', '#f472b6', '#ec4899', '#c084fc', '#a855f7', '#22c55e']
    },
    {
      name: 'Natural Hair & Skin',
      colors: ['#ffe0bd', '#ffd3b6', '#eac0a2', '#c68642', '#8d5524', '#3d2314', '#1e293b', '#fbbf24', '#dc2626']
    },
    {
      name: 'MMO Fantasy Metallics',
      colors: ['#ffffff', '#f1f5f9', '#94a3b8', '#334155', '#0f172a', '#e2b342', '#c0c0c0', '#4a0404']
    }
  ];

  const handleSelect = (color: string) => {
    setSelectedHex(color);
    onChangeColor(targetProp, color);
  };

  return (
    <div className="flex flex-col h-full bg-[#080c14] text-xs select-none">
      {/* Target Title */}
      <div className="p-2 bg-[#0b1220] border-b border-[#172a45] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Palette className="w-4 h-4 text-[#38bdf8]" />
          <div>
            <div className="font-semibold text-slate-100">{targetLabel}</div>
            <div className="text-[10px] text-slate-400 font-mono-code">{selectedHex.toUpperCase()}</div>
          </div>
        </div>

        {/* Live Swatch Preview */}
        <div
          className="w-7 h-7 rounded border border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.2)]"
          style={{ backgroundColor: selectedHex }}
        />
      </div>

      {/* Hex & Native Picker Input */}
      <div className="p-2.5 bg-[#090e19] border-b border-[#172a45] flex items-center space-x-2">
        <input
          type="color"
          value={selectedHex}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
          title="Pick color"
        />
        <div className="flex-1 flex items-center bg-[#060a12] border border-[#172a45] rounded px-2 py-1 font-mono-code">
          <span className="text-slate-500 mr-1">HEX</span>
          <input
            type="text"
            value={selectedHex}
            onChange={(e) => handleSelect(e.target.value)}
            className="flex-1 bg-transparent text-slate-200 outline-none uppercase text-xs"
          />
        </div>
      </div>

      {/* Curated Swatch Palettes */}
      <div className="flex-1 p-2.5 overflow-y-auto space-y-3 bg-[#070b13]">
        {curatedPalettes.map((palette) => (
          <div key={palette.name} className="space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {palette.name}
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {palette.colors.map((c) => {
                const isSelected = selectedHex.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    onClick={() => handleSelect(c)}
                    style={{ backgroundColor: c }}
                    className={`h-6 rounded border transition-transform flex items-center justify-center ${
                      isSelected
                        ? 'scale-110 border-white ring-2 ring-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                        : 'border-white/10 hover:border-white/40'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
