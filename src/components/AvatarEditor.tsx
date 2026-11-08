import React, { useState, useEffect, useMemo } from 'react';
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
  Redo2,
  FolderOpen,
  ListChecks,
  AlertCircle
} from 'lucide-react';
import { AvatarParameters, AVATAR_PRESETS, DEFAULT_AVATAR_PARAMS, getExpressionBlends, EXPRESSION_VRM_NAME, EXPRESSION_EDITOR_ID, normalizeAvatarParams } from '../types/avatar';
import { FileManagerService } from '../services/fileManager';
import {
  EDITOR_CONTROLS,
  controlStatus,
  type MorphControlDef,
  type MorphMapSummary,
} from '../services/vrmMorphMap';
import { exportCurrentModelAsGlb } from '../services/modelExport';

const PRESET_DIR = '/storage/emulated/0/Projects/Chimera/VRM_Models';
const PRESET_EXT = '.avatar.json';

interface AvatarEditorProps {
  params: AvatarParameters;
  onChange: (newParams: AvatarParameters) => void;
  /** Verified morph map for the model loaded in the 3D viewer (via App). */
  morphMap?: MorphMapSummary | null;
  onSaveToFile?: (filename: string) => void;
  onClose?: () => void;
  onOpenColorPicker?: (targetProp: keyof AvatarParameters, targetLabel: string) => void;
  onOpenAssetBrowser?: () => void;
}

type Category = 'body' | 'face' | 'hair' | 'outfit' | 'colors' | 'presets' | 'mapping';

export const AvatarEditor: React.FC<AvatarEditorProps> = ({
  params,
  onChange,
  morphMap = null,
  onSaveToFile,
  onClose,
  onOpenColorPicker,
  onOpenAssetBrowser
}) => {
  const [activeCategory, setActiveCategory] = useState<Category>('body');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveName, setSaveName] = useState('Vessel_custom');
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [savedPresets, setSavedPresets] = useState<Array<{ name: string; path: string }>>([]);

  // Defensive merge: presets saved before new sliders existed (armLength,
  // legThickness, browRaise, mouthOpen) load without those keys. Also
  // derives expressionBlends from the legacy single-choice `expression`
  // when an old preset has no blend map.
  const safeParams: AvatarParameters = useMemo(
    () => normalizeAvatarParams(params),
    [params]
  );

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<AvatarParameters[]>([]);
  const [redoStack, setRedoStack] = useState<AvatarParameters[]>([]);

  // Push history before updating params
  const pushHistoryState = (currentParams: AvatarParameters) => {
    setUndoStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(currentParams))]);
    setRedoStack([]);
  };

  // Live (drag) updates: slider drags update the model on every tick but
  // must NOT push a history entry per tick, or one drag fills the whole
  // 30-deep stack and undo steps through a single drag. The pre-drag
  // params are captured once as the baseline; commitDrag() pushes that
  // single baseline when the drag ends, so one drag = one undo step.
  const dragBaselineRef = React.useRef<AvatarParameters | null>(null);
  const updateParamLive = <K extends keyof AvatarParameters>(key: K, value: AvatarParameters[K]) => {
    if (!dragBaselineRef.current) dragBaselineRef.current = params;
    onChange({
      ...params,
      [key]: value
    });
  };
  const commitDrag = () => {
    if (dragBaselineRef.current) {
      pushHistoryState(dragBaselineRef.current);
      dragBaselineRef.current = null;
    }
  };

  const updateParam = <K extends keyof AvatarParameters>(key: K, value: AvatarParameters[K]) => {
    pushHistoryState(params);
    onChange({
      ...params,
      [key]: value
    });
  };

  // The expression choice sets the whole blend map, not just the legacy
  // single-choice field: choosing a preset means that preset at full
  // weight (0.85 for 'fierce', matching the old single-preset weight) and
  // nothing else; 'neutral' clears all blends.
  const handleExpressionChoice = (choiceId: AvatarParameters['expression']) => {
    pushHistoryState(params);
    onChange({
      ...params,
      expression: choiceId,
      expressionBlends:
        choiceId === 'neutral'
          ? {}
          : { [EXPRESSION_VRM_NAME[choiceId]]: choiceId === 'fierce' ? 0.85 : 1 },
    });
  };

  // Which editor expression the choice group should highlight: the preset
  // with the highest active blend weight. A blend the bar set directly
  // (e.g. 'sad') has no editor id, so nothing highlights — honest, not a
  // wrong highlight.
  const effectiveBlends = useMemo(() => getExpressionBlends(safeParams), [safeParams]);
  const currentExpressionId: AvatarParameters['expression'] | undefined = useMemo(() => {
    const entries = Object.entries(effectiveBlends);
    if (entries.length === 0) return 'neutral';
    entries.sort((a, b) => b[1] - a[1]);
    return EXPRESSION_EDITOR_ID[entries[0][0]];
  }, [effectiveBlends]);

  // Reset one category (body / face / hair / outfit / colors) to defaults.
  // Face also clears the expression blend map.
  const resetCategory = (section: string) => {
    pushHistoryState(params);
    const next: AvatarParameters = { ...params };
    for (const def of EDITOR_CONTROLS) {
      if (def.section !== section) continue;
      (next as unknown as Record<string, unknown>)[def.id] =
        DEFAULT_AVATAR_PARAMS[def.id as keyof AvatarParameters];
    }
    if (section === 'face') next.expressionBlends = {};
    onChange(next);
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

  const statusOf = (id: string) => controlStatus(morphMap, id);
  const verifiedCount = morphMap?.controls.filter((c) => c.status === 'verified').length ?? 0;
  const unavailableCount = morphMap?.controls.filter((c) => c.status === 'unavailable').length ?? 0;

  // Randomize — only controls verified on the loaded model. Randomizing an
  // unverified slider would be pointless: it has no effect on this model.
  const handleRandomize = () => {
    pushHistoryState(params);

    const randomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const randomRange = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

    const randomized: AvatarParameters = { ...safeParams };
    for (const def of EDITOR_CONTROLS) {
      if (statusOf(def.id).status !== 'verified') continue;
      if (def.kind === 'slider' && def.min !== undefined && def.max !== undefined) {
        (randomized as unknown as Record<string, unknown>)[def.id] = randomRange(def.min, def.max);
      } else if (def.kind === 'color') {
        const pool =
          def.id === 'skinColor' ? skinPresets
          : def.id === 'eyeColor' ? eyePresets
          : def.id === 'accentNeonColor' ? neonPresets
          : hairPresets;
        (randomized as unknown as Record<string, unknown>)[def.id] = randomItem(pool);
      } else if (def.kind === 'choice' && def.choices) {
        (randomized as unknown as Record<string, unknown>)[def.id] = randomItem(def.choices).id;
      }
    }
    // The randomized single-choice expression must match the blend map,
    // or the old explicit blends would win and the new choice would do
    // nothing.
    randomized.expressionBlends =
      randomized.expression === 'neutral'
        ? {}
        : { [EXPRESSION_VRM_NAME[randomized.expression]]: randomized.expression === 'fierce' ? 0.85 : 1 };

    onChange(randomized);
  };

  // -- Named preset persistence (FileManager / localStorage) -----------------
  const refreshSavedPresets = () => {
    try {
      const fs = FileManagerService.getInstance();
      const files = fs.getFilesByPath(PRESET_DIR);
      setSavedPresets(
        files
          .filter((f) => f.name.endsWith(PRESET_EXT))
          .map((f) => ({ name: f.name, path: f.path }))
      );
    } catch {
      setSavedPresets([]);
    }
  };

  useEffect(() => {
    if (activeCategory === 'presets') refreshSavedPresets();
  }, [activeCategory]);

  const presetFileName = () => {
    const base = saveName.trim().replace(/\.[^/.]+$/, '') || 'avatar';
    return `${base}${PRESET_EXT}`;
  };

  const presetJson = () =>
    JSON.stringify(
      {
        format: 'StorageLauncherAvatarPreset',
        version: 2,
        model: morphMap?.modelName || null,
        savedAt: new Date().toISOString(),
        parameters: safeParams
      },
      null,
      2
    );

  const handleSave = () => {
    const fs = FileManagerService.getInstance();
    const fileName = presetFileName();
    fs.createFile(PRESET_DIR, fileName, 'JSON', presetJson());
    if (onSaveToFile) onSaveToFile(fileName);
    refreshSavedPresets();

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleLoadSavedPreset = (fileName: string) => {
    try {
      const fs = FileManagerService.getInstance();
      const files = fs.getFilesByPath(PRESET_DIR);
      const found = files.find((f) => f.name === fileName);
      const content = found?.content || fs.readFileContent(found?.path || '', false);
      const parsed = JSON.parse(content || '');
      const loaded = normalizeAvatarParams(parsed.parameters || {});
      pushHistoryState(params);
      onChange(loaded);
      setSaveName(fileName.replace(PRESET_EXT, ''));
      setExportStatus(`Loaded preset ${fileName}.`);
      setTimeout(() => setExportStatus(null), 3000);
    } catch {
      setExportStatus(`Could not load ${fileName} — the file is not a valid preset.`);
      setTimeout(() => setExportStatus(null), 4000);
    }
  };

  const handleExportPresetJson = () => {
    const fileName = presetFileName();
    const blob = new Blob([presetJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportStatus(`Downloaded preset ${fileName}.`);
    setTimeout(() => setExportStatus(null), 3000);
  };

  // Export the loaded model as .glb. NOTE: this is real glTF export, NOT a
  // .vrm. The old editor wrote a JSON blob with a VRMC_vrm header and
  // invented bone-node numbers and called it ".vrm" — that file was not a
  // valid VRM. GLTFExporter cannot write the VRM extension, so the honest
  // export is .glb (valid glTF 2.0, keeps the morphed mesh) with the
  // limitation stated in the UI and in services/modelExport.ts.
  const handleExportGlb = async () => {
    setExportStatus('Exporting .glb…');
    const result = await exportCurrentModelAsGlb();
    if (result.ok) {
      setExportStatus(`Saved ${result.fileName} — ${result.note}`);
    } else {
      setExportStatus(`Export failed: ${result.reason}`);
    }
  };

  // -- Map-driven control renderers ------------------------------------------
  const renderSlider = (def: MorphControlDef) => {
    const st = statusOf(def.id);
    const value = (safeParams as unknown as Record<string, number>)[def.id] ?? def.min ?? 0;
    const defaultValue = DEFAULT_AVATAR_PARAMS[def.id as keyof AvatarParameters] as number;
    const isDefault = value === defaultValue;
    return (
      <div key={def.id} className="space-y-1">
        <div className="flex justify-between items-center text-[10px] text-slate-400">
          <span>
            {def.label}
            {st.status === 'verified' && <span className="text-emerald-400 ml-1" title={st.target}>✓</span>}
          </span>
          <span className="flex items-center gap-1">
            {/* Numeric input: same min/max/clamp as the slider, so a value
                can be typed exactly instead of hunted with the thumb. */}
            <input
              type="number"
              min={def.min}
              max={def.max}
              step={def.step}
              value={value}
              disabled={st.status !== 'verified'}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isNaN(v)) return; // empty field while typing
                updateParamLive(
                  def.id as keyof AvatarParameters,
                  Math.min(def.max ?? v, Math.max(def.min ?? v, v)) as never
                );
              }}
              onBlur={commitDrag}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitDrag();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-16 bg-[#060a12] border border-[#172a45] rounded px-1 py-0.5 text-[10px] font-mono-code text-slate-200 text-right outline-none focus:border-[#38bdf8] disabled:opacity-40 disabled:cursor-not-allowed"
              title={`Type a value (${def.min} – ${def.max})`}
            />
            <span className="font-mono-code text-slate-500">
              {def.id === 'browRaise' || def.id === 'mouthOpen' ? '' : 'x'}
            </span>
            {/* Per-slider reset: back to this control's default only. */}
            <button
              onClick={() => updateParam(def.id as keyof AvatarParameters, defaultValue as never)}
              disabled={st.status !== 'verified' || isDefault}
              className="p-0.5 rounded text-slate-500 hover:text-[#38bdf8] hover:bg-[#0f172a] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-500 transition-colors"
              title={`Reset ${def.label} to default (${defaultValue})`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </span>
        </div>
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          disabled={st.status !== 'verified'}
          onChange={(e) => updateParamLive(def.id as keyof AvatarParameters, parseFloat(e.target.value) as never)}
          onPointerUp={commitDrag}
          onMouseUp={commitDrag}
          onBlur={commitDrag}
          className="w-full h-1.5 bg-[#172a45] rounded-lg appearance-none cursor-pointer accent-[#38bdf8] disabled:opacity-40 disabled:cursor-not-allowed"
        />
        {st.status === 'verified' ? (
          <div className="text-[9px] text-slate-500 leading-tight" title={st.target}>
            → {st.target}
          </div>
        ) : (
          <div className="text-[9px] text-amber-300/80 leading-tight flex items-start gap-1">
            <AlertCircle className="w-2.5 h-2.5 shrink-0 mt-px" />
            <span>Disabled on this model: {st.reason}</span>
          </div>
        )}
      </div>
    );
  };

  const renderChoiceGroup = (def: MorphControlDef) => {
    const st = statusOf(def.id);
    // The expression choice highlights the preset with the highest active
    // blend weight (not the legacy field), and choosing one rewrites the
    // whole blend map — see handleExpressionChoice.
    const isExpression = def.id === 'expression';
    const current = isExpression
      ? (currentExpressionId ?? '')
      : (safeParams as unknown as Record<string, string>)[def.id];
    return (
      <div key={def.id}>
        <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
          {def.label}
          {st.status === 'verified' && <span className="text-emerald-400 ml-1" title={st.target}>✓</span>}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(def.choices || []).map((choice) => (
            <button
              key={choice.id}
              disabled={st.status !== 'verified'}
              onClick={() =>
                isExpression
                  ? handleExpressionChoice(choice.id as AvatarParameters['expression'])
                  : updateParam(def.id as keyof AvatarParameters, choice.id as never)
              }
              className={`py-1.5 px-2 rounded text-[11px] font-medium border text-left flex items-center justify-between transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                current === choice.id
                  ? 'bg-[#0e3a6a] text-white border-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                  : 'bg-[#0b1220] text-slate-400 border-[#172a45] hover:text-white'
              }`}
            >
              <span className="truncate">{choice.label}</span>
              {current === choice.id && <Check className="w-3 h-3 text-[#38bdf8] shrink-0" />}
            </button>
          ))}
        </div>
        {st.status !== 'verified' && (
          <div className="text-[9px] text-amber-300/80 leading-tight flex items-start gap-1 mt-1">
            <AlertCircle className="w-2.5 h-2.5 shrink-0 mt-px" />
            <span>Disabled on this model: {st.reason}</span>
          </div>
        )}
      </div>
    );
  };

  const renderColorRow = (def: MorphControlDef, swatches: string[], colorPickerTarget?: keyof AvatarParameters) => {
    const st = statusOf(def.id);
    const value = (safeParams as unknown as Record<string, string>)[def.id] || '#ffffff';
    return (
      <div key={def.id} className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300">
            {def.label}
            {st.status === 'verified' && <span className="text-emerald-400 ml-1" title={st.target}>✓</span>}
          </span>
          {colorPickerTarget && onOpenColorPicker && st.status === 'verified' && (
            <button
              onClick={() => onOpenColorPicker(colorPickerTarget, `${def.label} Studio`)}
              className="px-1.5 py-0.5 rounded bg-[#0e3a6a] hover:bg-[#154c86] text-cyan-300 border border-cyan-500/40 text-[9px] flex items-center gap-1 transition-colors"
            >
              <Palette className="w-2.5 h-2.5" />
              <span>Color Studio ⤹</span>
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {swatches.map((c) => (
            <button
              key={c}
              disabled={st.status !== 'verified'}
              onClick={() => updateParam(def.id as keyof AvatarParameters, c as never)}
              style={{ backgroundColor: c }}
              className={`w-6 h-6 rounded-full border transition-transform disabled:opacity-40 disabled:cursor-not-allowed ${
                value === c ? 'scale-120 border-white ring-2 ring-[#38bdf8]' : 'border-white/20'
              }`}
            />
          ))}
          <input
            type="color"
            value={value}
            disabled={st.status !== 'verified'}
            onChange={(e) => updateParam(def.id as keyof AvatarParameters, e.target.value as never)}
            className="w-6 h-6 rounded-full cursor-pointer bg-transparent border-0 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Custom Color"
          />
        </div>
        {st.status === 'verified' ? (
          <div className="text-[9px] text-slate-500 leading-tight" title={st.target}>
            → {st.target}
          </div>
        ) : (
          <div className="text-[9px] text-amber-300/80 leading-tight flex items-start gap-1">
            <AlertCircle className="w-2.5 h-2.5 shrink-0 mt-px" />
            <span>Disabled on this model: {st.reason}</span>
          </div>
        )}
      </div>
    );
  };

  const defById = (id: string) => EDITOR_CONTROLS.find((d) => d.id === id)!;
  const slidersFor = (section: string) =>
    EDITOR_CONTROLS.filter((d) => d.section === section && d.kind === 'slider');

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
            title="Randomize Character (verified controls only)"
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
          { id: 'mapping', label: 'Mapping', icon: ListChecks },
        ].map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as Category)}
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

      {/* Model verification banner */}
      <div className="px-2.5 py-1.5 bg-[#090e18] border-b border-[#172a45] text-[10px] leading-relaxed shrink-0">
        {morphMap ? (
          <span className="text-slate-400">
            Model: <span className="text-slate-200 font-mono-code">{morphMap.modelName}</span> —{' '}
            <span className="text-emerald-400">{verifiedCount} sliders verified</span>,{' '}
            <span className="text-amber-300">{unavailableCount} disabled</span> (no verified target on this model).
            Every slider morphs only the section it names.{' '}
            <button onClick={() => setActiveCategory('mapping')} className="text-cyan-300 underline">
              See mapping
            </button>
          </span>
        ) : (
          <span className="text-amber-300/90">
            No model loaded in the 3D viewer yet — sliders stay disabled until a model is loaded and its bones /
            morphs / materials are verified.
          </span>
        )}
      </div>

      {/* Body Content */}
      <div className="flex-1 p-2.5 overflow-y-auto space-y-3 bg-[#070b13]">
        {/* BODY SLIDERS */}
        {activeCategory === 'body' && (
          <div className="space-y-2.5">
            <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>Proportions — verified targets only</span>
              <span className="font-mono-code text-[#38bdf8] text-[10px]">
                {(safeParams.height * 160).toFixed(0)} cm
              </span>
            </div>
            {slidersFor('body').map(renderSlider)}
          </div>
        )}

        {/* FACE & EXPRESSION */}
        {activeCategory === 'face' && (
          <div className="space-y-3">
            {renderChoiceGroup(defById('expression'))}
            {/* Expression Blend — mix presets instead of one-at-a-time.
                Each slider is that preset's weight (0–1); several can be
                active at once, and the weights are applied in the same
                pass as the face sliders below, so they never overwrite
                each other. Face sliders always win on the morphs they
                drive. */}
            <div className="space-y-2 pt-2 border-t border-[#172a45]">
              <div className="text-[11px] font-semibold text-slate-300">Expression Blend</div>
              {(['smile', 'wink', 'fierce', 'surprised'] as const).map((id) => {
                const vrmName = EXPRESSION_VRM_NAME[id];
                const st = statusOf('expression');
                const weight = effectiveBlends[vrmName] ?? 0;
                return (
                  <div key={id} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>{defById('expression').choices?.find((c) => c.id === id)?.label ?? id}</span>
                      <span className="font-mono-code text-slate-200">{weight.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={weight}
                      disabled={st.status !== 'verified'}
                      onChange={(e) =>
                        updateParamLive('expressionBlends', {
                          ...effectiveBlends,
                          [vrmName]: parseFloat(e.target.value),
                        })
                      }
                      onPointerUp={commitDrag}
                      onMouseUp={commitDrag}
                      onBlur={commitDrag}
                      className="w-full h-1.5 bg-[#172a45] rounded-lg appearance-none cursor-pointer accent-[#38bdf8] disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                );
              })}
              {statusOf('expression').status !== 'verified' && (
                <div className="text-[9px] text-amber-300/80 leading-tight flex items-start gap-1">
                  <AlertCircle className="w-2.5 h-2.5 shrink-0 mt-px" />
                  <span>Disabled on this model: {statusOf('expression').reason}</span>
                </div>
              )}
            </div>
            <div className="space-y-2 pt-2 border-t border-[#172a45]">
              <div className="text-[11px] font-semibold text-slate-300">Feature Scaling</div>
              {slidersFor('face').map(renderSlider)}
            </div>
          </div>
        )}

        {/* HAIR & STYLES */}
        {activeCategory === 'hair' && (
          <div className="space-y-3">
            {renderChoiceGroup(defById('hairstyle'))}
            <div className="space-y-2 pt-2 border-t border-[#172a45]">
              {renderColorRow(defById('hairColor'), hairPresets, 'hairColor')}
            </div>
            <div className="space-y-2 pt-2 border-t border-[#172a45]">
              {renderColorRow(defById('hairHighlightColor'), hairPresets, 'hairHighlightColor')}
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

            {renderChoiceGroup(defById('outfit'))}
            <div className="pt-2 border-t border-[#172a45]">
              {renderChoiceGroup(defById('accessory'))}
            </div>
            <div className="space-y-2 pt-2 border-t border-[#172a45]">
              <div className="text-[11px] font-semibold text-slate-300">Outfit Shading</div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {(['coatColor', 'innerColor', 'bootsColor', 'accentNeonColor'] as const).map((id) => {
                  const st = statusOf(id);
                  const label = defById(id).label;
                  return (
                    <div key={id} className="p-2 rounded bg-[#0b1220] border border-[#172a45]">
                      <div className="flex items-center justify-between">
                        <span className={st.status === 'verified' ? '' : 'text-slate-500'}>
                          {label}
                          {st.status === 'verified' && <span className="text-emerald-400 ml-1">✓</span>}
                        </span>
                        <input
                          type="color"
                          value={(safeParams as unknown as Record<string, string>)[id]}
                          disabled={st.status !== 'verified'}
                          onChange={(e) => updateParam(id, e.target.value as never)}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                          title={st.status === 'verified' ? st.target : st.reason}
                        />
                      </div>
                      {st.status !== 'verified' && (
                        <div className="text-[9px] text-amber-300/80 leading-tight mt-1">{st.reason}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* COLORS PALETTE MASTER */}
        {activeCategory === 'colors' && (
          <div className="space-y-3">
            {renderColorRow(defById('skinColor'), skinPresets)}
            <div className="space-y-1.5 pt-2 border-t border-[#172a45]">
              {renderColorRow(defById('eyeColor'), eyePresets)}
            </div>
            <div className="space-y-1.5 pt-2 border-t border-[#172a45]">
              {renderColorRow(defById('accentNeonColor'), neonPresets)}
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
                    onChange(normalizeAvatarParams({ ...DEFAULT_AVATAR_PARAMS, ...preset.params }));
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
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Preset values for sliders this model does not support are stored in the preset but have no effect on
              this model — they apply when you load a model that supports them.
            </p>

            {/* My saved presets */}
            <div className="pt-2 border-t border-[#172a45]">
              <div className="text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <FolderOpen className="w-3 h-3 text-[#38bdf8]" /> My Saved Presets
              </div>
              {savedPresets.length === 0 ? (
                <div className="text-[10px] text-slate-500">No saved presets yet — save one below.</div>
              ) : (
                <div className="space-y-1.5">
                  {savedPresets.map((p) => (
                    <button
                      key={p.path}
                      onClick={() => handleLoadSavedPreset(p.name)}
                      className="w-full text-left p-2 rounded bg-[#0b1220] hover:bg-[#121e35] border border-[#172a45] hover:border-[#38bdf8]/50 text-[11px] text-slate-200 font-mono-code transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* File Save Bar */}
            <div className="p-2.5 rounded bg-[#090f1d] border border-[#172a45] space-y-2 pt-2">
              <div className="text-[11px] font-semibold text-slate-200">Save Preset & Export</div>
              <div className="flex items-center bg-[#060a12] border border-[#172a45] rounded overflow-hidden">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="flex-1 bg-transparent px-2 py-1 text-[11px] text-slate-200 font-mono-code outline-none"
                  placeholder="avatar_custom"
                />
                <span className="text-[10px] text-slate-500 pr-1 font-mono-code">{PRESET_EXT}</span>
                <button
                  onClick={handleSave}
                  className="px-2 py-1 bg-[#0e3a6a] hover:bg-[#154c86] text-[#38bdf8] font-medium flex items-center gap-1 transition-colors text-[10px] border-r border-[#172a45]"
                >
                  {saveSuccess ? <Check className="w-3 h-3 text-emerald-400" /> : <Save className="w-3 h-3" />}
                  <span>Save</span>
                </button>
                <button
                  onClick={handleExportPresetJson}
                  className="px-2 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium flex items-center gap-1 transition-colors text-[10px]"
                  title="Download this preset as a .avatar.json file"
                >
                  <Download className="w-3 h-3 text-white" />
                  <span>Preset .json</span>
                </button>
              </div>
              <button
                onClick={handleExportGlb}
                className="w-full px-2 py-1.5 rounded bg-[#0b1220] hover:bg-[#15233a] text-slate-200 border border-[#172a45] font-medium flex items-center justify-center gap-1 text-[11px] transition-colors"
                title="Export the loaded, morphed model as .glb (valid glTF — NOT a .vrm)"
              >
                <Download className="w-3 h-3 text-[#38bdf8]" />
                <span>Export Model as .glb</span>
              </button>
              <p className="text-[9px] text-slate-500 leading-relaxed">
                The .glb export is real glTF 2.0 of the morphed model — it is <b>not</b> a .vrm. VRM humanoid data,
                expressions and spring bones are not carried over by the glTF exporter, so the file will not load as
                a VRM avatar.
              </p>
              {exportStatus && (
                <p className="text-[10px] text-cyan-200 leading-relaxed">{exportStatus}</p>
              )}
            </div>
          </div>
        )}

        {/* MAPPING — verified vs disabled, per control */}
        {activeCategory === 'mapping' && (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <ListChecks className="w-3 h-3 text-[#38bdf8]" />
              <span>Verified Morph Map</span>
            </div>
            {!morphMap ? (
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                No model is loaded in the 3D viewer yet. Load a model and this tab lists every slider, the exact
                bone / morph / mesh / material it controls, and why any slider is disabled.
              </p>
            ) : (
              <>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Model: <span className="text-slate-200 font-mono-code">{morphMap.modelName}</span> (
                  {morphMap.modelKind}) — {verifiedCount} verified, {unavailableCount} disabled. The same list is
                  logged to the console as [MorphMap] when the model loads.
                </p>
                {morphMap.modelNote && (
                  <p className="text-[10px] text-amber-300/90 leading-relaxed p-2 rounded bg-[#171208] border border-amber-500/30">
                    {morphMap.modelNote}
                  </p>
                )}
                <div className="space-y-1.5">
                  {morphMap.controls.map((c) => {
                    const def = EDITOR_CONTROLS.find((d) => d.id === c.id);
                    return (
                      <div key={c.id} className="p-2 rounded bg-[#0b1220] border border-[#172a45]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-100 text-[11px]">
                            {def?.label || c.id}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono-code ${
                              c.status === 'verified'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : 'bg-[#171208] text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {c.status === 'verified' ? 'VERIFIED' : 'DISABLED'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                          {c.status === 'verified' ? `→ ${c.target}` : c.reason}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="h-10 bg-[#090e18] border-t border-[#172a45] px-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              pushHistoryState(params);
              onChange({ ...DEFAULT_AVATAR_PARAMS });
            }}
            className="px-2 py-1 rounded bg-[#0b1220] hover:bg-[#15233a] border border-[#172a45] text-slate-400 hover:text-white flex items-center gap-1 text-[10px] transition-colors"
            title="Reset Parameters to Default"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Reset</span>
          </button>
          {/* Per-category reset: resets only the open tab's controls. */}
          {['body', 'face', 'hair', 'outfit', 'colors'].includes(activeCategory) && (
            <button
              onClick={() => resetCategory(activeCategory)}
              className="px-2 py-1 rounded bg-[#0b1220] hover:bg-[#15233a] border border-[#172a45] text-slate-400 hover:text-white flex items-center gap-1 text-[10px] transition-colors"
              title={`Reset this tab (${activeCategory}) to defaults`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Reset {activeCategory[0].toUpperCase() + activeCategory.slice(1)}</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={handleSave}
            className="px-2 py-1 rounded bg-[#0b1220] hover:bg-[#15233a] text-slate-300 border border-[#172a45] font-medium flex items-center gap-1 text-[10px] transition-colors"
            title="Save preset to local project storage"
          >
            {saveSuccess ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Save className="w-2.5 h-2.5" />}
            <span>Save</span>
          </button>

          <button
            onClick={handleExportGlb}
            className="px-2.5 py-1 rounded bg-[#0077d4] hover:bg-[#0088f4] text-white font-medium flex items-center gap-1 text-[10px] shadow-[0_0_8px_rgba(0,119,212,0.4)] transition-colors"
            title="Export the loaded, morphed model as .glb (valid glTF — NOT a .vrm)"
          >
            <Download className="w-2.5 h-2.5" />
            <span>Export .glb</span>
          </button>
        </div>
      </div>
    </div>
  );
};
