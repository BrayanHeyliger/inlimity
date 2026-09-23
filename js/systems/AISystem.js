// ═══ archivo: js/systems/AISystem.js ═══
// IA enemiga. Perfiles:
//   aggressive → busca línea de visión y dispara; si no, avanza.
//   camper     → apenas se mueve; dispara desde lejos a lo que vea.
//   charger    → se lanza al jugador más cercano.
//   flanker    → busca ángulos laterales y prefiere tiros con rebote.
//   boss       → 3 fases: disparo / telegrafía / abanico triple.
//
// Regla de oro (edge case 4): un enemigo sin cobertura Y sin tiro DEBE
// alejarse del jugador. Nunca se queda parado sin hacer nada.

import { Vector2 } from '../utils/Vector2.js';
import { chebyshev, pick, chance } from '../utils/Math.js';

/** Sonda ligera: pregunta "¿me alcanzarían si estuviera aquí?" sin crear entidad. */
function probe(cx, cy, src) {
  return {
    cx, cy,
    pos: { x: cx * src.tile + src.tile / 2, y: cy * src.tile + src.tile / 2 },
    radius: src.radius,
    alive: true,
    team: 'enemy',
    id: '__probe',
  };
}

export class AISystem {
  constructor(grid, ballistics) {
    this.grid = grid;
    this.ballistics = ballistics;
  }

  /** Planifica todos los enemigos vivos: devuelve cola [{enemy, plan}]. */
  planAll(world) {
    const queue = [];
    for (const enemy of world.enemies) {
      if (!enemy.alive) continue;
      const plan = this.plan(enemy, world);
      if (plan.move || plan.shot) queue.push({ enemy, plan });
    }
    return queue;
  }

  /** Plan individual: {move:Array<cell>|null, shot:object|null} */
  plan(enemy, world) {
    const players = world.players.filter((p) => p.alive);
    if (players.length === 0) return { move: null, shot: null };

    if (enemy.aiProfile === 'boss') return this.planBoss(enemy, world);

    const targets = [...world.players, ...world.enemies];
    const opts = enemy.traceOptions(targets);
    const occupied = this._occupied(world, enemy);

    // 1) ¿Tenemos tiro?
    if (!enemy.hasShot) {
      const shot = this._findShot(enemy, players, opts);
      if (shot) {
        const move = enemy.aiProfile === 'camper'
          ? null
          : this._reposition(enemy, world, occupied, players);
        return { move, shot };
      }
    }

    // 2) Sin tiro: buscamos posición que lo habilite.
    if (!enemy.hasMoved) {
      const move = this._seekShot(enemy, world, occupied, players, opts);
      if (move && move.length) return { move, shot: null };
    }

    // 3) Sin cobertura ni tiro: retirada (edge case 4).
    if (!enemy.hasMoved && !enemy.hasShot) {
      const flee = this.retreat(enemy, world, players);
      if (flee && flee.length) return { move: flee, shot: null };
    }

    // 4) Último recurso: disparo especulativo buscando un rebote.
    if (!enemy.hasShot && enemy.aiProfile !== 'camper') {
      const blind = this._blindShot(enemy, players, opts);
      if (blind) return { move: null, shot: blind };
    }

    return { move: null, shot: null };
  }

  // ── disparo ──────────────────────────────────────────────────────────
  _findShot(enemy, players, opts) {
    const selective = enemy.aiProfile === 'camper';
    let best = null;

    for (const p of players) {
      const r = this.ballistics.findBestShot(enemy.pos, p, {
        ...opts,
        samples: selective ? 480 : 300,
        preferBounces: enemy.aiProfile === 'flanker',
      });
      if (!r) continue;
      if (!best || r.score > best.score) best = { ...r, target: p };
    }

    if (!best) return null;
    if (selective && best.result.bounceCount > 1) return null;
    if (!selective && chance(0.10)) return null;      // margen de error humano

    return { angle: best.angle, target: best.target, result: best.result };
  }

  _blindShot(enemy, players, opts) {
    if (!chance(0.5)) return null;
    const p = pick(players);
    const angle = p.pos.sub(enemy.pos).angle() + (Math.random() - 0.5) * 1.4;
    const result = this.ballistics.trace(enemy.pos, Vector2.fromAngle(angle), opts);
    return { angle, target: null, result, blind: true };
  }

  // ── movimiento ───────────────────────────────────────────────────────
  _seekShot(enemy, world, occupied, players, opts) {
    const reach = this.grid.reachable(enemy.cx, enemy.cy, enemy.movement, occupied);
    if (reach.size === 0) return null;

    let bestCell = null, bestScore = -Infinity;

    for (const [key, cost] of reach) {
      const [cx, cy] = key.split(',').map(Number);
      const center = this.grid.centerOf(cx, cy);

      let shotScore = -Infinity;
      for (const p of players) {
        const r = this.ballistics.findBestShot(center, p, { ...opts, samples: 80 });
        if (r) shotScore = Math.max(shotScore, 2000 - r.result.bounceCount * 10);
      }

      const cover = this.grid.coverScore(cx, cy) * 12;
      const dist = Math.min(...players.map((p) => chebyshev(cx, cy, p.cx, p.cy)));
      const depth = -cost * 3;

      let tactical;
      if (enemy.aiProfile === 'charger')      tactical = -dist * 26;
      else if (enemy.aiProfile === 'camper')  tactical = dist * 14;
      else if (enemy.aiProfile === 'flanker') tactical = -Math.abs(dist - 4) * 10;
      else                                    tactical = -dist * 8;

      const score = shotScore + cover + tactical + depth;
      if (score > bestScore) { bestScore = score; bestCell = { cx, cy }; }
    }

    if (!bestCell) return null;
    return this.grid.findPath(enemy.cx, enemy.cy, bestCell.cx, bestCell.cy, occupied);
  }

  /** Reposicionamiento tras disparar: busca cobertura sin exponerse. */
  _reposition(enemy, world, occupied, players) {
    const reach = this.grid.reachable(enemy.cx, enemy.cy, enemy.movement, occupied);
    if (reach.size === 0) return null;

    const nearest = this._nearestPlayer(enemy, players);
    let bestCell = null, bestScore = -Infinity;

    for (const [key, cost] of reach) {
      const [cx, cy] = key.split(',').map(Number);
      const cellPos = this.grid.centerOf(cx, cy);

      // ¿Alguien me alcanza desde aquí? Consulta barata con pocas muestras.
      let threatened = false;
      for (const p of players) {
        const dir = cellPos.sub(p.pos);
        if (dir.length() < 1e-3) continue;
        const r = this.ballistics.trace(p.pos, dir.normalize(), {
          maxBounces: p.maxBounces ?? 4,
          targets: [probe(cx, cy, enemy)],
          ignoreTeam: 'player',
        });
        if (r.hit) { threatened = true; break; }
      }

      const cover = this.grid.coverScore(cx, cy) * 16;
      const dist = nearest ? chebyshev(cx, cy, nearest.cx, nearest.cy) : 5;
      const ideal = enemy.aiProfile === 'camper' ? 8 : enemy.aiProfile === 'charger' ? 1 : 4;
      const spacing = -Math.abs(dist - ideal) * 12;
      const safety = threatened ? -90 : 0;

      const score = cover + spacing + safety - cost * 2;
      if (score > bestScore) { bestScore = score; bestCell = { cx, cy }; }
    }

    if (!bestCell || (bestCell.cx === enemy.cx && bestCell.cy === enemy.cy)) return null;
    return this.grid.findPath(enemy.cx, enemy.cy, bestCell.cx, bestCell.cy, occupied);
  }

  /** Edge case 4: sin cobertura ni tiro → alejarse del jugador. */
  retreat(enemy, world, players) {
    if (players.length === 0) return null;
    const occupied = this._occupied(world, enemy);
    const reach = this.grid.reachable(enemy.cx, enemy.cy, enemy.movement, occupied);
    if (reach.size === 0) return null;

    const nearest = this._nearestPlayer(enemy, players);
    let bestCell = null, bestScore = -Infinity;
    for (const [key] of reach) {
      const [cx, cy] = key.split(',').map(Number);
      const d = nearest ? chebyshev(cx, cy, nearest.cx, nearest.cy) : 0;
      const score = d * 10 + this.grid.coverScore(cx, cy) * 8;
      if (score > bestScore) { bestScore = score; bestCell = { cx, cy }; }
    }
    if (!bestCell) return null;
    return this.grid.findPath(enemy.cx, enemy.cy, bestCell.cx, bestCell.cy, occupied);
  }

  // ── boss ─────────────────────────────────────────────────────────────
  planBoss(boss, world) {
    const players = world.players.filter((p) => p.alive);
    if (!players.length) return { move: null, shot: null };
    const targets = [...world.players, ...world.enemies];
    const opts = boss.traceOptions(targets);

    // Fase 2: telegrafía y resuelve el disparo en la acción siguiente.
    if (boss.phase === 2 && !boss.hasShot) {
      if (boss.telegraphAngle !== null && boss.telegraphAngle !== undefined) {
        const angle = boss.telegraphAngle;
        boss.telegraphAngle = null;
        const result = this.ballistics.trace(boss.pos, Vector2.fromAngle(angle), opts);
        return { move: null, shot: { angle, result, target: null } };
      }
      const shot = this._findShot(boss, players, opts);
      if (shot) {
        boss.telegraphAngle = shot.angle;
        return { move: null, shot: { ...shot, telegraph: true } };
      }
    }

    // Fase 3: abanico triple.
    if (boss.phase === 3 && !boss.hasShot) {
      const shot = this._findShot(boss, players, opts);
      const base = shot ? shot.angle : players[0].pos.sub(boss.pos).angle();
      return {
        move: null,
        shot: { spread: [base - 0.30, base, base + 0.30], target: shot?.target || null },
      };
    }

    // Fase 1 (y respaldo): disparo simple; si no hay, se acerca.
    const shot = this._findShot(boss, players, opts);
    if (shot) return { move: null, shot };

    if (!boss.hasMoved) {
      const move = this._seekShot(boss, world, this._occupied(world, boss), players, opts);
      if (move && move.length) return { move, shot: null };
      const flee = this.retreat(boss, world, players);
      if (flee && flee.length) return { move: flee, shot: null };
    }
    return { move: null, shot: null };
  }

  // ── helpers ──────────────────────────────────────────────────────────
  _nearestPlayer(enemy, players) {
    let best = null, bd = Infinity;
    for (const p of players) {
      const d = chebyshev(enemy.cx, enemy.cy, p.cx, p.cy);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  _occupied(world, self) {
    const set = new Set();
    for (const e of [...world.players, ...world.enemies]) {
      if (!e.alive || e === self) continue;
      set.add(`${e.cx},${e.cy}`);
    }
    return set;
  }
}

export default AISystem;
