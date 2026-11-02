import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ShieldAlert, RefreshCw, HardDrive } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalSystemErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Global System Exception caught:', error, errorInfo);
  }

  private handleRecoverSession = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleFullReset = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#03060c] text-slate-100 flex items-center justify-center p-4 font-sans select-none relative overflow-hidden">
          {/* Cyber BG Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)] bg-[size:24px_24px] opacity-10" />

          <div className="relative z-10 w-full max-w-md p-6 rounded-2xl bg-[#08101e]/95 border border-red-500/50 shadow-[0_20px_60px_rgba(239,68,68,0.3)] backdrop-blur-2xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-red-950/80 border border-red-500/60 flex items-center justify-center text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <h2 className="text-sm font-black tracking-wider uppercase text-red-400">
                System Recovery Shield
              </h2>
              <div className="text-[10px] text-cyan-400 font-mono-code mt-0.5">
                Savage OS 2026 Process Exception Intercepted
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#040810] border border-red-500/30 text-left font-mono-code text-[11px] text-slate-300 max-h-32 overflow-y-auto leading-relaxed">
              {this.state.error?.message || 'An unexpected system runtime exception was caught safely.'}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={this.handleRecoverSession}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(56,189,248,0.4)] transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recover Current Session</span>
              </button>

              <button
                onClick={this.handleFullReset}
                className="w-full py-2 rounded-lg bg-[#0d1626] hover:bg-[#16253e] text-slate-400 hover:text-white border border-[#1e293b] font-medium text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Reset Local Cache & Reload</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <GlobalSystemErrorBoundary>
    <App />
  </GlobalSystemErrorBoundary>
);
