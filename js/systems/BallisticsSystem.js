// ═══ archivo: js/systems/BallisticsSystem.js ═══
// SISTEMA CRÍTICO: cálculo de trayectoria con rebotes.
//
// Estrategia: raymarching a pasos cortos sobre la rejilla. En cada paso
// comprobamos la celda destino; si es sólida, calculamos la normal por el
// eje de entrada y reflejamos. Es estable, simple y no sufre de "tunneling"
// porque el paso (2px) es muy inferior al tamaño de celda (48px).
//
//   antes            en el muro          después
//   d=(1,-1)   ──▶   normal=(0,1)   ──▶  r = d - 2(d·n)n = (1,1)
//
//        \                │                    /
//         \               │  n                /
//          ▼              ▼                  ▼
//   ════════════════════════════════════════════  muro
//
// El cálculo es PURO: recibe el grid y devuelve un path. No dibuja nada,
// no muta entidades. Eso lo hace trivialmente testeable y permite usarlo
// tanto para la previsualización del jugador como para la IA enemiga.

import { Vector2 } from '../utils/Vector2.js';
import { TILE, BALLISTICS, GRID } from '../utils/Constants.js';

export class BallisticsSystem {
  /**
   * @param {Grid} grid instancia con isSolid(cx,cy) / tileAt(cx,cy)
   */
  constructor(grid) {
    this.grid = grid;
  }

  /**
   * Traza la trayectoria de un disparo.
   * @param {Vector2} origin  punto de salida en px
   * @param {Vector2} dir     dirección (se normaliza)
   * @param {object}  opts
   *   maxBounces  número máximo de rebotes
   *   targets     array de entidades con {pos:{x,y}, radius, alive, team}
   *   ignoreTeam  no impacta a entidades de este equipo
   *   pierceCover atraviesa la primera cobertura
   * @returns {{points:Vector2[], bounces:object[], hit:object|null,
   *            hitCover:object|null, ended:string, bounceCount:number}}
   */
  trace(origin, dir, opts = {}) {
    const {
      maxBounces = BALLISTICS.MAX_BOUNCES,
      targets = [],
      ignoreTeam = null,
      pierceCover = false,
    } = opts;

    const points = [origin.clone()];
    const bounces = [];
    let pos = origin.clone();
    let d = dir.normalize();
    if (d.length() < 1e-6) {
      return { points, bounces, hit: null, hitCover: null, ended: 'nodir', bounceCount: 0 };
    }

    let bounceCount = 0;
    let travelled = 0;
    let pierceLeft = pierceCover ? 1 : 0;
    const step = BALLISTICS.STEP;
    const recent = [];              // para detección de loops
    let ended = 'maxlen';

    const guardMax = Math.ceil(BALLISTICS.MAX_PATH_LEN / step) + 16;

    for (let guard = 0; guard < guardMax; guard++) {
      const next = new Vector2(pos.x + d.x * step, pos.y + d.y * step);
      travelled += step;

      // ── 1) ¿Fuera del tablero? ─────────────────────────────────────
      if (!this.grid.inBoundsPx(next.x, next.y)) {
        // Los bordes del tablero funcionan como muros: rebotamos.
        const n = this.grid.borderNormal(next.x, next.y);
        if (bounceCount >= maxBounces) {
          points.push(next); ended = 'maxbounces'; break;
        }
        d = d.reflect(n);
        pos = new Vector2(pos.x + n.x * BALLISTICS.NUDGE, pos.y + n.y * BALLISTICS.NUDGE);
        points.push(pos.clone());
        bounceCount++;
        bounces.push({ x: pos.x, y: pos.y, nx: n.x, ny: n.y, kind: 'border', index: bounceCount });
        if (this._isLoop(recent, pos)) { ended = 'loop'; break; }
        continue;
      }

      // ── 2) ¿Impacto con una entidad? ───────────────────────────────
      const hitEntity = this._entityAt(next, targets, ignoreTeam);
      if (hitEntity) {
        points.push(next);
        return {
          points, bounces, hit: hitEntity, hitCover: null,
          ended: 'entity', bounceCount, distance: travelled,
        };
      }

      // ── 3) ¿Celda sólida? ──────────────────────────────────────────
      const cell = this.grid.cellAtPx(next.x, next.y);
      const tile = this.grid.tileAt(cell.cx, cell.cy);

      if (tile === TILE.WALL || tile === TILE.BUMPER || tile === TILE.COVER) {
        // La cobertura se destruye (o se atraviesa si pierceCover).
        if (tile === TILE.COVER) {
          if (pierceLeft > 0) {
            pierceLeft--;
            pos = next;
            continue;                        // la atraviesa sin rebotar
          }
          points.push(next);
          return {
            points, bounces, hit: null,
            hitCover: { cx: cell.cx, cy: cell.cy },
            ended: 'cover', bounceCount, distance: travelled,
          };
        }

        // Muro o bumper: rebote.
        if (bounceCount >= maxBounces) {
          points.push(next); ended = 'maxbounces'; break;
        }
        const n = this._surfaceNormal(pos, next, cell);
        d = d.reflect(n);
        pos = new Vector2(pos.x + n.x * BALLISTICS.NUDGE, pos.y + n.y * BALLISTICS.NUDGE);
        points.push(pos.clone());
        bounceCount++;
        bounces.push({
          x: pos.x, y: pos.y, nx: n.x, ny: n.y,
          kind: tile === TILE.BUMPER ? 'bumper' : 'wall',
          index: bounceCount,
        });
        if (this._isLoop(recent, pos)) { ended = 'loop'; break; }
        continue;
      }

      // ── 4) Avance normal ───────────────────────────────────────────
      pos = next;
      if (travelled >= BALLISTICS.MAX_PATH_LEN) { points.push(pos.clone()); ended = 'maxlen'; break; }
    }

    if (points[points.length - 1] !== pos) points.push(pos.clone());
    return { points, bounces, hit: null, hitCover: null, ended, bounceCount, distance: travelled };
  }

  /**
   * Determina la normal de la superficie golpeada.
   * Comprueba qué eje provocó la entrada en la celda sólida: si al mover
   * sólo en X ya estábamos dentro, la cara golpeada es vertical.
   */
  _surfaceNormal(from, to, cell) {
    const cx = cell.cx, cy = cell.cy;
    const wasSolidX = this.grid.isSolidPx(to.x, from.y);
    const wasSolidY = this.grid.isSolidPx(from.x, to.y);

    if (wasSolidX && !wasSolidY) {
      return new Vector2(to.x > from.x ? -1 : 1, 0);
    }
    if (wasSolidY && !wasSolidX) {
      return new Vector2(0, to.y > from.y ? -1 : 1);
    }

    // Golpe de esquina o ambos ejes sólidos: usamos la cara más cercana.
    const r = this.grid.cellRect(cx, cy);
    const px = to.x, py = to.y;
    const dLeft = Math.abs(px - r.x);
    const dRight = Math.abs(r.x + r.w - px);
    const dTop = Math.abs(py - r.y);
    const dBot = Math.abs(r.y + r.h - py);
    const m = Math.min(dLeft, dRight, dTop, dBot);
    if (m === dLeft)  return new Vector2(-1, 0);
    if (m === dRight) return new Vector2(1, 0);
    if (m === dTop)   return new Vector2(0, -1);
    return new Vector2(0, 1);
  }

  /** Detección de loop infinito entre paredes paralelas. */
  _isLoop(recent, pos) {
    for (const p of recent) {
      if (Math.abs(p.x - pos.x) < BALLISTICS.LOOP_EPS &&
          Math.abs(p.y - pos.y) < BALLISTICS.LOOP_EPS) {
        return true;
      }
    }
    recent.push({ x: pos.x, y: pos.y });
    if (recent.length > BALLISTICS.LOOP_WINDOW) recent.shift();
    return false;
  }

  /** Primera entidad viva cuyo círculo contiene el punto. */
  _entityAt(p, targets, ignoreTeam) {
    for (const t of targets) {
      if (!t.alive) continue;
      if (ignoreTeam && t.team === ignoreTeam) continue;
      const dx = p.x - t.pos.x, dy = p.y - t.pos.y;
      const r = t.radius || GRID.TILE * 0.34;
      if (dx * dx + dy * dy <= r * r) return t;
    }
    return null;
  }

  /**
   * Busca el mejor ángulo de disparo desde un origen hacia un objetivo.
   * Se usa para la IA enemiga y para el botón "Pista".
   * Barre el círculo completo en pasos finos y puntúa cada trayectoria.
   * @returns {{angle:number, result:object, score:number}|null}
   */
  findBestShot(origin, target, opts = {}) {
    const { maxBounces = BALLISTICS.MAX_BOUNCES, targets = [], ignoreTeam = null,
            samples = 720, preferBounces = false } = opts;

    let best = null;
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const dir = Vector2.fromAngle(angle);
      const res = this.trace(origin, dir, { maxBounces, targets, ignoreTeam });
      if (res.hit !== target) continue;

      // Puntuación: acertar es lo esencial; los rebotes suman si se piden,
      // y penalizamos trayectorias larguísimas para preferir tiros limpios.
      let score = 1000;
      score += res.bounceCount * (preferBounces ? 120 : -8);
      score -= (res.distance || 0) * 0.01;
      if (!best || score > best.score) best = { angle, result: res, score };
    }
    return best;
  }

  /** Cuenta cuántos enemigos distintos podría alcanzar un disparo en abanico. */
  countReachable(origin, targets, opts = {}) {
    const set = new Set();
    const samples = opts.samples || 360;
    for (let i = 0; i < samples; i++) {
      const dir = Vector2.fromAngle((i / samples) * Math.PI * 2);
      const r = this.trace(origin, dir, { ...opts, targets });
      if (r.hit) set.add(r.hit.id);
    }
    return set;
  }
}

export default BallisticsSystem;
