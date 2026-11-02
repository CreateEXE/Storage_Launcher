import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Minus,
  Square,
  X,
  FileBox,
  FileCode,
  FileText,
  FileJson,
  Terminal,
  Folder,
  File,
  ExternalLink,
  Code2,
  HardDrive,
  Info,
  Download,
  AlertTriangle,
  Sparkles,
  Palette,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { FileItem } from '../types';
import { FileManagerService } from '../services/fileManager';
import { FileTypeDetector } from '../services/fileInspector';

interface InspectorPanelProps {
  selectedFile: FileItem | null;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
  onOpenIn3DViewer?: (file: FileItem) => void;
  onOpenInCodeEditor?: (file: FileItem) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedFile,
  onMinimize,
  onMaximize,
  onClose,
  isMaximized = false,
  onOpenIn3DViewer,
  onOpenInCodeEditor
}) => {
  const [activeTab, setActiveTab] = useState<'Properties' | 'Metadata' | 'Icon/Favicon' | 'Preview'>('Properties');
  const [copiedDataUrl, setCopiedDataUrl] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fs = FileManagerService.getInstance();

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Run deep inspection on selected file
  const inspection = selectedFile ? FileTypeDetector.inspect(selectedFile) : null;

  // Handle restoring file extension if mismatched
  const handleFixExtension = () => {
    if (!selectedFile || !inspection?.suggestedExtension) return;
    const dotIdx = selectedFile.name.lastIndexOf('.');
    const baseName = dotIdx >= 0 ? selectedFile.name.substring(0, dotIdx) : selectedFile.name;
    const fixedName = `${baseName}${inspection.suggestedExtension}`;
    fs.renameItem(selectedFile.path, fixedName);
    showNotification(`Restored extension: ${fixedName}`);
  };

  // Copy Icon Data URI
  const handleCopyIconDataUrl = () => {
    if (!inspection?.icon?.dataUrl) return;
    navigator.clipboard.writeText(inspection.icon.dataUrl);
    setCopiedDataUrl(true);
    showNotification('Icon SVG Data URL copied to clipboard');
    setTimeout(() => setCopiedDataUrl(false), 2000);
  };

  const getFileIcon = (type: FileItem['type']) => {
    switch (type) {
      case 'VRM':
      case 'glTF':
        return <FileBox className="w-5 h-5 text-[#38bdf8]" />;
      case 'C++ Source':
        return <FileCode className="w-5 h-5 text-blue-400" />;
      case 'JSON':
        return <FileJson className="w-5 h-5 text-amber-300" />;
      case 'Markdown':
      case 'Text':
        return <FileText className="w-5 h-5 text-slate-300" />;
      case 'Shell Script':
        return <Terminal className="w-5 h-5 text-emerald-400" />;
      case 'Folder':
        return <Folder className="w-5 h-5 text-amber-400 fill-amber-400/80" />;
      default:
        return <File className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#080c14]/90 backdrop-blur-md border border-[#172a45] rounded-md overflow-hidden select-none text-xs shadow-xl">
      {/* Header */}
      <div className="h-8 bg-[#0b111e]/90 border-b border-[#172a45] flex items-center justify-between px-2.5 shrink-0 z-10">
        <div className="flex items-center space-x-2">
          <SlidersHorizontal className="w-4 h-4 text-[#38bdf8]" />
          <span className="font-semibold text-slate-200 tracking-tight text-xs">
            Item Details & Inspector
          </span>
          {inspection?.isVRM && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 font-medium">
              VRM Model
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
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

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="bg-[#0e3a6a] border-b border-[#38bdf8]/40 px-3 py-1 text-[10px] text-cyan-200 flex items-center justify-between shrink-0">
          <span>{actionNotice}</span>
          <Check className="w-3 h-3 text-emerald-400" />
        </div>
      )}

      {/* When NOTHING is selected: Clean Empty Panel */}
      {!selectedFile || !inspection ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
          <div className="w-12 h-12 rounded-full bg-[#0c1424] border border-[#172a45] flex items-center justify-center mb-3 text-slate-500">
            <Info className="w-6 h-6 text-[#38bdf8]/60" />
          </div>
          <div className="text-slate-300 font-medium text-xs mb-1">No Item Selected</div>
          <p className="text-[11px] text-slate-500 max-w-[240px] leading-relaxed">
            Select any file or folder from Device Storage to inspect its true MIME type, embedded metadata, 3D traits, or extract its icon/favicon.
          </p>
        </div>
      ) : (
        /* When an item IS selected: Full Deep Inspector */
        <>
          {/* Extension Mismatch Banner */}
          {inspection.isExtensionMismatched && (
            <div className="bg-[#421d05] border-b border-amber-500/40 p-2.5 flex flex-col gap-1.5 shrink-0">
              <div className="flex items-start gap-1.5 text-amber-200 font-medium text-[11px]">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <div>Content Mismatch Detected!</div>
                  <div className="text-[10px] text-amber-300/90 font-normal">
                    {inspection.mismatchDescription}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={handleFixExtension}
                  className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-medium flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Restore {inspection.suggestedExtension} Extension</span>
                </button>
                {inspection.is3DModel && onOpenIn3DViewer && (
                  <button
                    onClick={() => onOpenIn3DViewer(selectedFile)}
                    className="px-2 py-0.5 rounded bg-[#0e3a6a] hover:bg-[#154c86] text-cyan-200 text-[10px] font-medium border border-cyan-500/40"
                  >
                    Open in 3D Viewer Anyway
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Inspector Tabs */}
          <div className="flex border-b border-[#172a45] bg-[#090e18]/80 shrink-0">
            {(['Properties', 'Metadata', 'Icon/Favicon', 'Preview'] as const).map((tab) => {
              const isTabActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 text-[11px] font-medium transition-colors border-b-2 ${
                    isTabActive
                      ? 'bg-[#0e3a6a] text-white border-[#38bdf8]'
                      : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-[#0c1424]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {/* 1. PROPERTIES TAB */}
            {activeTab === 'Properties' && (
              <div className="space-y-3">
                {/* Header Card with Retrieved Thumbnail */}
                <div className="flex items-center space-x-2.5 p-2 rounded bg-[#0b1220] border border-[#172a45]">
                  <div className="w-10 h-10 rounded bg-[#070c16] border border-[#1e3a5f] p-0.5 shrink-0 overflow-hidden flex items-center justify-center">
                    <img
                      src={inspection.icon.dataUrl}
                      alt={selectedFile.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-100 truncate text-[12px] flex items-center gap-1.5">
                      <span>{selectedFile.name}</span>
                    </div>
                    <div className="text-[10px] text-cyan-400 font-mono-code truncate">
                      {inspection.detectedType}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono-code">
                      {selectedFile.isFolder ? 'Directory' : selectedFile.size}
                    </div>
                  </div>

                  {/* Context Action Button (3D Viewer / Code Editor) */}
                  {(inspection.is3DModel || selectedFile.type === 'VRM' || selectedFile.type === 'glTF') && onOpenIn3DViewer ? (
                    <button
                      onClick={() => onOpenIn3DViewer(selectedFile)}
                      className="px-2 py-1 rounded bg-[#0077d4] hover:bg-[#0088f0] text-white text-[10px] font-medium flex items-center gap-1 border border-cyan-400/40 shadow-sm transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>3D View</span>
                    </button>
                  ) : !selectedFile.isFolder && onOpenInCodeEditor ? (
                    <button
                      onClick={() => onOpenInCodeEditor(selectedFile)}
                      className="px-2 py-1 rounded bg-[#0e3a6a] hover:bg-[#154c86] text-[#38bdf8] text-[10px] font-medium flex items-center gap-1 border border-[#38bdf8]/40 transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  ) : null}
                </div>

                {/* Deep Content Inspection Details */}
                <div className="p-2.5 rounded bg-[#060a12] border border-[#172a45] space-y-2">
                  <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Deep Content & Signature Sniffing</span>
                  </div>

                  <div className="space-y-1.5 text-slate-300 text-[10px] font-mono-code">
                    <div className="flex justify-between items-center py-0.5 border-b border-[#121c2e]">
                      <span className="text-slate-400">Declared Extension</span>
                      <span className={inspection.isExtensionMismatched ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                        {inspection.declaredExtension}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-0.5 border-b border-[#121c2e]">
                      <span className="text-slate-400">Detected Content Type</span>
                      <span className="text-cyan-300 font-medium">
                        {inspection.detectedType}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-0.5 border-b border-[#121c2e]">
                      <span className="text-slate-400">MIME Type</span>
                      <span className="text-slate-200">{inspection.detectedMime}</span>
                    </div>

                    <div className="flex justify-between items-center py-0.5 border-b border-[#121c2e]">
                      <span className="text-slate-400">Binary Magic Bytes</span>
                      <span className="text-emerald-400">{inspection.magicBytesHex}</span>
                    </div>

                    {inspection.magicHeaderAscii && (
                      <div className="flex justify-between items-center py-0.5 border-b border-[#121c2e]">
                        <span className="text-slate-400">Header Signature</span>
                        <span className="text-slate-300 truncate max-w-[150px]">{inspection.magicHeaderAscii}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Properties Table */}
                <div className="space-y-1.5 text-slate-300 text-[11px]">
                  {!selectedFile.isFolder && (
                    <div className="flex justify-between py-1 border-b border-[#142338]">
                      <span className="text-slate-400">File Size</span>
                      <span className="font-mono-code text-slate-200">
                        {selectedFile.size} ({selectedFile.sizeBytes.toLocaleString()} bytes)
                      </span>
                    </div>
                  )}

                  {selectedFile.dimensions && selectedFile.dimensions !== 'N/A' && (
                    <div className="flex justify-between py-1 border-b border-[#142338]">
                      <span className="text-slate-400">3D Bounds (W x H x D)</span>
                      <span className="font-mono-code text-slate-200">{selectedFile.dimensions}</span>
                    </div>
                  )}

                  {inspection.is3DModel && (
                    <>
                      <div className="flex justify-between py-1 border-b border-[#142338]">
                        <span className="text-slate-400">Polygons / Triangles</span>
                        <span className="font-mono-code text-cyan-300">
                          {(inspection.embeddedMetadata.polyCount || selectedFile.faces || 42850).toLocaleString()} tris
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-[#142338]">
                        <span className="text-slate-400">Embedded Materials</span>
                        <span className="font-mono-code text-slate-200">
                          {inspection.embeddedMetadata.materialsCount || selectedFile.materials || 12} PBR / MToon
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between py-1 border-b border-[#142338]">
                    <span className="text-slate-400">Modified Date</span>
                    <span className="font-mono-code text-slate-200">{selectedFile.modified}</span>
                  </div>

                  <div className="py-1">
                    <span className="text-slate-400 block mb-0.5">Absolute Device Path</span>
                    <span className="font-mono-code text-[10px] text-[#38bdf8] break-all bg-[#060a12] p-1.5 rounded block border border-[#172a45]">
                      {selectedFile.path}
                    </span>
                  </div>
                </div>

                {/* Quick Actions */}
                {!selectedFile.isFolder && (
                  <div className="pt-2 flex items-center space-x-2">
                    <button
                      onClick={() => fs.downloadFile(selectedFile)}
                      className="flex-1 py-1.5 px-2 rounded bg-[#0b1220] hover:bg-[#162338] border border-[#172a45] text-slate-200 hover:text-white flex items-center justify-center gap-1.5 transition-colors text-[10px]"
                    >
                      <Download className="w-3 h-3 text-emerald-400" />
                      <span>Download File</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('Icon/Favicon')}
                      className="flex-1 py-1.5 px-2 rounded bg-[#0b1220] hover:bg-[#162338] border border-[#172a45] text-cyan-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors text-[10px]"
                    >
                      <Palette className="w-3 h-3 text-cyan-400" />
                      <span>Extract Icon</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2. METADATA & EMBEDDED ATTRIBUTES TAB */}
            {activeTab === 'Metadata' && (
              <div className="space-y-3">
                {/* Embedded Avatar Metadata */}
                {inspection.isVRM && (
                  <div className="p-2.5 rounded bg-[#060a12] border border-[#172a45] space-y-2">
                    <div className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Embedded VRM 0.0 Avatar Metadata</span>
                    </div>

                    <div className="space-y-1.5 text-[10px] font-mono-code">
                      <div className="flex justify-between border-b border-[#121c2e] py-0.5">
                        <span className="text-slate-400">Avatar Title</span>
                        <span className="text-white font-medium">{inspection.embeddedMetadata.title}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#121c2e] py-0.5">
                        <span className="text-slate-400">Author / Studio</span>
                        <span className="text-slate-200">{inspection.embeddedMetadata.author}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#121c2e] py-0.5">
                        <span className="text-slate-400">Exporter Engine</span>
                        <span className="text-slate-300">{inspection.embeddedMetadata.exporter}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#121c2e] py-0.5">
                        <span className="text-slate-400">VRM Spec Version</span>
                        <span className="text-cyan-400 font-bold">{inspection.vrmVersion}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#121c2e] py-0.5">
                        <span className="text-slate-400">Humanoid Bones Rig</span>
                        <span className="text-emerald-400">{inspection.embeddedMetadata.bonesCount} bones</span>
                      </div>
                      <div className="flex justify-between border-b border-[#121c2e] py-0.5">
                        <span className="text-slate-400">BlendShape Morphs</span>
                        <span className="text-purple-300">{inspection.embeddedMetadata.blendShapeCount} expressions</span>
                      </div>
                    </div>

                    {/* Permissions & Usage Rights */}
                    <div className="pt-2 border-t border-[#121c2e]">
                      <div className="text-[10px] font-semibold text-slate-300 mb-1.5">Usage Permissions & Rights</div>
                      <div className="space-y-1 text-[9px] font-mono-code">
                        <div className="flex items-center justify-between text-emerald-300 bg-[#091524] px-1.5 py-0.5 rounded">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>Commercial Usage</span>
                          </span>
                          <span>{inspection.embeddedMetadata.commercialUsage}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300 bg-[#091524] px-1.5 py-0.5 rounded">
                          <span className="flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-amber-400" />
                            <span>Violent Actions</span>
                          </span>
                          <span>{inspection.embeddedMetadata.violentUsage}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300 bg-[#091524] px-1.5 py-0.5 rounded">
                          <span className="flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-red-400" />
                            <span>Sexual Content</span>
                          </span>
                          <span>{inspection.embeddedMetadata.sexualUsage}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Extra Embedded Fields */}
                {inspection.embeddedMetadata.extraFields && (
                  <div className="p-2.5 rounded bg-[#060a12] border border-[#172a45] space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-200">Embedded Technical Attributes</div>
                    <div className="space-y-1 font-mono-code text-[10px]">
                      {Object.entries(inspection.embeddedMetadata.extraFields).map(([k, v]) => (
                        <div key={k} className="flex justify-between border-b border-[#121c2e] py-0.5">
                          <span className="text-slate-400">{k}</span>
                          <span className="text-slate-200">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Android OS Storage Metadata */}
                <div className="p-2.5 rounded bg-[#060a12] border border-[#172a45] space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span>Android Storage Inode Attributes</span>
                  </div>

                  <div className="space-y-1 font-mono-code text-[10px] text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Android Mode</span>
                      <span className="text-emerald-400">
                        {selectedFile.isFolder ? 'drwxrwx--x' : '-rw-rw----'} (0660)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Owner UID</span>
                      <span>u0_a328 (10328)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Group GID</span>
                      <span>media_rw (1023)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">SELinux</span>
                      <span className="text-slate-400 truncate max-w-[160px]">u:object_r:media_rw_data_file:s0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Filesystem</span>
                      <span>f2fs (/storage/emulated/0)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. ICON & FAVICON EXTRACTION STUDIO TAB */}
            {activeTab === 'Icon/Favicon' && (
              <div className="space-y-3">
                <div className="p-2.5 rounded bg-[#060a12] border border-[#172a45] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Retrieved File Icon & Favicon</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#0e3a6a] text-cyan-200 font-mono-code">
                      {inspection.icon.format} Vector
                    </span>
                  </div>

                  {/* Multi-Size Icon Previews */}
                  <div className="flex items-end justify-around p-3 rounded bg-[#040810] border border-[#121c2e]">
                    {/* 128x128 Large Preview */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-20 h-20 rounded-lg bg-[#080d16] border border-cyan-500/40 p-1 flex items-center justify-center shadow-lg">
                        <img
                          src={inspection.icon.dataUrl}
                          alt="Icon 128px"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono-code">128x128 HD</span>
                    </div>

                    {/* 48x48 Android App Icon */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 rounded-lg bg-[#080d16] border border-[#1e3a5f] p-0.5 flex items-center justify-center">
                        <img
                          src={inspection.icon.dataUrl}
                          alt="Icon 48px"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono-code">48x48 Launcher</span>
                    </div>

                    {/* 32x32 Taskbar Icon */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded bg-[#080d16] border border-[#1e3a5f] p-0.5 flex items-center justify-center">
                        <img
                          src={inspection.icon.dataUrl}
                          alt="Icon 32px"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono-code">32x32 Bar</span>
                    </div>

                    {/* 16x16 Browser Favicon */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-4 h-4 rounded-sm bg-[#080d16] border border-[#1e3a5f] flex items-center justify-center">
                        <img
                          src={inspection.icon.dataUrl}
                          alt="Icon 16px"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono-code">16x16 Favicon</span>
                    </div>
                  </div>

                  {/* Extraction Details */}
                  <div className="space-y-1 font-mono-code text-[10px] text-slate-300">
                    <div className="flex justify-between border-b border-[#121c2e] py-0.5">
                      <span className="text-slate-400">Extraction Source</span>
                      <span className="text-cyan-300 text-right truncate max-w-[170px]">{inspection.icon.source}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#121c2e] py-0.5">
                      <span className="text-slate-400">Resolution</span>
                      <span>{inspection.icon.dimensions}</span>
                    </div>
                  </div>

                  {/* Extracted Color Palette */}
                  {inspection.icon.palette && inspection.icon.palette.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[10px] text-slate-400 block mb-1">Extracted Color Palette:</span>
                      <div className="flex items-center gap-1.5">
                        {inspection.icon.palette.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#1e3a5f] bg-[#070d18] text-[9px] font-mono-code"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-black/40"
                              style={{ backgroundColor: c }}
                            />
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons for Icon */}
                  <div className="pt-2 flex flex-col gap-1.5">
                    <button
                      onClick={() => FileTypeDetector.downloadIcon(inspection.icon)}
                      className="w-full py-1.5 px-2 rounded bg-[#0077d4] hover:bg-[#0088f0] text-white flex items-center justify-center gap-1.5 transition-colors text-[10px] font-medium"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download Retrieved Icon ({inspection.icon.fileName})</span>
                    </button>
                    <button
                      onClick={handleCopyIconDataUrl}
                      className="w-full py-1.5 px-2 rounded bg-[#0b1220] hover:bg-[#162338] border border-[#172a45] text-slate-200 hover:text-white flex items-center justify-center gap-1.5 transition-colors text-[10px]"
                    >
                      {copiedDataUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                      <span>{copiedDataUrl ? 'Copied Data URI!' : 'Copy Vector Icon Data URI'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. PREVIEW / BUFFER TAB */}
            {activeTab === 'Preview' && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>Content Buffer & Binary Stream</span>
                </div>

                {selectedFile.content ? (
                  <pre className="p-2.5 rounded bg-[#060a12] border border-[#172a45] text-[10px] font-mono-code text-slate-300 max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {selectedFile.content}
                  </pre>
                ) : inspection.is3DModel ? (
                  <div className="p-2.5 rounded bg-[#060a12] border border-[#172a45] text-[10px] font-mono-code text-slate-300 space-y-1">
                    <div className="text-cyan-400 font-semibold">[glTF 2.0 / VRM Binary Payload]</div>
                    <div className="text-slate-400">Header Magic: <span className="text-emerald-400">0x46546C67 (glTF)</span></div>
                    <div className="text-slate-400">Chunk 0: <span className="text-purple-300">0x4E4F534A (JSON Chunk)</span></div>
                    <div className="text-slate-400">Chunk 1: <span className="text-cyan-300">0x004E4942 (BIN Buffer)</span></div>
                    <div className="text-slate-400">File Payload: {selectedFile.size}</div>
                    <div className="text-emerald-400 pt-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Ready for 3D Three.js PBR / MToon viewport rendering</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-slate-500 text-xs">
                    Directory or binary content preview not available
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
