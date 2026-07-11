export class Vector2D {
  constructor(public x: number = 0, public y: number = 0) {}

  add(v: Vector2D): Vector2D {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v: Vector2D): Vector2D {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  mult(n: number): Vector2D {
    this.x *= n;
    this.y *= n;
    return this;
  }

  div(n: number): Vector2D {
    if (n !== 0) {
      this.x /= n;
      this.y /= n;
    }
    return this;
  }

  magSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  mag(): number {
    return Math.sqrt(this.magSq());
  }

  normalize(): Vector2D {
    const m = this.mag();
    if (m !== 0) {
      this.div(m);
    }
    return this;
  }

  limit(max: number): Vector2D {
    const mSq = this.magSq();
    if (mSq > max * max) {
      this.normalize().mult(max);
    }
    return this;
  }

  dist(v: Vector2D): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  heading(): number {
    return Math.atan2(this.y, this.x);
  }

  copy(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  static sub(v1: Vector2D, v2: Vector2D): Vector2D {
    return new Vector2D(v1.x - v2.x, v1.y - v2.y);
  }

  static dist(v1: Vector2D, v2: Vector2D): number {
    return v1.dist(v2);
  }

  static fromAngle(angle: number, length: number = 1): Vector2D {
    return new Vector2D(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  static random2D(): Vector2D {
    const angle = Math.random() * Math.PI * 2;
    return Vector2D.fromAngle(angle);
  }
}
