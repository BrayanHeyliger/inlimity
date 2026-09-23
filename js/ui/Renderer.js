// ═══ archivo: js/ui/Renderer.js ═══
// Capa visual: dibuja tablero, entidades, balas y efectos.
// Gráficos geométricos procedurales con la paleta del mockup.
// Para usar sprites en el futuro: activar ASSETS.enabled y rellenar
// ASSETS.images con las claves indicadas — el resto del código no cambia.

import { COLORS, TILE, GRID, BALLISTICS } from '../utils/Constants.js';
import { clamp, easeOutCubic } from '../utils/Math.js';

/** Espacio reservado para arte externo (Fase 2). */
export const ASSETS = {
  enabled: false,
  images: {},   // { hero_scout: Image, enemy_grunt: Image, floor: Image, wall: Image }
};

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.scale = 1;
  }

  setScale(s) { this.scale = s; }

  _reset() {
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  }

  // ══════════════════════════════════════════════════════════════════
  //  FONDO
  // ══════════════════════════════════════════════════════════════════
  drawMenuBackdrop(t) {
    this._reset();
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, GRID.ROWS * TILE);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GRID.COLS * TILE, GRID.ROWS * TILE);

    // Burbujas flotantes suaves para dar vida al fondo del menú.
    ctx.save();
    ctx.globalAlpha = 0.10;
    for (let i = 0; i < 18; i++) {
      const seed = i * 137.5;
      const x = ((seed * 7.3) % 960 + t * 12 * (1 + (i % 3))) % 1000;
      const y = 640 - (((seed * 3.1) % 700) + t * 22 * (0.5 + (i % 4) * 0.2)) % 760;
      const r = 12 + (i % 5) * 9;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#ffffff' : '#0e3550';
      ctx.fill();
    }
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════
  //  TABLERO
  // ══════════════════════════════════════════════════════════════════
  drawBoard(world, t) {
    this._reset();
    const ctx = this.ctx;
    const grid = world.grid;
    const W = grid.width, H = grid.height;

    // cielo
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, COLORS.bgTop);
    sky.addColorStop(1, COLORS.bgBot);
    ctx.fillStyle = sky;
    ctx.fillRect(-40, -40, W + 80, H + 80);

    // nubes simples
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 260 + t * 9) % (W + 320)) - 160;
      const cy = 42 + i * 26;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 74, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // celdas de suelo
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const tile = grid.tileAt(x, y);
        const r = grid.cellRect(x, y);
        if (tile === TILE.PIT) {
          ctx.fillStyle = COLORS.pit;
          ctx.fillRect(r.x, r.y, r.w, r.h);
          continue;
        }
        // damero suave
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = COLORS.floorLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      }
    }

    // bloques sólidos (con "altura" simulada por una cara superior)
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const tile = grid.tileAt(x, y);
        if (tile === TILE.FLOOR || tile === TILE.PIT) continue;
        const r = grid.cellRect(x, y);
        this._drawBlock(r.x, r.y, r.w, r.h, tile, t);
      }
    }
  }

  _drawBlock(x, y, w, h, tile, t) {
    const ctx = this.ctx;
    const lift = 7;
    let base, top;

    if (tile === TILE.WALL)        { base = COLORS.wall;   top = COLORS.wallTop; }
    else if (tile === TILE.COVER)  { base = COLORS.cover;  top = COLORS.coverTop; }
    else                           { base = COLORS.bumper; top = COLORS.bumperGlow; }

    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h - 3, w * 0.42, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // cara frontal
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2 + lift, w - 4, h - 4, 9);
    ctx.fill();

    // cara superior
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4 - lift, 9);
    ctx.fill();

    // brillo del bumper (pulsa)
    if (tile === TILE.BUMPER) {
      const pulse = 0.35 + 0.25 * Math.sin(t * 3 + x * 0.1 + y * 0.1);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = COLORS.bumperGlow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x + 5, y + 5, w - 10, h - 10 - lift, 7);
      ctx.stroke();
      ctx.restore();
    }

    // detalle de cobertura rota
    if (tile === TILE.COVER) {
      ctx.strokeStyle = 'rgba(90,55,20,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 18);
      ctx.lineTo(x + w - 13, y + 26);
      ctx.stroke();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  CASILLAS DE MOVIMIENTO Y PELIGRO
  // ══════════════════════════════════════════════════════════════════
  drawMoveTiles(world, moveTiles) {
    if (!moveTiles || moveTiles.size === 0) return;
    this._reset();
    const ctx = this.ctx;
    const grid = world.grid;
    const t = performance.now() / 1000;

    for (const [key] of moveTiles) {
      const [x, y] = key.split(',').map(Number);
      const r = grid.cellRect(x, y);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + (x + y) * 0.4);
      ctx.fillStyle = COLORS.moveTile;
      ctx.globalAlpha = 0.45 + pulse * 0.30;
      ctx.beginPath();
      ctx.roundRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COLORS.moveTileEdge;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, 8);
      ctx.stroke();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  PREVISUALIZACIÓN DE TIRO
  // ══════════════════════════════════════════════════════════════════
  drawPreview(preview, t) {
    if (!preview || !preview.points || preview.points.length < 2) return;
    this._reset();
    const ctx = this.ctx;
    const pts = preview.points;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // halo suave bajo la línea
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    this._path(pts);
    ctx.stroke();

    // línea punteada animada
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([9, 9]);
    ctx.lineDashOffset = -(t * 60) % 18;
    this._path(pts);
    ctx.stroke();
    ctx.setLineDash([]);

    // marcadores de rebote
    for (const b of preview.bounces) {
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // pequeña normal indicando la superficie
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.nx * 14, b.y + b.ny * 14);
      ctx.stroke();
    }

    // retícula final
    const end = pts[pts.length - 1];
    const hit = preview.hit;
    const color = hit ? '#ff5d6c' : '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    const rad = 13 + (hit ? 3 : 0);
    ctx.beginPath();
    ctx.arc(end.x, end.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end.x - rad - 6, end.y); ctx.lineTo(end.x - rad + 2, end.y);
    ctx.moveTo(end.x + rad - 2, end.y); ctx.lineTo(end.x + rad + 6, end.y);
    ctx.moveTo(end.x, end.y - rad - 6); ctx.lineTo(end.x, end.y - rad + 2);
    ctx.moveTo(end.x, end.y + rad - 2); ctx.lineTo(end.x, end.y + rad + 6);
    ctx.stroke();

    ctx.restore();
  }

  _path(points) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  }

  /** Trayectoria de la pista comprada (resaltada en dorado). */
  drawHint(hintTiles, t) {
    if (!hintTiles || hintTiles.length < 2) return;
    this._reset();
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#ffd45e';
    ctx.lineWidth = 3.5;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 6);
    ctx.setLineDash([12, 7]);
    ctx.lineDashOffset = -(t * 90) % 19;
    this._path(hintTiles);
    ctx.stroke();
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════
  //  ENTIDADES
  // ══════════════════════════════════════════════════════════════════
  drawEntities(world, t, selected) {
    this._reset();
    const ctx = this.ctx;

    // héroes primero, enemigos encima (más legibles)
    for (const p of world.players) this._drawHero(p, t, p === selected);
    for (const e of world.enemies) this._drawEnemy(e, t);
  }

  _drawHero(p, t, isSelected) {
    if (!p.alive) return;
    const ctx = this.ctx;
    const x = p.pos.x, y = p.pos.y;
    const bob = Math.sin(p.bob) * 1.6;
    const s = 1 + p.scalePulse * 0.22;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(s, s);

    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, p.radius * 0.95 + 6, p.radius * 0.95, p.radius * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // anillo de selección / equipo
    const ringColor = isSelected ? '#ffffff' : p.color;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = isSelected ? 3.2 : 2;
    ctx.globalAlpha = isSelected ? 0.95 : 0.55;
    ctx.beginPath();
    ctx.ellipse(0, p.radius * 0.95 + 5, p.radius * 0.92, p.radius * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // pulso de selección
    if (isSelected) {
      const pr = p.radius * (0.95 + 0.28 * Math.sin(t * 4));
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, p.radius * 0.95 + 5, pr, pr * 0.37, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // cuerpo (cápsula redondeada)
    const bodyR = p.radius;
    const grad = ctx.createLinearGradient(0, -bodyR * 1.5, 0, bodyR * 1.4);
    grad.addColorStop(0, p.accent);
    grad.addColorStop(1, p.color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-bodyR * 0.78, -bodyR * 1.25, bodyR * 1.56, bodyR * 2.5, bodyR * 0.72);
    ctx.fill();

    // contorno
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // visor
    ctx.fillStyle = 'rgba(12,26,42,0.85)';
    ctx.beginPath();
    ctx.roundRect(-bodyR * 0.5, -bodyR * 0.86, bodyR * 1.0, bodyR * 0.5, bodyR * 0.22);
    ctx.fill();
    ctx.fillStyle = '#bff4ff';
    ctx.beginPath();
    ctx.roundRect(-bodyR * 0.34, -bodyR * 0.76, bodyR * 0.26, bodyR * 0.16, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(bodyR * 0.08, -bodyR * 0.76, bodyR * 0.26, bodyR * 0.16, 3);
    ctx.fill();

    // destello al recibir daño
    if (p.flash > 0) {
      ctx.globalAlpha = p.flash * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-bodyR * 0.78, -bodyR * 1.25, bodyR * 1.56, bodyR * 2.5, bodyR * 0.72);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    this._drawHealthBar(p, x, y - p.radius * 1.9, 34);
  }

  _drawEnemy(e, t) {
    if (!e.alive) return;
    const ctx = this.ctx;
    const x = e.pos.x, y = e.pos.y;
    const bob = Math.sin(e.bob * 1.3) * 1.2;
    const s = 1 + e.scalePulse * 0.22;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(s, s);

    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, e.radius * 0.95 + 6, e.radius * 0.95, e.radius * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // cuerpo romboidal
    const R = e.radius;
    const grad = ctx.createLinearGradient(0, -R * 1.3, 0, R * 1.3);
    grad.addColorStop(0, '#ff8b8b');
    grad.addColorStop(1, e.color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -R * 1.25);
    ctx.lineTo(R * 0.98, 0);
    ctx.lineTo(0, R * 1.15);
    ctx.lineTo(-R * 0.98, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // núcleo
    const coreR = R * 0.34 * (1 + 0.10 * Math.sin(t * 4 + e.bob));
    ctx.fillStyle = '#fff0a8';
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,90,90,0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 0.48, 0, Math.PI * 2);
    ctx.fill();

    // antenas
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-R * 0.4, -R * 1.0); ctx.lineTo(-R * 0.62, -R * 1.5);
    ctx.moveTo(R * 0.4, -R * 1.0);  ctx.lineTo(R * 0.62, -R * 1.5);
    ctx.stroke();
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath(); ctx.arc(-R * 0.62, -R * 1.55, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.62, -R * 1.55, 2.6, 0, Math.PI * 2); ctx.fill();

    // marca de boss
    if (e.isBoss) {
      ctx.strokeStyle = '#ffd45e';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.45, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (e.flash > 0) {
      ctx.globalAlpha = e.flash * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -R * 1.25);
      ctx.lineTo(R * 0.98, 0);
      ctx.lineTo(0, R * 1.15);
      ctx.lineTo(-R * 0.98, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // telegrafía del boss: flecha parpadeante
    if (e.telegraphAngle !== null && e.telegraphAngle !== undefined) {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 12);
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(e.telegraphAngle) * 90, Math.sin(e.telegraphAngle) * 90);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
    this._drawHealthBar(e, x, y - e.radius * 1.9, e.isBoss ? 58 : 32, '#ff5d6c');
  }

  _drawHealthBar(ent, cx, cy, width = 32, color = null) {
    const ctx = this.ctx;
    const h = 5;
    const x = cx - width / 2;
    const pct = clamp(ent.hpPct, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(6,14,26,0.72)';
    ctx.beginPath();
    ctx.roundRect(x - 1, cy - 1, width + 2, h + 2, 3.5);
    ctx.fill();
    ctx.fillStyle = color || (pct > 0.5 ? '#5ee88f' : pct > 0.25 ? '#ffc94d' : '#ff5d6c');
    ctx.beginPath();
    ctx.roundRect(x, cy, Math.max(2, width * pct), h, 2.5);
    ctx.fill();
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════
  //  BALAS
  // ══════════════════════════════════════════════════════════════════
  drawProjectiles(world) {
    this._reset();
    const ctx = this.ctx;
    for (const pr of world.projectiles) {
      // estela
      ctx.save();
      for (let i = 0; i < pr.trail.length; i++) {
        const tp = pr.trail[i];
        const a = clamp(tp.life, 0, 1) * (i / pr.trail.length);
        if (a <= 0) continue;
        ctx.globalAlpha = a * 0.7;
        ctx.fillStyle = COLORS.projectileGlow;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 1.5 + a * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // núcleo
      ctx.save();
      ctx.shadowColor = COLORS.projectile;
      ctx.shadowBlur = 16;
      ctx.fillStyle = COLORS.projectileGlow;
      ctx.beginPath();
      ctx.arc(pr.pos.x, pr.pos.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pr.pos.x, pr.pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  TEXTO FLOTANTE
  // ══════════════════════════════════════════════════════════════════
  drawFloatingText(items) {
    if (!items || !items.length) return;
    this._reset();
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of items) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `${f.big ? 700 : 600} ${f.big ? 20 : 16}px "Segoe UI", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(4,12,24,0.8)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color || '#ffffff';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }
}

export default Renderer;
