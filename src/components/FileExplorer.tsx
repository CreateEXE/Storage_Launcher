import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  Minus,
  Square,
  X,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Search,
  LayoutGrid,
  List,
  FileCode,
  FileText,
  FileJson,
  FileBox,
  Terminal,
  File,
  Plus,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  Edit2,
  Check,
  HardDrive,
  Undo2,
  Redo2,
  CheckSquare,
  Copy,
  FolderInput,
  Layers
} from 'lucide-react';
import { FileItem, TreeNode } from '../types';
import { FileManagerService } from '../services/fileManager';

interface FileExplorerProps {
  files: FileItem[];
  selectedFile: FileItem | null;
  onSelectFile: (file: FileItem) => void;
  onOpenFile?: (file: FileItem) => void;
  onContextMenuFile?: (file: FileItem, x: number, y: number) => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  selectedFile,
  onSelectFile,
  onOpenFile,
  onContextMenuFile,
  onMinimize,
  onMaximize,
  onClose,
  isMaximized = false
}) => {
  const fs = FileManagerService.getInstance();
  const [currentPath, setCurrentPath] = useState(fs.getNativeRootPath());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    '/': true,
    '/storage': true,
    '/storage/emulated': true,
    '/storage/emulated/0': true
  });
  const [showSearchInput, setShowSearchInput] = useState(false);

  // Batch Selection State
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // New File/Folder Dialog State
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<FileItem['type']>('VRM');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const itemTouchPosRef = useRef({ x: 0, y: 0 });

  const [canUndo, setCanUndo] = useState(fs.canUndo());
  const [canRedo, setCanRedo] = useState(fs.canRedo());

  useEffect(() => {
    const updateHistoryState = () => {
      setCanUndo(fs.canUndo());
      setCanRedo(fs.canRedo());
    };
    const unsubscribe = fs.subscribe(updateHistoryState);
    return () => unsubscribe();
  }, [fs]);

  // Keyboard shortcut listener for Ctrl+Z / Ctrl+Y / Cmd+Z / Cmd+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (fs.canRedo()) {
            e.preventDefault();
            const desc = fs.redo();
            if (desc) showNotification(`Redo: ${desc}`);
          }
        } else {
          if (fs.canUndo()) {
            e.preventDefault();
            const desc = fs.undo();
            if (desc) showNotification(`Undo: ${desc}`);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (fs.canRedo()) {
          e.preventDefault();
          const desc = fs.redo();
          if (desc) showNotification(`Redo: ${desc}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fs]);

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 2500);
  };

  const handleUndo = () => {
    const desc = fs.undo();
    if (desc) showNotification(`Undid: ${desc}`);
  };

  const handleRedo = () => {
    const desc = fs.redo();
    if (desc) showNotification(`Redid: ${desc}`);
  };

  const toggleFolder = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleSelectFolder = (path: string) => {
    setCurrentPath(path);
  };

  const getFileIcon = (type: FileItem['type']) => {
    switch (type) {
      case 'Folder':
        return <Folder className="w-3.5 h-3.5 text-amber-400 fill-amber-400/80 shrink-0" />;
      case 'VRM':
      case 'glTF':
        return <FileBox className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />;
      case 'C++ Source':
        return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'JSON':
        return <FileJson className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
      case 'Markdown':
      case 'Text':
        return <FileText className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
      case 'Shell Script':
        return <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      default:
        return <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  // Create New File
  const handleCreateFileSubmit = () => {
    if (!newItemName.trim()) return;
    let finalName = newItemName.trim();
    if (newItemType === 'VRM' && !finalName.endsWith('.vrm')) finalName += '.vrm';
    else if (newItemType === 'glTF' && !finalName.endsWith('.glb')) finalName += '.glb';
    else if (newItemType === 'JSON' && !finalName.endsWith('.json')) finalName += '.json';
    else if (newItemType === 'C++ Source' && !finalName.endsWith('.cpp')) finalName += '.cpp';
    else if (newItemType === 'Shell Script' && !finalName.endsWith('.sh')) finalName += '.sh';
    else if (newItemType === 'Markdown' && !finalName.endsWith('.md')) finalName += '.md';

    const created = fs.createFile(currentPath, finalName, newItemType, `// ${finalName}\n// Created in Termux GUI`);
    onSelectFile(created);
    setIsCreatingFile(false);
    setNewItemName('');
    showNotification(`Created ${finalName}`);
  };

  // Create New Folder
  const handleCreateFolderSubmit = () => {
    if (!newItemName.trim()) return;
    const folder = fs.createFolder(currentPath, newItemName.trim());
    onSelectFile(folder);
    setIsCreatingFolder(false);
    setNewItemName('');
    showNotification(`Folder '${newItemName.trim()}' created`);
  };

  // Delete Item
  const handleDelete = () => {
    if (!selectedFile) return;
    if (confirm(`Delete '${selectedFile.name}' permanently?`)) {
      fs.deleteItem(selectedFile.path);
      showNotification(`Deleted ${selectedFile.name}`);
    }
  };

  // Rename Item
  const handleRenameSubmit = () => {
    if (!selectedFile || !newItemName.trim()) return;
    fs.renameItem(selectedFile.path, newItemName.trim());
    setIsRenaming(false);
    setNewItemName('');
    showNotification(`Renamed to ${newItemName.trim()}`);
  };

  // Download File to Device
  const handleDownload = () => {
    if (!selectedFile) return;
    fs.downloadFile(selectedFile);
    showNotification(`Exporting ${selectedFile.name}...`);
  };

  // Upload File from Phone/PC
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploaded = await fs.uploadFile(file, currentPath);
    onSelectFile(uploaded);
    showNotification(`Uploaded ${file.name}`);
  };

  const handleSetDefault = () => {
    alert("Termux GUI is registered as default scoped storage provider (/storage/emulated/0). Android intent action: android.intent.action.VIEW & GET_CONTENT.");
  };

  // Render recursive tree node
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = !!expandedFolders[node.path];
    const isSelected = currentPath === node.path;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path} className="select-none">
        <div
          onClick={() => handleSelectFolder(node.path)}
          style={{ paddingLeft: `${depth * 8 + 2}px` }}
          className={`flex items-center space-x-1 py-0.5 px-1 rounded cursor-pointer text-[10px] group transition-colors ${
            isSelected
              ? 'bg-[#0e3a6a] text-white font-medium shadow-[0_0_8px_rgba(14,58,106,0.5)]'
              : 'text-slate-300 hover:bg-[#121c2e] hover:text-white'
          }`}
        >
          {hasChildren ? (
            <button
              onClick={(e) => toggleFolder(node.path, e)}
              className="p-0.5 text-slate-400 hover:text-slate-200"
            >
              {isExpanded ? (
                <ChevronDown className="w-2.5 h-2.5" />
              ) : (
                <ChevronRight className="w-2.5 h-2.5" />
              )}
            </button>
          ) : (
            <span className="w-2.5" />
          )}

          <Folder
            className={`w-3 h-3 ${
              isSelected ? 'text-[#38bdf8] fill-[#38bdf8]/60' : 'text-amber-400 fill-amber-400/70'
            }`}
          />
          <span className="truncate">{node.name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (fs.isNativeDeviceStorage()) {
      fs.syncFromNativeStorage(currentPath, true);
    }
  }, [currentPath]);

  // Filter files in current path
  const visibleFiles = files.filter((f) => {
    const matchesSearch = searchQuery.trim()
      ? f.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    if (fs.isNativeDeviceStorage()) {
      return matchesSearch;
    }
    const parent = f.path.substring(0, f.path.lastIndexOf('/'));
    const inCurrentDir = parent === currentPath.replace(/\/+$/, '') || f.path === currentPath;
    return inCurrentDir && matchesSearch;
  });

  const toggleSelectFile = (id: string, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFileIds.size === visibleFiles.length && visibleFiles.length > 0) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(visibleFiles.map((f) => f.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedFileIds.size === 0) return;
    const selectedItems = visibleFiles.filter((f) => selectedFileIds.has(f.id));
    if (confirm(`Permanently delete ${selectedItems.length} selected item(s)?`)) {
      // Report the honest count: deleteItem returns false when the native
      // delete fails, and previously every item was reported deleted
      // regardless.
      let deleted = 0;
      const failed: string[] = [];
      selectedItems.forEach((f) => {
        if (fs.deleteItem(f.path)) deleted++;
        else failed.push(f.name);
      });
      setSelectedFileIds(new Set());
      showNotification(
        failed.length === 0
          ? `Bulk deleted ${deleted} item(s)`
          : `Deleted ${deleted} of ${selectedItems.length} item(s). Failed: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`
      );
    }
  };

  const handleBulkCopyMove = (mode: 'copy' | 'move') => {
    if (selectedFileIds.size === 0) return;
    const targetDir = prompt(`Enter target directory for bulk ${mode}:`, currentPath);
    if (!targetDir || !targetDir.trim()) return;

    const cleanTarget = targetDir.trim();
    const selectedItems = visibleFiles.filter((f) => selectedFileIds.has(f.id));

    // A failed read must never produce an empty copy, and a move must
    // never delete the original when the copy did not happen. Previously
    // a read failure returned '' (or threw), createFile still wrote an
    // empty file, and move then deleted the original — silent data loss.
    let done = 0;
    const failed: string[] = [];
    selectedItems.forEach((item) => {
      try {
        const isBinary = item.type === 'VRM' || item.type === 'glTF' || item.type === 'Image';
        let content = '';
        try {
          content = fs.readFileContent(item.path, isBinary);
        } catch (err) {
          failed.push(`${item.name} (${err instanceof Error ? err.message : 'could not be read'})`);
          return;
        }
        if (!content && (item.sizeBytes || 0) > 0) {
          failed.push(`${item.name} (could not be read)`);
          return;
        }
        fs.createFile(cleanTarget, item.name, item.type, content);
        if (mode === 'move') {
          if (!fs.deleteItem(item.path)) {
            // Copy succeeded but the original could not be removed: keep
            // both and report it instead of claiming a clean move.
            failed.push(`${item.name} (copied, original could not be removed)`);
            return;
          }
        }
        done++;
      } catch (err) {
        failed.push(`${item.name} (${err instanceof Error ? err.message : 'failed'})`);
      }
    });

    setSelectedFileIds(new Set());
    showNotification(
      failed.length === 0
        ? `Bulk ${mode}ed ${done} item(s) to ${cleanTarget}`
        : `Bulk ${mode}: ${done} of ${selectedItems.length} succeeded. Failed: ${failed.slice(0, 3).join('; ')}${failed.length > 3 ? '…' : ''}`
    );
  };

  const handleBulkDownload = () => {
    const selectedItems = visibleFiles.filter((f) => selectedFileIds.has(f.id));
    selectedItems.forEach((f) => fs.downloadFile(f));
    showNotification(`Exporting ${selectedItems.length} item(s)...`);
  };

  return (
    <div className="flex flex-col h-full bg-[#080c14]/90 backdrop-blur-md border border-[#172a45] rounded-md overflow-hidden select-none text-xs shadow-xl">
      {/* File Explorer Header */}
      <div className="h-8 bg-[#0b111e]/90 border-b border-[#172a45] flex items-center justify-between px-2.5 shrink-0 z-10">
        <div className="flex items-center space-x-1.5">
          <Folder className="w-3.5 h-3.5 text-amber-400 fill-amber-400/60" />
          <span className="font-semibold text-slate-200 tracking-tight text-xs">File Explorer</span>
          {fs.isNativeDeviceStorage() ? (
            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded bg-[#0b291d] text-emerald-300 border border-emerald-500/50 font-mono-code">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>NATIVE STORAGE ACTIVE</span>
            </span>
          ) : (
            <span className="hidden sm:inline text-[9px] px-1.5 py-0.2 rounded bg-[#0c1626] text-cyan-400 border border-cyan-500/30 font-mono-code">
              {currentPath}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {fs.isNativeDeviceStorage() && (
            <button
              onClick={() => fs.requestNativePermission()}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#102438] border border-cyan-500/40 text-[10px] text-cyan-300 hover:text-white hover:bg-[#183654] transition-all"
              title="Grant full Android storage permissions"
            >
              <HardDrive className="w-2.5 h-2.5 text-cyan-400" />
              <span>Grant Permissions</span>
            </button>
          )}

          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-[#162338] rounded"
              title="Minimize"
            >
              <Minus className="w-3 h-3" />
            </button>
          )}
          {onMaximize && (
            <button
              onClick={onMaximize}
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-[#162338] rounded"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              <Square className="w-3 h-3" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-red-400 hover:bg-[#162338] rounded"
              title="Close"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Path & Operations Toolbar */}
      <div className="h-7 bg-[#090e18] border-b border-[#172a45]/80 flex items-center justify-between px-2 space-x-1.5 shrink-0 z-10 text-[11px]">
        {/* Navigation Arrows */}
        <div className="flex items-center space-x-0.5 text-slate-400">
          <button
            onClick={() => {
              const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
              setCurrentPath(parent);
            }}
            className="p-0.5 hover:text-white hover:bg-[#162338] rounded"
            title="Up directory"
          >
            <ArrowLeft className="w-3 h-3" />
          </button>
          <button
            className="p-0.5 hover:text-white hover:bg-[#162338] rounded"
            title="Forward"
          >
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Undo / Redo Buttons */}
        <div className="flex items-center space-x-0.5 border-l border-r border-[#172a45] px-1">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className={`p-1 rounded transition-colors ${
              canUndo
                ? 'text-slate-200 hover:text-[#38bdf8] hover:bg-[#162338]'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Undo File Action (Ctrl+Z)"
          >
            <Undo2 className="w-3 h-3" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className={`p-1 rounded transition-colors ${
              canRedo
                ? 'text-slate-200 hover:text-[#38bdf8] hover:bg-[#162338]'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Redo File Action (Ctrl+Y)"
          >
            <Redo2 className="w-3 h-3" />
          </button>
        </div>

        {/* Path Input / Breadcrumb */}
        <div className="flex-1 flex items-center bg-[#070b13] border border-[#172a45] rounded px-1.5 py-0.5 font-mono-code text-slate-300 overflow-hidden text-[10px]">
          <span className="truncate">{currentPath}</span>
        </div>

        {/* Action Buttons: New File, New Folder, Upload, Download, Delete */}
        <div className="flex items-center space-x-1 text-slate-300">
          <button
            onClick={() => {
              setNewItemName('');
              setIsCreatingFile(true);
            }}
            className="p-1 rounded bg-[#0b1220] hover:bg-[#162338] border border-[#172a45] text-slate-300 hover:text-[#38bdf8]"
            title="Create New File (.vrm, .json, .txt, .sh)"
          >
            <Plus className="w-3 h-3" />
          </button>

          <button
            onClick={() => {
              setNewItemName('');
              setIsCreatingFolder(true);
            }}
            className="p-1 rounded bg-[#0b1220] hover:bg-[#162338] border border-[#172a45] text-slate-300 hover:text-amber-400"
            title="Create New Folder"
          >
            <FolderPlus className="w-3 h-3" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded bg-[#0b1220] hover:bg-[#162338] border border-[#172a45] text-slate-300 hover:text-cyan-300"
            title="Upload file from phone or PC"
          >
            <Upload className="w-3 h-3" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
          />

          {selectedFile && (
            <>
              <button
                onClick={handleDownload}
                className="p-1 rounded bg-[#0b1220] hover:bg-[#162338] border border-[#172a45] text-slate-300 hover:text-emerald-400"
                title={`Export ${selectedFile.name} to device`}
              >
                <Download className="w-3 h-3" />
              </button>

              <button
                onClick={() => {
                  setNewItemName(selectedFile.name);
                  setIsRenaming(true);
                }}
                className="p-1 rounded bg-[#0b1220] hover:bg-[#162338] border border-[#172a45] text-slate-300 hover:text-yellow-400"
                title="Rename selected file"
              >
                <Edit2 className="w-3 h-3" />
              </button>

              <button
                onClick={handleDelete}
                className="p-1 rounded bg-[#0b1220] hover:bg-[#162338] border border-[#172a45] text-slate-300 hover:text-red-400"
                title="Delete selected file"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}

          {/* Search Toggle */}
          <button
            onClick={() => setShowSearchInput(!showSearchInput)}
            className="p-1 rounded bg-[#0b1220] hover:bg-[#162338] border border-[#172a45] text-slate-300 hover:text-white"
            title="Search"
          >
            <Search className="w-3 h-3" />
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="p-1 rounded bg-[#0b1220] hover:bg-[#162338] border border-[#172a45] text-slate-300 hover:text-white"
            title="Toggle View Mode"
          >
            {viewMode === 'list' ? <List className="w-3 h-3" /> : <LayoutGrid className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Floating Action Banner */}
      {actionNotice && (
        <div className="bg-[#0e3a6a] border-b border-[#38bdf8]/40 px-3 py-0.5 text-[10px] text-cyan-200 flex items-center justify-between shrink-0">
          <span>{actionNotice}</span>
          <Check className="w-3 h-3 text-emerald-400" />
        </div>
      )}

      {/* Inline Create File / Folder Bar */}
      {(isCreatingFile || isCreatingFolder || isRenaming) && (
        <div className="bg-[#0c1524] border-b border-[#172a45] p-1.5 flex items-center space-x-1.5 shrink-0">
          <span className="text-[10px] text-slate-300 font-medium whitespace-nowrap">
            {isCreatingFile ? 'New File:' : isCreatingFolder ? 'New Folder:' : 'Rename:'}
          </span>
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder={isCreatingFile ? 'avatar.vrm or main.cpp' : 'folder name'}
            autoFocus
            className="flex-1 bg-[#060a12] border border-[#172a45] rounded px-1.5 py-0.5 text-[11px] text-slate-100 font-mono-code outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (isCreatingFile) handleCreateFileSubmit();
                else if (isCreatingFolder) handleCreateFolderSubmit();
                else if (isRenaming) handleRenameSubmit();
              }
            }}
          />

          {isCreatingFile && (
            <select
              value={newItemType}
              onChange={(e) => setNewItemType(e.target.value as any)}
              className="bg-[#060a12] border border-[#172a45] rounded px-1 py-0.5 text-[10px] text-slate-300 outline-none"
            >
              <option value="VRM">VRM Model</option>
              <option value="glTF">glTF 3D</option>
              <option value="JSON">JSON</option>
              <option value="C++ Source">C++</option>
              <option value="Shell Script">Shell Script</option>
              <option value="Text">Plain Text</option>
            </select>
          )}

          <button
            onClick={() => {
              if (isCreatingFile) handleCreateFileSubmit();
              else if (isCreatingFolder) handleCreateFolderSubmit();
              else if (isRenaming) handleRenameSubmit();
            }}
            className="px-2 py-0.5 rounded bg-[#0077d4] text-white text-[10px] font-medium"
          >
            Done
          </button>

          <button
            onClick={() => {
              setIsCreatingFile(false);
              setIsCreatingFolder(false);
              setIsRenaming(false);
            }}
            className="px-1.5 py-0.5 rounded bg-[#0b1220] text-slate-400 text-[10px]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Split Pane: Tree View (Left) & File List (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Tree Explorer */}
        <div className="w-32 sm:w-40 border-r border-[#172a45] bg-[#070b13]/80 p-1 overflow-y-auto no-scrollbar shrink-0">
          {renderTreeNode(fs.getTree())}
        </div>

        {/* Right File List Table */}
        <div className="flex-1 overflow-y-auto bg-[#080c14] flex flex-col">
          {viewMode === 'list' ? (
            <>
              {/* Table Header */}
              <div className="h-5 bg-[#0a0f1b] border-b border-[#172a45] px-2 flex items-center text-[9px] font-medium text-slate-400 shrink-0 sticky top-0 z-10">
                <input
                  type="checkbox"
                  checked={selectedFileIds.size === visibleFiles.length && visibleFiles.length > 0}
                  onChange={toggleSelectAll}
                  className="mr-2 accent-[#38bdf8] cursor-pointer"
                  title="Select / Deselect All Visible Files"
                />
                <span className="flex-1">Name</span>
                <span className="w-14 text-right pr-2">Size</span>
                <span className="w-18 text-left pl-2">Type</span>
                <span className="w-16 text-right">Modified</span>
              </div>

              {/* Table Rows */}
              <div className="p-0.5 space-y-0.5 flex-1">
                {visibleFiles.map((file) => {
                  const isSelected = selectedFile?.id === file.id || selectedFileIds.has(file.id);
                  const isChecked = selectedFileIds.has(file.id);

                  return (
                    <div
                      key={file.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', file.path);
                        e.dataTransfer.setData('application/json', JSON.stringify(file));
                        e.dataTransfer.effectAllowed = 'copyMove';
                      }}
                      onClick={() => onSelectFile(file)}
                      onDoubleClick={() => {
                        if (file.isFolder) {
                          setCurrentPath(file.path);
                        } else if (onOpenFile) {
                          onOpenFile(file);
                        }
                      }}
                      onPointerDown={(e) => {
                        itemTouchPosRef.current = { x: e.clientX, y: e.clientY };
                        if (itemLongPressTimerRef.current) clearTimeout(itemLongPressTimerRef.current);
                        itemLongPressTimerRef.current = setTimeout(() => {
                          onSelectFile(file);
                          if (onContextMenuFile) onContextMenuFile(file, e.clientX, e.clientY);
                        }, 500);
                      }}
                      onPointerMove={(e) => {
                        const dx = Math.abs(e.clientX - itemTouchPosRef.current.x);
                        const dy = Math.abs(e.clientY - itemTouchPosRef.current.y);
                        if (dx > 6 || dy > 6) {
                          if (itemLongPressTimerRef.current) clearTimeout(itemLongPressTimerRef.current);
                        }
                      }}
                      onPointerUp={() => {
                        if (itemLongPressTimerRef.current) clearTimeout(itemLongPressTimerRef.current);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectFile(file);
                        if (onContextMenuFile) onContextMenuFile(file, e.clientX, e.clientY);
                      }}
                      className={`flex items-center px-1.5 py-1 rounded cursor-pointer text-xs transition-colors group ${
                        isSelected
                          ? 'bg-[#0e3a6a] text-white font-medium shadow-[0_0_8px_rgba(14,58,106,0.6)] border border-[#38bdf8]/40'
                          : 'text-slate-300 hover:bg-[#101a2c] hover:text-white border border-transparent'
                      }`}
                    >
                      {/* Batch Checkbox */}
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => toggleSelectFile(file.id, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="mr-2 accent-[#38bdf8] cursor-pointer shrink-0"
                      />

                      {/* Name + Icon */}
                      <div className="flex items-center space-x-1.5 flex-1 min-w-0 pr-2">
                        {getFileIcon(file.type)}
                        <span className="truncate text-[11px]">{file.name}</span>
                      </div>

                      {/* Size */}
                      <span className="w-14 text-right text-[10px] font-mono-code text-slate-400 pr-2 shrink-0">
                        {file.size}
                      </span>

                      {/* Type */}
                      <span className="w-18 text-left text-[9px] text-slate-400 pl-2 truncate shrink-0">
                        {file.type}
                      </span>

                      {/* Modified */}
                      <span className="w-16 text-right text-[9px] font-mono-code text-slate-400 shrink-0">
                        {file.modified}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Grid View */
            <div className="p-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {visibleFiles.map((file) => {
                const isSelected = selectedFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', file.path);
                      e.dataTransfer.setData('application/json', JSON.stringify(file));
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    onClick={() => onSelectFile(file)}
                    onDoubleClick={() => {
                      if (file.isFolder) setCurrentPath(file.path);
                      else if (onOpenFile) onOpenFile(file);
                    }}
                    onPointerDown={(e) => {
                      itemTouchPosRef.current = { x: e.clientX, y: e.clientY };
                      if (itemLongPressTimerRef.current) clearTimeout(itemLongPressTimerRef.current);
                      itemLongPressTimerRef.current = setTimeout(() => {
                        onSelectFile(file);
                        if (onContextMenuFile) onContextMenuFile(file, e.clientX, e.clientY);
                      }, 500);
                    }}
                    onPointerMove={(e) => {
                      const dx = Math.abs(e.clientX - itemTouchPosRef.current.x);
                      const dy = Math.abs(e.clientY - itemTouchPosRef.current.y);
                      if (dx > 6 || dy > 6) {
                        if (itemLongPressTimerRef.current) clearTimeout(itemLongPressTimerRef.current);
                      }
                    }}
                    onPointerUp={() => {
                      if (itemLongPressTimerRef.current) clearTimeout(itemLongPressTimerRef.current);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectFile(file);
                      if (onContextMenuFile) onContextMenuFile(file, e.clientX, e.clientY);
                    }}
                    className={`relative flex flex-col items-center justify-center p-2 rounded cursor-pointer border text-center transition-all ${
                      isSelected
                        ? 'bg-[#0e3a6a] border-[#38bdf8] text-white shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                        : 'bg-[#0b1220] border-[#172a45] text-slate-300 hover:border-[#223d63]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFileIds.has(file.id)}
                      onChange={(e) => toggleSelectFile(file.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-1.5 left-1.5 accent-[#38bdf8] cursor-pointer z-10"
                    />
                    <div className="mb-1">{getFileIcon(file.type)}</div>
                    <span className="text-[10px] truncate max-w-full font-medium">{file.name}</span>
                    <span className="text-[8px] text-slate-400 font-mono-code">{file.size}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Floating Bar */}
      {selectedFileIds.size > 0 && (
        <div className="bg-[#091b30] border-t border-[#38bdf8]/50 px-3 py-1.5 flex items-center justify-between text-xs text-slate-100 shadow-[0_-8px_24px_rgba(0,0,0,0.8)] z-20 shrink-0 animate-in slide-in-from-bottom-2">
          <div className="flex items-center space-x-2 font-bold text-cyan-300 font-mono-code text-[11px]">
            <CheckSquare className="w-4 h-4 text-[#38bdf8]" />
            <span>{selectedFileIds.size} item(s) selected</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => handleBulkCopyMove('copy')}
              className="px-2 py-1 rounded bg-[#0b2442] hover:bg-[#123660] border border-cyan-500/40 text-cyan-200 text-[10px] font-semibold flex items-center gap-1 transition-all"
              title="Copy selected items to target folder"
            >
              <Copy className="w-3 h-3 text-[#38bdf8]" />
              <span>Copy To</span>
            </button>

            <button
              onClick={() => handleBulkCopyMove('move')}
              className="px-2 py-1 rounded bg-[#0b2442] hover:bg-[#123660] border border-cyan-500/40 text-cyan-200 text-[10px] font-semibold flex items-center gap-1 transition-all"
              title="Move selected items to target folder"
            >
              <FolderInput className="w-3 h-3 text-cyan-300" />
              <span>Move To</span>
            </button>

            <button
              onClick={handleBulkDownload}
              className="px-2 py-1 rounded bg-[#0b2442] hover:bg-[#123660] border border-emerald-500/40 text-emerald-200 text-[10px] font-semibold flex items-center gap-1 transition-all"
              title="Export selected items to device"
            >
              <Download className="w-3 h-3 text-emerald-400" />
              <span>Export</span>
            </button>

            <button
              onClick={handleBulkDelete}
              className="px-2 py-1 rounded bg-[#330f18] hover:bg-[#521827] border border-rose-500/40 text-rose-200 text-[10px] font-semibold flex items-center gap-1 transition-all"
              title="Delete selected items"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>Delete ({selectedFileIds.size})</span>
            </button>

            <button
              onClick={() => setSelectedFileIds(new Set())}
              className="px-1.5 py-1 rounded bg-[#0b1220] text-slate-400 hover:text-white text-[10px] ml-1"
              title="Clear selection"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
