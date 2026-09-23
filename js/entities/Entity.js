// ═══ archivo: js/entities/Entity.js ═══
// Clase base de todas las entidades del tablero.

import { Vector2 } from '../utils/Vector2.js';
import { GRID } from '../utils/Constants.js';
import { clamp, easeInOutQuad } from '../utils/Math.js';

let _nextId = 1;

export class Entity {
  constructor(cfg = {}) {
    this.id        = cfg.id || `e${_nextId++}`;
    this.name      = cfg.name || 'Entity';
    this.team      = cfg.team || 'neutral';   // 'player' | 'enemy'
    this.cx        = cfg.cx ?? 0;
    this.cy        = cfg.cy ?? 0;
    this.tile      = cfg.tile ?? GRID.TILE;
    this.pos       = new Vector2(this.cx * this.tile + this.tile / 2,
                                 this.cy * this.tile + this.tile / 2);
    this.radius    = this.tile * 0.32;

    this.maxHp     = cfg.hp ?? 100;
    this.hp        = this.maxHp;
    this.damage    = cfg.damage ?? 3;
    this.movement  = cfg.movement ?? 3;
    this.accuracy  = cfg.accuracy ?? 3;
    this.color     = cfg.color || '#ffffff';
    this.accent    = cfg.accent || '#ffffff';

    this.alive     = true;
    this.hasMoved  = false;
    this.hasShot   = false;

    // animación
    this._anim     = null;   // {from, to, t, dur}
    this.flash     = 0;      // 0..1 destello al recibir daño
    this.bob       = Math.random() * Math.PI * 2;
    this.facing    = 1;
    this.scalePulse = 0;
  }

  get key() { return `${this.cx},${this.cy}`; }
  get isMoving() { return this._anim !== null; }

  /** Empieza la animación de desplazamiento por un camino de celdas. */
  moveAlong(path) {
    if (!path || path.length === 0) return;
    this._path = path.slice();
    this._startNextLeg();
  }

  _startNextLeg() {
    if (!this._path || this._path.length === 0) {
      this._anim = null;
      this._path = null;
      return;
    }
    const nextCell = this._path.shift();
    const from = this.pos.clone();
    const to = new Vector2(nextCell.x * this.tile + this.tile / 2,
                           nextCell.y * this.tile + this.tile / 2);
    if (to.x !== from.x) this.facing = to.x > from.x ? 1 : -1;
    this.cx = nextCell.x;
    this.cy = nextCell.y;
    this._anim = { from, to, t: 0, dur: 0.14 };
  }

  /** Teletransporte instantáneo (carga de nivel). */
  placeAt(cx, cy) {
    this.cx = cx; this.cy = cy;
    this.pos.set(cx * this.tile + this.tile / 2, cy * this.tile + this.tile / 2);
    this._anim = null; this._path = null;
  }

  update(dt) {
    this.bob += dt * 2.4;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.scalePulse > 0) this.scalePulse = Math.max(0, this.scalePulse - dt * 4);

    if (this._anim) {
      const a = this._anim;
      a.t += dt;
      const k = clamp(a.t / a.dur, 0, 1);
      const e = easeInOutQuad(k);
      this.pos.set(a.from.x + (a.to.x - a.from.x) * e,
                   a.from.y + (a.to.y - a.from.y) * e);
      if (k >= 1) this._startNextLeg();
    }
  }

  takeDamage(amount) {
    if (!this.alive) return 0;
    const dealt = Math.min(this.hp, Math.max(0, Math.round(amount)));
    this.hp -= dealt;
    this.flash = 1;
    this.scalePulse = 1;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return dealt;
  }

  heal(amount) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  resetTurnFlags() { this.hasMoved = false; this.hasShot = false; }
  get canAct() { return this.alive && (!this.hasMoved || !this.hasShot); }
  get hpPct() { return this.maxHp === 0 ? 0 : this.hp / this.maxHp; }

  serialize() {
    return { id: this.id, cx: this.cx, cy: this.cy, hp: this.hp, alive: this.alive };
  }
}

export default Entity;
