import React, { useEffect, useRef } from 'react';
import { WallpaperPreset, AccentColor, ACCENT_THEMES } from '../types/customization';

interface LiveWallpaperProps {
  wallpaper: WallpaperPreset;
  customWallpaperUrl?: string;
  accentColor?: AccentColor;
}

interface LeafParticle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  color: string;
  type: 'maple' | 'petal';
}

interface ShootingLaserStreak {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  color: string;
  history: { x: number; y: number }[];
  maxHistory: number;
  turnsRemaining: number;
  stepCounter: number;
}

export const LiveWallpaper: React.FC<LiveWallpaperProps> = ({
  wallpaper,
  customWallpaperUrl,
  accentColor = 'cyan'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (wallpaper !== 'nihonga_live' && wallpaper !== 'cyber_matrix') {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // -------------------------------------------------------------
    // SETUP FOR 'nihonga_live' (Falling Leaves / Sakura Petals only)
    // -------------------------------------------------------------
    const leafColors = ['#f43f5e', '#fb7185', '#fcd34d', '#fbbf24', '#f472b6', '#38bdf8'];
    const leaves: LeafParticle[] = [];
    const LEAF_COUNT = Math.min(45, Math.floor(width / 30));

    for (let i = 0; i < LEAF_COUNT; i++) {
      leaves.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 8 + 6,
        speedX: Math.random() * 1.2 - 0.3,
        speedY: Math.random() * 0.9 + 0.6,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.03,
        opacity: Math.random() * 0.6 + 0.35,
        color: leafColors[Math.floor(Math.random() * leafColors.length)],
        type: Math.random() > 0.4 ? 'maple' : 'petal'
      });
    }

    let leafTimer = 0;

    const drawLeaf = (ctx: CanvasRenderingContext2D, leaf: LeafParticle) => {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.rotation);
      ctx.globalAlpha = leaf.opacity;
      ctx.fillStyle = leaf.color;

      if (leaf.type === 'maple') {
        ctx.beginPath();
        ctx.moveTo(0, -leaf.size);
        ctx.quadraticCurveTo(leaf.size * 0.6, -leaf.size * 0.4, leaf.size * 0.8, -leaf.size * 0.1);
        ctx.quadraticCurveTo(leaf.size * 0.4, leaf.size * 0.2, leaf.size * 0.5, leaf.size * 0.8);
        ctx.quadraticCurveTo(0, leaf.size * 0.5, -leaf.size * 0.5, leaf.size * 0.8);
        ctx.quadraticCurveTo(-leaf.size * 0.4, leaf.size * 0.2, -leaf.size * 0.8, -leaf.size * 0.1);
        ctx.quadraticCurveTo(-leaf.size * 0.6, -leaf.size * 0.4, 0, -leaf.size);
        ctx.fill();

        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, leaf.size * 0.5);
        ctx.lineTo(0, leaf.size * 1.1);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf.size * 0.5, leaf.size, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    // -------------------------------------------------------------
    // SETUP FOR 'cyber_matrix' (Scarce Shooting Star Lasers across Screen)
    // -------------------------------------------------------------
    const GRID_SIZE = 60;
    const themeHex = ACCENT_THEMES[accentColor]?.hex || '#38bdf8';
    const laserColors = [themeHex, '#38bdf8', '#f43f5e', '#a855f7', '#10b981', '#00f0ff'];

    // Scarce laser count for clean, high-impact shooting star visuals
    const LASER_COUNT = Math.min(8, Math.max(4, Math.floor(width / 240)));
    const lasers: ShootingLaserStreak[] = [];

    const initShootingLaser = (): ShootingLaserStreak => {
      const isHorizontal = Math.random() > 0.5;
      const startEdge = Math.random() > 0.5;

      let x = 0;
      let y = 0;
      let dirX = 0;
      let dirY = 0;

      if (isHorizontal) {
        x = startEdge ? -50 : width + 50;
        y = Math.floor((Math.random() * height) / GRID_SIZE) * GRID_SIZE;
        dirX = startEdge ? 1 : -1;
      } else {
        x = Math.floor((Math.random() * width) / GRID_SIZE) * GRID_SIZE;
        y = startEdge ? -50 : height + 50;
        dirY = startEdge ? 1 : -1;
      }

      return {
        x,
        y,
        dirX,
        dirY,
        speed: Math.random() * 10.0 + 14.0, // High speed lightning streak
        color: laserColors[Math.floor(Math.random() * laserColors.length)],
        history: [{ x, y }],
        maxHistory: Math.floor(Math.random() * 30) + 50, // Sleek tail
        turnsRemaining: 1, // Single direction change ONLY
        stepCounter: Math.floor(Math.random() * 4) + 2
      };
    };

    for (let i = 0; i < LASER_COUNT; i++) {
      lasers.push(initShootingLaser());
    }

    // -------------------------------------------------------------
    // RENDER LOOP
    // -------------------------------------------------------------
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      if (wallpaper === 'nihonga_live') {
        ctx.clearRect(0, 0, width, height);

        leafTimer += dt;

        for (const leaf of leaves) {
          leaf.x += leaf.speedX + Math.sin(leafTimer + leaf.y * 0.01) * 0.4;
          leaf.y += leaf.speedY;
          leaf.rotation += leaf.rotationSpeed;

          if (leaf.y > height + 20) {
            leaf.y = -20;
            leaf.x = Math.random() * width;
          }
          if (leaf.x > width + 20) leaf.x = -20;
          if (leaf.x < -20) leaf.x = width + 20;

          drawLeaf(ctx, leaf);
        }
      } else if (wallpaper === 'cyber_matrix') {
        // Deep clear for sharp shooting stars without grid lines
        ctx.fillStyle = 'rgba(3, 7, 18, 0.28)';
        ctx.fillRect(0, 0, width, height);

        // Update High-Speed Laser Streaks
        for (let i = 0; i < lasers.length; i++) {
          const l = lasers[i];

          l.x += l.dirX * l.speed;
          l.y += l.dirY * l.speed;

          l.history.push({ x: l.x, y: l.y });
          if (l.history.length > l.maxHistory) {
            l.history.shift();
          }

          // Single Direction Change at Grid Intersection Point
          const atGridX = Math.abs(l.x % GRID_SIZE) < l.speed;
          const atGridY = Math.abs(l.y % GRID_SIZE) < l.speed;

          if (atGridX && atGridY && l.turnsRemaining === 1) {
            l.stepCounter--;
            if (l.stepCounter <= 0) {
              l.turnsRemaining = 0; // Lock out further turns: single direction change ONLY

              const nodeX = Math.round(l.x / GRID_SIZE) * GRID_SIZE;
              const nodeY = Math.round(l.y / GRID_SIZE) * GRID_SIZE;
              l.x = nodeX;
              l.y = nodeY;

              if (l.dirX !== 0) {
                l.dirX = 0;
                l.dirY = Math.random() > 0.5 ? 1 : -1;
              } else {
                l.dirY = 0;
                l.dirX = Math.random() > 0.5 ? 1 : -1;
              }
            }
          }

          // Full Screen Crossing Check: reset only when laser fully exits screen boundaries
          const isFarOutOfBounds =
            l.x < -200 || l.x > width + 200 || l.y < -200 || l.y > height + 200;

          if (isFarOutOfBounds) {
            lasers[i] = initShootingLaser();
            continue;
          }

          // Render Shooting Star Laser Beam Path
          if (l.history.length > 1) {
            ctx.save();

            // Laser Beam Line
            ctx.beginPath();
            ctx.moveTo(l.history[0].x, l.history[0].y);
            for (let j = 1; j < l.history.length; j++) {
              ctx.lineTo(l.history[j].x, l.history[j].y);
            }

            ctx.strokeStyle = l.color;
            ctx.lineWidth = 2.8;
            ctx.shadowColor = l.color;
            ctx.shadowBlur = 14;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Shooting Head Core
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(l.x, l.y, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [wallpaper, accentColor]);

  const getBaseStyle = (): React.CSSProperties => {
    if (wallpaper === 'nihonga' || wallpaper === 'nihonga_live') {
      return {
        backgroundImage: `url('/assets/aistudio/japanese_nihonga_painting_abou__10__19e79978.jpeg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    if (wallpaper === 'cyber_matrix') {
      return {
        background: '#050912'
      };
    }
    if (wallpaper === 'custom' && customWallpaperUrl) {
      return {
        backgroundImage: `url('${customWallpaperUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    if (wallpaper === 'midnight') {
      return {
        background: 'radial-gradient(circle at 50% 20%, #0d213f 0%, #060b14 70%)'
      };
    }
    if (wallpaper === 'obsidian') {
      return {
        background: 'linear-gradient(135deg, #090e17 0%, #030508 100%)'
      };
    }
    if (wallpaper === 'nebula') {
      return {
        background: 'radial-gradient(ellipse at bottom, #2e1065 0%, #080718 60%, #030209 100%)'
      };
    }
    return {
      backgroundImage: `url('/assets/aistudio/japanese_nihonga_painting_abou__10__19e79978.jpeg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  };

  return (
    <div
      className="absolute inset-0 select-none z-0 pointer-events-none transition-all duration-300"
      style={getBaseStyle()}
    >
      {(wallpaper === 'nihonga_live' || wallpaper === 'cyber_matrix') && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[#060a12]/75 via-transparent to-[#060a12]/50 pointer-events-none z-1" />
    </div>
  );
};
