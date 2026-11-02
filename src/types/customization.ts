export type WallpaperPreset = 'nihonga' | 'nihonga_live' | 'cyber_matrix' | 'midnight' | 'obsidian' | 'nebula' | 'custom';
export type AccentColor = 'cyan' | 'crimson' | 'purple' | 'emerald' | 'amber';
export type DesktopLayout = 'grid' | 'dock' | 'minimal';

export interface DesktopCustomization {
  wallpaper: WallpaperPreset;
  customWallpaperUrl: string;
  accentColor: AccentColor;
  desktopLayout: DesktopLayout;
  windowOpacity: 'high' | 'medium' | 'solid';
  showNodeWires: boolean;
  phoneCompactMode: boolean;
  uiScale: 'compact' | 'normal' | 'expanded';
}

export const DEFAULT_CUSTOMIZATION: DesktopCustomization = {
  wallpaper: 'nihonga_live',
  customWallpaperUrl: '',
  accentColor: 'cyan',
  desktopLayout: 'grid',
  windowOpacity: 'medium',
  showNodeWires: true,
  phoneCompactMode: true,
  uiScale: 'normal'
};

export const ACCENT_THEMES: Record<AccentColor, {
  name: string;
  hex: string;
  glow: string;
  border: string;
  bg: string;
  text: string;
}> = {
  cyan: {
    name: 'Electric Cyan',
    hex: '#38bdf8',
    glow: 'rgba(56,189,248,0.3)',
    border: '#38bdf8',
    bg: '#0e3a6a',
    text: '#38bdf8'
  },
  crimson: {
    name: 'Oni Crimson',
    hex: '#f43f5e',
    glow: 'rgba(244,63,94,0.3)',
    border: '#f43f5e',
    bg: '#4c0519',
    text: '#fb7185'
  },
  purple: {
    name: 'Void Purple',
    hex: '#a855f7',
    glow: 'rgba(168,85,247,0.3)',
    border: '#a855f7',
    bg: '#3b0764',
    text: '#c084fc'
  },
  emerald: {
    name: 'Matrix Emerald',
    hex: '#10b981',
    glow: 'rgba(16,185,129,0.3)',
    border: '#10b981',
    bg: '#064e3b',
    text: '#34d399'
  },
  amber: {
    name: 'Solar Amber',
    hex: '#f59e0b',
    glow: 'rgba(245,158,11,0.3)',
    border: '#f59e0b',
    bg: '#451a03',
    text: '#fbbf24'
  }
};
