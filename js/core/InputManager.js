// ═══ archivo: js/core/InputManager.js ═══
// Input unificado: ratón, táctil y teclado.
// Edge case 9: mientras una acción está en curso se ignoran toques extra.

import { Vector2 } from '../utils/Vector2.js';

export class InputManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} handlers  callbacks: onTap, onDrag, onDragEnd, onKey
   */
  constructor(canvas, handlers = {}) {
    this.canvas = canvas;
    this.h = handlers;
    this.pointer = { active: false, id: null, pos: new Vector2() };
    this.dragging = false;
    this.locked = false;            // bloquea input durante la resolución
    this.enabled = true;
    this._bound = [];
    this._attach();
  }

  /** Convierte coordenadas de pantalla al espacio del canvas. */
  toCanvas(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / r.width;
    const sy = this.canvas.height / r.height;
    return new Vector2((clientX - r.left) * sx, (clientY - r.top) * sy);
  }

  _attach() {
    const add = (el, type, fn, opts) => {
      el.addEventListener(type, fn, opts);
      this._bound.push([el, type, fn]);
    };

    // ── puntero (cubre ratón + táctil + stylus) ────────────────────────
    add(this.canvas, 'pointerdown', (e) => {
      if (!this.enabled || this.locked) return;
      if (this.pointer.active) return;               // edge case 9: multi-touch
      this.pointer.active = true;
      this.pointer.id = e.pointerId;
      this.pointer.pos = this.toCanvas(e.clientX, e.clientY);
      this.dragging = false;
      this.canvas.setPointerCapture?.(e.pointerId);
      this.h.onDown?.(this.pointer.pos, e);
      e.preventDefault();
    }, { passive: false });

    add(this.canvas, 'pointermove', (e) => {
      if (!this.enabled) return;
      const p = this.toCanvas(e.clientX, e.clientY);
      this.h.onHover?.(p, e);
      if (!this.pointer.active || e.pointerId !== this.pointer.id) return;
      const delta = p.distance(this.pointer.pos);
      if (!this.dragging && delta > 6) this.dragging = true;
      this.pointer.pos = p;
      if (this.dragging) this.h.onDrag?.(p, e);
      e.preventDefault();
    }, { passive: false });

    const endPointer = (e) => {
      if (!this.pointer.active || e.pointerId !== this.pointer.id) return;
      const p = this.toCanvas(e.clientX, e.clientY);
      this.pointer.active = false;
      this.pointer.id = null;
      if (this.dragging) this.h.onDragEnd?.(p, e);
      else this.h.onTap?.(p, e);
      this.dragging = false;
      e.preventDefault();
    };
    add(this.canvas, 'pointerup', endPointer, { passive: false });
    add(this.canvas, 'pointercancel', (e) => {
      this.pointer.active = false;
      this.pointer.id = null;
      this.dragging = false;
      this.h.onCancel?.(e);
    });

    // Bloquea el menú contextual en long-press móvil.
    add(this.canvas, 'contextmenu', (e) => e.preventDefault());

    // ── teclado ────────────────────────────────────────────────────────
    add(window, 'keydown', (e) => {
      if (!this.enabled) return;
      this.h.onKey?.(e.key, e);
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    });
  }

  lock()   { this.locked = true;  this.pointer.active = false; this.dragging = false; }
  unlock() { this.locked = false; }
  setEnabled(v) { this.enabled = v; if (!v) this.lock(); else this.unlock(); }

  destroy() {
    for (const [el, type, fn] of this._bound) el.removeEventListener(type, fn);
    this._bound = [];
  }
}

export default InputManager;
