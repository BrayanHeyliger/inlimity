// ═══ archivo: js/entities/Projectile.js ═══
// Bala visual: recorre un path ya calculado por BallisticsSystem.
// La resolución del impacto se decidió ANTES de lanzarla (determinismo),
// así la animación nunca contradice el resultado lógico.

import { Vector2 } from '../utils/Vector2.js';
import { BALLISTICS } from '../utils/Constants.js';

export class Projectile {
  /**
   * @param {object} trace  resultado de BallisticsSystem.trace()
   * @param {object} meta   {shooter, onBounce, onDone}
   */
  constructor(trace, meta = {}) {
    this.points = trace.points.map((p) => new Vector2(p.x, p.y));
    this.bounces = trace.bounces;
    this.result = trace;
    this.shooter = meta.shooter || null;
    this.onBounce = meta.onBounce || (() => {});
    this.onDone = meta.onDone || (() => {});

    this.leg = 0;
    this.legT = 0;
    this.pos = this.points[0].clone();
    this.prev = this.pos.clone();
    this.alive = true;
    this.age = 0;
    this.bouncesSeen = 0;
    this.trail = [];
    this.speed = BALLISTICS.SPEED;
  }

  get dir() {
    const a = this.points[this.leg];
    const b = this.points[Math.min(this.leg + 1, this.points.length - 1)];
    return b.sub(a).normalize();
  }

  update(dt) {
    if (!this.alive) return;
    this.age += dt;

    // Edge case 7: timeout anti-bug. Si por cualquier razón la bala no
    // termina su path, se elimina y se resuelve igualmente.
    if (this.age > BALLISTICS.LIFETIME) { this._finish(); return; }

    this.prev = this.pos.clone();

    let budget = this.speed * dt;
    while (budget > 0 && this.alive) {
      const a = this.points[this.leg];
      const b = this.points[this.leg + 1];
      if (!b) { this._finish(); return; }

      const legLen = b.distance(a);
      if (legLen < 1e-6) { this._advanceLeg(); continue; }

      const remain = legLen * (1 - this.legT);
      if (budget < remain) {
        this.legT += budget / legLen;
        budget = 0;
      } else {
        budget -= remain;
        this.legT = 0;
        this._advanceLeg();
      }
      if (!this.alive) return;
      const aa = this.points[this.leg];
      const bb = this.points[this.leg + 1];
      if (aa && bb) this.pos = aa.lerp(bb, this.legT);
      else if (aa) this.pos = aa.clone();
    }

    // estela
    this.trail.push({ x: this.pos.x, y: this.pos.y, life: 1 });
    if (this.trail.length > 18) this.trail.shift();
    for (const t of this.trail) t.life -= dt * 3.4;
  }

  _advanceLeg() {
    this.leg++;
    if (this.leg >= this.points.length - 1) {
      this.pos = this.points[this.points.length - 1].clone();
      this._finish();
      return;
    }
    // Cada vértice intermedio del path es un rebote.
    const b = this.bounces[this.bouncesSeen];
    if (b) {
      this.bouncesSeen++;
      this.onBounce(b, this.bouncesSeen);
    }
  }

  _finish() {
    if (!this.alive) return;
    this.alive = false;
    this.onDone(this.result);
  }
}

export default Projectile;
