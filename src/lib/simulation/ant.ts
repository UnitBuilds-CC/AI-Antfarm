import { Vector2D } from './vector';
import { SimulationMap, SugarCrystal, GridCell } from './map';

export type AntRole = 'queen' | 'forager' | 'digger' | 'nurse';

export type AntState = 
  | 'wandering' 
  | 'foraging' 
  | 'carrying_food' 
  | 'digging' 
  | 'carrying_dirt' 
  | 'tending_eggs' 
  | 'resting' 
  | 'suspended';

export class Ant {
  public id: string;
  public role: AntRole;
  public state: AntState;
  public pos: Vector2D;
  public vel: Vector2D;
  public acc: Vector2D;
  public energy: number = 100;
  public maxSpeed: number = 1.8;
  public maxForce: number = 0.15;
  public carriedItem: 'none' | 'food' | 'dirt' | 'egg' = 'none';
  public whisper: string | null = null;
  public history: string[] = [];
  public age: number = 0; // in ticks
  public size: number = 4;
  public speedModifier: number = 1.0;

  private targetCell: GridCell | null = null;
  private wanderAngle: number = 0;

  constructor(id: string, role: AntRole, startX: number, startY: number) {
    this.id = id;
    this.role = role;
    this.state = 'wandering';
    this.pos = new Vector2D(startX, startY);
    this.vel = Vector2D.random2D().mult(0.5);
    this.acc = new Vector2D(0, 0);
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.history.push(`${role.charAt(0).toUpperCase() + role.slice(1)} hatched in the royal chamber.`);
  }

  public addLog(log: string) {
    this.history.push(log);
    if (this.history.length > 50) {
      this.history.shift(); // keep history compact
    }
  }

  public applyForce(force: Vector2D) {
    this.acc.add(force);
  }

  public update(map: SimulationMap, wind: Vector2D, mutationSpeed: number) {
    if (this.state === 'suspended') {
      this.vel.mult(0);
      this.acc.mult(0);
      this.age++;
      return;
    }

    this.age++;
    this.speedModifier = mutationSpeed;

    // Apply basic physics
    const currentMaxSpeed = this.maxSpeed * this.speedModifier;
    this.vel.add(this.acc);
    this.vel.limit(currentMaxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);

    // Apply wind above ground
    const surfaceYPos = map.surfaceY * map.cellSize;
    if (this.pos.y < surfaceYPos) {
      this.applyForce(wind.copy().mult(0.05));
    }

    // Energy drain (except Queen)
    if (this.role !== 'queen') {
      this.energy -= 0.015;
      if (this.energy < 0) this.energy = 0;
    }

    // Boundary constraints (bounce off canvas edges)
    if (this.pos.x < 10) {
      this.pos.x = 10;
      this.vel.x *= -1;
    } else if (this.pos.x > map.width - 10) {
      this.pos.x = map.width - 10;
      this.vel.x *= -1;
    }

    if (this.pos.y < 10) {
      this.pos.y = 10;
      this.vel.y *= -1;
    } else if (this.pos.y > map.height - 10) {
      this.pos.y = map.height - 10;
      this.vel.y *= -1;
    }

    // Map constraint: Stay in walkable areas underground (y > surfaceY)
    const nextPos = this.pos.copy().add(this.vel.copy().mult(2));
    const nextCell = map.getCellAt(nextPos.x, nextPos.y);

    if (this.pos.y > surfaceYPos && this.state !== 'digging') {
      // If we are about to hit dirt or stone, bounce or slide
      if (nextCell && (nextCell.type === 'dirt' || nextCell.type === 'stone')) {
        // Try steering away
        const avoidance = this.steerAvoidance(map);
        this.applyForce(avoidance.mult(2.0));
      }
    }
  }

  private steerAvoidance(map: SimulationMap): Vector2D {
    // Look ahead and steer away from walls
    const steer = new Vector2D(0, 0);
    const lookAhead = 15;
    const angles = [0, -Math.PI / 4, Math.PI / 4, -Math.PI / 2, Math.PI / 2];

    for (const angle of angles) {
      const dir = Vector2D.fromAngle(this.vel.heading() + angle, lookAhead);
      const testPos = this.pos.copy().add(dir);
      const cell = map.getCellAt(testPos.x, testPos.y);

      if (!cell || cell.type === 'dirt' || cell.type === 'stone') {
        // Create force away from this path
        const force = Vector2D.sub(this.pos, testPos).normalize().mult(this.maxSpeed);
        steer.add(force);
      }
    }

    return steer.limit(this.maxForce);
  }

  public executeBehavior(map: SimulationMap) {
    if (this.state === 'suspended') return;

    // State machine transitions
    if (this.energy < 15 && this.state !== 'resting' && this.role !== 'queen') {
      this.state = 'resting';
      this.addLog(`Felt exhaustion. Crawling back to the chambers to rest.`);
    }

    switch (this.state) {
      case 'resting':
        this.behaviorRest(map);
        break;
      case 'wandering':
        this.behaviorWander(map);
        break;
      case 'foraging':
        this.behaviorForage(map);
        break;
      case 'carrying_food':
        this.behaviorCarryFood(map);
        break;
      case 'digging':
        this.behaviorDig(map);
        break;
      case 'carrying_dirt':
        this.behaviorCarryDirt(map);
        break;
      case 'tending_eggs':
        this.behaviorTendEggs(map);
        break;
    }
  }

  // --- INDIVIDUAL STATE BEHAVIORS ---

  private behaviorRest(map: SimulationMap) {
    // Go to Queen's chamber or nested chambers
    const nestCenter = new Vector2D(map.width / 2, map.height * 0.6);
    const dist = this.pos.dist(nestCenter);

    if (dist > 50) {
      const seekForce = this.steerTowards(nestCenter);
      this.applyForce(seekForce);
    } else {
      // Resting inside chamber
      this.vel.mult(0.2); // Slow down
      this.energy += 0.3; // Replenish energy
      if (this.energy >= 100) {
        this.energy = 100;
        // Return to work based on role
        if (this.role === 'forager') {
          this.state = 'wandering';
          this.addLog('Refreshed. Seeking resources on the surface.');
        } else if (this.role === 'digger') {
          this.state = 'digging';
          this.addLog('Refreshed. Returning to tunnel expansions.');
        } else {
          this.state = 'wandering';
        }
      }
    }
  }

  private behaviorWander(map: SimulationMap) {
    // Standard wandering force
    const wanderForce = this.steerWander();
    this.applyForce(wanderForce);

    // Lay Home Pheromone when exploring
    const surfaceYPos = map.surfaceY * map.cellSize;
    if (this.pos.y > surfaceYPos) {
      map.addPheromone(this.pos.x, this.pos.y, 'home', 0.25);
    }

    // Role specific transitions
    if (this.role === 'forager') {
      // 1. Look for sugar crystals
      let closestSugar: SugarCrystal | null = null;
      let minDist = 120; // Smell range

      for (const sugar of map.sugarCrystals) {
        const d = this.pos.dist(sugar.pos);
        if (d < d && d < minDist) {
          closestSugar = sugar;
          minDist = d;
        }
      }

      if (closestSugar) {
        this.state = 'foraging';
        this.addLog(`Smelled glucose. Commencing forage retrieval.`);
      } else {
        // 2. Sense food pheromones
        const cell = map.getCellAt(this.pos.x, this.pos.y);
        if (cell && cell.pheromoneFood > 5) {
          // Steer towards food pheromones
          const force = this.steerPheromone(map, 'pheromoneFood');
          this.applyForce(force.mult(1.5));
        }
      }
    } else if (this.role === 'digger') {
      this.state = 'digging';
    }

    // React to whisper pheromone
    const cell = map.getCellAt(this.pos.x, this.pos.y);
    if (cell && cell.pheromoneWhisper > 5 && cell.whisperVector) {
      this.applyForce(cell.whisperVector.copy().mult(this.maxSpeed * 1.5));
    }
  }

  private behaviorForage(map: SimulationMap) {
    let closestSugar: SugarCrystal | null = null;
    let minDist = Infinity;

    for (const sugar of map.sugarCrystals) {
      const d = this.pos.dist(sugar.pos);
      if (d < minDist) {
        closestSugar = sugar;
        minDist = d;
      }
    }

    if (!closestSugar || closestSugar.amount <= 0) {
      this.state = 'wandering';
      return;
    }

    // Head towards food
    if (minDist > 8) {
      const steer = this.steerTowards(closestSugar.pos);
      this.applyForce(steer);
    } else {
      // Bite food
      closestSugar.amount -= 10;
      this.carriedItem = 'food';
      this.state = 'carrying_food';
      this.addLog(`Harvested sucrose crystal. Returning to base.`);
    }
  }

  private behaviorCarryFood(map: SimulationMap) {
    // Steer towards nest center
    const nestCenter = new Vector2D(map.width / 2, map.surfaceY * map.cellSize + 20);
    const storageCenter = new Vector2D(map.width / 2 - 120, map.height * 0.45); // food storage coordinates

    // Target the food storage chamber first, or nest entrance
    const target = this.pos.y > map.surfaceY * map.cellSize ? storageCenter : nestCenter;

    const steer = this.steerTowards(target);
    this.applyForce(steer);

    // Lay food pheromone on the way home
    map.addPheromone(this.pos.x, this.pos.y, 'food', 1.5);

    // Drop food once close to home
    if (this.pos.dist(storageCenter) < 25 || (this.pos.y > map.surfaceY * map.cellSize && this.pos.dist(nestCenter) < 30)) {
      this.carriedItem = 'none';
      this.state = 'wandering';
      this.addLog(`Stored food in colony cache.`);
    }
  }

  private behaviorDig(map: SimulationMap) {
    // Wander deep underground to dig
    const surfaceYPos = map.surfaceY * map.cellSize;
    if (this.pos.y < surfaceYPos + 30) {
      // Head down
      const force = this.steerTowards(new Vector2D(this.pos.x, surfaceYPos + 60));
      this.applyForce(force);
      return;
    }

    // Wander and find dirt
    const wanderForce = this.steerWander();
    this.applyForce(wanderForce);

    // Look ahead for dirt to dig
    const ahead = this.vel.copy().normalize().mult(10);
    const testPos = this.pos.copy().add(ahead);
    const cell = map.getCellAt(testPos.x, testPos.y);

    if (cell && cell.type === 'dirt') {
      const carved = map.carve(testPos.x, testPos.y);
      if (carved) {
        this.carriedItem = 'dirt';
        this.state = 'carrying_dirt';
        this.addLog(`Carved tunnel segment. Carrying excess substrate away.`);
      }
    }
  }

  private behaviorCarryDirt(map: SimulationMap) {
    // Go to surface to drop dirt
    const surfaceYPos = map.surfaceY * map.cellSize - 10;
    const nestEntranceX = map.width / 2;
    const target = new Vector2D(this.pos.x, surfaceYPos); // drop nearby on surface

    if (this.pos.y > surfaceYPos + 15) {
      // Find tunnel/shaft to go up
      // Steer towards center shaft
      const shaftForce = this.steerTowards(new Vector2D(nestEntranceX, this.pos.y));
      this.applyForce(shaftForce.mult(0.6));
      this.applyForce(new Vector2D(0, -0.5)); // upward bias
    } else {
      // We are on surface, drop dirt
      this.carriedItem = 'none';
      this.state = 'digging';
      this.addLog(`Dropped debris on surface. Heading down.`);
    }
  }

  private behaviorTendEggs(map: SimulationMap) {
    // Nurse behavior: tend to eggs in nursery
    const nurseryCenter = new Vector2D(map.width / 2 + 120, map.height * 0.45);
    if (this.pos.dist(nurseryCenter) > 40) {
      const force = this.steerTowards(nurseryCenter);
      this.applyForce(force);
    } else {
      const wander = this.steerWander();
      this.applyForce(wander.mult(0.3));
    }
  }

  // --- STEERING ALGORITHMS ---

  private steerTowards(target: Vector2D): Vector2D {
    const desired = Vector2D.sub(target, this.pos);
    const d = desired.mag();
    desired.normalize();

    // Arrive behavior if close
    const currentMaxSpeed = this.maxSpeed * this.speedModifier;
    if (d < 30) {
      const m = (d / 30) * currentMaxSpeed;
      desired.mult(m);
    } else {
      desired.mult(currentMaxSpeed);
    }

    const steer = Vector2D.sub(desired, this.vel);
    steer.limit(this.maxForce);
    return steer;
  }

  private steerWander(): Vector2D {
    const wanderRadius = 15;
    const wanderDist = 30;
    const change = 0.5;

    this.wanderAngle += (Math.random() - 0.5) * change;

    // Calculate circle center ahead
    const circleCenter = this.vel.copy().normalize().mult(wanderDist);

    // Calculate displacement force on circle
    const displacement = Vector2D.fromAngle(this.wanderAngle).mult(wanderRadius);

    const wanderForce = circleCenter.add(displacement);
    wanderForce.limit(this.maxForce);
    return wanderForce;
  }

  private steerPheromone(map: SimulationMap, type: 'pheromoneHome' | 'pheromoneFood'): Vector2D {
    // Sample cells in a cone ahead of the ant
    const sensorDist = 20;
    const sensorAngle = Math.PI / 4; // 45 degrees left/right

    const centerDir = this.vel.copy().normalize().mult(sensorDist);
    const leftDir = Vector2D.fromAngle(this.vel.heading() - sensorAngle, sensorDist);
    const rightDir = Vector2D.fromAngle(this.vel.heading() + sensorAngle, sensorDist);

    const posC = this.pos.copy().add(centerDir);
    const posL = this.pos.copy().add(leftDir);
    const posR = this.pos.copy().add(rightDir);

    const cellC = map.getCellAt(posC.x, posC.y);
    const cellL = map.getCellAt(posL.x, posL.y);
    const cellR = map.getCellAt(posR.x, posR.y);

    const valC = cellC ? (type === 'pheromoneHome' ? cellC.pheromoneHome : cellC.pheromoneFood) : 0;
    const valL = cellL ? (type === 'pheromoneHome' ? cellL.pheromoneHome : cellL.pheromoneFood) : 0;
    const valR = cellR ? (type === 'pheromoneHome' ? cellR.pheromoneHome : cellR.pheromoneFood) : 0;

    let targetAngle = 0;
    if (valL > valC && valL > valR) {
      targetAngle = -sensorAngle;
    } else if (valR > valC && valR > valL) {
      targetAngle = sensorAngle;
    }

    const desiredAngle = this.vel.heading() + targetAngle;
    const desired = Vector2D.fromAngle(desiredAngle, this.maxSpeed * this.speedModifier);
    const steer = Vector2D.sub(desired, this.vel);
    return steer.limit(this.maxForce);
  }
}
