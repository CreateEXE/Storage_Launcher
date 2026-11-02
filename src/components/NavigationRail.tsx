import React from 'react';
import {
  Folder,
  Terminal,
  BoxSelect,
  Settings,
  Sparkles
} from 'lucide-react';
import { ActiveNavTab } from '../types';

interface NavigationRailProps {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  onOpenSettings: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeTab,
  onSelectTab,
  onOpenSettings
}) => {
  const navItems: { label: ActiveNavTab; display: string; icon: React.ElementType }[] = [
    { label: 'Files', display: 'Storage', icon: Folder },
    { label: '3D Viewer', display: '3D Viewer', icon: BoxSelect },
    { label: 'Terminal', display: 'Terminal', icon: Terminal },
    { label: 'Settings', display: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-16 md:w-20 bg-[#080c14]/90 backdrop-blur-md border-r border-[#172a45] flex flex-col justify-between py-2 shrink-0 z-20 select-none">
      {/* Top Nav Items - All fully functional */}
      <nav className="flex flex-col items-center space-y-1 px-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.label;

          return (
            <button
              key={item.label}
              onClick={() => {
                if (item.label === 'Settings') {
                  onOpenSettings();
                } else {
                  onSelectTab(item.label);
                }
              }}
              className={`w-full py-2 px-1 flex flex-col items-center justify-center rounded-lg transition-all text-center ${
                isActive
                  ? 'bg-[#0e3a6a] text-white shadow-[0_0_12px_rgba(14,58,106,0.6)] border border-[#38bdf8]/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e1626]'
              }`}
            >
              <Icon
                className={`w-4 h-4 mb-1 transition-transform ${
                  isActive ? 'text-[#38bdf8] scale-105' : 'text-slate-400'
                }`}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span className={`text-[10px] tracking-tight leading-tight ${isActive ? 'font-medium text-white' : 'font-normal'}`}>
                {item.display}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom: Termux Applet Version Label */}
      <div className="px-1 pt-2 border-t border-[#172a45]/80 flex flex-col items-center text-center">
        <div className="flex items-center space-x-1 text-slate-400 cursor-default">
          <Sparkles className="w-3 h-3 text-[#38bdf8]" />
          <span className="text-[9px] font-mono-code text-slate-400 whitespace-nowrap">
            Termux GUI
          </span>
        </div>
      </div>
    </aside>
  );
};
