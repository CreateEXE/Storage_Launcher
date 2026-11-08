import { FileItem } from './index';

export type WindowType =
  | 'viewer_3d'
  | 'avatar_editor'
  | 'animation_studio'
  | 'color_picker'
  | 'file_explorer'
  | 'terminal'
  | 'inspector'
  | 'code_editor';

export interface WindowNode {
  id: string;
  title: string;
  type: WindowType;
  parentId?: string; // Node parent-child linkage!
  childIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  file?: FileItem;
  payload?: any;
}
