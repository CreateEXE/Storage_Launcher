import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  HardDriveUpload,
  Check,
  XCircle
} from 'lucide-react';
import {
  NotificationService,
  ToastItem,
  FileTransferProgress
} from '../services/notificationService';

export const ToastNotificationStack: React.FC = () => {
  const notifService = NotificationService.getInstance();
  const [toasts, setToasts] = useState<ToastItem[]>(notifService.getToasts());
  const [transfers, setTransfers] = useState<FileTransferProgress[]>(notifService.getTransfers());

  useEffect(() => {
    const updateState = () => {
      setToasts(notifService.getToasts());
      setTransfers(notifService.getTransfers());
    };

    const unsubscribe = notifService.subscribe(updateState);
    return () => unsubscribe();
  }, [notifService]);

  if (toasts.length === 0 && transfers.length === 0) {
    return null;
  }

  const getToastIcon = (type: ToastItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed bottom-10 right-3 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none select-none">
      {/* File Transfer Progress Cards */}
      {transfers.map((tr) => (
        <div
          key={tr.id}
          className="pointer-events-auto bg-[#050b18]/95 backdrop-blur-2xl border border-cyan-500/50 rounded-xl p-3 shadow-[0_16px_40px_rgba(0,0,0,0.9),0_0_20px_rgba(56,189,248,0.25)] animate-in slide-in-from-right-5 duration-200"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <HardDriveUpload className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
              <span className="font-extrabold text-xs text-slate-100 truncate">
                {tr.fileName}
              </span>
            </div>
            <button
              onClick={() => notifService.cancelTransfer(tr.id)}
              className="text-slate-400 hover:text-rose-400 p-0.5 rounded hover:bg-[#0f1d33] transition-colors"
              title="Cancel Transfer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#081326] h-2 rounded-full overflow-hidden border border-[#1e293b] mb-1.5">
            <div
              className={`h-full transition-all duration-200 shadow-[0_0_10px_rgba(56,189,248,0.8)] ${
                tr.status === 'completed'
                  ? 'bg-emerald-400'
                  : tr.status === 'failed'
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
              style={{ width: `${tr.progressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-400">
            <span>
              {formatBytes(tr.bytesTransferred)} / {formatBytes(tr.totalBytes)} ({tr.progressPct}%)
            </span>
            <span className="text-cyan-300 font-bold">
              {tr.status === 'transferring' ? `${tr.speedKbps} KB/s` : tr.status.toUpperCase()}
            </span>
          </div>
        </div>
      ))}

      {/* Floating Toast Cards */}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start space-x-2.5 p-3 rounded-xl border backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.9)] animate-in slide-in-from-right-5 duration-200 ${
            toast.type === 'success'
              ? 'bg-[#041812]/95 border-emerald-500/50 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : toast.type === 'error'
              ? 'bg-[#1a080c]/95 border-rose-500/50 text-rose-100 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
              : toast.type === 'warning'
              ? 'bg-[#1a1306]/95 border-amber-500/50 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              : 'bg-[#06101f]/95 border-cyan-500/50 text-cyan-100 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
          }`}
        >
          {getToastIcon(toast.type)}
          <div className="flex-1 min-w-0 pr-1">
            <div className="font-extrabold text-xs leading-tight mb-0.5 tracking-tight">
              {toast.title}
            </div>
            <div className="text-[11px] opacity-90 leading-snug font-mono-code break-words">
              {toast.message}
            </div>
          </div>
          <button
            onClick={() => notifService.removeToast(toast.id)}
            className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-black/20 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
