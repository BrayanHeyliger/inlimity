// ═══ archivo: js/systems/CombatSystem.js ═══
// Puente entre BallisticsSystem (cálculo puro) y el mundo (efectos).

import { Projectile } from '../entities/Projectile.js';
import { Vector2 } from '../utils/Vector2.js';
import { ECONOMY } from '../utils/Constants.js';

export class CombatSystem {
  constructor(world) {
    this.world = world;
  }

  get targets() {
    return [...this.world.players, ...this.world.enemies];
  }

  /**
   * Dispara y resuelve. Devuelve el trace calculado.
   * @param {Entity} shooter
   * @param {number}  angle      radianes
   * @param {object}  opts       { maxBounces, pierceCover }
   */
  fire(shooter, angle, opts = {}) {
    if (!shooter.alive) return null;
    if (this.targets.length === 0) return null;

    const dir = Vector2.fromAngle(angle);
    const trace = this.world.ballistics.trace(shooter.pos, dir, {
      ...shooter.traceOptions(this.targets),
      ...opts,
    });

    this.world.currentShooter = shooter;

    const proj = new Projectile(trace, {
      shooter,
      onBounce: (b, n) => {
        this.world.particles.bounceSparks(b.x, b.y, b.nx, b.ny);
        this.world.shake(2.5, 0.12);
        this.world.stats.totalBounces++;
        this.world.audio.bounce(n);
      },
      onDone: (res) => this._resolve(res),
    });

    this.world.projectiles.push(proj);
    this.world.stats.totalShots++;
    shooter.shotsFired++;
    this.world.audio.shoot();
    return trace;
  }

  /** Abanico del boss (fase 3): varias balas a la vez. */
  fireSpread(shooter, angles, opts = {}) {
    return angles.map((a) => this.fire(shooter, a, opts)).filter(Boolean);
  }

  /** Aplica el resultado del trace al estado del juego. */
  _resolve(trace) {
    const shooter = this.world.currentShooter;
    const outcome = this.world.collisions.resolveImpact(trace, {
      shooter,
      damageFor: (t) => (shooter ? shooter.damageFor(t.bounceCount) : 1),
    });

    for (const d of outcome.damaged) {
      this.world.particles.burst(d.entity.pos.x, d.entity.pos.y, 8, {
        color: d.entity.team === 'player' ? '#8fd4ff' : '#ffd45e',
      });
      this.world.audio.hit();
      this.world.showFloatingText(
        d.entity.pos.x, d.entity.pos.y - 20, `-${d.amount}`,
        d.entity.team === 'player' ? '#ff9aa2' : '#fff0a8'
      );
    }

    for (const k of outcome.killed) {
      this.world.particles.deathBurst(k.pos.x, k.pos.y, k.color);
      this.world.shake(6, 0.3);
      this.world.audio.death();
      if (k.team === 'enemy') this.world.stats.kills++;
      this.world.showFloatingText(
        k.pos.x, k.pos.y - 28,
        k.team === 'enemy' ? `${k.name} eliminado` : `${k.name} caído`,
        k.team === 'enemy' ? '#a8ffcf' : '#ff9aa2'
      );
    }

    if (outcome.coverDestroyed) {
      this.world.shake(3, 0.16);
      this.world.audio.breakCover();
    }

    // XP de rebote múltiple
    if (trace.bounceCount >= 2 && outcome.damaged.some((d) => d.entity.team === 'enemy')) {
      this.world.xpRun += ECONOMY.XP_MULTI_BOUNCE;
    }

    this.world.lastOutcome = outcome;
    this.world.currentShooter = null;
    return outcome;
  }

  /** Previsualiza sin efectos: lo usan el HUD y el botón Pista. */
  preview(shooter, angle, opts = {}) {
    return this.world.ballistics.trace(shooter.pos, Vector2.fromAngle(angle), {
      ...shooter.traceOptions(this.targets),
      ...opts,
    });
  }
}

export default CombatSystem;
