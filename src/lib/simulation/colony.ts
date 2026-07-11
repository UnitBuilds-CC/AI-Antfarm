import { Vector2D } from './vector';
import { SimulationMap } from './map';
import { Ant, AntRole } from './ant';

export interface Egg {
  id: string;
  pos: Vector2D;
  state: 'laid' | 'carried' | 'nursery';
  carriedBy: string | null;
  age: number; // ticks
  hatchTime: number; // ticks to hatch
}

export interface ColonyEvent {
  slot: number;
  type: string;
  text: string;
  timestamp: string;
}

export class Colony {
  public map: SimulationMap;
  public ants: Ant[] = [];
  public eggs: Egg[] = [];
  public wind: Vector2D = new Vector2D(0, 0);
  public mutationSpeed: number = 1.0;
  public foodCollected: number = 0;
  public currentSlot: number = 0;
  public currentHash: string = '00000000000000000000000000000000';
  public lore: ColonyEvent[] = [];
  
  private antIdCounter = 0;
  private eggIdCounter = 0;
  private queenSpawnTimer = 0;

  constructor(width: number, height: number) {
    this.map = new SimulationMap(width, height);
    this.initializeColony();
  }

  private initializeColony() {
    // 1. Spawn Queen in her chamber
    const midX = this.map.width / 2;
    const queenY = this.map.height * 0.6;
    const queen = new Ant(`Ant-Queen-${++this.antIdCounter}`, 'queen', midX, queenY);
    queen.maxSpeed = 0.1; // Queen barely moves
    queen.state = 'resting';
    this.ants.push(queen);

    // 2. Spawn starting workers
    const foragerCount = 10;
    const diggerCount = 5;
    const nurseCount = 3;

    for (let i = 0; i < foragerCount; i++) {
      this.ants.push(new Ant(`Ant-Forager-${++this.antIdCounter}`, 'forager', midX + (Math.random() - 0.5) * 40, queenY + 20));
    }
    for (let i = 0; i < diggerCount; i++) {
      this.ants.push(new Ant(`Ant-Digger-${++this.antIdCounter}`, 'digger', midX + (Math.random() - 0.5) * 40, queenY + 25));
    }
    for (let i = 0; i < nurseCount; i++) {
      this.ants.push(new Ant(`Ant-Nurse-${++this.antIdCounter}`, 'nurse', midX + (Math.random() - 0.5) * 40, queenY + 15));
    }

    // Add initial lore entry
    this.logLore('INITIALIZATION', 'Colony established in the dark soil. The Queen occupies the central chamber.');
  }

  public addAnt(role: AntRole, x: number, y: number) {
    const id = `Ant-${role.charAt(0).toUpperCase() + role.slice(1)}-${++this.antIdCounter}`;
    const newAnt = new Ant(id, role, x, y);
    this.ants.push(newAnt);
    this.logLore('BIRTH', `${role.charAt(0).toUpperCase() + role.slice(1)} ${id} was born.`);
  }

  public update() {
    // Update map pheromones
    const pheromoneDecay = 0.99; // Can be altered by Solana hash
    this.map.update(pheromoneDecay);

    // Queen laying eggs
    this.queenSpawnTimer++;
    if (this.queenSpawnTimer > 1800) { // every ~30s at 60fps
      this.queenSpawnTimer = 0;
      this.queenLayEgg();
    }

    // Update eggs
    this.updateEggs();

    // Track food stock count
    this.updateFoodCollected();

    // Update all ants
    for (const ant of this.ants) {
      // Custom nurse behavior: carrying eggs
      if (ant.role === 'nurse' && ant.state !== 'resting') {
        this.runNurseLogic(ant);
      }

      // Execute behavior steering
      ant.executeBehavior(this.map);
      
      // Update physics position
      ant.update(this.map, this.wind, this.mutationSpeed);
    }
  }

  private queenLayEgg() {
    const queen = this.ants.find(a => a.role === 'queen');
    if (!queen) return;

    const eggId = `Egg-${++this.eggIdCounter}`;
    // Place egg near Queen
    const pos = new Vector2D(queen.pos.x + (Math.random() - 0.5) * 20, queen.pos.y + (Math.random() - 0.5) * 20);
    this.eggs.push({
      id: eggId,
      pos,
      state: 'laid',
      carriedBy: null,
      age: 0,
      hatchTime: 1200 // hatches in ~20 seconds
    });

    queen.addLog(`Spawns egg ${eggId} into the chamber.`);
    this.logLore('ROYAL_EVENT', `The Queen laid egg ${eggId} in the dark.`);
  }

  private updateEggs() {
    const nurseryCenter = new Vector2D(this.map.width / 2 + 120, this.map.height * 0.45);

    this.eggs = this.eggs.filter(egg => {
      egg.age++;

      // If egg is in the nursery and reaches hatch time, hatch it!
      if (egg.state === 'nursery' && egg.age >= egg.hatchTime) {
        // Spawn baby ant with random worker role
        const roles: AntRole[] = ['forager', 'digger', 'nurse'];
        const chosenRole = roles[Math.floor(Math.random() * roles.length)];
        this.addAnt(chosenRole, egg.pos.x, egg.pos.y);
        
        // Notify nurse who was carrying or near
        if (egg.carriedBy) {
          const carrier = this.ants.find(a => a.id === egg.carriedBy);
          if (carrier) {
            carrier.carriedItem = 'none';
            carrier.state = 'wandering';
            carrier.addLog(`Watched egg ${egg.id} hatch into a new colony member.`);
          }
        }
        return false; // delete egg
      }
      return true;
    });
  }

  private runNurseLogic(ant: Ant) {
    const nurseryCenter = new Vector2D(this.map.width / 2 + 120, this.map.height * 0.45);

    if (ant.carriedItem === 'none') {
      // Look for a 'laid' egg to pick up
      const freeEgg = this.eggs.find(e => e.state === 'laid' && !e.carriedBy);
      if (freeEgg) {
        const d = ant.pos.dist(freeEgg.pos);
        if (d > 10) {
          ant.applyForce(Vector2D.sub(freeEgg.pos, ant.pos).normalize().mult(ant.maxSpeed * 0.8));
          ant.state = 'tending_eggs';
        } else {
          // Pick up egg
          freeEgg.state = 'carried';
          freeEgg.carriedBy = ant.id;
          ant.carriedItem = 'egg';
          ant.state = 'tending_eggs';
          ant.addLog(`Secured egg ${freeEgg.id} to relocate to the nursery.`);
        }
      } else {
        ant.state = 'wandering';
      }
    } else if (ant.carriedItem === 'egg') {
      // Find the egg that is carried
      const egg = this.eggs.find(e => e.carriedBy === ant.id);
      if (egg) {
        // Head to nursery
        const d = ant.pos.dist(nurseryCenter);
        if (d > 25) {
          ant.applyForce(Vector2D.sub(nurseryCenter, ant.pos).normalize().mult(ant.maxSpeed * 0.8));
          egg.pos = ant.pos.copy(); // update egg position to match ant
        } else {
          // Drop egg in nursery
          egg.state = 'nursery';
          egg.carriedBy = null;
          ant.carriedItem = 'none';
          ant.state = 'wandering';
          ant.addLog(`Nurtured egg ${egg.id} in the nursery.`);
        }
      } else {
        // Lost egg somehow
        ant.carriedItem = 'none';
        ant.state = 'wandering';
      }
    }
  }

  private updateFoodCollected() {
    // Count how much food is dropped in the food storage chamber
    const storageY = Math.floor(this.map.rows * 0.45);
    const midX = Math.floor(this.map.cols / 2);
    // Simple heuristic: If foragers are carrying food and drop it, we count it.
    // (Handled directly when the ant drops item in behaviorCarryFood)
    const foodCarriers = this.ants.filter(a => a.state === 'carrying_food');
    for (const ant of this.ants) {
      if (ant.state === 'carrying_food' && ant.carriedItem === 'food') {
        const storageCenter = new Vector2D(this.map.width / 2 - 120, this.map.height * 0.45);
        if (ant.pos.dist(storageCenter) < 25) {
          this.foodCollected += 10;
        }
      }
    }
  }

  public logLore(type: string, text: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.lore.unshift({
      slot: this.currentSlot,
      type,
      text,
      timestamp
    });

    if (this.lore.length > 100) {
      this.lore.pop();
    }
  }

  public applySolanaHash(hash: string, slot: number) {
    this.currentHash = hash;
    this.currentSlot = slot;

    // Parse bytes from Solana blockhash to dictate global environment
    // Hash is 64 hex characters (e.g. 5Kx... but standard hash is 32-byte in hex = 64 characters)
    if (hash.length >= 8) {
      // 1. Wind Angle (Bytes 0-1)
      const b0 = parseInt(hash.substring(0, 2), 16) || 0;
      const b1 = parseInt(hash.substring(2, 4), 16) || 0;
      const windAngle = ((b0 + b1) / 510) * Math.PI * 2;

      // 2. Wind Force (Bytes 2-3)
      const b2 = parseInt(hash.substring(4, 6), 16) || 0;
      const windMag = (b2 / 255) * 0.4; // max wind strength
      this.wind = Vector2D.fromAngle(windAngle, windMag);

      // 3. Mutation speed (Bytes 4-5) - influences max speed of ants
      const b4 = parseInt(hash.substring(8, 10), 16) || 128;
      this.mutationSpeed = 0.5 + (b4 / 255) * 1.5; // ranges from 0.5x to 2.0x standard speed

      // 4. Catastrophic/Dynamic event check (Bytes 6-7)
      const b6 = parseInt(hash.substring(12, 14), 16) || 0;
      if (b6 % 30 === 0) {
        this.triggerEvent(b6, hash);
      }
    }
  }

  private triggerEvent(eventByte: number, hash: string) {
    const eventType = eventByte % 4;

    switch (eventType) {
      case 0: // Sugar Rain
        this.logLore('COSMIC_EVENT', 'A crystallizing celestial light spawns glucose nodes across the surface.');
        for (let i = 0; i < 3; i++) {
          const rx = Math.random() * (this.map.width - 100) + 50;
          this.map.addSugar(rx, 40, 150);
        }
        break;
      case 1: // Torrential Downpour
        this.logLore('COSMIC_EVENT', 'Heavy atmospheric moisture condenses. Water droplets flood the surface.');
        for (let i = 0; i < 4; i++) {
          const rx = Math.random() * (this.map.width - 100) + 50;
          this.map.addWater(rx, 140, 0.8);
        }
        break;
      case 2: // Substrate Shift (Earthquake)
        this.logLore('CATASTROPHE', 'A low frequency tremor collapses loose tunnels. Debris fills underground cells.');
        // Fill a random tunnel segment back with dirt
        let collapseCount = 0;
        for (let x = 4; x < this.map.cols - 4; x++) {
          for (let y = this.map.surfaceY + 4; y < this.map.rows - 4; y++) {
            const cell = this.map.grid[x][y];
            if (cell.type === 'tunnel' && Math.random() < 0.05 && collapseCount < 5) {
              cell.type = 'dirt';
              collapseCount++;
            }
          }
        }
        break;
      case 3: // Hyperdrive (Solana Surge)
        this.logLore('COSMIC_EVENT', 'The blockhash emits a blinding pulse. Worker velocities are doubled.');
        this.mutationSpeed *= 2.0;
        break;
    }
  }

  // Interaction handlers
  public dropSugar(x: number, y: number) {
    this.map.addSugar(x, y, 120);
    this.logLore('INTERACTION', `The Hand of God placed glucose crystal at coordinate (${Math.floor(x)}, ${Math.floor(y)}).`);
  }

  public dropWater(x: number, y: number) {
    this.map.addWater(x, y, 0.8);
    this.logLore('INTERACTION', `The Hand of God flooded region (${Math.floor(x)}, ${Math.floor(y)}) with moisture.`);
  }

  public abductAnt(antId: string): Ant | null {
    const ant = this.ants.find(a => a.id === antId);
    if (ant) {
      ant.state = 'suspended';
      ant.vel.mult(0);
      ant.addLog('LIFTED BY THE GIANT GLOWING HAND. I FLOAT BEYOND THE DUST.');
      return ant;
    }
    return null;
  }

  public releaseAnt(antId: string, x: number, y: number) {
    const ant = this.ants.find(a => a.id === antId);
    if (ant) {
      ant.pos = new Vector2D(x, y);
      ant.state = 'wandering';
      ant.addLog(`Cast down into the dirt at (${Math.floor(x)}, ${Math.floor(y)}). Cosmic displacement logged.`);
      this.logLore('DIVINE_DISPLACEMENT', `Ant ${ant.id} was picked up and dropped at (${Math.floor(x)}, ${Math.floor(y)}).`);
    }
  }

  public whisperToAnt(antId: string, whisperText: string) {
    const ant = this.ants.find(a => a.id === antId);
    if (ant) {
      ant.whisper = whisperText;
      ant.addLog(`Heard a cosmic whisper: "${whisperText}".`);
      this.logLore('WHISPER', `A whisper was breathed into the mind of ${ant.id}: "${whisperText}".`);

      // Add a physical pheromone node at the center of the canvas towards which the ant is steered
      // Let's make it look like the ant is drawn in a direction
      const surfaceYPos = this.map.surfaceY * this.map.cellSize;
      let targetX = this.map.width / 2;
      let targetY = surfaceYPos + 50;

      if (whisperText.toLowerCase().includes('sugar') || whisperText.toLowerCase().includes('food') || whisperText.toLowerCase().includes('east')) {
        // steer towards east/right surface
        targetX = this.map.width - 50;
        targetY = 100;
      } else if (whisperText.toLowerCase().includes('nest') || whisperText.toLowerCase().includes('home') || whisperText.toLowerCase().includes('down')) {
        // steer towards Queen's chamber
        targetX = this.map.width / 2;
        targetY = this.map.height * 0.6;
      } else if (whisperText.toLowerCase().includes('dig') || whisperText.toLowerCase().includes('dirt')) {
        // steer deep down
        targetX = this.map.width / 2;
        targetY = this.map.height - 100;
      }

      // Propagate whisper steering pheromones near the ant's current position leading to target
      const dirVec = new Vector2D(targetX, targetY).sub(ant.pos).normalize();
      this.map.addPheromone(ant.pos.x, ant.pos.y, 'whisper', 80, dirVec);
    }
  }
}
