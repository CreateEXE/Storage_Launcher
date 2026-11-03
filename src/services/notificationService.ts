export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  durationMs?: number;
}

export interface FileTransferProgress {
  id: string;
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  progressPct: number;
  speedKbps: number;
  startTime: number;
  status: 'transferring' | 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private toasts: ToastItem[] = [];
  private transfers: Map<string, FileTransferProgress> = new Map();
  private listeners: (() => void)[] = [];

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  public getToasts(): ToastItem[] {
    return [...this.toasts];
  }

  public getTransfers(): FileTransferProgress[] {
    return Array.from(this.transfers.values());
  }

  public addToast(
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    durationMs: number = 4000
  ): string {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const toast: ToastItem = {
      id,
      title,
      message,
      type,
      timestamp: Date.now(),
      durationMs
    };

    this.toasts.push(toast);
    this.notify();

    if (durationMs > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, durationMs);
    }

    return id;
  }

  public removeToast(id: string): void {
    const initialLen = this.toasts.length;
    this.toasts = this.toasts.filter((t) => t.id !== id);
    if (this.toasts.length < initialLen) {
      this.notify();
    }
  }

  public startTransfer(fileName: string, totalBytes: number): string {
    const id = `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const transfer: FileTransferProgress = {
      id,
      fileName,
      bytesTransferred: 0,
      totalBytes: Math.max(1, totalBytes),
      progressPct: 0,
      speedKbps: 0,
      startTime: Date.now(),
      status: 'transferring'
    };

    this.transfers.set(id, transfer);
    this.notify();
    return id;
  }

  public updateTransferProgress(id: string, bytesTransferred: number): void {
    const transfer = this.transfers.get(id);
    if (!transfer || transfer.status !== 'transferring') return;

    const now = Date.now();
    const elapsedSec = Math.max(0.1, (now - transfer.startTime) / 1000);

    transfer.bytesTransferred = Math.min(transfer.totalBytes, bytesTransferred);
    transfer.progressPct = Math.min(100, Math.round((transfer.bytesTransferred / transfer.totalBytes) * 100));
    transfer.speedKbps = Math.round(transfer.bytesTransferred / 1024 / elapsedSec);

    this.notify();
  }

  public finishTransfer(id: string, success: boolean, message?: string): void {
    const transfer = this.transfers.get(id);
    if (!transfer) return;

    if (success) {
      transfer.status = 'completed';
      transfer.bytesTransferred = transfer.totalBytes;
      transfer.progressPct = 100;
      this.addToast('File Transfer Complete', `'${transfer.fileName}' transferred successfully.`, 'success', 3500);
    } else {
      transfer.status = 'failed';
      transfer.errorMessage = message || 'Transfer failed';
      this.addToast('File Transfer Failed', `'${transfer.fileName}': ${message || 'Error transferring file.'}`, 'error', 5000);
    }

    this.notify();

    // Auto cleanup transfer progress item after 5 seconds
    setTimeout(() => {
      this.transfers.delete(id);
      this.notify();
    }, 5000);
  }

  public cancelTransfer(id: string): void {
    const transfer = this.transfers.get(id);
    if (!transfer) return;

    transfer.status = 'cancelled';
    this.addToast('Transfer Cancelled', `Operation for '${transfer.fileName}' was cancelled.`, 'warning', 3000);
    this.transfers.delete(id);
    this.notify();
  }
}
