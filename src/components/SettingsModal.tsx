import React, { useState } from 'react';
import {
  X,
  Cpu,
  Smartphone,
  Shield,
  Sliders,
  Check,
  Terminal,
  Code,
  Flame,
  Lock,
  Unlock,
  Sparkles
} from 'lucide-react';

import { clearAppLocalStorage } from '../utils/appStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDeveloperModeUnlocked: boolean;
  onUnlockDeveloperMode: () => void;
  onLockDeveloperMode: () => void;
  onOpenTerminal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isDeveloperModeUnlocked,
  onUnlockDeveloperMode,
  onLockDeveloperMode,
  onOpenTerminal
}) => {
  const [refreshRate, setRefreshRate] = useState<'60' | '90' | '120'>('120');
  const [graphicsBackend, setGraphicsBackend] = useState<'Vulkan' | 'OpenGL ES 3.2' | 'WebGL2'>('Vulkan');
  const [springBones, setSpringBones] = useState(true);
  const [shadowsEnabled, setShadowsEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  // Android Easter Egg 7-Tap Build Number State
  const [tapCount, setTapCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleBuildNumberClick = () => {
    if (isDeveloperModeUnlocked) {
      showToast('You are already a developer!');
      return;
    }

    const nextCount = tapCount + 1;
    setTapCount(nextCount);

    if (nextCount >= 7) {
      onUnlockDeveloperMode();
      showToast('🎉 You are now a developer! Termux CLI is unlocked.');
      setTapCount(0);
    } else if (nextCount >= 4) {
      const remaining = 7 - nextCount;
      showToast(`You are now ${remaining} step${remaining > 1 ? 's' : ''} away from being a developer.`);
    }
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 select-none text-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#090f1d] border border-[#1e3a5f] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="h-10 bg-[#0d1627] border-b border-[#172a45] flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded bg-[#0e3a6a] text-cyan-400">
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold text-slate-100 text-xs">Oni's Storage Launcher Settings</span>
              <span className="text-[9px] text-cyan-400 ml-1.5 font-medium">by Oni Song</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-[#162338] rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Android Floating Toast */}
        {toastMessage && (
          <div className="bg-[#0e3a6a] border-b border-cyan-400/50 px-3 py-1.5 text-[11px] text-cyan-200 font-medium flex items-center justify-between shrink-0 animate-in slide-in-from-top-1">
            <span>{toastMessage}</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
          </div>
        )}

        {/* Content */}
        <div className="p-3.5 space-y-3.5 overflow-y-auto flex-1">
          {/* Target Profile Card & Hardware Performance Gauges */}
          <div className="p-3 rounded-lg bg-[#060a12] border border-[#172a45] space-y-2">
            <div className="flex items-center justify-between text-cyan-300 font-semibold text-[11px]">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4" />
                <span>Motorola Moto G Power 2025</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 font-mono-code border border-cyan-500/40">
                120 FPS
              </span>
            </div>

            <div className="text-[10px] text-slate-400 space-y-1 font-mono-code pt-1 border-t border-[#121f33]">
              <div className="flex justify-between">
                <span>SoC / GPU: MediaTek Dimensity 6300 • Mali-G57 MC2</span>
                <span className="text-cyan-400">8.3 ms/f</span>
              </div>
              <div className="flex justify-between">
                <span>RAM Allocation (8 GB LPDDR4X):</span>
                <span className="text-emerald-400">2.4 / 8.0 GB (30%)</span>
              </div>
              <div className="w-full bg-[#0b1424] h-1.5 rounded-full overflow-hidden border border-[#1e293b]">
                <div className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full w-[30%]" />
              </div>
              <div className="flex justify-between pt-0.5 text-[9px] text-slate-500">
                <span>Storage: /storage/emulated/0</span>
                <span>Android 16 (API 36)</span>
              </div>
            </div>
          </div>

          {/* Display & Refresh Rate */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span>Display Refresh Rate</span>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono-code">{refreshRate} Hz</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['60', '90', '120'] as const).map((hz) => (
                <button
                  key={hz}
                  onClick={() => setRefreshRate(hz)}
                  className={`py-1.5 px-2 rounded-lg border text-center font-mono-code transition-colors ${
                    refreshRate === hz
                      ? 'bg-[#0e3a6a] text-white border-[#38bdf8] font-bold shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                      : 'bg-[#0b1220] text-slate-400 border-[#172a45] hover:text-white'
                  }`}
                >
                  {hz} Hz
                </button>
              ))}
            </div>
          </div>

          {/* Backup & Restore System State JSON */}
          <div className="space-y-2 pt-2 border-t border-[#172a45]">
            <div className="text-slate-300 font-semibold text-[11px] flex items-center justify-between">
              <span>System Backup & Data Recovery</span>
              <span className="text-[9px] text-cyan-400 font-mono-code">JSON Config</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <button
                onClick={() => {
                  try {
                    const data = {
                      savedAt: new Date().toISOString(),
                      customization: localStorage.getItem('savage_desktop_customization'),
                      files: localStorage.getItem('termux_gui_filesystem_v2'),
                      developerUnlocked: localStorage.getItem('savage_developer_mode_unlocked')
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `OnisStorageLauncher_Backup_${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('Backup JSON exported successfully!');
                  } catch (e) {
                    showToast('Export failed!');
                  }
                }}
                className="p-2 rounded-lg bg-[#0b1424] hover:bg-[#112038] border border-[#172a45] text-cyan-300 hover:text-white font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Export System Backup</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('Reset system cache and local storage?')) {
                    try {
                      // Scoped reset: only this app's own keys, not
                      // localStorage.clear() (which wiped everything under
                      // the WebView origin).
                      clearAppLocalStorage();
                      window.location.reload();
                    } catch {
                      window.location.reload();
                    }
                  }
                }}
                className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Reset Local Cache</span>
              </button>
            </div>
          </div>

          {/* 3D Rendering Pipeline */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium text-[11px]">3D Graphics API</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Vulkan', 'OpenGL ES 3.2', 'WebGL2'] as const).map((backend) => (
                <button
                  key={backend}
                  onClick={() => setGraphicsBackend(backend)}
                  className={`py-1.5 px-1 rounded-lg border text-center text-[10px] truncate transition-colors ${
                    graphicsBackend === backend
                      ? 'bg-[#0e3a6a] text-white border-[#38bdf8] font-bold shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                      : 'bg-[#0b1220] text-slate-400 border-[#172a45] hover:text-white'
                  }`}
                >
                  {backend}
                </button>
              ))}
            </div>
          </div>

          {/* VRM Shader & Physics */}
          <div className="space-y-2 pt-2 border-t border-[#172a45]">
            <div className="text-slate-300 font-semibold text-[11px]">VRM Avatar Simulation</div>

            <label className="flex items-center justify-between p-2 rounded-lg bg-[#0b1220] border border-[#172a45] cursor-pointer">
              <span className="text-slate-300 text-[10px]">VRM 0.0 Spring Bones Physics Simulation</span>
              <input
                type="checkbox"
                checked={springBones}
                onChange={(e) => setSpringBones(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#38bdf8]"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-[#0b1220] border border-[#172a45] cursor-pointer">
              <span className="text-slate-300 text-[10px]">Soft Shadow Lighting & NPR Shaders</span>
              <input
                type="checkbox"
                checked={shadowsEnabled}
                onChange={(e) => setShadowsEnabled(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#38bdf8]"
              />
            </label>
          </div>

          {/* HIDDEN DEVELOPER OPTIONS (Unlocked only when build number is tapped 7 times!) */}
          {isDeveloperModeUnlocked && (
            <div className="p-3 rounded-lg bg-[#160b24] border border-purple-500/40 space-y-2 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-purple-300 font-bold text-[11px]">
                  <Unlock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Developer Options (Termux Active)</span>
                </div>
                <button
                  onClick={onLockDeveloperMode}
                  className="text-[9px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30 hover:bg-purple-900"
                >
                  Relock
                </button>
              </div>

              <p className="text-[10px] text-purple-200/80 leading-snug">
                Termux CLI terminal bridge is enabled. You can launch direct Linux terminal commands, inspect scoped storage mounts, and compile native C++ engines.
              </p>

              <div className="flex items-center gap-2 pt-1">
                {onOpenTerminal && (
                  <button
                    onClick={() => {
                      onOpenTerminal();
                      onClose();
                    }}
                    className="flex-1 py-1 px-2 rounded bg-purple-700 hover:bg-purple-600 text-white font-medium text-[10px] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Terminal className="w-3 h-3" />
                    <span>Launch Termux Terminal</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ABOUT ONI'S STORAGE LAUNCHER & 7-TAP EASTER EGG */}
          <div className="p-2.5 rounded-lg bg-[#070c16] border border-[#172a45] space-y-1.5">
            <div className="text-slate-300 font-semibold text-[11px] flex items-center justify-between">
              <span>About Oni's Storage Launcher</span>
              <span className="text-[9px] text-slate-500 font-mono-code">v2.4.0</span>
            </div>

            <div className="text-[10px] text-slate-400">
              <div>Creator: Oni Song</div>
              <div>Renderer: Chimera 3D Native Engine</div>
            </div>

            {/* Tap 7 times on Build Number to unlock Developer Mode! */}
            <div
              onClick={handleBuildNumberClick}
              className="mt-1 pt-1 border-t border-[#121c2e] flex items-center justify-between cursor-pointer hover:bg-[#0c1524] p-1 rounded transition-colors group"
              title="Tap 7 times to unlock Developer Options"
            >
              <div>
                <span className="text-[10px] text-slate-400 block group-hover:text-cyan-300">
                  Build Number
                </span>
                <span className="font-mono-code text-[9px] text-slate-500">
                  OniOS-2.4.0-REL.Dimensity6300.2025
                </span>
              </div>
              <div className="text-slate-500 group-hover:text-cyan-400">
                {isDeveloperModeUnlocked ? (
                  <Unlock className="w-3.5 h-3.5 text-purple-400" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-600" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 bg-[#0d1627] border-t border-[#172a45] px-3 flex items-center justify-end space-x-2 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#0b1220] hover:bg-[#162338] text-slate-300 hover:text-white border border-[#172a45]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 rounded bg-[#0077d4] hover:bg-[#0088f4] text-white font-medium flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,119,212,0.4)]"
          >
            {saved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            ) : (
              <span>Apply Settings</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
