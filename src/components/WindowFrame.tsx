import React, { useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Minus, Square, X, Link, AlertTriangle, RefreshCw, Cpu } from 'lucide-react';
import { WindowNode } from '../types/window';

// Error Boundary to prevent window force closing on 3D or VRM exceptions
interface ErrorBoundaryProps {
  children: ReactNode;
  windowTitle: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WindowErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Window [${this.props.windowTitle}] rendering error:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-[#040810] text-slate-100 select-none text-center relative overflow-hidden">
          {/* Cyber BG Grid Effect */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)] bg-[size:16px_16px]" />
          
          <div className="relative z-10 max-w-sm p-5 rounded-xl bg-[#09101f]/90 border border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.25)]">
            <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-red-950/80 border border-red-500/60 flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>

            <h3 className="text-xs font-black uppercase tracking-wider text-red-400 mb-1">
              Window Process Exception
            </h3>
            <p className="text-[11px] text-slate-300 mb-3 font-mono leading-relaxed">
              {this.state.error?.message || 'An unexpected rendering error occurred inside this avatar container.'}
            </p>

            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-1.5 rounded-md bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 mx-auto shadow-[0_0_12px_rgba(244,63,94,0.4)] transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset & Restore Process</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface WindowFrameProps {
  window: WindowNode;
  parentTitle?: string;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  onContextMenuWindow?: (win: WindowNode, x: number, y: number) => void;
  children: React.ReactNode;
  boundsRef?: React.RefObject<HTMLDivElement | null>;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({
  window: win,
  parentTitle,
  onFocus,
  onMove,
  onResize,
  onMinimize,
  onMaximize,
  onClose,
  onContextMenuWindow,
  children
}) => {
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });

  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Multi-Touch Pinch Resizing State
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const initialSizeRef = useRef<{ w: number; h: number } | null>(null);

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    onFocus();
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 2 && !win.isMaximized) {
      const pts = Array.from(activePointersRef.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      initialPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      initialSizeRef.current = { w: win.width, h: win.height };
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (
      activePointersRef.current.size === 2 &&
      initialPinchDistRef.current !== null &&
      initialSizeRef.current !== null &&
      !win.isMaximized
    ) {
      const pts = Array.from(activePointersRef.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const currentDist = Math.sqrt(dx * dx + dy * dy);

      const deltaDist = currentDist - initialPinchDistRef.current;
      const minW = win.minWidth || 280;
      const minH = win.minHeight || 200;

      const scale = Math.max(0.4, Math.min(3.0, 1 + deltaDist / 300));
      const newW = Math.max(minW, Math.round(initialSizeRef.current.w * scale));
      const newH = Math.max(minH, Math.round(initialSizeRef.current.h * scale));

      onResize(newW, newH);
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      initialPinchDistRef.current = null;
      initialSizeRef.current = null;
    }
  };

  // Dragging & Long-press title bar
  const handleTitlePointerDown = (e: React.PointerEvent) => {
    onFocus();
    startPosRef.current = { x: e.clientX, y: e.clientY };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (onContextMenuWindow) {
        onContextMenuWindow(win, e.clientX, e.clientY);
      }
    }, 500);

    if (win.isMaximized) return;

    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - win.x,
      y: e.clientY - win.y
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleTitlePointerMove = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 6 || dy > 6) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    }

    if (!isDraggingRef.current) return;
    const newX = Math.max(0, e.clientX - dragOffsetRef.current.x);
    const newY = Math.max(0, e.clientY - dragOffsetRef.current.y);
    onMove(newX, newY);
  };

  const handleTitlePointerUp = (e: React.PointerEvent) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Resize Corner (Bottom-Right)
  const handleResizePointerDown = (e: React.PointerEvent) => {
    if (win.isMaximized) return;
    e.stopPropagation();
    onFocus();
    isResizingRef.current = true;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: win.width,
      h: win.height
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizingRef.current) return;
    const dx = e.clientX - resizeStartRef.current.x;
    const dy = e.clientY - resizeStartRef.current.y;
    const minW = win.minWidth || 280;
    const minH = win.minHeight || 200;
    const newW = Math.max(minW, resizeStartRef.current.w + dx);
    const newH = Math.max(minH, resizeStartRef.current.h + dy);
    onResize(newW, newH);
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    isResizingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  if (win.isMinimized) return null;

  return (
    <div
      onPointerDownCapture={() => onFocus()}
      onClickCapture={() => onFocus()}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={handleContainerPointerUp}
      style={
        win.isMaximized
          ? {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: win.zIndex + 100
            }
          : {
              position: 'absolute',
              top: `${win.y}px`,
              left: `${win.x}px`,
              width: `${win.width}px`,
              height: `${win.height}px`,
              zIndex: win.zIndex
            }
      }
      className="flex flex-col bg-[#050914]/96 backdrop-blur-2xl border border-[#1e3250] rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_20px_rgba(56,189,248,0.18)] overflow-hidden select-none relative group"
    >
      {/* Custom Stylized Tech Corner Brackets */}
      <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-[#38bdf8] z-30 pointer-events-none" />
      <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[#38bdf8] z-30 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[#38bdf8] z-30 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-[#38bdf8] z-30 pointer-events-none" />

      {/* Title Bar */}
      <div
        onPointerDown={handleTitlePointerDown}
        onPointerMove={handleTitlePointerMove}
        onPointerUp={handleTitlePointerUp}
        onContextMenu={(e) => {
          e.preventDefault();
          if (onContextMenuWindow) onContextMenuWindow(win, e.clientX, e.clientY);
        }}
        className={`h-7 px-2.5 flex items-center justify-between border-b border-[#1e3250] shrink-0 cursor-move touch-none relative ${
          win.parentId
            ? 'bg-gradient-to-r from-[#0c2340] via-[#081527] to-[#0e2a4e]'
            : 'bg-gradient-to-r from-[#0b1629] via-[#070e1a] to-[#0f1f3a]'
        }`}
      >
        {/* Subtle Tech Header Accent Stripe */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#38bdf8]/50 to-transparent" />

        {/* Title & Hierarchy Node Badge */}
        <div className="flex items-center space-x-2 min-w-0 pr-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8] shrink-0" />

          {win.parentId && (
            <span
              className="text-[9px] px-1.5 py-0.2 rounded bg-[#0b2442] text-cyan-300 border border-cyan-400/50 flex items-center gap-0.5 shrink-0 font-mono-code shadow-[0_0_8px_rgba(56,189,248,0.25)]"
              title={`Child window linked to ${parentTitle || 'Parent'}`}
            >
              <Link className="w-2 h-2 text-cyan-300" />
              <span className="truncate max-w-[80px]">Link</span>
            </span>
          )}

          {win.childIds && win.childIds.length > 0 && (
            <span
              className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-400/50 flex items-center gap-1 shrink-0 font-mono-code shadow-[0_0_8px_rgba(56,189,248,0.2)]"
              title={`${win.childIds.length} connected child node${win.childIds.length > 1 ? 's' : ''}`}
            >
              <Cpu className="w-2 h-2 text-cyan-300 animate-pulse" />
              <span>{win.childIds.length} {win.childIds.length > 1 ? 'nodes' : 'node'}</span>
            </span>
          )}

          <span className="font-bold text-slate-100 text-[11px] truncate tracking-tight uppercase">
            {win.title}
          </span>
        </div>

        {/* Window Controls */}
        <div className="flex items-center space-x-1 shrink-0 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            className="p-1 text-slate-400 hover:text-white hover:bg-[#12243d] rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMaximize();
            }}
            className="p-1 text-slate-400 hover:text-white hover:bg-[#12243d] rounded transition-colors"
            title={win.isMaximized ? 'Restore' : 'Maximize'}
          >
            <Square className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 text-slate-400 hover:text-red-400 hover:bg-[#12243d] rounded transition-colors"
            title="Close Window"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Window Body Protected by WindowErrorBoundary */}
      <div className="flex-1 overflow-hidden relative bg-[#060b15]">
        <WindowErrorBoundary windowTitle={win.title}>
          {children}
        </WindowErrorBoundary>
      </div>

      {/* Resize Handle (Bottom-Right Corner) */}
      {!win.isMaximized && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-30 flex items-end justify-end p-0.5 text-cyan-500/60 hover:text-cyan-400"
          title="Resize Window"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 6 6" fill="currentColor">
            <circle cx="5" cy="5" r="1" />
            <circle cx="5" cy="2" r="1" />
            <circle cx="2" cy="5" r="1" />
          </svg>
        </div>
      )}
    </div>
  );
};

