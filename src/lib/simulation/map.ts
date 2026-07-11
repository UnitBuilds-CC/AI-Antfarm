import { Vector2D } from './vector';

export type CellType = 
  | 'sky' 
  | 'grass' 
  | 'dirt' 
  | 'tunnel' 
  | 'queen_chamber' 
  | 'food_storage' 
  | 'egg_nursery' 
  | 'stone';

export interface GridCell {
  x: number; // grid x index
  y: number; // grid y index
  type: CellType;
  pheromoneHome: number;
  pheromoneFood: number;
  pheromoneWhisper: number;
  whisperVector: Vector2D | null;
  water: number; // water level (0 to 1)
}

export interface SugarCrystal {
  id: string;
  pos: Vector2D;
  amount: number; // how much food left in this crystal
}

export class SimulationMap {
  public cols: number;
  public rows: number;
  public grid: GridCell[][];
  public sugarCrystals: SugarCrystal[] = [];
  public width: number;
  public height: number;
  public cellSize: number;
  public surfaceY: number; // y coordinate dividing surface and underground

  constructor(width: number, height: number, cellSize: number = 10) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.cols = Math.floor(width / cellSize);
    this.rows = Math.floor(height / cellSize);
    this.surfaceY = Math.floor(150 / cellSize); // ~150px down is ground level
    this.grid = [];
    this.initGrid();
  }

  private initGrid() {
    this.grid = [];
    for (let x = 0; x < this.cols; x++) {
      this.grid[x] = [];
      for (let y = 0; y < this.rows; y++) {
        let type: CellType = 'dirt';

        if (y < this.surfaceY) {
          type = 'sky';
        } else if (y === this.surfaceY) {
          type = 'grass';
        } else {
          type = 'dirt';
        }

        // Place some stones (obstacles)
        if (y > this.surfaceY + 3 && Math.random() < 0.04) {
          // Cluster stones
          type = 'stone';
        }

        this.grid[x][y] = {
          x,
          y,
          type,
          pheromoneHome: 0,
          pheromoneFood: 0,
          pheromoneWhisper: 0,
          whisperVector: null,
          water: 0,
        };
      }
    }

    // Carve main nest shaft (centered)
    const midX = Math.floor(this.cols / 2);
    for (let y = this.surfaceY; y < Math.floor(this.rows * 0.65); y++) {
      this.grid[midX][y].type = 'tunnel';
      this.grid[midX - 1][y].type = 'tunnel';
    }

    // Carve Queen's chamber
    const queenY = Math.floor(this.rows * 0.6);
    this.carveChamber(midX, queenY, 6, 4, 'queen_chamber');

    // Carve food storage chamber (left side)
    const storageY = Math.floor(this.rows * 0.45);
    this.carveChamber(midX - 12, storageY, 5, 3, 'food_storage');
    // Connect storage to shaft
    for (let x = midX - 12; x <= midX; x++) {
      this.grid[x][storageY].type = 'tunnel';
    }

    // Carve nursery chamber (right side)
    const nurseryY = Math.floor(this.rows * 0.45);
    this.carveChamber(midX + 12, nurseryY, 5, 3, 'egg_nursery');
    // Connect nursery to shaft
    for (let x = midX; x <= midX + 12; x++) {
      this.grid[x][nurseryY].type = 'tunnel';
    }
  }

  private carveChamber(centerX: number, centerY: number, rx: number, ry: number, type: CellType) {
    for (let x = centerX - rx; x <= centerX + rx; x++) {
      for (let y = centerY - ry; y <= centerY + ry; y++) {
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
          // Elliptical shape carve
          const dx = (x - centerX) / rx;
          const dy = (y - centerY) / ry;
          if (dx * dx + dy * dy <= 1.0) {
            this.grid[x][y].type = type;
          }
        }
      }
    }
  }

  public getCellAt(worldX: number, worldY: number): GridCell | null {
    const gx = Math.floor(worldX / this.cellSize);
    const gy = Math.floor(worldY / this.cellSize);
    if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
      return this.grid[gx][gy];
    }
    return null;
  }

  public getCellByGrid(gx: number, gy: number): GridCell | null {
    if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
      return this.grid[gx][gy];
    }
    return null;
  }

  public isWalkable(worldX: number, worldY: number): boolean {
    const cell = this.getCellAt(worldX, worldY);
    if (!cell) return false;
    return cell.type !== 'dirt' && cell.type !== 'stone';
  }

  public update(pheromoneDecay: number) {
    // 1. Decay pheromones
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        const cell = this.grid[x][y];
        cell.pheromoneHome *= pheromoneDecay;
        cell.pheromoneFood *= pheromoneDecay;
        cell.pheromoneWhisper *= pheromoneDecay;

        if (cell.pheromoneHome < 0.01) cell.pheromoneHome = 0;
        if (cell.pheromoneFood < 0.01) cell.pheromoneFood = 0;
        if (cell.pheromoneWhisper < 0.01) {
          cell.pheromoneWhisper = 0;
          cell.whisperVector = null;
        }

        // Dissipate water
        if (cell.water > 0) {
          cell.water -= 0.001; // slow evaporation
          if (cell.water < 0) cell.water = 0;
        }
      }
    }

    // 2. Clean up empty sugar crystals
    this.sugarCrystals = this.sugarCrystals.filter(c => c.amount > 0);
  }

  public addPheromone(worldX: number, worldY: number, type: 'home' | 'food' | 'whisper', amount: number, dir?: Vector2D) {
    const cell = this.getCellAt(worldX, worldY);
    if (!cell) return;

    if (type === 'home') {
      cell.pheromoneHome = Math.min(100, cell.pheromoneHome + amount);
    } else if (type === 'food') {
      cell.pheromoneFood = Math.min(100, cell.pheromoneFood + amount);
    } else if (type === 'whisper') {
      cell.pheromoneWhisper = Math.min(100, cell.pheromoneWhisper + amount);
      if (dir) {
        cell.whisperVector = dir.copy().normalize();
      }
    }
  }

  public addSugar(worldX: number, worldY: number, amount: number = 100) {
    const id = `sugar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const pos = new Vector2D(worldX, worldY);
    this.sugarCrystals.push({ id, pos, amount });
  }

  public addWater(worldX: number, worldY: number, amount: number = 0.5) {
    const cell = this.getCellAt(worldX, worldY);
    if (!cell) return;

    // Apply water to a 3x3 grid around click
    const gx = cell.x;
    const gy = cell.y;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighbor = this.getCellByGrid(gx + dx, gy + dy);
        if (neighbor && neighbor.type !== 'stone') {
          neighbor.water = Math.min(1.0, neighbor.water + amount * (dx === 0 && dy === 0 ? 1.0 : 0.5));
          // Water clears out pheromones!
          neighbor.pheromoneHome = 0;
          neighbor.pheromoneFood = 0;
          neighbor.pheromoneWhisper = 0;
        }
      }
    }
  }

  public carve(worldX: number, worldY: number): boolean {
    const cell = this.getCellAt(worldX, worldY);
    if (cell && cell.type === 'dirt') {
      cell.type = 'tunnel';
      return true;
    }
    return false;
  }
}
