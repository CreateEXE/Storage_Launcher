import { FileItem, TreeNode } from '../types';
import { INITIAL_FILES, FOLDER_TREE } from '../data/mockData';
import { NotificationService } from './notificationService';

const STORAGE_KEY = 'termux_gui_filesystem_v2';
const TREE_STORAGE_KEY = 'termux_gui_foldertree_v2';

declare global {
  interface Window {
    AndroidStorage?: {
      hasStoragePermission: () => boolean;
      requestStoragePermission: () => void;
      getStorageRootPath: () => string;
      listDirectory: (dirPath: string) => string;
      readFileAsBase64: (filePath: string) => string;
      readFileAsString: (filePath: string) => string;
      writeFile: (filePath: string, content: string, isBase64: boolean) => boolean;
      deletePath: (filePath: string) => boolean;
      createDirectory: (dirPath: string) => boolean;
    };
    SafStorage?: {
      hasPersistedPermission: () => boolean;
      getPersistedUriString: () => string;
      openDocumentTree: () => void;
      listSafDirectory: (uriOrPath: string) => string;
      readSafFileAsString: (fileUriStr: string) => string;
      readSafFileAsBase64: (fileUriStr: string) => string;
      writeSafFile: (parentUriOrPath: string, fileName: string, content: string, isBase64: boolean) => string;
      createSafDirectory: (parentUriOrPath: string, dirName: string) => string;
      deleteSafDocument: (documentUriStr: string) => boolean;
    };
    onSafPermissionGranted?: (treeUri: string) => void;
  }
}

interface HistoryState {
  files: FileItem[];
  tree: TreeNode;
  description: string;
}

export class FileManagerService {
  private static instance: FileManagerService;
  private files: FileItem[] = [];
  private tree: TreeNode = FOLDER_TREE;
  private listeners: (() => void)[] = [];

  // Undo / Redo Stacks
  private undoStack: HistoryState[] = [];
  private redoStack: HistoryState[] = [];
  private maxHistory: number = 30;

  private isNativeStorageAvailable: boolean = false;
  private isSafAvailable: boolean = false;
  private currentNativeDirPath: string = '';

  // Concurrency & Recursion Guards
  private isSyncing: boolean = false;
  private isNotifying: boolean = false;
  private notifyDebounceTimer: any = null;

  private constructor() {
    this.isNativeStorageAvailable = typeof window !== 'undefined' && !!window.AndroidStorage;
    this.isSafAvailable = typeof window !== 'undefined' && !!window.SafStorage;

    if (typeof window !== 'undefined') {
      window.onSafPermissionGranted = (treeUri: string) => {
        this.currentNativeDirPath = treeUri;
        this.syncFromNativeStorage(treeUri, true);
      };
    }

    // Load initial fallback state immediately
    this.load();

    // If native storage exists, perform one background sync without blocking constructor.
    // Bridge calls can throw (e.g. a Java exception escaping a
    // @JavascriptInterface method) — that must never propagate out of
    // this constructor: it runs during the first render, so an uncaught
    // throw lands the whole app on the SYSTEM RECOVERY SHIELD instead of
    // the desktop. A failed root lookup just leaves
    // currentNativeDirPath empty; the sync below and getNativeRootPath()
    // fall back to the default external-storage path, and the user can
    // still grant folder access from File Explorer's "Grant Permissions".
    try {
      if (this.isSafActive() && window.SafStorage) {
        this.currentNativeDirPath = window.SafStorage.getPersistedUriString();
        setTimeout(() => this.syncFromNativeStorage(this.currentNativeDirPath, true), 10);
      } else if (this.isNativeStorageAvailable && window.AndroidStorage) {
        this.currentNativeDirPath = window.AndroidStorage.getStorageRootPath();
        setTimeout(() => this.syncFromNativeStorage(this.currentNativeDirPath, true), 10);
      }
    } catch (e) {
      console.warn('Native storage root lookup failed at startup, continuing without it:', e);
      this.currentNativeDirPath = '';
    }
  }

  public static getInstance(): FileManagerService {
    if (!FileManagerService.instance) {
      FileManagerService.instance = new FileManagerService();
    }
    return FileManagerService.instance;
  }

  public isNativeDeviceStorage(): boolean {
    return this.isNativeStorageAvailable || this.isSafActive();
  }

  public isSafActive(): boolean {
    // Guarded: this is called from the constructor and from every
    // storage path, so a bridge throw here must not take the app down.
    try {
      return typeof window !== 'undefined' && !!window.SafStorage && window.SafStorage.hasPersistedPermission();
    } catch (e) {
      console.warn('SAF permission check failed, treating SAF as inactive:', e);
      return false;
    }
  }

  public openSafPicker(): void {
    if (typeof window !== 'undefined' && window.SafStorage) {
      window.SafStorage.openDocumentTree();
    } else if (this.isNativeStorageAvailable && window.AndroidStorage) {
      window.AndroidStorage.requestStoragePermission();
    }
  }

  public getNativeRootPath(): string {
    try {
      if (this.isSafActive() && window.SafStorage) {
        return window.SafStorage.getPersistedUriString();
      }
      if (this.isNativeStorageAvailable && window.AndroidStorage) {
        return window.AndroidStorage.getStorageRootPath();
      }
    } catch (e) {
      console.warn('Native root path lookup failed, using default external-storage path:', e);
    }
    return '/storage/emulated/0';
  }

  public requestNativePermission(): void {
    this.openSafPicker();
  }

  public syncFromNativeStorage(dirPath?: string, shouldNotify: boolean = true): FileItem[] {
    if (this.isSyncing) {
      return this.files;
    }

    const targetDir = dirPath || this.currentNativeDirPath || this.getNativeRootPath();
    this.currentNativeDirPath = targetDir;
    this.isSyncing = true;

    try {
      // 1. SAF Storage Access Framework Path
      if (this.isSafActive() && window.SafStorage) {
        try {
          const rawJson = window.SafStorage.listSafDirectory(targetDir);
          const parsed = JSON.parse(rawJson || '[]');

          const safFiles: FileItem[] = parsed.map((item: any) => ({
            id: `saf_${item.uri.replace(/[^a-zA-Z0-9]/g, '_')}`,
            name: item.name,
            size: item.isFolder ? '--' : this.formatBytes(item.sizeBytes || 0),
            sizeBytes: item.sizeBytes || 0,
            type: item.type || (item.isFolder ? 'Folder' : 'File'),
            modified: item.modified || this.formatDate(new Date()),
            isFolder: item.isFolder,
            path: item.uri,
            created: item.modified || this.formatDate(new Date())
          }));

          this.files = safFiles;
          this.buildTreeFromNativePath(targetDir, safFiles);
          if (shouldNotify) {
            this.notify();
          }
          return safFiles;
        } catch (e) {
          console.warn('SAF storage sync exception:', e);
        }
      }

      // 2. Direct File Bridge Path
      if (this.isNativeStorageAvailable && window.AndroidStorage) {
        try {
          const rawJson = window.AndroidStorage.listDirectory(targetDir);
          const parsed = JSON.parse(rawJson || '[]');

          const nativeFiles: FileItem[] = parsed.map((item: any) => ({
            id: `native_${item.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
            name: item.name,
            size: item.isFolder ? '--' : this.formatBytes(item.sizeBytes || 0),
            sizeBytes: item.sizeBytes || 0,
            type: item.type || (item.isFolder ? 'Folder' : 'File'),
            modified: item.modified || this.formatDate(new Date()),
            isFolder: item.isFolder,
            path: item.path,
            created: item.modified || this.formatDate(new Date())
          }));

          this.files = nativeFiles;
          this.buildTreeFromNativePath(targetDir, nativeFiles);
          if (shouldNotify) {
            this.notify();
          }
          return nativeFiles;
        } catch (e) {
          console.warn('Native storage sync exception:', e);
        }
      }
    } finally {
      this.isSyncing = false;
    }

    return this.files;
  }

  private buildTreeFromNativePath(currentDir: string, currentFiles: FileItem[]): void {
    const childrenNodes: TreeNode[] = currentFiles
      .filter((f) => f.isFolder)
      .map((f) => ({
        name: f.name,
        path: f.path,
        isOpen: false
      }));

    this.tree = {
      name: this.isSafActive() ? 'SAF Storage Tree (/sdcard)' : 'Device Storage (/sdcard)',
      path: currentDir,
      isOpen: true,
      children: childrenNodes
    };
  }

  private load(): void {
    // Mock INITIAL_FILES are only a web-preview fallback. On a device with
    // native/SAF storage they must not be merged back in on every launch
    // as if they were real files (phantom "Chimera" project files).
    const useMock = !this.isNativeDeviceStorage();
    try {
      const storedFiles = localStorage.getItem(STORAGE_KEY);
      if (storedFiles) {
        const parsed: FileItem[] = JSON.parse(storedFiles);
        if (useMock) {
          const currentPaths = new Set(parsed.map((p) => p.path));
          const missing = INITIAL_FILES.filter((f) => !currentPaths.has(f.path));
          this.files = [...parsed, ...missing];
        } else {
          this.files = [...parsed];
        }
      } else {
        this.files = useMock ? [...INITIAL_FILES] : [];
      }

      const storedTree = localStorage.getItem(TREE_STORAGE_KEY);
      if (storedTree) {
        this.tree = JSON.parse(storedTree);
      } else {
        this.tree = JSON.parse(JSON.stringify(FOLDER_TREE));
      }
    } catch {
      this.files = useMock ? [...INITIAL_FILES] : [];
      this.tree = JSON.parse(JSON.stringify(FOLDER_TREE));
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.files));
      localStorage.setItem(TREE_STORAGE_KEY, JSON.stringify(this.tree));
      this.notify();
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  private pushHistory(description: string): void {
    const snapshot: HistoryState = {
      files: JSON.parse(JSON.stringify(this.files)),
      tree: JSON.parse(JSON.stringify(this.tree)),
      description
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): string | null {
    if (this.undoStack.length === 0) return null;

    const currentSnapshot: HistoryState = {
      files: JSON.parse(JSON.stringify(this.files)),
      tree: JSON.parse(JSON.stringify(this.tree)),
      description: 'Current State'
    };
    this.redoStack.push(currentSnapshot);

    const previousState = this.undoStack.pop()!;
    this.files = previousState.files;
    this.tree = previousState.tree;

    this.save();
    return previousState.description;
  }

  public redo(): string | null {
    if (this.redoStack.length === 0) return null;

    const currentSnapshot: HistoryState = {
      files: JSON.parse(JSON.stringify(this.files)),
      tree: JSON.parse(JSON.stringify(this.tree)),
      description: 'Current State'
    };
    this.undoStack.push(currentSnapshot);

    const nextState = this.redoStack.pop()!;
    this.files = nextState.files;
    this.tree = nextState.tree;

    this.save();
    return nextState.description;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    if (this.isNotifying) {
      return;
    }

    if (this.notifyDebounceTimer) {
      clearTimeout(this.notifyDebounceTimer);
    }

    this.notifyDebounceTimer = setTimeout(() => {
      this.isNotifying = true;
      try {
        this.listeners.forEach((l) => {
          try {
            l();
          } catch (err) {
            console.error('Error in fileManager listener:', err);
          }
        });
      } finally {
        this.isNotifying = false;
      }
    }, 40);
  }

  // PURE GETTER: Never trigger notify or synchronous recursion
  public getFiles(): FileItem[] {
    return [...this.files];
  }

  public getTree(): TreeNode {
    return this.tree;
  }

  // PURE GETTER: Queries the directory without modifying this.files or calling notify()
  public getFilesByPath(dirPath: string): FileItem[] {
    if (this.isSafActive() && window.SafStorage) {
      try {
        const rawJson = window.SafStorage.listSafDirectory(dirPath);
        const parsed = JSON.parse(rawJson || '[]');
        return parsed.map((item: any) => ({
          id: `saf_${item.uri.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: item.name,
          size: item.isFolder ? '--' : this.formatBytes(item.sizeBytes || 0),
          sizeBytes: item.sizeBytes || 0,
          type: item.type || (item.isFolder ? 'Folder' : 'File'),
          modified: item.modified || this.formatDate(new Date()),
          isFolder: item.isFolder,
          path: item.uri,
          created: item.modified || this.formatDate(new Date())
        }));
      } catch (e) {
        console.warn('Error reading SAF directory in getFilesByPath:', e);
        return [];
      }
    }

    if (this.isNativeStorageAvailable && window.AndroidStorage) {
      try {
        const rawJson = window.AndroidStorage.listDirectory(dirPath);
        const parsed = JSON.parse(rawJson || '[]');
        return parsed.map((item: any) => ({
          id: `native_${item.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: item.name,
          size: item.isFolder ? '--' : this.formatBytes(item.sizeBytes || 0),
          sizeBytes: item.sizeBytes || 0,
          type: item.type || (item.isFolder ? 'Folder' : 'File'),
          modified: item.modified || this.formatDate(new Date()),
          isFolder: item.isFolder,
          path: item.path,
          created: item.modified || this.formatDate(new Date())
        }));
      } catch (e) {
        console.warn('Error reading AndroidStorage directory in getFilesByPath:', e);
        return [];
      }
    }

    const cleanPath = dirPath.replace(/\/+$/, '');
    return this.files.filter((f) => {
      const parent = f.path.substring(0, f.path.lastIndexOf('/'));
      return parent === cleanPath;
    });
  }

  public readFileContent(filePath: string, isBinary: boolean = false): string {
    // Binary reads ALWAYS return the file's bytes as a data: URL — never a
    // raw content:// or file:// path string. The WebView page
    // (https://appassets.androidplatform.net) cannot fetch content:// or file://
    // URLs, and every binary consumer (Viewer3D's data:/blob: gate,
    // normalizeModelFileForViewer, bulk copy/move, downloadFile) treats a
    // path string as unreadable data. Previously this method returned
    // content:// / file:// paths unchanged for binary reads, which made the
    // SAF/AndroidStorage base64 branches below dead code for real device
    // files and made every 3D file tapped in the device-storage browser
    // fail with "Could not read model data". No caller depends on the old
    // passthrough: renameItem already reads base64 directly for native
    // binary files, and the other callers all handle data: URLs.
    //
    // Size limits: the native bridges read whole files into memory before
    // base64-encoding them (SAF: 30MB, direct storage: 40MB). A file over
    // its limit is refused HERE, with a clear error, instead of letting
    // the bridge return a truncated partial file that looks complete.
    // Callers must catch the thrown Error and show it to the user.
    const BINARY_READ_LIMIT = this.isSafActive() ? 30 * 1024 * 1024 : 40 * 1024 * 1024;
    if (isBinary) {
      const known = this.files.find((f) => f.path === filePath);
      const sizeBytes = known?.sizeBytes || 0;
      if (sizeBytes > BINARY_READ_LIMIT) {
        throw new Error(
          `"${known?.name || filePath}" is ${this.formatBytes(sizeBytes)} — too large to load into memory ` +
          `(limit ${this.formatBytes(BINARY_READ_LIMIT)} for device-storage files). ` +
          `Use a smaller file.`
        );
      }
    }

    if (this.isSafActive() && window.SafStorage) {
      if (isBinary) {
        const base64 = window.SafStorage.readSafFileAsBase64(filePath);
        if (!base64) {
          const known = this.files.find((f) => f.path === filePath);
          if ((known?.sizeBytes || 0) > 0) {
            throw new Error(`Could not read "${known?.name || filePath}" from device storage.`);
          }
          return '';
        }
        try {
          return `data:application/octet-stream;base64,${base64}`;
        } catch {
          return '';
        }
      }
      return window.SafStorage.readSafFileAsString(filePath);
    }

    if (this.isNativeStorageAvailable && window.AndroidStorage) {
      if (isBinary) {
        const base64 = window.AndroidStorage.readFileAsBase64(filePath);
        if (!base64) {
          const known = this.files.find((f) => f.path === filePath);
          if ((known?.sizeBytes || 0) > 0) {
            throw new Error(`Could not read "${known?.name || filePath}" from device storage.`);
          }
          return '';
        }
        try {
          return `data:application/octet-stream;base64,${base64}`;
        } catch {
          return '';
        }
      }
      return window.AndroidStorage.readFileAsString(filePath);
    }

    const item = this.files.find((f) => f.path === filePath);
    return item?.content || '';
  }

  public createFile(
    parentPath: string,
    name: string,
    type: FileItem['type'],
    content: string = ''
  ): FileItem {
    this.pushHistory(`Created file '${name}'`);

    const cleanParent = parentPath.replace(/\/+$/, '');
    const path = `${cleanParent}/${name}`;
    const sizeBytes = new Blob([content]).size;

    if (this.isSafActive() && window.SafStorage) {
      const isBase64 = content.startsWith('data:') && content.includes(';base64,');
      const writtenUri = window.SafStorage.writeSafFile(cleanParent, name, content, isBase64);
      if (!writtenUri) throw new Error(`Failed to write file via SAF: ${path}`);
      setTimeout(() => this.syncFromNativeStorage(cleanParent, true), 10);
    } else if (this.isNativeStorageAvailable && window.AndroidStorage) {
      const isBase64 = content.startsWith('data:') && content.includes(';base64,');
      const written = window.AndroidStorage.writeFile(path, content, isBase64);
      if (!written) throw new Error(`Failed to write file: ${path}`);
      setTimeout(() => this.syncFromNativeStorage(cleanParent, true), 10);
    }

    const newFile: FileItem = {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      size: this.formatBytes(sizeBytes),
      sizeBytes,
      type,
      modified: this.formatDate(new Date()),
      isFolder: false,
      path,
      created: this.formatDate(new Date()),
      content
    };

    const existingIdx = this.files.findIndex((f) => f.path === path);
    if (existingIdx >= 0) {
      this.files[existingIdx] = newFile;
    } else {
      this.files.push(newFile);
    }

    this.save();
    return newFile;
  }

  public createFolder(parentPath: string, folderName: string): FileItem {
    this.pushHistory(`Created folder '${folderName}'`);

    const cleanParent = parentPath.replace(/\/+$/, '');
    const path = `${cleanParent}/${folderName}`;

    if (this.isSafActive() && window.SafStorage) {
      const createdUri = window.SafStorage.createSafDirectory(cleanParent, folderName);
      if (!createdUri) throw new Error(`Failed to create directory via SAF: ${path}`);
      setTimeout(() => this.syncFromNativeStorage(cleanParent, true), 10);
    } else if (this.isNativeStorageAvailable && window.AndroidStorage) {
      const created = window.AndroidStorage.createDirectory(path);
      if (!created) throw new Error(`Failed to create directory: ${path}`);
      setTimeout(() => this.syncFromNativeStorage(cleanParent, true), 10);
    }

    const newFolder: FileItem = {
      id: `dir_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: folderName,
      size: '--',
      sizeBytes: 0,
      type: 'Folder',
      modified: this.formatDate(new Date()),
      isFolder: true,
      path,
      created: this.formatDate(new Date())
    };

    if (!this.files.some((f) => f.path === path)) {
      this.files.push(newFolder);
    }

    this.addNodeToTree(this.tree, cleanParent, folderName, path);
    this.save();
    return newFolder;
  }

  public deleteItem(path: string): boolean {
    const item = this.files.find((f) => f.path === path);
    if (item) {
      this.pushHistory(`Deleted '${item.name}'`);
    }

    if (this.isSafActive() && window.SafStorage) {
      const deleted = window.SafStorage.deleteSafDocument(path);
      if (!deleted) return false;
      const parentDir = path.substring(0, path.lastIndexOf('/')) || this.getNativeRootPath();
      // Remove the local entry now; the background sync will confirm it.
      this.files = this.files.filter((f) => f.path !== path && !f.path.startsWith(`${path}/`));
      this.removeNodeFromTree(this.tree, path);
      this.save();
      setTimeout(() => this.syncFromNativeStorage(parentDir, true), 10);
      return true;
    }

    if (this.isNativeStorageAvailable && window.AndroidStorage) {
      const deleted = window.AndroidStorage.deletePath(path);
      if (!deleted) return false;
      const parentDir = path.substring(0, path.lastIndexOf('/'));
      this.files = this.files.filter((f) => f.path !== path && !f.path.startsWith(`${path}/`));
      this.removeNodeFromTree(this.tree, path);
      this.save();
      setTimeout(() => this.syncFromNativeStorage(parentDir, true), 10);
      return true;
    }

    const initialLen = this.files.length;
    this.files = this.files.filter((f) => f.path !== path && !f.path.startsWith(`${path}/`));
    this.removeNodeFromTree(this.tree, path);
    this.save();
    return this.files.length < initialLen;
  }

  public renameItem(oldPath: string, newName: string): boolean {
    const item = this.files.find((f) => f.path === oldPath);
    if (!item) return false;
    if (!newName || newName.includes('/') || newName.includes('\0')) return false;
    // Folders have no copy-based rename in this service; refusing is safer
    // than copying a folder as if it were a file and deleting the original.
    if (item.isFolder) return false;

    const parent = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${parent}/${newName}`;
    if (newPath === oldPath) return true;
    if (this.files.some((f) => f.path === newPath)) return false;

    this.pushHistory(`Renamed '${item.name}' to '${newName}'`);

    const lowerName = item.name.toLowerCase();
    const isBinary =
      item.type === 'VRM' ||
      item.type === 'glTF' ||
      item.type === 'Image' ||
      lowerName.endsWith('.vrm') ||
      lowerName.endsWith('.glb') ||
      lowerName.endsWith('.gltf') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp') ||
      lowerName.endsWith('.zip') ||
      lowerName.endsWith('.pdf');

    // Binary-safe read: never use a file:// path string as file content.
    // readFileContent(oldPath, true) used to return a file:// path for
    // native files, which the old code wrote as the new file's content and
    // then deleted the original — data loss. It now returns the bytes as a
    // data: URL instead, but rename still reads base64 directly from the
    // native/SAF bridge so the copy can be verified byte-for-byte.
    let content = '';
    let originalBase64 = '';
    if (isBinary && (this.isSafActive() || this.isNativeStorageAvailable)) {
      originalBase64 = this.isSafActive() && window.SafStorage
        ? window.SafStorage.readSafFileAsBase64(oldPath)
        : window.AndroidStorage
          ? window.AndroidStorage.readFileAsBase64(oldPath)
          : '';
      if (!originalBase64) return false;
      content = `data:application/octet-stream;base64,${originalBase64}`;
    } else {
      content = this.readFileContent(oldPath, isBinary);
      // A non-empty source file must not rename to empty content. An empty
      // text file (sizeBytes 0) is the only legitimate empty case.
      if (!content && (item.sizeBytes || 0) > 0) return false;
      if (isBinary && (content.startsWith('file://') || content.startsWith('content://'))) {
        return false;
      }
    }

    this.createFile(parent, newName, item.type, content);

    // Verify the copy before deleting the original. If verification fails,
    // remove the partial new file and keep the original.
    const copied = this.files.find((f) => f.path === newPath);
    if (!copied) return false;
    if (isBinary && (this.isSafActive() || this.isNativeStorageAvailable)) {
      const copiedBase64 = this.isSafActive() && window.SafStorage
        ? window.SafStorage.readSafFileAsBase64(newPath)
        : window.AndroidStorage
          ? window.AndroidStorage.readFileAsBase64(newPath)
          : '';
      if (!copiedBase64 || copiedBase64.length !== originalBase64.length) {
        this.deleteItem(newPath);
        return false;
      }
    } else if (!isBinary) {
      const copiedContent = this.readFileContent(newPath, false);
      if (copiedContent !== content) {
        this.deleteItem(newPath);
        return false;
      }
    }

    const deleted = this.deleteItem(oldPath);
    if (!deleted) {
      // Copy succeeded but the original could not be removed. Keep both
      // and report failure rather than claiming a successful rename.
      return false;
    }
    return true;
  }

  public downloadFile(file: FileItem): void {
    const content = file.content || this.readFileContent(file.path, true) || '';
    if (!content || content.startsWith('file://') || content.startsWith('content://')) {
      // A path string is not file data. Refuse instead of downloading a
      // text file containing the literal path.
      console.warn(`Cannot download ${file.name}: no file data available (got a path, not content).`);
      return;
    }
    let blob: Blob;
    if (content.startsWith('data:') && content.includes(';base64,')) {
      const base64 = content.substring(content.indexOf(';base64,') + 8);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      blob = new Blob([bytes], { type: 'application/octet-stream' });
    } else {
      blob = new Blob([content], { type: 'application/octet-stream' });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public async uploadFile(fileObj: File, targetDir: string): Promise<FileItem> {
    const notif = NotificationService.getInstance();
    const transferId = notif.startTransfer(fileObj.name, fileObj.size);

    const cleanParent = targetDir.replace(/\/+$/, '');
    const lowerName = fileObj.name.toLowerCase();
    const isBinary =
      lowerName.endsWith('.vrm') ||
      lowerName.endsWith('.glb') ||
      lowerName.endsWith('.gltf') ||
      lowerName.endsWith('.obj') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp') ||
      lowerName.endsWith('.zip') ||
      lowerName.endsWith('.pdf');

    let content = '';
    try {
      if (isBinary) {
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onprogress = (e) => {
            if (e.lengthComputable) {
              notif.updateTransferProgress(transferId, e.loaded);
            }
          };
          reader.onload = () => {
            notif.updateTransferProgress(transferId, fileObj.size);
            resolve(reader.result as string);
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(fileObj);
        });
      } else {
        content = await fileObj.text();
        notif.updateTransferProgress(transferId, fileObj.size);
      }

      let type: FileItem['type'] = 'Text';
      if (lowerName.endsWith('.vrm')) type = 'VRM';
      else if (lowerName.endsWith('.glb') || lowerName.endsWith('.gltf')) type = 'glTF';
      else if (lowerName.endsWith('.json')) type = 'JSON';
      else if (lowerName.endsWith('.cpp') || lowerName.endsWith('.h')) type = 'C++ Source';
      else if (lowerName.endsWith('.sh')) type = 'Shell Script';
      else if (lowerName.endsWith('.md')) type = 'Markdown';

      const fileItem = this.createFile(cleanParent, fileObj.name, type, content);
      notif.finishTransfer(transferId, true);
      return fileItem;
    } catch (err: any) {
      notif.finishTransfer(transferId, false, err?.message || 'Upload error');
      throw err;
    }
  }

  private addNodeToTree(node: TreeNode, parentPath: string, name: string, path: string): boolean {
    if (node.path === parentPath) {
      if (!node.children) node.children = [];
      if (!node.children.some((c) => c.path === path)) {
        node.children.push({ name, path, isOpen: false });
      }
      return true;
    }
    if (node.children) {
      for (const child of node.children) {
        if (this.addNodeToTree(child, parentPath, name, path)) return true;
      }
    }
    return false;
  }

  private removeNodeFromTree(node: TreeNode, path: string): boolean {
    if (node.children) {
      const idx = node.children.findIndex((c) => c.path === path);
      if (idx >= 0) {
        node.children.splice(idx, 1);
        return true;
      }
      for (const child of node.children) {
        if (this.removeNodeFromTree(child, path)) return true;
      }
    }
    return false;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private formatDate(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${m}/${day} ${h}:${min}`;
  }
}

