import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Activity, Sparkles, Layers } from 'lucide-react';
import { VESSEL_MODEL_DATA } from '../data/mockData';

interface AnimationStudioWindowProps {
  selectedAnimation: string;
  onSelectAnimation: (animId: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  timelineProgress: number;
  onSeek: (progress: number) => void;
  speed: number;
  onChangeSpeed: (spd: number) => void;
}

export const AnimationStudioWindow: React.FC<AnimationStudioWindowProps> = ({
  selectedAnimation,
  onSelectAnimation,
  isPlaying,
  onTogglePlay,
  timelineProgress,
  onSeek,
  speed,
  onChangeSpeed
}) => {
  return (
    <div className="flex flex-col h-full bg-[#080c14] text-xs select-none">
      {/* Active Clip Preview Bar */}
      <div className="p-2.5 bg-[#0b1220] border-b border-[#172a45] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#38bdf8]" />
          <div>
            <div className="font-semibold text-slate-100 capitalize">{selectedAnimation} Clip</div>
            <div className="text-[10px] text-slate-400 font-mono-code">VRM Skeletal Keyframe Track</div>
          </div>
        </div>

        {/* Speed multiplier selector */}
        <div className="flex items-center space-x-1 bg-[#060a12] border border-[#172a45] rounded p-0.5">
          {[0.5, 1.0, 1.5, 2.0].map((s) => (
            <button
              key={s}
              onClick={() => onChangeSpeed(s)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono-code transition-colors ${
                speed === s
                  ? 'bg-[#0e3a6a] text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Scrub Timeline & Playback Controls */}
      <div className="p-2.5 bg-[#090e19] border-b border-[#172a45] space-y-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={onTogglePlay}
            className="p-1.5 rounded bg-[#0e3a6a] hover:bg-[#154c86] text-white font-medium border border-[#38bdf8]/40 transition-colors shadow-[0_0_8px_rgba(56,189,248,0.25)]"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => onSeek(0)}
            className="p-1.5 rounded bg-[#0b1220] hover:bg-[#162338] text-slate-400 hover:text-white border border-[#172a45]"
            title="Rewind to Start"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Time Scrubber */}
          <div className="flex-1 flex items-center space-x-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={timelineProgress}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-[#172a45] rounded appearance-none cursor-pointer accent-[#38bdf8]"
            />
            <span className="font-mono-code text-[10px] text-cyan-300 w-10 text-right">
              {(timelineProgress * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Animation Clips List */}
      <div className="flex-1 p-2 overflow-y-auto space-y-1 bg-[#070b13]">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
          <Layers className="w-3 h-3 text-[#38bdf8]" />
          <span>Available VRM Clips</span>
        </div>

        {VESSEL_MODEL_DATA.animations.map((anim) => {
          const isCurrent = selectedAnimation === anim.id;
          return (
            <button
              key={anim.id}
              onClick={() => onSelectAnimation(anim.id)}
              className={`w-full flex items-center justify-between p-2 rounded text-left transition-colors border ${
                isCurrent
                  ? 'bg-[#0e3a6a] text-white border-[#38bdf8]/50 shadow-[0_0_8px_rgba(56,189,248,0.2)] font-medium'
                  : 'bg-[#0b1220] text-slate-300 hover:bg-[#121c2e] hover:text-white border-[#172a45]/60'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Play className={`w-3 h-3 ${isCurrent ? 'text-[#38bdf8] fill-[#38bdf8]' : 'text-slate-500'}`} />
                <span>{anim.name}</span>
              </div>
              <span className="text-[10px] font-mono-code text-slate-400">{anim.duration}s</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
