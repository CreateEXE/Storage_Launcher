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

  private constructor() {
    this.isNativeStorageAvailable = typeof window !== 'undefined' && !!window.AndroidStorage;
    this.isSafAvailable = typeof window !== 'undefined' && !!window.SafStorage;

    if (typeof window !== 'undefined') {
      window.onSafPermissionGranted = (treeUri: string) => {
        console.log('SAF Storage Permission Granted:', treeUri);
        this.currentNativeDirPath = treeUri;
        this.syncFromNativeStorage(treeUri);
      };
    }

    if (this.isSafActive() && window.SafStorage) {
      this.currentNativeDirPath = window.SafStorage.getPersistedUriString();
      this.syncFromNativeStorage(this.currentNativeDirPath);
    } else if (this.isNativeStorageAvailable && window.AndroidStorage) {
      this.currentNativeDirPath = window.AndroidStorage.getStorageRootPath();
      this.syncFromNativeStorage(this.currentNativeDirPath);
    } else {
      this.load();
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
    return typeof window !== 'undefined' && !!window.SafStorage && window.SafStorage.hasPersistedPermission();
  }

  public openSafPicker(): void {
    if (typeof window !== 'undefined' && window.SafStorage) {
      window.SafStorage.openDocumentTree();
    } else if (this.isNativeStorageAvailable && window.AndroidStorage) {
      window.AndroidStorage.requestStoragePermission();
    }
  }

  public getNativeRootPath(): string {
    if (this.isSafActive() && window.SafStorage) {
      return window.SafStorage.getPersistedUriString();
    }
    if (this.isNativeStorageAvailable && window.AndroidStorage) {
      return window.AndroidStorage.getStorageRootPath();
    }
    return '/storage/emulated/0';
  }

  public requestNativePermission(): void {
    this.openSafPicker();
  }

  public syncFromNativeStorage(dirPath?: string): FileItem[] {
    const targetDir = dirPath || this.currentNativeDirPath || this.getNativeRootPath();
    this.currentNativeDirPath = targetDir;

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
        this.notify();
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
        this.notify();
        return nativeFiles;
      } catch (e) {
        console.warn('Native storage sync exception:', e);
      }
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
    try {
      const storedFiles = localStorage.getItem(STORAGE_KEY);
      if (storedFiles) {
        const parsed: FileItem[] = JSON.parse(storedFiles);
        const currentPaths = new Set(parsed.map((p) => p.path));
        const missing = INITIAL_FILES.filter((f) => !currentPaths.has(f.path));
        this.files = [...parsed, ...missing];
      } else {
        this.files = [...INITIAL_FILES];
        this.save();
      }

      const storedTree = localStorage.getItem(TREE_STORAGE_KEY);
      if (storedTree) {
        this.tree = JSON.parse(storedTree);
      } else {
        this.tree = JSON.parse(JSON.stringify(FOLDER_TREE));
      }
    } catch {
      this.files = [...INITIAL_FILES];
      this.tree = JSON.parse(JSON.stringify(FOLDER_TREE));
    }
  }

  private save(): void {
    try {
      if (!this.isNativeDeviceStorage()) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.files));
        localStorage.setItem(TREE_STORAGE_KEY, JSON.stringify(this.tree));
      }
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
    this.listeners.forEach((l) => l());
  }

  public getFiles(): FileItem[] {
    if (this.isNativeDeviceStorage()) {
      return this.syncFromNativeStorage();
    }
    return [...this.files];
  }

  public getTree(): TreeNode {
    return this.tree;
  }

  public getFilesByPath(dirPath: string): FileItem[] {
    if (this.isNativeDeviceStorage()) {
      return this.syncFromNativeStorage(dirPath);
    }

    const cleanPath = dirPath.replace(/\/+$/, '');
    return this.files.filter((f) => {
      const parent = f.path.substring(0, f.path.lastIndexOf('/'));
      return parent === cleanPath;
    });
  }

  public readFileContent(filePath: string, isBinary: boolean = false): string {
    if (this.isSafActive() && window.SafStorage) {
      if (isBinary) {
        const base64 = window.SafStorage.readSafFileAsBase64(filePath);
        if (!base64) return '';
        try {
          const byteCharacters = atob(base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/octet-stream' });
          return URL.createObjectURL(blob);
        } catch {
          return '';
        }
      }
      return window.SafStorage.readSafFileAsString(filePath);
    }

    if (this.isNativeStorageAvailable && window.AndroidStorage) {
      if (isBinary) {
        const base64 = window.AndroidStorage.readFileAsBase64(filePath);
        if (!base64) return '';
        try {
          const byteCharacters = atob(base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/octet-stream' });
          return URL.createObjectURL(blob);
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
      const createdUri = window.SafStorage.writeSafFile(cleanParent, name, content, isBase64);
      this.syncFromNativeStorage(cleanParent);
    } else if (this.isNativeStorageAvailable && window.AndroidStorage) {
      const isBase64 = content.startsWith('data:') && content.includes(';base64,');
      window.AndroidStorage.writeFile(path, content, isBase64);
      this.syncFromNativeStorage(cleanParent);
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
      window.SafStorage.createSafDirectory(cleanParent, folderName);
      this.syncFromNativeStorage(cleanParent);
    } else if (this.isNativeStorageAvailable && window.AndroidStorage) {
      window.AndroidStorage.createDirectory(path);
      this.syncFromNativeStorage(cleanParent);
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
      window.SafStorage.deleteSafDocument(path);
      const parentDir = path.substring(0, path.lastIndexOf('/')) || this.getNativeRootPath();
      this.syncFromNativeStorage(parentDir);
      return true;
    }

    if (this.isNativeStorageAvailable && window.AndroidStorage) {
      window.AndroidStorage.deletePath(path);
      const parentDir = path.substring(0, path.lastIndexOf('/'));
      this.syncFromNativeStorage(parentDir);
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

    this.pushHistory(`Renamed '${item.name}' to '${newName}'`);

    const parent = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${parent}/${newName}`;

    const isBinary = item.type === 'VRM' || item.type === 'glTF' || item.type === 'Image';
    const content = this.readFileContent(oldPath, isBinary);
    if (content) {
      this.createFile(parent, newName, item.type, content);
      this.deleteItem(oldPath);
      return true;
    }

    return true;
  }

  public downloadFile(file: FileItem): void {
    const content = file.content || this.readFileContent(file.path, true) || `[Binary payload for ${file.name}]`;
    const blob = new Blob([content], { type: 'application/octet-stream' });
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
    const isBinary =
      fileObj.name.endsWith('.vrm') ||
      fileObj.name.endsWith('.glb') ||
      fileObj.name.endsWith('.gltf') ||
      fileObj.name.endsWith('.obj') ||
      fileObj.name.endsWith('.png') ||
      fileObj.name.endsWith('.jpg');

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
      if (fileObj.name.endsWith('.vrm')) type = 'VRM';
      else if (fileObj.name.endsWith('.glb') || fileObj.name.endsWith('.gltf')) type = 'glTF';
      else if (fileObj.name.endsWith('.json')) type = 'JSON';
      else if (fileObj.name.endsWith('.cpp') || fileObj.name.endsWith('.h')) type = 'C++ Source';
      else if (fileObj.name.endsWith('.sh')) type = 'Shell Script';
      else if (fileObj.name.endsWith('.md')) type = 'Markdown';

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
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
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
