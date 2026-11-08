import React, { useState } from 'react';
import {
  Shirt,
  Scissors,
  Headphones,
  Sparkles,
  Check,
  Search,
  Tag,
  Palette,
  ShieldCheck,
  Crown,
  Zap,
  ShoppingBag
} from 'lucide-react';
import { AvatarParameters } from '../types/avatar';

interface AssetBrowserProps {
  params: AvatarParameters;
  onChange: (newParams: AvatarParameters) => void;
  onClose?: () => void;
}

interface AssetDef {
  id: string;
  name: string;
  category: 'outfit' | 'hairstyle' | 'palette';
  description: string;
  tags: string[];
  rarity: 'Common' | 'Rare' | 'Legendary' | 'Cyber';
  icon: any;
  apply: (p: AvatarParameters) => AvatarParameters;
  isEquipped: (p: AvatarParameters) => boolean;
}

export const AssetBrowser: React.FC<AssetBrowserProps> = ({
  params,
  onChange,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'outfit' | 'hairstyle' | 'palette'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const ASSETS: AssetDef[] = [
    // Outfits
    {
      id: 'outfit-cyber-jacket',
      name: 'Cyber Strike Jacket & Shorts',
      category: 'outfit',
      description: 'Futuristic urban cyberpunk jacket with dual knee-high boots and neon striping.',
      tags: ['Cyber', 'Urban', 'Default'],
      rarity: 'Common',
      icon: Shirt,
      apply: (p) => ({ ...p, outfit: 'cyber_jacket' }),
      isEquipped: (p) => p.outfit === 'cyber_jacket'
    },
    {
      id: 'outfit-mmo-tunic',
      name: 'Alchemia Sorcerer Robe',
      category: 'outfit',
      description: 'Mystic MMO spellcaster robes with flowing silk trims and enchanted crystal gem accents.',
      tags: ['Fantasy', 'Mage', 'Alchemia'],
      rarity: 'Rare',
      icon: Shirt,
      apply: (p) => ({ ...p, outfit: 'mmo_tunic', coatColor: '#3b0764', innerColor: '#fae8ff' }),
      isEquipped: (p) => p.outfit === 'mmo_tunic'
    },
    {
      id: 'outfit-school-uniform',
      name: 'Custom Cast Pop Uniform',
      category: 'outfit',
      description: 'Vibrant Japanese idol academy blazer outfit with pleated skirt and satin bow.',
      tags: ['Anime', 'Idol', 'CustomCast'],
      rarity: 'Rare',
      icon: Shirt,
      apply: (p) => ({ ...p, outfit: 'school_uniform', coatColor: '#1e1b4b', innerColor: '#ffffff' }),
      isEquipped: (p) => p.outfit === 'school_uniform'
    },
    {
      id: 'outfit-combat-suit',
      name: 'Vanguard Exosuit Armor',
      category: 'outfit',
      description: 'Heavy tactical cybernetic power armor with reinforced carbon fiber plates.',
      tags: ['Tactical', 'Armor', 'Vanguard'],
      rarity: 'Legendary',
      icon: ShieldCheck,
      apply: (p) => ({ ...p, outfit: 'combat_suit', coatColor: '#0f172a', innerColor: '#020617', accentNeonColor: '#10b981' }),
      isEquipped: (p) => p.outfit === 'combat_suit'
    },
    {
      id: 'outfit-hoodie',
      name: 'Street Tech Oversized Hoodie',
      category: 'outfit',
      description: 'Relaxed oversized hacker hoodie with glowing neon piping and techwear boots.',
      tags: ['Techwear', 'Casual', 'Hacker'],
      rarity: 'Rare',
      icon: Shirt,
      apply: (p) => ({ ...p, outfit: 'hoodie', coatColor: '#18181b', innerColor: '#27272a', accentNeonColor: '#06b6d4' }),
      isEquipped: (p) => p.outfit === 'hoodie'
    },

    // Hairstyles
    {
      id: 'hair-ponytail',
      name: 'High Wild Ponytail & Blunt Bangs',
      category: 'hairstyle',
      description: 'Sleek dark raven blunt bangs paired with a high flowing wild ponytail (Kunoichi spec).',
      tags: ['Kunoichi', 'Raven', 'Bangs'],
      rarity: 'Legendary',
      icon: Scissors,
      apply: (p) => ({ ...p, hairstyle: 'ponytail', hairColor: '#111827', hairHighlightColor: '#374151' }),
      isEquipped: (p) => p.hairstyle === 'ponytail'
    },
    {
      id: 'hair-twintails',
      name: 'Cyber Idol Twin Tails',
      category: 'hairstyle',
      description: 'Iconic long twin tails with animated gradient highlights and ribbon locks.',
      tags: ['TwinTails', 'Idol', 'Classic'],
      rarity: 'Rare',
      icon: Scissors,
      apply: (p) => ({ ...p, hairstyle: 'twintails' }),
      isEquipped: (p) => p.hairstyle === 'twintails'
    },
    {
      id: 'hair-longwaves',
      name: 'Cascading Magic Waves',
      category: 'hairstyle',
      description: 'Luxurious long wavy locks that drape over shoulders with soft metallic sheen.',
      tags: ['Wavy', 'Long', 'Fantasy'],
      rarity: 'Rare',
      icon: Scissors,
      apply: (p) => ({ ...p, hairstyle: 'longwaves' }),
      isEquipped: (p) => p.hairstyle === 'longwaves'
    },
    {
      id: 'hair-spiky',
      name: 'Neon Cyber Spikes',
      category: 'hairstyle',
      description: 'Sharp edgy spiky hair styled with cybernetic hold hair wax.',
      tags: ['Edgy', 'Spiky', 'Action'],
      rarity: 'Common',
      icon: Scissors,
      apply: (p) => ({ ...p, hairstyle: 'spiky' }),
      isEquipped: (p) => p.hairstyle === 'spiky'
    },
    {
      id: 'hair-bobcut',
      name: 'Precision Bob Cut',
      category: 'hairstyle',
      description: 'Clean symmetrical anime bob cut with soft framed jawline locks.',
      tags: ['Bob', 'Symmetrical', 'Cute'],
      rarity: 'Common',
      icon: Scissors,
      apply: (p) => ({ ...p, hairstyle: 'bobcut' }),
      isEquipped: (p) => p.hairstyle === 'bobcut'
    },

    // Color Palettes
    {
      id: 'pal-raven-kunoichi',
      name: 'Raven Kunoichi Aesthetic',
      category: 'palette',
      description: 'Deep midnight obsidian black coat, emerald green eyes, and stealth neon accents.',
      tags: ['Ninja', 'Emerald', 'Black'],
      rarity: 'Legendary',
      icon: Palette,
      apply: (p) => ({
        ...p,
        skinColor: '#fceade',
        hairColor: '#111827',
        hairHighlightColor: '#374151',
        eyeColor: '#10b981',
        coatColor: '#090d16',
        innerColor: '#1f2937',
        accentNeonColor: '#059669',
        bootsColor: '#030712'
      }),
      isEquipped: (p) => p.eyeColor === '#10b981' && p.hairColor === '#111827'
    },
    {
      id: 'pal-sakura-idol',
      name: 'Sakura Pink Pop Palette',
      category: 'palette',
      description: 'Vibrant pastel pink hair, magenta irises, and bright cyan pop neon highlights.',
      tags: ['Pastel', 'Pink', 'Pop'],
      rarity: 'Rare',
      icon: Palette,
      apply: (p) => ({
        ...p,
        hairColor: '#f472b6',
        hairHighlightColor: '#fbcfe8',
        eyeColor: '#ec4899',
        coatColor: '#1e1b4b',
        innerColor: '#ffffff',
        accentNeonColor: '#fb7185'
      }),
      isEquipped: (p) => p.hairColor === '#f472b6'
    },
    {
      id: 'pal-cyber-emerald',
      name: 'Matrix Cyber Emerald',
      category: 'palette',
      description: 'Electric cyan hair with lime green neon emission and dark metallic composite suit.',
      tags: ['Matrix', 'Electric', 'Emerald'],
      rarity: 'Cyber',
      icon: Zap,
      apply: (p) => ({
        ...p,
        hairColor: '#0284c7',
        hairHighlightColor: '#38bdf8',
        eyeColor: '#10b981',
        coatColor: '#0f172a',
        accentNeonColor: '#22c55e'
      }),
      isEquipped: (p) => p.accentNeonColor === '#22c55e'
    }
  ];

  const filteredAssets = ASSETS.filter((item) => {
    const matchesTab = activeTab === 'all' || item.category === activeTab;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const getRarityBadge = (rarity: AssetDef['rarity']) => {
    switch (rarity) {
      case 'Legendary':
        return 'bg-amber-950/80 text-amber-300 border-amber-500/50';
      case 'Cyber':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50';
      case 'Rare':
        return 'bg-purple-950/80 text-purple-300 border-purple-500/50';
      default:
        return 'bg-slate-900 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#080c14] border border-[#172a45] rounded-sm overflow-hidden select-none text-xs">
      {/* Top Bar */}
      <div className="h-8 bg-[#0b111e] border-b border-[#172a45] flex items-center justify-between px-2.5 shrink-0">
        <div className="flex items-center space-x-2">
          <ShoppingBag className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span className="font-semibold text-slate-100 tracking-tight text-xs">
            VRM Asset & Outfit Browser
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#0e3a6a] text-[#38bdf8] font-mono-code border border-[#38bdf8]/40">
            {filteredAssets.length} Items Available
          </span>
        </div>

        {onClose && (
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            ✕
          </button>
        )}
      </div>

      {/* Search & Navigation Tabs */}
      <div className="p-2 bg-[#090e18] border-b border-[#172a45] space-y-2 shrink-0">
        <div className="flex items-center bg-[#070b13] border border-[#172a45] rounded px-2 py-1">
          <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
          <input
            type="text"
            placeholder="Search costumes, hair, accessories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 text-xs outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300 text-[10px]">
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Assets' },
            { id: 'outfit', label: 'Wardrobe' },
            { id: 'hairstyle', label: 'Hairstyles' },
            { id: 'palette', label: 'Color Themes' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#0e3a6a] text-cyan-300 border border-[#38bdf8]/50 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                  : 'bg-[#0b1220] text-slate-400 border border-[#172a45] hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Cards Grid */}
      <div className="flex-1 p-2.5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#070b13]">
        {filteredAssets.map((asset) => {
          const IconComponent = asset.icon;
          const equipped = asset.isEquipped(params);

          return (
            <div
              key={asset.id}
              className={`p-2.5 rounded border transition-all flex flex-col justify-between ${
                equipped
                  ? 'bg-[#0b182b] border-[#38bdf8] shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                  : 'bg-[#0b1220] border-[#172a45] hover:border-[#38bdf8]/50 hover:bg-[#0e1728]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <div className="p-1 rounded bg-[#101c30] border border-[#1e3456] text-[#38bdf8]">
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold text-slate-100 text-[11px] truncate">
                      {asset.name}
                    </span>
                  </div>

                  <span className={`text-[8px] px-1.5 py-0.2 rounded border font-mono-code shrink-0 ${getRarityBadge(asset.rarity)}`}>
                    {asset.rarity}
                  </span>
                </div>

                <p className="text-[10px] text-slate-400 leading-tight mb-2">
                  {asset.description}
                </p>

                <div className="flex flex-wrap gap-1 mb-2">
                  {asset.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[8px] px-1 py-0.2 rounded bg-[#070d17] text-slate-400 border border-[#15253d] flex items-center gap-0.5"
                    >
                      <Tag className="w-2 h-2 text-slate-500" />
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onChange(asset.apply(params))}
                className={`w-full py-1.5 rounded font-medium text-[10px] flex items-center justify-center gap-1 transition-all ${
                  equipped
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 cursor-default'
                    : 'bg-[#0e3a6a] hover:bg-[#154c86] text-white border border-[#38bdf8]/50 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                }`}
              >
                {equipped ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Equipped</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-[#38bdf8]" />
                    <span>Equip Asset</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
