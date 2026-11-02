import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  User,
  Smile,
  Scissors,
  Shirt,
  Palette,
  RotateCcw,
  Save,
  Download,
  Dices,
  Check,
  ChevronRight,
  Sliders,
  Layers,
  ShoppingBag,
  Undo2,
  Redo2
} from 'lucide-react';
import { AvatarParameters, AVATAR_PRESETS } from '../types/avatar';
import { FileManagerService } from '../services/fileManager';

interface AvatarEditorProps {
  params: AvatarParameters;
  onChange: (newParams: AvatarParameters) => void;
  onSaveToFile?: (filename: string) => void;
  onClose?: () => void;
  onOpenColorPicker?: (targetProp: keyof AvatarParameters, targetLabel: string) => void;
  onOpenAssetBrowser?: () => void;
}

export const AvatarEditor: React.FC<AvatarEditorProps> = ({
  params,
  onChange,
  onSaveToFile,
  onClose,
  onOpenColorPicker,
  onOpenAssetBrowser
}) => {
  const [activeCategory, setActiveCategory] = useState<'body' | 'face' | 'hair' | 'outfit' | 'colors' | 'presets'>('body');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveName, setSaveName] = useState('Vessel_custom.vrm');

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<AvatarParameters[]>([]);
  const [redoStack, setRedoStack] = useState<AvatarParameters[]>([]);

  // Push history before updating params
  const pushHistoryState = (currentParams: AvatarParameters) => {
    setUndoStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(currentParams))]);
    setRedoStack([]);
  };

  const updateParam = <K extends keyof AvatarParameters>(key: K, value: AvatarParameters[K]) => {
    pushHistoryState(params);
    onChange({
      ...params,
      [key]: value
    });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevParams = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(params))]);
    onChange(prevParams);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextParams = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(params))]);
    onChange(nextParams);
  };

  // Keyboard shortcut listener for Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, params]);

  // Color Swatch Presets
  const skinPresets = ['#ffe0bd', '#ffd3b6', '#f5c6a5', '#eac0a2', '#c68642', '#8d5524', '#3d2314', '#e2f3ff'];
  const hairPresets = ['#6bb5f8', '#38bdf8', '#c084fc', '#f472b6', '#fbbf24', '#34d399', '#f87171', '#1e293b', '#f1f5f9'];
  const eyePresets = ['#1d4ed8', '#0284c7', '#9333ea', '#ec4899', '#059669', '#d97706', '#dc2626', '#334155'];
  const neonPresets = ['#38bdf8', '#22c55e', '#a855f7', '#fb7185', '#fbbf24', '#06b6d4'];

  // Randomize Avatar
  const handleRandomize = () => {
    pushHistoryState(params);

    const randomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const randomRange = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

    const randomized: AvatarParameters = {
      height: randomRange(0.85, 1.2),
      headScale: randomRange(0.9, 1.15),
      bustSize: randomRange(0.7, 1.45),
      shoulderWidth: randomRange(0.85, 1.2),
      waistWidth: randomRange(0.8, 1.2),
      hipWidth: randomRange(0.85, 1.3),
      legLength: randomRange(0.85, 1.25),
      armThickness: randomRange(0.85, 1.2),

      eyeScale: randomRange(0.8, 1.3),
      eyeSpacing: randomRange(-0.02, 0.02),
      chinWidth: randomRange(0.85, 1.15),
      earSize: randomRange(0.7, 1.4),

      skinColor: randomItem(skinPresets),
      hairColor: randomItem(hairPresets),
      hairHighlightColor: randomItem(hairPresets),
      eyeColor: randomItem(eyePresets),
      coatColor: randomItem(['#121b2d', '#1e1b4b', '#3b0764', '#0f172a', '#3f3f46']),
      innerColor: randomItem(['#f1f5f9', '#ffffff', '#020617', '#fae8ff']),
      accentNeonColor: randomItem(neonPresets),
      bootsColor: randomItem(['#0f172a', '#1e293b', '#2e1065', '#450a0a']),

      hairstyle: randomItem(['twintails', 'bobcut', 'longwaves', 'spiky', 'ponytail', 'short']),
      accessory: randomItem(['cat_ears', 'kitsune', 'elf_ears', 'cyber_horns', 'headphones', 'none']),
      outfit: randomItem(['cyber_jacket', 'mmo_tunic', 'school_uniform', 'combat_suit', 'hoodie']),
      expression: randomItem(['neutral', 'smile', 'wink', 'fierce', 'surprised'])
    };

    onChange(randomized);
  };

  const handleSave = () => {
    const fs = FileManagerService.getInstance();
    const cleanName = saveName.endsWith('.vrm') || saveName.endsWith('.json') ? saveName : `${saveName}.vrm`;
    const avatarConfigContent = JSON.stringify(
      {
        format: 'VRM/AlchemiaCustomCast',
        version: '1.0',
        savedAt: new Date().toISOString(),
        parameters: params
      },
      null,
      2
    );

    fs.createFile('/storage/emulated/0/Projects/Chimera/VRM_Models', cleanName, 'VRM', avatarConfigContent);
    if (onSaveToFile) onSaveToFile(cleanName);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Full VRM File Serialization & Direct Browser Download Export Function
  const handleExportVrmDownload = () => {
    const cleanName = saveName.endsWith('.vrm')
      ? saveName
      : `${saveName.replace(/\.[^/.]+$/, '')}.vrm`;

    const vrmExportData = {
      asset: {
        version: '2.0',
        generator: 'Savage VRM Studio 2026 Engine'
      },
      extensionsUsed: ['VRMC_vrm', 'VRMC_materials_mtoon'],
      extensions: {
        VRMC_vrm: {
          specVersion: '1.0',
          meta: {
            name: cleanName.replace('.vrm', ''),
            authors: ['Savage VRM Studio User'],
            avatarPermission: 'everyone',
            allowExcessivelyViolentUsage: true,
            allowExcessivelySexualUsage: true,
            commercialUsage: 'personalUse',
            version: '1.0'
          },
          humanoid: {
            humanBones: {
              hips: { node: 0 },
              spine: { node: 1 },
              chest: { node: 2 },
              neck: { node: 3 },
              head: { node: 4 },
              leftUpperArm: { node: 5 },
              rightUpperArm: { node: 6 },
              leftLowerArm: { node: 7 },
              rightLowerArm: { node: 8 },
              leftUpperLeg: { node: 9 },
              rightUpperLeg: { node: 10 },
              leftLowerLeg: { node: 11 },
              rightLowerLeg: { node: 12 }
            }
          },
          avatarParameters: params,
          exportedAt: new Date().toISOString()
        }
      }
    };

    const fs = FileManagerService.getInstance();
    fs.createFile(
      '/storage/emulated/0/Projects/Chimera/VRM_Models',
      cleanName,
      'VRM',
      JSON.stringify(vrmExportData, null, 2)
    );
    if (onSaveToFile) onSaveToFile(cleanName);

    // Direct Browser Download
    const blob = new Blob([JSON.stringify(vrmExportData, null, 2)], {
      type: 'model/gltf+json'
    });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = cleanName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#080c14] border border-[#172a45] rounded-sm overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="h-8 bg-[#0b111e] border-b border-[#172a45] flex items-center justify-between px-2.5 shrink-0 z-10">
        <div className="flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span className="font-semibold text-slate-100 tracking-tight text-xs">
            VRM Avatar Editor
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#0e3a6a] text-[#38bdf8] font-mono-code border border-[#38bdf8]/40">
            Alchemia & CustomCast
          </span>
        </div>

        {/* Quick Actions & Undo/Redo */}
        <div className="flex items-center space-x-1">
          {onOpenAssetBrowser && (
            <button
              onClick={onOpenAssetBrowser}
              className="px-2 py-0.5 rounded bg-[#0e3a6a] hover:bg-[#154c86] text-cyan-300 border border-[#38bdf8]/40 text-[10px] flex items-center gap-1 transition-colors font-medium mr-1"
              title="Open Asset Gallery Window"
            >
              <ShoppingBag className="w-3 h-3 text-[#38bdf8]" />
              <span>Asset Gallery</span>
            </button>
          )}

          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className={`p-1 rounded border transition-colors ${
              undoStack.length > 0
                ? 'bg-[#0d1627] hover:bg-[#162744] text-slate-300 hover:text-[#38bdf8] border-[#172a45]'
                : 'bg-[#070b13] text-slate-600 border-[#101c2e] cursor-not-allowed'
            }`}
            title="Undo Parameter Change (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className={`p-1 rounded border transition-colors ${
              redoStack.length > 0
                ? 'bg-[#0d1627] hover:bg-[#162744] text-slate-300 hover:text-[#38bdf8] border-[#172a45]'
                : 'bg-[#070b13] text-slate-600 border-[#101c2e] cursor-not-allowed'
            }`}
            title="Redo Parameter Change (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleRandomize}
            className="p-1 rounded bg-[#0d1627] hover:bg-[#162744] text-slate-300 hover:text-[#38bdf8] border border-[#172a45] transition-colors"
            title="Randomize Character"
          >
            <Dices className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center bg-[#090e18] border-b border-[#172a45] p-1 gap-1 overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'body', label: 'Body', icon: User },
          { id: 'face', label: 'Face', icon: Smile },
          { id: 'hair', label: 'Hair', icon: Scissors },
          { id: 'outfit', label: 'Outfit', icon: Shirt },
          { id: 'colors', label: 'Colors', icon: Palette },
          { id: 'presets', label: 'Presets', icon: Layers },
        ].map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`flex items-center gap-1 py-1 px-2 rounded text-[11px] font-medium transition-all shrink-0 ${
                isActive
                  ? 'bg-[#0e3a6a] text-white border border-[#38bdf8]/50 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1729]'
              }`}
            >
              <Icon className="w-3 h-3 text-[#38bdf8]" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Body Content */}
      <div className="flex-1 p-2.5 overflow-y-auto space-y-3 bg-[#070b13]">
        {/* BODY SLIDERS */}
        {activeCategory === 'body' && (
          <div className="space-y-2.5">
            <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>Proportions & Skeletal Morphs</span>
              <span className="font-mono-code text-[#38bdf8] text-[10px]">
                {(params.height * 160).toFixed(0)} cm
              </span>
            </div>

            {[
              { label: 'Overall Height', key: 'height', min: 0.8, max: 1.25, step: 0.01 },
              { label: 'Head Proportions', key: 'headScale', min: 0.85, max: 1.2, step: 0.01 },
              { label: 'Chest / Bust Size', key: 'bustSize', min: 0.6, max: 1.6, step: 0.01 },
              { label: 'Shoulder Width', key: 'shoulderWidth', min: 0.8, max: 1.3, step: 0.01 },
              { label: 'Waist Width', key: 'waistWidth', min: 0.7, max: 1.3, step: 0.01 },
              { label: 'Hip Width', key: 'hipWidth', min: 0.8, max: 1.4, step: 0.01 },
              { label: 'Leg Length', key: 'legLength', min: 0.8, max: 1.3, step: 0.01 },
              { label: 'Arm Thickness', key: 'armThickness', min: 0.8, max: 1.3, step: 0.01 },
            ].map((slider) => (
              <div key={slider.key} className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{slider.label}</span>
                  <span className="font-mono-code text-slate-200">
                    {(params as any)[slider.key].toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={(params as any)[slider.key]}
                  onChange={(e) => updateParam(slider.key as any, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#172a45] rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                />
              </div>
            ))}
          </div>
        )}

        {/* FACE & EXPRESSION */}
        {activeCategory === 'face' && (
          <div className="space-y-3">
            {/* Expression Switcher */}
            <div>
              <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Facial Expression</div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'neutral', label: 'Neutral' },
                  { id: 'smile', label: 'Smile' },
                  { id: 'wink', label: 'Wink' },
                  { id: 'fierce', label: 'Fierce' },
                  { id: 'surprised', label: 'Surprised' },
                ].map((expr) => (
                  <button
                    key={expr.id}
                    onClick={() => updateParam('expression', expr.id as any)}
                    className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition-colors ${
                      params.expression === expr.id
                        ? 'bg-[#0e3a6a] text-white border-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                        : 'bg-[#0b1220] text-slate-400 border-[#172a45] hover:text-white'
                    }`}
                  >
                    {expr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Face sliders */}
            <div className="space-y-2 pt-2 border-t border-[#172a45]">
              <div className="text-[11px] font-semibold text-slate-300">Feature Scaling</div>
              {[
                { label: 'Anime Eye Scale', key: 'eyeScale', min: 0.7, max: 1.4, step: 0.01 },
                { label: 'Eye Spacing', key: 'eyeSpacing', min: -0.03, max: 0.03, step: 0.002 },
                { label: 'Chin & Jaw Width', key: 'chinWidth', min: 0.8, max: 1.2, step: 0.01 },
                { label: 'Ear / Accessory Size', key: 'earSize', min: 0.6, max: 1.5, step: 0.02 },
              ].map((slider) => (
                <div key={slider.key} className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{slider.label}</span>
                    <span className="font-mono-code text-slate-200">
                      {(params as any)[slider.key].toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={(params as any)[slider.key]}
                    onChange={(e) => updateParam(slider.key as any, parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#172a45] rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HAIR & STYLES */}
        {activeCategory === 'hair' && (
          <div className="space-y-3">
            <div>
              <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Hairstyle Preset</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'twintails', label: 'Twin Tails (Vessel)' },
                  { id: 'bobcut', label: 'Cute Bob Cut' },
                  { id: 'longwaves', label: 'Long Waves (MMO)' },
                  { id: 'spiky', label: 'Cyber Spiky' },
                  { id: 'ponytail', label: 'High Ponytail' },
                  { id: 'short', label: 'Short Crop' },
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => updateParam('hairstyle', style.id as any)}
                    className={`py-1.5 px-2 rounded text-[11px] font-medium border text-left flex items-center justify-between transition-colors ${
                      params.hairstyle === style.id
                        ? 'bg-[#0e3a6a] text-white border-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                        : 'bg-[#0b1220] text-slate-400 border-[#172a45] hover:text-white'
                    }`}
                  >
                    <span className="truncate">{style.label}</span>
                    {params.hairstyle === style.id && <Check className="w-3 h-3 text-[#38bdf8] shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Hair Color */}
            <div className="space-y-2 pt-2 border-t border-[#172a45]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">Base Hair Tone</span>
                {onOpenColorPicker && (
                  <button
                    onClick={() => onOpenColorPicker('hairColor', 'Hair Color Studio')}
                    className="px-1.5 py-0.5 rounded bg-[#0e3a6a] hover:bg-[#154c86] text-cyan-300 border border-cyan-500/40 text-[9px] flex items-center gap-1 transition-colors"
                  >
                    <Palette className="w-2.5 h-2.5" />
                    <span>Color Studio ⤹</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hairPresets.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateParam('hairColor', c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border transition-transform ${
                      params.hairColor === c ? 'scale-120 border-white ring-2 ring-[#38bdf8]' : 'border-white/20'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={params.hairColor}
                  onChange={(e) => updateParam('hairColor', e.target.value)}
                  className="w-6 h-6 rounded-full cursor-pointer bg-transparent border-0"
                  title="Custom Color"
                />
              </div>
            </div>

            {/* Hair Highlights */}
            <div className="space-y-2 pt-2 border-t border-[#172a45]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300">Highlights & Gradient Tips</span>
                {onOpenColorPicker && (
                  <button
                    onClick={() => onOpenColorPicker('hairHighlightColor', 'Highlight Color Studio')}
                    className="px-1.5 py-0.5 rounded bg-[#0e3a6a] hover:bg-[#154c86] text-cyan-300 border border-cyan-500/40 text-[9px] flex items-center gap-1 transition-colors"
                  >
                    <Palette className="w-2.5 h-2.5" />
                    <span>Color Studio ⤹</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hairPresets.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateParam('hairHighlightColor', c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border transition-transform ${
                      params.hairHighlightColor === c ? 'scale-120 border-white ring-2 ring-pink-400' : 'border-white/20'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={params.hairHighlightColor}
                  onChange={(e) => updateParam('hairHighlightColor', e.target.value)}
                  className="w-6 h-6 rounded-full cursor-pointer bg-transparent border-0"
                  title="Custom Highlight Color"
                />
              </div>
            </div>
          </div>
        )}

        {/* OUTFIT & ACCESSORIES */}
        {activeCategory === 'outfit' && (
          <div className="space-y-3">
            {/* Asset Gallery Launcher Banner */}
            {onOpenAssetBrowser && (
              <div
                onClick={onOpenAssetBrowser}
                className="p-2.5 rounded bg-gradient-to-r from-[#0c2340] to-[#0a182d] border border-[#38bdf8]/40 hover:border-[#38bdf8] cursor-pointer transition-all flex items-center justify-between group shadow-[0_0_12px_rgba(56,189,248,0.15)]"
              >
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded bg-[#0e3a6a] text-[#38bdf8] border border-[#38bdf8]/40 group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-100 text-[11px] flex items-center gap-1">
                      <span>Open Asset Gallery</span>
                      <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                    </div>
                    <div className="text-[9px] text-slate-400">
                      Browse gallery of costumes, ears, horns, hairstyles & color themes
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#38bdf8] group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}

            {/* Outfits */}
            <div>
              <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Wardrobe</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'cyber_jacket', label: 'Cyber Jacket & Shorts' },
                  { id: 'mmo_tunic', label: 'Alchemia Sorcery Robe' },
                  { id: 'school_uniform', label: 'Custom Cast Uniform' },
                  { id: 'combat_suit', label: 'Vanguard Exosuit' },
                  { id: 'hoodie', label: 'Street Tech Hoodie' },
                ].map((outfit) => (
                  <button
                    key={outfit.id}
                    onClick={() => updateParam('outfit', outfit.id as any)}
                    className={`py-1.5 px-2 rounded text-[11px] font-medium border text-left flex items-center justify-between transition-colors ${
                      params.outfit === outfit.id
                        ? 'bg-[#0e3a6a] text-white border-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                        : 'bg-[#0b1220] text-slate-400 border-[#172a45] hover:text-white'
                    }`}
                  >
                    <span className="truncate">{outfit.label}</span>
                    {params.outfit === outfit.id && <Check className="w-3 h-3 text-[#38bdf8] shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Accessories / Ears */}
            <div className="pt-2 border-t border-[#172a45]">
              <div className="text-[11px] font-semibold text-slate-300 mb-1.5">Headwear & Ears</div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'cat_ears', label: 'Cat Ears' },
                  { id: 'kitsune', label: 'Fox Ears' },
                  { id: 'elf_ears', label: 'Elf Ears' },
                  { id: 'cyber_horns', label: 'Cyber Horns' },
                  { id: 'headphones', label: 'Headphones' },
                  { id: 'none', label: 'None' },
                ].map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => updateParam('accessory', acc.id as any)}
                    className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-colors ${
                      params.accessory === acc.id
                        ? 'bg-[#0e3a6a] text-white border-[#38bdf8]'
                        : 'bg-[#0b1220] text-slate-400 border-[#172a45] hover:text-white'
                    }`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors for Outfit */}
            <div className="space-y-2 pt-2 border-t border-[#172a45]">
              <div className="text-[11px] font-semibold text-slate-300">Outfit Shading</div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 rounded bg-[#0b1220] border border-[#172a45] flex items-center justify-between">
                  <span>Jacket Coat</span>
                  <input
                    type="color"
                    value={params.coatColor}
                    onChange={(e) => updateParam('coatColor', e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
                <div className="p-2 rounded bg-[#0b1220] border border-[#172a45] flex items-center justify-between">
                  <span>Inner Top</span>
                  <input
                    type="color"
                    value={params.innerColor}
                    onChange={(e) => updateParam('innerColor', e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
                <div className="p-2 rounded bg-[#0b1220] border border-[#172a45] flex items-center justify-between">
                  <span>Boots / Shoes</span>
                  <input
                    type="color"
                    value={params.bootsColor}
                    onChange={(e) => updateParam('bootsColor', e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
                <div className="p-2 rounded bg-[#0b1220] border border-[#172a45] flex items-center justify-between">
                  <span>Neon Emission</span>
                  <input
                    type="color"
                    value={params.accentNeonColor}
                    onChange={(e) => updateParam('accentNeonColor', e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COLORS PALETTE MASTER */}
        {activeCategory === 'colors' && (
          <div className="space-y-3">
            {/* Skin Tone */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-300">Skin Tone</div>
              <div className="flex flex-wrap gap-1.5">
                {skinPresets.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateParam('skinColor', c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border transition-transform ${
                      params.skinColor === c ? 'scale-120 border-white ring-2 ring-[#38bdf8]' : 'border-white/20'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={params.skinColor}
                  onChange={(e) => updateParam('skinColor', e.target.value)}
                  className="w-6 h-6 rounded-full cursor-pointer bg-transparent border-0"
                />
              </div>
            </div>

            {/* Eye Iris Color */}
            <div className="space-y-1.5 pt-2 border-t border-[#172a45]">
              <div className="text-[11px] font-semibold text-slate-300">Eye Iris Color</div>
              <div className="flex flex-wrap gap-1.5">
                {eyePresets.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateParam('eyeColor', c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border transition-transform ${
                      params.eyeColor === c ? 'scale-120 border-white ring-2 ring-[#38bdf8]' : 'border-white/20'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={params.eyeColor}
                  onChange={(e) => updateParam('eyeColor', e.target.value)}
                  className="w-6 h-6 rounded-full cursor-pointer bg-transparent border-0"
                />
              </div>
            </div>

            {/* Neon Glow */}
            <div className="space-y-1.5 pt-2 border-t border-[#172a45]">
              <div className="text-[11px] font-semibold text-slate-300">Cyber Neon Emission Glow</div>
              <div className="flex flex-wrap gap-1.5">
                {neonPresets.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateParam('accentNeonColor', c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border transition-transform ${
                      params.accentNeonColor === c ? 'scale-120 border-white ring-2 ring-cyan-400' : 'border-white/20'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={params.accentNeonColor}
                  onChange={(e) => updateParam('accentNeonColor', e.target.value)}
                  className="w-6 h-6 rounded-full cursor-pointer bg-transparent border-0"
                />
              </div>
            </div>
          </div>
        )}

        {/* PRESETS & SAVE */}
        {activeCategory === 'presets' && (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold text-slate-300">Archetype Presets</div>
            <div className="space-y-1.5">
              {AVATAR_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => {
                    pushHistoryState(params);
                    onChange(preset.params);
                  }}
                  className="p-2 rounded bg-[#0b1220] hover:bg-[#121e35] border border-[#172a45] hover:border-[#38bdf8]/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100 text-[11px]">{preset.name}</span>
                    <span className="text-[9px] px-1 rounded bg-[#0e3a6a] text-[#38bdf8] font-mono-code">
                      {preset.origin}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</div>
                </div>
              ))}
            </div>

            {/* File Save Bar */}
            <div className="p-2.5 rounded bg-[#090f1d] border border-[#172a45] space-y-2 pt-2">
              <div className="text-[11px] font-semibold text-slate-200">Save & Export VRM File</div>
              <div className="flex items-center bg-[#060a12] border border-[#172a45] rounded overflow-hidden">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="flex-1 bg-transparent px-2 py-1 text-[11px] text-slate-200 font-mono-code outline-none"
                  placeholder="avatar_custom.vrm"
                />
                <button
                  onClick={handleSave}
                  className="px-2 py-1 bg-[#0e3a6a] hover:bg-[#154c86] text-[#38bdf8] font-medium flex items-center gap-1 transition-colors text-[10px] border-r border-[#172a45]"
                >
                  {saveSuccess ? <Check className="w-3 h-3 text-emerald-400" /> : <Save className="w-3 h-3" />}
                  <span>Save</span>
                </button>
                <button
                  onClick={handleExportVrmDownload}
                  className="px-2 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium flex items-center gap-1 transition-colors text-[10px]"
                  title="Serialize and download as .vrm file"
                >
                  <Download className="w-3 h-3 text-white" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="h-10 bg-[#090e18] border-t border-[#172a45] px-2.5 flex items-center justify-between shrink-0">
        <button
          onClick={() => {
            pushHistoryState(params);
            onChange(AVATAR_PRESETS[0].params);
          }}
          className="px-2 py-1 rounded bg-[#0b1220] hover:bg-[#15233a] border border-[#172a45] text-slate-400 hover:text-white flex items-center gap-1 text-[10px] transition-colors"
          title="Reset Parameters to Default"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Reset</span>
        </button>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleSave}
            className="px-2 py-1 rounded bg-[#0b1220] hover:bg-[#15233a] text-slate-300 border border-[#172a45] font-medium flex items-center gap-1 text-[10px] transition-colors"
            title="Save to local project storage"
          >
            {saveSuccess ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Save className="w-2.5 h-2.5" />}
            <span>Save</span>
          </button>

          <button
            onClick={handleExportVrmDownload}
            className="px-2.5 py-1 rounded bg-[#0077d4] hover:bg-[#0088f4] text-white font-medium flex items-center gap-1 text-[10px] shadow-[0_0_8px_rgba(0,119,212,0.4)] transition-colors"
            title="Export & Download .vrm avatar file"
          >
            <Download className="w-2.5 h-2.5" />
            <span>{saveSuccess ? 'Exported!' : 'Export .VRM'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
