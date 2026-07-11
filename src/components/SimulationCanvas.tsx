'use client';

import React, { useRef, useEffect, useState } from 'react';
import styles from '@/styles/Canvas.module.css';
import { Colony } from '@/lib/simulation/colony';
import { Ant } from '@/lib/simulation/ant';
import { Vector2D } from '@/lib/simulation/vector';

interface SimulationCanvasProps {
  colony: Colony;
  activeTool: 'select' | 'sugar' | 'water';
  selectedAnt: Ant | null;
  onSelectAnt: (ant: Ant | null) => void;
  isPaused: boolean;
}

export default function SimulationCanvas({
  colony,
  activeTool,
  selectedAnt,
  onSelectAnt,
  isPaused
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const draggedAntIdRef = useRef<string | null>(null);

  // Canvas size: 800x500
  const width = 800;
  const height = 500;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // 1. Update simulation if not paused
      if (!isPaused) {
        colony.update();
        
        // Sync selected ant state from colony array
        if (selectedAnt) {
          const updated = colony.ants.find(a => a.id === selectedAnt.id);
          if (updated) {
            // Keep object reference or update page state
            onSelectAnt(updated);
          } else {
            // Ant died
            onSelectAnt(null);
          }
        }
      }

      // 2. Draw Simulation Map
      drawMap(ctx, colony);

      // 3. Draw Eggs
      drawEggs(ctx, colony);

      // 4. Draw Sugar Crystals
      drawSugar(ctx, colony);

      // 5. Draw Ants
      drawAnts(ctx, colony);

      // Loop
      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [colony, isPaused, selectedAnt, onSelectAnt]);

  // --- DRAWING FUNCTIONS ---

  const drawMap = (ctx: CanvasRenderingContext2D, col: Colony) => {
    const map = col.map;
    const cSize = map.cellSize;

    // Background dirt color
    ctx.fillStyle = '#0e0b0b';
    ctx.fillRect(0, 0, width, height);

    // Draw sky/surface
    const skyGrad = ctx.createLinearGradient(0, 0, 0, map.surfaceY * cSize);
    skyGrad.addColorStop(0, '#020b1e');
    skyGrad.addColorStop(1, '#051833');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, map.surfaceY * cSize);

    // Draw grass line
    ctx.fillStyle = '#0ea960';
    ctx.fillRect(0, map.surfaceY * cSize, width, cSize);

    // Render cells
    for (let x = 0; x < map.cols; x++) {
      for (let y = map.surfaceY + 1; y < map.rows; y++) {
        const cell = map.grid[x][y];
        const cx = x * cSize;
        const cy = y * cSize;

        // Draw chambers and tunnels
        if (cell.type === 'tunnel' || cell.type === 'queen_chamber' || cell.type === 'food_storage' || cell.type === 'egg_nursery') {
          ctx.fillStyle = '#17141d';
          ctx.fillRect(cx, cy, cSize, cSize);

          // Draw chamber outlines to make them pop
          if (cell.type === 'queen_chamber') {
            ctx.fillStyle = 'rgba(255, 0, 119, 0.04)';
            ctx.fillRect(cx, cy, cSize, cSize);
          } else if (cell.type === 'food_storage') {
            ctx.fillStyle = 'rgba(255, 208, 0, 0.04)';
            ctx.fillRect(cx, cy, cSize, cSize);
          } else if (cell.type === 'egg_nursery') {
            ctx.fillStyle = 'rgba(0, 242, 254, 0.04)';
            ctx.fillRect(cx, cy, cSize, cSize);
          }
        }

        // Draw stone obstacles
        if (cell.type === 'stone') {
          ctx.fillStyle = '#2d3340';
          ctx.fillRect(cx, cy, cSize, cSize);
          // Highlight rock edge
          ctx.strokeStyle = '#3e4659';
          ctx.strokeRect(cx, cy, cSize, cSize);
        }

        // Draw pheromone overlays
        if (cell.pheromoneHome > 0) {
          ctx.fillStyle = `rgba(155, 0, 255, ${Math.min(0.4, cell.pheromoneHome / 100)})`;
          ctx.fillRect(cx, cy, cSize, cSize);
        }

        if (cell.pheromoneFood > 0) {
          ctx.fillStyle = `rgba(255, 208, 0, ${Math.min(0.4, cell.pheromoneFood / 100)})`;
          ctx.fillRect(cx, cy, cSize, cSize);
        }

        if (cell.pheromoneWhisper > 0) {
          ctx.fillStyle = `rgba(0, 242, 254, ${Math.min(0.5, cell.pheromoneWhisper / 100)})`;
          ctx.fillRect(cx, cy, cSize, cSize);
        }

        // Draw water overlay
        if (cell.water > 0) {
          ctx.fillStyle = `rgba(0, 150, 255, ${cell.water * 0.7})`;
          ctx.fillRect(cx, cy, cSize, cSize);
        }
      }
    }

    // Chamber Borders
    // Queen
    ctx.strokeStyle = 'rgba(255, 0, 119, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(width / 2 - 60, height * 0.6 - 40, 120, 80);
    // Food Storage
    ctx.strokeStyle = 'rgba(255, 208, 0, 0.4)';
    ctx.strokeRect(width / 2 - 120 - 50, height * 0.45 - 30, 100, 60);
    // Nursery
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    ctx.strokeRect(width / 2 + 120 - 50, height * 0.45 - 30, 100, 60);
  };

  const drawEggs = (ctx: CanvasRenderingContext2D, col: Colony) => {
    ctx.fillStyle = '#f0f3fa';
    for (const egg of col.eggs) {
      ctx.beginPath();
      // Draw little oval shape
      ctx.ellipse(egg.pos.x, egg.pos.y, 3, 2, egg.age * 0.05, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.shadowColor = 'rgba(255,255,255,0.4)';
      ctx.shadowBlur = 4;
    }
    // reset shadow
    ctx.shadowBlur = 0;
  };

  const drawSugar = (ctx: CanvasRenderingContext2D, col: Colony) => {
    for (const sugar of col.map.sugarCrystals) {
      ctx.fillStyle = '#ffd000';
      ctx.shadowColor = 'var(--neon-gold-glow)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      // Draw diamond-like sugar crystal shape
      ctx.moveTo(sugar.pos.x, sugar.pos.y - 6);
      ctx.lineTo(sugar.pos.x + 5, sugar.pos.y);
      ctx.lineTo(sugar.pos.x, sugar.pos.y + 6);
      ctx.lineTo(sugar.pos.x - 5, sugar.pos.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  };

  const drawAnts = (ctx: CanvasRenderingContext2D, col: Colony) => {
    for (const ant of col.ants) {
      const heading = ant.vel.heading();
      ctx.save();
      ctx.translate(ant.pos.x, ant.pos.y);
      ctx.rotate(heading);

      // Color coding by role
      let bodyColor = '#00f2fe'; // forager cyan
      if (ant.role === 'queen') bodyColor = '#ff0077'; // queen magenta
      else if (ant.role === 'digger') bodyColor = '#ffd000'; // digger gold
      else if (ant.role === 'nurse') bodyColor = '#55ff55'; // nurse green

      // Size multiplier
      const isQueen = ant.role === 'queen';
      const scale = isQueen ? 2.5 : 1.0;

      // Suspended ant: draw legs flailing wildly
      const isSuspended = ant.state === 'suspended';
      const wiggle = isSuspended ? Math.sin(Date.now() * 0.05) * 0.5 : 0;

      // Draw Legs
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1.5;
      
      // Left legs
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-2 * scale, -5 * scale + wiggle * 3);
      ctx.moveTo(2 * scale, 0); ctx.lineTo(1 * scale, -6 * scale + wiggle * -3);
      ctx.moveTo(-2 * scale, 0); ctx.lineTo(-4 * scale, -5 * scale + wiggle * 2);
      ctx.stroke();

      // Right legs
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-2 * scale, 5 * scale - wiggle * 3);
      ctx.moveTo(2 * scale, 0); ctx.lineTo(1 * scale, 6 * scale - wiggle * -3);
      ctx.moveTo(-2 * scale, 0); ctx.lineTo(-4 * scale, 5 * scale - wiggle * 2);
      ctx.stroke();

      // Draw Body Segments (Abdomen, Thorax, Head)
      // 1. Gaster (Rear)
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(-4 * scale, 0, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
      // Highlight on Gaster
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 2. Thorax (Middle)
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.ellipse(0, 0, 2 * scale, 1.5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. Head (Front)
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(4 * scale, 0, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Eyes
      ctx.fillStyle = isQueen ? '#ff0000' : '#000';
      ctx.beginPath();
      ctx.arc(5 * scale, -1 * scale, 0.5 * scale, 0, Math.PI * 2);
      ctx.arc(5 * scale, 1 * scale, 0.5 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Antennae
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(5 * scale, -1 * scale); ctx.quadraticCurveTo(7 * scale, -3 * scale, 8 * scale, -2 * scale);
      ctx.moveTo(5 * scale, 1 * scale); ctx.quadraticCurveTo(7 * scale, 3 * scale, 8 * scale, 2 * scale);
      ctx.stroke();

      // Draw Carried Items
      if (ant.carriedItem === 'food') {
        ctx.fillStyle = '#ffd000'; // sugar
        ctx.beginPath();
        ctx.arc(6 * scale, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (ant.carriedItem === 'dirt') {
        ctx.fillStyle = '#654321'; // dirt clump
        ctx.beginPath();
        ctx.arc(6 * scale, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (ant.carriedItem === 'egg') {
        ctx.fillStyle = '#f0f3fa'; // white egg
        ctx.beginPath();
        ctx.ellipse(6 * scale, 0, 3, 2, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Draw selection circle
      const isSelected = selectedAnt && ant.id === selectedAnt.id;
      if (isSelected) {
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ant.pos.x, ant.pos.y, (isQueen ? 20 : 12), 0, Math.PI * 2);
        ctx.stroke();

        // Glowing shadow on selection
        ctx.shadowColor = 'var(--neon-cyan)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(ant.pos.x, ant.pos.y, (isQueen ? 20 : 12), 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }
    }
  };

  // --- MOUSE LISTENERS ---

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Scale coordinates correctly in case CSS size differs from canvas size
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getMousePos(e);

    if (activeTool === 'select') {
      // Check if clicked an ant
      let clickedAnt: Ant | null = null;
      let minDistance = 25; // selection range

      for (const ant of colony.ants) {
        const d = ant.pos.dist(new Vector2D(x, y));
        if (d < minDistance) {
          clickedAnt = ant;
          minDistance = d;
        }
      }

      if (clickedAnt) {
        onSelectAnt(clickedAnt);
        // Begin drag abduction (only for workers, not the Queen)
        if (clickedAnt.role !== 'queen') {
          draggedAntIdRef.current = clickedAnt.id;
          colony.abductAnt(clickedAnt.id);
        }
      } else {
        onSelectAnt(null);
      }
    } else if (activeTool === 'sugar') {
      colony.dropSugar(x, y);
    } else if (activeTool === 'water') {
      colony.dropWater(x, y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedAntIdRef.current) {
      const { x, y } = getMousePos(e);
      // Pinned to cursor
      const ant = colony.ants.find(a => a.id === draggedAntIdRef.current);
      if (ant) {
        ant.pos.x = x;
        ant.pos.y = y;
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedAntIdRef.current) {
      const { x, y } = getMousePos(e);
      colony.releaseAnt(draggedAntIdRef.current, x, y);
      draggedAntIdRef.current = null;
    }
  };

  const getCursor = () => {
    if (activeTool === 'select') return 'default';
    return 'crosshair';
  };

  return (
    <div className={`${styles.canvasCard} glass-panel`}>
      <div className={styles.canvasToolbar}>
        <div className={styles.instructions}>
          {activeTool === 'select' && 'Select tool: Click ant to inspect / Drag to abduct and displace.'}
          {activeTool === 'sugar' && 'Sugar tool: Click anywhere to drop a sucrose pile.'}
          {activeTool === 'water' && 'Water tool: Click to drop water (washes pheromones, hydrates/slows ants).'}
        </div>
      </div>
      <div className={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            cursor: getCursor(),
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
}
