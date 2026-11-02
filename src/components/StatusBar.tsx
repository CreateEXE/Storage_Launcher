import React from 'react';
import { Terminal, EyeOff, Eye, Cpu, Gauge } from 'lucide-react';

interface StatusBarProps {
  isTerminalVisible: boolean;
  onToggleTerminal: () => void;
  onResetLayout: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isTerminalVisible,
  onToggleTerminal,
  onResetLayout
}) => {
  return (
    <footer className="h-6 bg-[#080c14] border-t border-[#172a45] flex items-center justify-between px-3 text-[11px] text-slate-400 select-none z-30 shrink-0">
      {/* Left: Termux Version */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1.5 text-slate-300">
          <Terminal className="w-3 h-3 text-[#38bdf8]" />
          <span className="font-mono-code font-medium text-slate-200 text-[10px]">
            Termux 0.119.0
          </span>
        </div>

        <span className="text-[#172a45]">|</span>

        {/* Target Hardware Badge (Moto G Power 2025 optimization) */}
        <div className="hidden sm:flex items-center space-x-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>Dimensity 6300 (8GB)</span>
          </span>
          <span className="text-[#172a45]">•</span>
          <span className="flex items-center gap-1">
            <Gauge className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400 font-mono-code">120 Hz</span>
          </span>
        </div>
      </div>

      {/* Right: Layout & Terminal Toggles */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onToggleTerminal}
          className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#0d1525] hover:bg-[#14233c] text-slate-300 hover:text-white border border-[#172a45] transition-colors text-[10px]"
        >
          {isTerminalVisible ? (
            <>
              <EyeOff className="w-3 h-3 text-slate-400" />
              <span>Hide Terminal</span>
            </>
          ) : (
            <>
              <Eye className="w-3 h-3 text-[#38bdf8]" />
              <span>Show Terminal</span>
            </>
          )}
        </button>

        <button
          onClick={onResetLayout}
          className="p-1 hover:text-white hover:bg-[#162338] rounded text-slate-400"
          title="Reset Panel Layout"
        >
          <span className="font-mono-code text-[10px]">Layout</span>
        </button>
      </div>
    </footer>
  );
};
