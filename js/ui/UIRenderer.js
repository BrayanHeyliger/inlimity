// ═══ archivo: js/ui/UIRenderer.js ═══
// Capa de contexto 2D para elementos sueltos (marco del tablero, viñeta,
// pantalla de carga). Se mantiene separada del Renderer para que éste
// pueda recibir sprites en el futuro sin arrastrar dependencias de UI.

import { GRID, COLORS } from '../utils/Constants.js';

export class UIRenderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.scale = 1;
  }

  setScale(s) { this.scale = s; }

  get W() { return GRID.COLS * GRID.TILE; }
  get H() { return GRID.ROWS * GRID.TILE; }

  /** Marco decorativo y viñeta; se llama al final de cada frame de juego. */
  drawFrame() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // viñeta
    const g = ctx.createRadialGradient(
      this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.30,
      this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.72
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(2,8,18,0.52)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    // marco
    ctx.strokeStyle = 'rgba(120,180,230,0.20)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(1, 1, this.W - 2, this.H - 2, 14);
    ctx.stroke();

    ctx.restore();
  }

  /** Pantalla de carga simple entre niveles. */
  drawLoading(progress, label) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.fillStyle = 'rgba(4,10,22,0.86)';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#eaf6ff';
    ctx.fillText(label || 'Cargando…', this.W / 2, this.H / 2 - 18);

    const bw = 240, bh = 8, bx = this.W / 2 - bw / 2, by = this.H / 2 + 14;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 4); ctx.fill();
    ctx.fillStyle = COLORS.projectile;
    ctx.beginPath(); ctx.roundRect(bx, by, bw * Math.max(0, Math.min(1, progress)), bh, 4); ctx.fill();

    ctx.restore();
  }

  /** Texto grande centrado, usado para mensajes de sistema. */
  drawCenterText(text, sub, color = '#eaf6ff') {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 40px "Segoe UI", system-ui, sans-serif';
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(3,10,20,0.8)';
    ctx.strokeText(text, this.W / 2, this.H / 2 - 14);
    ctx.fillStyle = color;
    ctx.fillText(text, this.W / 2, this.H / 2 - 14);
    if (sub) {
      ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#a9c3e0';
      ctx.fillText(sub, this.W / 2, this.H / 2 + 26);
    }
    ctx.restore();
  }
}

export default UIRenderer;
