// ═══ archivo: js/systems/ParticleSystem.js ═══
// Object pooling + límite duro de partículas activas (edge case 5).

import { PARTICLES } from '../utils/Constants.js';
import { randRange, clamp } from '../utils/Math.js';

class Particle {
  constructor() { this.active = false; this.reset(); }
  reset() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.life = 0; this.maxLife = 1; this.size = 3;
    this.color = '#fff'; this.gravity = 0; this.drag = 0.9;
    this.shape = 'dot'; this.rot = 0; this.vr = 0; this.active = false;
  }
}

const SHAPES = ['dot', 'spark', 'ring', 'square'];

export class ParticleSystem {
  constructor(max = PARTICLES.MAX, poolSize = PARTICLES.POOL) {
    this.max = max;
    this.pool = Array.from({ length: poolSize }, () => new Particle());
    this.enabled = true;
    this.liveCount = 0;
  }

  get active() { return this.liveCount; }

  /** Reutiliza una partícula libre; si no hay, no se crea nada (pool limitado). */
  _acquire() {
    if (!this.enabled) return null;
    if (this.liveCount >= this.max) return null;
    for (const p of this.pool) {
      if (!p.active) { p.active = true; this.liveCount++; return p; }
    }
    return null;
  }

  spawn(x, y, opts = {}) {
    const p = this._acquire();
    if (!p) return null;
    p.reset();
    p.active = true;
    p.x = x; p.y = y;
    p.vx = opts.vx ?? randRange(-60, 60);
    p.vy = opts.vy ?? randRange(-60, 60);
    p.maxLife = opts.life ?? randRange(0.3, 0.7);
    p.life = p.maxLife;
    p.size = opts.size ?? randRange(2, 4.5);
    p.color = opts.color || '#ffd45e';
    p.gravity = opts.gravity ?? 120;
    p.drag = opts.drag ?? 0.92;
    p.shape = opts.shape || 'dot';
    p.rot = opts.rot ?? 0;
    p.vr = opts.vr ?? randRange(-6, 6);
    return p;
  }

  burst(x, y, count = 12, opts = {}) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + randRange(-0.2, 0.2);
      const sp = opts.speed ?? randRange(70, 210);
      this.spawn(x, y, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        ...opts,
        color: opts.color || undefined,
      });
    }
  }

  /** Chispas de impacto contra un muro, orientadas por la normal. */
  bounceSparks(x, y, nx, ny, color = '#bde3ff') {
    for (let i = 0; i < 6; i++) {
      const base = Math.atan2(-ny, -nx) + randRange(-0.9, 0.9);
      const sp = randRange(90, 240);
      this.spawn(x, y, {
        vx: Math.cos(base) * sp,
        vy: Math.sin(base) * sp,
        color, life: randRange(0.18, 0.36),
        size: randRange(1.5, 3.5), gravity: 40, shape: 'spark',
      });
    }
  }

  deathBurst(x, y, color) {
    this.burst(x, y, 18, { color, speed: 220, live: 0.8, size: randRange(2, 5), shape: 'square' });
  }

  trailPuff(x, y, color) {
    this.spawn(x, y, {
      vx: randRange(-18, 18), vy: randRange(-18, 18),
      color, life: 0.25, size: randRange(1.5, 3), gravity: 0, shape: 'dot',
    });
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; this.liveCount--; continue; }
      p.vy += p.gravity * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  draw(ctx) {
    if (!this.enabled) return;
    for (const p of this.pool) {
      if (!p.active) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = clamp(p.size * 0.6, 0.8, 2.4);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.shape === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 2.5), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const s = p.size * a;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.4, p.size * a), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    for (const p of this.pool) p.active = false;
    this.liveCount = 0;
  }
}

export default ParticleSystem;
