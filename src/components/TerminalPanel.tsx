import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Minus,
  Square,
  X,
  Plus,
  Copy,
  ClipboardPaste,
  Send,
  ChevronDown,
  History,
  Code,
  Network,
  Check,
  Radio,
  ExternalLink
} from 'lucide-react';
import { INITIAL_TERMINAL_OUTPUT } from '../data/mockData';
import { TermuxBridgeService } from '../services/termuxBridge';

interface TerminalPanelProps {
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  onMinimize,
  onMaximize,
  onClose,
  isMaximized = false
}) => {
  const [tabs, setTabs] = useState(['Chimera', 'Build', 'System']);
  const [activeTab, setActiveTab] = useState('Chimera');
  const [shellType, setShellType] = useState('bash');
  const [lines, setLines] = useState(INITIAL_TERMINAL_OUTPUT);
  const [currentInput, setCurrentInput] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const [historyItems, setHistoryItems] = useState([
    'ls -la',
    'cd src',
    './build.sh',
    './run.sh'
  ]);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [showBridgeModal, setShowBridgeModal] = useState(false);
  const [bridgeEndpoint, setBridgeEndpoint] = useState('http://localhost:8080');
  const [bridgeStatusMsg, setBridgeStatusMsg] = useState<string | null>(null);

  const bridge = TermuxBridgeService.getInstance();
  const [isDirectMode, setIsDirectMode] = useState(bridge.getConfig().mode === 'direct');

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const handleCommandSubmit = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    if (trimmed === 'clear') {
      setLines([]);
      setCurrentInput('');
      setQuickInput('');
      return;
    }

    // Add prompt line
    const promptLine = {
      type: 'input',
      text: `u0_a328@localhost:${bridge.getCurrentDir().replace('/storage/emulated/0', '~')}$ ${trimmed}`
    };

    // Execute via bridge
    const outputLines = await bridge.executeCommand(trimmed);

    const formattedOutputs = outputLines.map((line) => {
      if (line.startsWith('drw')) return { type: 'dir', text: line };
      if (line.startsWith('-rwx') || line.includes('[✓]')) return { type: 'exec', text: line };
      if (line.startsWith('[+]') || line.startsWith('[*]')) return { type: 'info', text: line };
      return { type: 'text', text: line };
    });

    setLines((prev) => [...prev, promptLine, ...formattedOutputs]);

    if (!historyItems.includes(trimmed)) {
      setHistoryItems((prev) => [trimmed, ...prev.slice(0, 5)]);
    }

    setCurrentInput('');
    setQuickInput('');
  };

  const handleCopyTerminal = () => {
    const textToCopy = lines.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 1500);
  };

  const handlePasteCommand = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setQuickInput(text);
        setCurrentInput(text);
      }
    } catch {
      setQuickInput('ls -la');
    }
  };

  const handleTestBridge = async () => {
    setBridgeStatusMsg('Pinging Termux daemon...');
    const result = await bridge.testConnection(bridgeEndpoint);
    setBridgeStatusMsg(result.message);
    if (result.success) {
      setIsDirectMode(true);
    }
  };

  const handleCopyTermuxScript = () => {
    navigator.clipboard.writeText(bridge.getTermuxSetupScript());
    setBridgeStatusMsg('Copied Termux setup script to clipboard! Paste into Termux.');
  };

  const addTab = () => {
    const newName = `Session ${tabs.length + 1}`;
    setTabs([...tabs, newName]);
    setActiveTab(newName);
  };

  const closeTab = (tabToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const nextTabs = tabs.filter((t) => t !== tabToClose);
    setTabs(nextTabs);
    if (activeTab === tabToClose) {
      setActiveTab(nextTabs[0]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#080c14] border border-[#172a45] rounded-sm overflow-hidden select-none text-xs relative">
      {/* Terminal Header */}
      <div className="h-8 bg-[#0b111e] border-b border-[#172a45] flex items-center justify-between px-2.5 shrink-0 z-10">
        <div className="flex items-center space-x-1.5">
          <TerminalIcon className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span className="font-semibold text-slate-200 tracking-tight text-xs">Terminal</span>

          {/* Session Tabs */}
          <div className="flex items-center space-x-1 ml-1 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <div
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded cursor-pointer text-[10px] transition-colors border ${
                    isActive
                      ? 'bg-[#0e3a6a] text-white border-[#38bdf8]/50 font-medium'
                      : 'bg-[#0d1422] text-slate-400 border-[#172a45] hover:text-slate-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#22c55e]' : 'bg-slate-600'}`} />
                  <span>{tab}</span>
                  <button
                    onClick={(e) => closeTab(tab, e)}
                    className="hover:text-red-400 ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}

            <button
              onClick={addTab}
              className="p-1 text-slate-400 hover:text-white hover:bg-[#162338] rounded"
              title="New Terminal Session"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Right Actions: Termux Bridge Config & Window Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowBridgeModal(!showBridgeModal)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] transition-colors ${
              isDirectMode
                ? 'bg-[#0e3a6a] text-emerald-300 border-emerald-500/50'
                : 'bg-[#0c1424] text-slate-400 border-[#172a45] hover:text-slate-200'
            }`}
            title="Configure Termux Connection Bridge"
          >
            <Radio className={`w-2.5 h-2.5 ${isDirectMode ? 'text-emerald-400 animate-pulse' : 'text-[#38bdf8]'}`} />
            <span>{isDirectMode ? 'Termux Live' : 'Termux Bridge'}</span>
          </button>

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

      {/* Termux Bridge Configuration Flyout */}
      {showBridgeModal && (
        <div className="bg-[#0b1322] border-b border-[#172a45] p-2.5 text-[11px] space-y-2 z-20">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Termux Connection Bridge</span>
            </span>
            <button
              onClick={() => setShowBridgeModal(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
            <div className="space-y-1">
              <span className="text-slate-400">Daemon Endpoint:</span>
              <div className="flex items-center bg-[#060a12] border border-[#172a45] rounded overflow-hidden">
                <input
                  type="text"
                  value={bridgeEndpoint}
                  onChange={(e) => setBridgeEndpoint(e.target.value)}
                  placeholder="http://localhost:8080"
                  className="flex-1 px-1.5 py-0.5 bg-transparent font-mono-code text-slate-200 outline-none text-[10px]"
                />
                <button
                  onClick={handleTestBridge}
                  className="px-2 py-0.5 bg-[#0e3a6a] hover:bg-[#154c86] text-[#38bdf8] font-medium"
                >
                  Connect
                </button>
              </div>
            </div>

            <div className="space-y-1 flex flex-col justify-end">
              <button
                onClick={handleCopyTermuxScript}
                className="w-full py-1 px-2 rounded bg-[#0d182b] hover:bg-[#162744] border border-[#172a45] text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-colors"
              >
                <Copy className="w-3 h-3 text-[#38bdf8]" />
                <span>Copy 1-Click Termux Setup Script</span>
              </button>
            </div>
          </div>

          {bridgeStatusMsg && (
            <div className="p-1.5 rounded bg-[#070c16] text-[#38bdf8] font-mono-code text-[10px]">
              {bridgeStatusMsg}
            </div>
          )}
        </div>
      )}

      {/* Main Terminal Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Terminal Screen (Console output) */}
        <div
          onClick={() => terminalInputRef.current?.focus()}
          className="flex-1 p-2 bg-[#060a12] font-mono-code text-xs text-slate-200 overflow-y-auto cursor-text space-y-0.5"
        >
          {lines.map((item, idx) => {
            if (item.type === 'input') {
              return (
                <div key={idx} className="text-[#38bdf8] font-medium leading-relaxed">
                  {item.text}
                </div>
              );
            }
            if (item.type === 'dir') {
              return (
                <div key={idx} className="text-[#38bdf8] font-medium leading-tight">
                  {item.text}
                </div>
              );
            }
            if (item.type === 'exec') {
              return (
                <div key={idx} className="text-[#22c55e] font-medium leading-tight">
                  {item.text}
                </div>
              );
            }
            if (item.type === 'info') {
              return (
                <div key={idx} className="text-cyan-300 leading-tight">
                  {item.text}
                </div>
              );
            }
            return (
              <div key={idx} className="text-slate-300 leading-tight">
                {item.text}
              </div>
            );
          })}

          {/* Active Interactive Input Line */}
          <div className="flex items-center text-xs pt-1">
            <span className="text-[#22c55e] font-semibold whitespace-nowrap text-[11px]">
              u0_a328@localhost:{bridge.getCurrentDir().replace('/storage/emulated/0', '~')}$&nbsp;
            </span>
            <input
              ref={terminalInputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCommandSubmit(currentInput);
                }
              }}
              className="flex-1 bg-transparent border-none outline-none text-slate-100 font-mono-code p-0 text-xs caret-[#22c55e]"
              autoFocus
            />
          </div>

          <div ref={terminalEndRef} />
        </div>

        {/* Right Shell & History Sidebar */}
        <div className="w-36 sm:w-44 bg-[#090e19] border-l border-[#172a45] p-1.5 flex flex-col justify-between shrink-0 text-xs">
          <div className="space-y-2">
            {/* Shell Selector */}
            <div>
              <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Code className="w-2.5 h-2.5 text-[#38bdf8]" />
                <span>Shell</span>
              </div>
              <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-[#060a12] border border-[#172a45] text-slate-200 text-[10px]">
                <span className="font-mono-code">{shellType}</span>
                <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-1 mt-1.5">
                <button
                  onClick={handleCopyTerminal}
                  className="flex items-center justify-center gap-1 py-1 px-1 rounded bg-[#0e1726] hover:bg-[#15233a] border border-[#172a45] text-slate-300 hover:text-white transition-colors text-[9px]"
                >
                  <Copy className="w-2.5 h-2.5 text-slate-400" />
                  <span>{copiedNotice ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handlePasteCommand}
                  className="flex items-center justify-center gap-1 py-1 px-1 rounded bg-[#0e1726] hover:bg-[#15233a] border border-[#172a45] text-slate-300 hover:text-white transition-colors text-[9px]"
                >
                  <ClipboardPaste className="w-2.5 h-2.5 text-slate-400" />
                  <span>Paste</span>
                </button>
              </div>
            </div>

            {/* Command History */}
            <div>
              <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <History className="w-2.5 h-2.5 text-[#38bdf8]" />
                  <span>History</span>
                </span>
                <button
                  onClick={() => setHistoryItems([])}
                  className="text-slate-500 hover:text-slate-300 text-[8px]"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-0.5">
                {historyItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentInput(item);
                      setQuickInput(item);
                      handleCommandSubmit(item);
                    }}
                    className="w-full text-left px-1.5 py-0.5 rounded bg-[#070b14] hover:bg-[#101b2e] border border-[#172a45]/60 hover:border-[#1e3a5f] text-slate-300 hover:text-cyan-300 font-mono-code text-[9px] truncate flex items-center justify-between group transition-colors"
                  >
                    <span className="truncate">{item}</span>
                    <span className="text-slate-500 group-hover:text-cyan-400 text-[8px]">run</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Command Input */}
          <div className="pt-1.5 border-t border-[#172a45]">
            <div className="flex items-center bg-[#060a12] border border-[#172a45] rounded overflow-hidden">
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommandSubmit(quickInput);
                }}
                placeholder="Command..."
                className="flex-1 bg-transparent px-1.5 py-0.5 text-[10px] text-slate-200 outline-none font-mono-code placeholder:text-slate-500"
              />
              <button
                onClick={() => handleCommandSubmit(quickInput)}
                className="p-1 text-slate-400 hover:text-[#38bdf8] hover:bg-[#121c2e] transition-colors"
              >
                <Send className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
