import { FileItem, TreeNode } from '../types';
import { INITIAL_FILES, FOLDER_TREE } from '../data/mockData';

const STORAGE_KEY = 'termux_gui_filesystem_v2';
const TREE_STORAGE_KEY = 'termux_gui_foldertree_v2';

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

  private constructor() {
    this.load();
  }

  public static getInstance(): FileManagerService {
    if (!FileManagerService.instance) {
      FileManagerService.instance = new FileManagerService();
    }
    return FileManagerService.instance;
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
    this.redoStack = []; // Clear redo history on new user action
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): string | null {
    if (this.undoStack.length === 0) return null;

    // Push current state to redo stack
    const currentSnapshot: HistoryState = {
      files: JSON.parse(JSON.stringify(this.files)),
      tree: JSON.parse(JSON.stringify(this.tree)),
      description: 'Current State'
    };
    this.redoStack.push(currentSnapshot);

    // Pop state from undo stack
    const previousState = this.undoStack.pop()!;
    this.files = previousState.files;
    this.tree = previousState.tree;

    this.save();
    return previousState.description;
  }

  public redo(): string | null {
    if (this.redoStack.length === 0) return null;

    // Push current state to undo stack
    const currentSnapshot: HistoryState = {
      files: JSON.parse(JSON.stringify(this.files)),
      tree: JSON.parse(JSON.stringify(this.tree)),
      description: 'Current State'
    };
    this.undoStack.push(currentSnapshot);

    // Pop state from redo stack
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
    return [...this.files];
  }

  public getTree(): TreeNode {
    return this.tree;
  }

  public getFilesByPath(dirPath: string): FileItem[] {
    const cleanPath = dirPath.replace(/\/+$/, '');
    return this.files.filter((f) => {
      const parent = f.path.substring(0, f.path.lastIndexOf('/'));
      return parent === cleanPath;
    });
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
    if (!item) return false;

    this.pushHistory(`Deleted '${item.name}'`);

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

    item.name = newName;
    item.path = newPath;
    item.modified = this.formatDate(new Date());

    if (item.isFolder) {
      this.files.forEach((f) => {
        if (f.path.startsWith(`${oldPath}/`)) {
          f.path = f.path.replace(oldPath, newPath);
        }
      });
    }

    this.save();
    return true;
  }

  public downloadFile(file: FileItem): void {
    const content = file.content || `[Binary payload for ${file.name}]`;
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
    const cleanParent = targetDir.replace(/\/+$/, '');
    const isBinary =
      fileObj.name.endsWith('.vrm') ||
      fileObj.name.endsWith('.glb') ||
      fileObj.name.endsWith('.gltf') ||
      fileObj.name.endsWith('.obj') ||
      fileObj.name.endsWith('.png') ||
      fileObj.name.endsWith('.jpg');

    let content = '';
    if (isBinary) {
      content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(fileObj);
      });
    } else {
      content = await fileObj.text();
    }

    let type: FileItem['type'] = 'Text';
    if (fileObj.name.endsWith('.vrm')) type = 'VRM';
    else if (fileObj.name.endsWith('.glb') || fileObj.name.endsWith('.gltf')) type = 'glTF';
    else if (fileObj.name.endsWith('.json')) type = 'JSON';
    else if (fileObj.name.endsWith('.cpp') || fileObj.name.endsWith('.h')) type = 'C++ Source';
    else if (fileObj.name.endsWith('.sh')) type = 'Shell Script';
    else if (fileObj.name.endsWith('.md')) type = 'Markdown';

    return this.createFile(cleanParent, fileObj.name, type, content);
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
