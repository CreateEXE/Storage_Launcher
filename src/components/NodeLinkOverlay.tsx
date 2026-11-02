import React from 'react';
import { WindowNode } from '../types/window';

interface NodeLinkOverlayProps {
  windows: WindowNode[];
  enabled?: boolean;
}

export const NodeLinkOverlay: React.FC<NodeLinkOverlayProps> = ({ windows, enabled = true }) => {
  if (!enabled) return null;

  const links: {
    id: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    color: string;
  }[] = [];

  const windowMap = new Map<string, WindowNode>();
  windows.forEach((w) => windowMap.set(w.id, w));

  windows.forEach((child) => {
    if (child.parentId && !child.isMinimized) {
      const parent = windowMap.get(child.parentId);
      if (parent && !parent.isMinimized) {
        // Compute connection points:
        // Parent right-center to Child left-center (or top/bottom if stacked)
        const parentCenterX = parent.isMaximized ? window.innerWidth / 2 : parent.x + parent.width;
        const parentCenterY = parent.isMaximized ? window.innerHeight / 2 : parent.y + 14; // header level

        const childCenterX = child.isMaximized ? window.innerWidth / 2 : child.x;
        const childCenterY = child.isMaximized ? window.innerHeight / 2 : child.y + 14;

        links.push({
          id: `${parent.id}->${child.id}`,
          fromX: parentCenterX,
          fromY: parentCenterY,
          toX: childCenterX,
          toY: childCenterY,
          color: child.type === 'color_picker' ? '#f472b6' : child.type === 'avatar_editor' ? '#38bdf8' : '#22c55e'
        });
      }
    }
  });

  if (links.length === 0) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-15 overflow-visible">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {links.map((link) => {
        const dx = Math.abs(link.toX - link.fromX) * 0.5;
        const cp1x = link.fromX + Math.max(30, dx);
        const cp1y = link.fromY;
        const cp2x = link.toX - Math.max(30, dx);
        const cp2y = link.toY;
        const d = `M ${link.fromX} ${link.fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${link.toX} ${link.toY}`;

        return (
          <g key={link.id}>
            {/* Glow Backing Path */}
            <path
              d={d}
              fill="none"
              stroke={link.color}
              strokeWidth="3"
              strokeOpacity="0.3"
              filter="url(#glow)"
            />
            {/* Dashed Animated Wire */}
            <path
              d={d}
              fill="none"
              stroke={link.color}
              strokeWidth="1.5"
              strokeOpacity="0.85"
              strokeDasharray="4 3"
            />
            {/* Source Pin */}
            <circle cx={link.fromX} cy={link.fromY} r="3.5" fill={link.color} />
            {/* Target Pin */}
            <circle cx={link.toX} cy={link.toY} r="3.5" fill={link.color} />
          </g>
        );
      })}
    </svg>
  );
};
