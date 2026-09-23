// ═══ archivo: js/levels/Grid.js ═══
// Rejilla del tablero: consultas de celda, solidez, bordes y pathfinding.

import { GRID, TILE } from '../utils/Constants.js';
import { Vector2 } from '../utils/Vector2.js';

export class Grid {
  constructor(cols = GRID.COLS, rows = GRID.ROWS, tile = GRID.TILE) {
    this.cols = cols;
    this.rows = rows;
    this.tile = tile;
    this.cells = new Array(cols * rows).fill(TILE.FLOOR);
  }

  static fromLayout(layout, tile = GRID.TILE) {
    const rows = layout.length;
    const cols = layout[0].length;
    const g = new Grid(cols, rows, tile);
    const map = { '.': TILE.FLOOR, '#': TILE.WALL, 'c': TILE.COVER, 'b': TILE.BUMPER, 'o': TILE.PIT };
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ch = layout[y][x] ?? '.';
        g.set(x, y, map[ch] ?? TILE.FLOOR);
      }
    }
    return g;
  }

  get width()  { return this.cols * this.tile; }
  get height() { return this.rows * this.tile; }

  idx(cx, cy) { return cy * this.cols + cx; }
  inBounds(cx, cy) { return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows; }
  tileAt(cx, cy) { return this.inBounds(cx, cy) ? this.cells[this.idx(cx, cy)] : TILE.WALL; }
  set(cx, cy, v) { if (this.inBounds(cx, cy)) this.cells[this.idx(cx, cy)] = v; }

  /** Bloquea el movimiento de entidades. */
  blocksMove(cx, cy) {
    const t = this.tileAt(cx, cy);
    return t === TILE.WALL || t === TILE.COVER || t === TILE.BUMPER || t === TILE.PIT;
  }

  /** Bloquea/rebota la bala. */
  isSolid(cx, cy) {
    const t = this.tileAt(cx, cy);
    return t === TILE.WALL || t === TILE.COVER || t === TILE.BUMPER;
  }

  isSolidPx(px, py) {
    const c = this.cellAtPx(px, py);
    return this.isSolid(c.cx, c.cy);
  }

  inBoundsPx(px, py) {
    return px >= 0 && py >= 0 && px < this.width && py < this.height;
  }

  cellAtPx(px, py) {
    return { cx: Math.floor(px / this.tile), cy: Math.floor(py / this.tile) };
  }

  cellRect(cx, cy) {
    return { x: cx * this.tile, y: cy * this.tile, w: this.tile, h: this.tile };
  }

  centerOf(cx, cy) {
    return new Vector2(cx * this.tile + this.tile / 2, cy * this.tile + this.tile / 2);
  }

  /** Normal del borde del tablero más cercano al punto dado. */
  borderNormal(px, py) {
    if (px < 0) return new Vector2(1, 0);
    if (px >= this.width) return new Vector2(-1, 0);
    if (py < 0) return new Vector2(0, 1);
    return new Vector2(0, -1);
  }

  /** Destruye una cobertura (la bala la rompe). */
  destroyCover(cx, cy) {
    if (this.tileAt(cx, cy) === TILE.COVER) { this.set(cx, cy, TILE.FLOOR); return true; }
    return false;
  }

  /** ¿Hay línea de visión despejada entre dos celdas? */
  hasLineOfSight(ax, ay, bx, by) {
    let x0 = ax, y0 = ay;
    const dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = dx - dy;
    for (let guard = 0; guard < 4096; guard++) {
      if (x0 === bx && y0 === by) return true;
      if (!(x0 === ax && y0 === ay) && this.isSolid(x0, y0)) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    return false;
  }

  /** ¿La celda toca una cobertura o muro adyacente? (heurística de cobertura) */
  coverScore(cx, cy) {
    let s = 0;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx, dy] of dirs) {
      const t = this.tileAt(cx + dx, cy + dy);
      if (t === TILE.COVER) s += 2;
      else if (t === TILE.WALL || t === TILE.BUMPER) s += 1;
    }
    return s;
  }

  /**
   * BFS de alcance de movimiento. Devuelve un Map "cx,cy" -> coste.
   * @param occupied Set de "cx,cy" ocupados por otras entidades.
   */
  reachable(startX, startY, maxSteps, occupied = new Set()) {
    const out = new Map();
    const key = (x, y) => `${x},${y}`;
    out.set(key(startX, startY), 0);
    let frontier = [{ x: startX, y: startY, c: 0 }];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    while (frontier.length) {
      const nextF = [];
      for (const n of frontier) {
        if (n.c >= maxSteps) continue;
        for (const [dx, dy] of dirs) {
          const nx = n.x + dx, ny = n.y + dy, k = key(nx, ny);
          if (!this.inBounds(nx, ny)) continue;
          if (this.blocksMove(nx, ny)) continue;
          if (occupied.has(k)) continue;
          if (out.has(k)) continue;
          out.set(k, n.c + 1);
          nextF.push({ x: nx, y: ny, c: n.c + 1 });
        }
      }
      frontier = nextF;
    }
    out.delete(key(startX, startY));
    return out;
  }

  /** Camino más corto (BFS) entre dos celdas. Devuelve array de celdas o null. */
  findPath(sx, sy, tx, ty, occupied = new Set()) {
    if (sx === tx && sy === ty) return [];
    const key = (x, y) => `${x},${y}`;
    const prev = new Map();
    const seen = new Set([key(sx, sy)]);
    let frontier = [{ x: sx, y: sy }];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    while (frontier.length) {
      const nextF = [];
      for (const n of frontier) {
        for (const [dx, dy] of dirs) {
          const nx = n.x + dx, ny = n.y + dy, k = key(nx, ny);
          if (seen.has(k)) continue;
          if (!this.inBounds(nx, ny)) continue;
          if (this.blocksMove(nx, ny)) continue;
          if (occupied.has(k) && !(nx === tx && ny === ty)) continue;
          seen.add(k);
          prev.set(k, { x: n.x, y: n.y });
          if (nx === tx && ny === ty) {
            const path = [];
            let cur = { x: nx, y: ny };
            while (!(cur.x === sx && cur.y === sy)) {
              path.unshift(cur);
              cur = prev.get(key(cur.x, cur.y));
            }
            return path;
          }
          nextF.push({ x: nx, y: ny });
        }
      }
      frontier = nextF;
    }
    return null;
  }
}

export default Grid;
