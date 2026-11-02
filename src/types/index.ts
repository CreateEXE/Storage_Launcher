export interface FileItem {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  type: 'Folder' | 'VRM' | 'glTF' | 'C++ Source' | 'JSON' | 'Markdown' | 'Shell Script' | 'Text' | 'Binary';
  modified: string;
  isFolder: boolean;
  path: string;
  dimensions?: string;
  faces?: number;
  materials?: number;
  animations?: number;
  created?: string;
  content?: string;
}

export interface TreeNode {
  name: string;
  path: string;
  isOpen?: boolean;
  isSelected?: boolean;
  children?: TreeNode[];
}

export interface ModelAnimation {
  id: string;
  name: string;
  duration: number;
  speed: number;
}

export interface Model3DData {
  id: string;
  name: string;
  type: string;
  size: string;
  meshes: number;
  textures: number;
  animations: ModelAnimation[];
  materials: {
    name: string;
    type: string;
    roughness: number;
    metalness: number;
    color: string;
  }[];
}

export interface TerminalTab {
  id: string;
  title: string;
  active: boolean;
  history: string[];
  currentPath: string;
}

export type ActiveNavTab = 'Home' | 'Files' | 'Terminal' | 'Sessions' | 'Scripts' | 'Packages' | '3D Viewer' | 'Settings';

export type PanelId = 'viewer' | 'explorer' | 'terminal' | 'inspector';

export interface PanelState {
  minimized: boolean;
  maximized: boolean;
  visible: boolean;
}
