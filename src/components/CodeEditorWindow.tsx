import React, { useState } from 'react';
import { Save, Check, FileCode, Play, Copy } from 'lucide-react';
import { FileItem } from '../types';
import { FileManagerService } from '../services/fileManager';

interface CodeEditorWindowProps {
  file: FileItem;
  onRunScript?: (cmd: string) => void;
}

export const CodeEditorWindow: React.FC<CodeEditorWindowProps> = ({ file, onRunScript }) => {
  const [content, setContent] = useState<string>(file.content || '// Empty buffer');
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const fs = FileManagerService.getInstance();

  const handleSave = () => {
    fs.createFile(
      file.path.substring(0, file.path.lastIndexOf('/')),
      file.name,
      file.type,
      content
    );
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lineCount = content.split('\n').length;

  return (
    <div className="flex flex-col h-full bg-[#080c14] text-xs font-mono-code select-text">
      {/* Editor Sub-header Bar */}
      <div className="h-7 bg-[#0b1220] border-b border-[#172a45] flex items-center justify-between px-2.5 shrink-0 select-none">
        <div className="flex items-center space-x-2">
          <FileCode className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span className="font-semibold text-slate-200 text-[11px]">{file.name}</span>
          <span className="text-[9px] text-slate-500">{file.type}</span>
        </div>

        <div className="flex items-center space-x-1.5">
          {file.name.endsWith('.sh') && onRunScript && (
            <button
              onClick={() => onRunScript(`./${file.name}`)}
              className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 border border-emerald-500/40 text-[10px] flex items-center gap-1 transition-colors"
            >
              <Play className="w-2.5 h-2.5" />
              <span>Run in Termux</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="p-1 rounded bg-[#0b1220] hover:bg-[#162338] text-slate-400 hover:text-white border border-[#172a45]"
            title="Copy buffer"
          >
            <Copy className="w-3 h-3" />
          </button>

          <button
            onClick={handleSave}
            className="px-2 py-0.5 rounded bg-[#0077d4] hover:bg-[#0088f4] text-white font-medium text-[10px] flex items-center gap-1 transition-colors shadow-[0_0_8px_rgba(0,119,212,0.4)]"
          >
            {isSaved ? <Check className="w-2.5 h-2.5" /> : <Save className="w-2.5 h-2.5" />}
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Editor Workspace with Line Numbers */}
      <div className="flex-1 flex overflow-hidden bg-[#060a12]">
        {/* Line Numbers */}
        <div className="w-9 py-2 bg-[#080d16] border-r border-[#172a45]/80 text-[10px] text-slate-600 text-right pr-2 select-none font-mono-code leading-5">
          {Array.from({ length: Math.max(lineCount, 15) }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          className="flex-1 p-2 bg-transparent text-slate-200 outline-none resize-none text-xs font-mono-code leading-5 selection:bg-[#0e3a6a]"
        />
      </div>

      {/* Editor Status Bar */}
      <div className="h-5 bg-[#090e18] border-t border-[#172a45] px-2 flex items-center justify-between text-[9px] text-slate-500 shrink-0 select-none">
        <span>{file.path}</span>
        <span>{lineCount} lines | UTF-8</span>
      </div>
    </div>
  );
};
