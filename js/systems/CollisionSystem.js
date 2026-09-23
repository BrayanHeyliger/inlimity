// ═══ archivo: js/systems/CollisionSystem.js ═══
// Consultas de ocupación y aplicación de impactos.

import { TILE } from '../utils/Constants.js';
import { circleCircle } from '../utils/Math.js';

export class CollisionSystem {
  constructor(grid) { this.grid = grid; }

  /** Set de claves "cx,cy" ocupadas por entidades vivas. */
  occupiedKeys(entities, except = null) {
    const set = new Set();
    for (const e of entities) {
      if (!e.alive || e === except) continue;
      set.add(`${e.cx},${e.cy}`);
    }
    return set;
  }

  /** ¿La celda destino está libre? (edge case 3) */
  canEnter(grid, cx, cy, entities, self) {
    if (!grid.inBounds(cx, cy)) return false;
    if (grid.blocksMove(cx, cy)) return false;
    for (const e of entities) {
      if (!e.alive || e === self) continue;
      if (e.cx === cx && e.cy === cy) return false;
    }
    return true;
  }

  /** Entidad viva en una celda concreta. */
  entityAtCell(entities, cx, cy) {
    for (const e of entities) {
      if (e.alive && e.cx === cx && e.cy === cy) return e;
    }
    return null;
  }

  /**
   * Aplica el resultado de un trazado al mundo.
   * @returns {{killed:Array, damaged:Array, coverDestroyed:boolean, xpGained:number}}
   */
  resolveImpact(trace, world) {
    const out = { killed: [], damaged: [], coverDestroyed: false, xpGained: 0, bounceBonus: 0 };

    if (trace.hitCover) {
      const broke = this.grid.destroyCover(trace.hitCover.cx, trace.hitCover.cy);
      out.coverDestroyed = broke;
    }

    if (trace.hit) {
      const target = trace.hit;
      const dmg = world.damageFor(trace);
      const dealt = target.takeDamage(dmg);
      out.damaged.push({ entity: target, amount: dealt });

      if (!target.alive) {
        out.killed.push(target);
        if (target.team === 'enemy' && world.shooter) {
          world.shooter.kills++;
          out.xpGained += 50;                                   // XP_KILL
        }
      }
      // XP extra por cadena de rebotes (edge: rebote múltiple)
      if (trace.bounceCount >= 2 && target.team === 'enemy') {
        out.xpGained += 25;
        out.bounceBonus = trace.bounceCount;
      }
    }
    return out;
  }

  /** ¿Dos entidades se solapan? (sanity check tras mover) */
  overlaps(a, b) {
    return circleCircle(a.pos.x, a.pos.y, a.radius, b.pos.x, b.pos.y, b.radius);
  }

  /** ¿El punto está dentro de alguna zona de peligro? */
  inAnyZone(x, y, zones) {
    for (const z of zones) {
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return true;
    }
    return false;
  }
}

export default CollisionSystem;
