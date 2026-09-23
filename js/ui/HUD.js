// ═══ archivo: js/ui/HUD.js ═══
// Interfaz durante el juego: tarjetas de personaje, botones de acción,
// indicador de turno. Todo dibujado en canvas para que escale con el juego.

import { GRID, ACTION, ECONOMY } from '../utils/Constants.js';
import { clamp } from '../utils/Math.js';

const BAR_H = 84;

export class HUD {
  constructor(game) {
    this.game = game;
    this.buttons = [];
    this.scale = 1;
  }

  setScale(s) { this.scale = s; }
  get W() { return GRID.COLS * GRID.TILE; }
  get H() { return GRID.ROWS * GRID.TILE; }

  draw(world, uiState) {
    const ctx = this.game.ctx;
    ctx.save();
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.buttons = [];

    this._drawTopBar(world);
    this._drawCards(world, uiState.selected);
    this._drawActionButtons(world, uiState);
    if (world.turns.banner) this._drawBanner(world.turns.banner);

    ctx.restore();
  }

  // ── barra superior ─────────────────────────────────────────────────
  _drawTopBar(world) {
    const ctx = this.game.ctx;
    const t = world.turns;
    const y = 8;

    this._panel(8, y, 232, 40, 'rgba(6,16,30,0.66)');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#eaf6ff';
    ctx.fillText(`NIVEL ${world.levelNumber}`, 20, y + 20);

    ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = t.side === 'player' ? '#7ff0ef' : '#ff9aa2';
    ctx.fillText(t.side === 'player' ? 'TU TURNO' : 'ENEMIGO', 104, y + 20);

    const limit = world.levelData.turnLimit;
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#a9bcd8';
    ctx.fillText(limit ? `${t.turnNumber}/${limit}` : `Turno ${t.turnNumber}`, 178, y + 20);

    const rx = this.W - 8;
    this._panel(rx - 208, y, 208, 40, 'rgba(6,16,30,0.66)');
    ctx.textAlign = 'right';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffd45e';
    ctx.fillText(`◈ ${this.game.save.data.coins}`, rx - 112, y + 20);
    ctx.fillStyle = '#9ee7a8';
    ctx.fillText(`✦ ${world.xpRun} XP`, rx - 20, y + 20);
  }

  // ── tarjetas de personaje ──────────────────────────────────────────
  _drawCards(world, selected) {
    const ctx = this.game.ctx;
    const y = this.H - BAR_H - 6;
    this._panel(0, y, this.W, BAR_H + 6, 'rgba(4,12,24,0.74)');

    const players = world.players;
    const cardW = Math.min(152, (this.W - 340) / Math.max(1, players.length));
    let x = 12;

    for (const p of players) {
      const r = { x, y: y + 12, w: cardW, h: BAR_H - 20 };
      const isSel = p === selected;

      ctx.save();
      ctx.globalAlpha = p.alive ? 1 : 0.42;
      ctx.fillStyle = isSel ? 'rgba(38,62,104,0.96)' : 'rgba(18,30,54,0.9)';
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill();
      ctx.strokeStyle = isSel ? 'rgba(200,244,255,0.92)' : 'rgba(90,120,170,0.42)';
      ctx.lineWidth = isSel ? 2.2 : 1.2;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.roundRect(r.x + 7, r.y + 7, 6, r.h - 14, 3); ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = p.alive ? '#f2f8ff' : '#7b8aa6';
      ctx.fillText(p.name, r.x + 21, r.y + 8);

      ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#93a8c6';
      ctx.fillText(`${p.hp}/${p.maxHp}`, r.x + 21, r.y + 25);

      const bx = r.x + 21, by = r.y + 39, bw = r.w - 33;
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, 6, 3); ctx.fill();
      const pct = clamp(p.hpPct, 0, 1);
      ctx.fillStyle = pct > 0.5 ? '#5ee88f' : pct > 0.25 ? '#ffc94d' : '#ff5d6c';
      ctx.beginPath(); ctx.roundRect(bx, by, Math.max(2, bw * pct), 6, 3); ctx.fill();

      const ax = r.x + 21, ay = r.y + 54;
      this._dot(ax, ay, !p.hasMoved && p.alive, '#7ff0ef');
      this._dot(ax + 17, ay, !p.hasShot && p.alive, '#ffd45e');
      ctx.font = '700 9px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#8fa3c0';
      ctx.fillText('MOV', ax + 26, ay - 4);
      ctx.fillText('TIR', ax + 57, ay - 4);

      x += cardW + 8;
    }
  }

  _dot(x, y, on, color) {
    const ctx = this.game.ctx;
    ctx.fillStyle = on ? color : 'rgba(120,140,170,0.28)';
    ctx.beginPath(); ctx.arc(x, y + 2, 5, 0, Math.PI * 2); ctx.fill();
    if (on) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  // ── botones ────────────────────────────────────────────────────────
  _drawActionButtons(world, uiState) {
    const ctx = this.game.ctx;
    const y = this.H - BAR_H - 58;
    const canAct = world.turns.canInteract && this.game.state === 'playing';
    const p = uiState.selected;
    const btns = [];

    if (uiState.mode === ACTION.AIM) {
      btns.push({ label: 'DISPARAR ▶', id: 'fire', x: 0, y, w: 140, h: 46, enabled: true, color: '#5ee88f' });
      btns.push({ label: '✕ CANCELAR', id: 'cancel', x: 0, y, w: 130, h: 46, enabled: true, color: '#ff8f8f' });
    } else {
      btns.push({ label: 'APUNTAR ◎', id: 'aim', x: 0, y, w: 138, h: 46,
        enabled: canAct && !!p && p.alive && !p.hasShot, color: '#ffd45e' });
      const hintOk = !world.hintUsedThisLevel && this.game.save.data.coins >= ECONOMY.HINT_COST;
      btns.push({ label: `PISTA ◈${ECONOMY.HINT_COST}`, id: 'hint', x: 0, y, w: 138, h: 46,
        enabled: canAct && hintOk, color: '#c9a6ff' });
    }
    btns.push({ label: 'TERMINAR TURNO', id: 'endTurn', x: 0, y, w: 176, h: 46,
      enabled: canAct, color: '#4dd6ff' });

    let rx = this.W - 12;
    for (const b of btns) {
      b.x = rx - b.w;
      rx -= b.w + 8;
      this._button(b);
      this.buttons.push(b);
    }

    const msg = this._contextHint(world, uiState);
    if (msg) {
      this._panel(12, y + 5, 260, 36, 'rgba(6,16,30,0.62)');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#a9c3e0';
      ctx.fillText(msg, 24, y + 23);
    }
  }

  _contextHint(world, uiState) {
    if (this.game.state === 'resolving') return 'Resolviendo...';
    if (world.turns.side !== 'player') return 'Turno enemigo';
    if (uiState.mode === ACTION.AIM) return 'Arrastra para apuntar • Pulsa DISPARAR';
    const p = uiState.selected;
    if (!p) return 'Toca un personaje para empezar';
    if (p.hasMoved && p.hasShot) return 'Este personaje ya actuó';
    if (!p.hasMoved) return 'Toca una casilla iluminada para moverte';
    return 'Pulsa APUNTAR para disparar';
  }

  _button(b) {
    const ctx = this.game.ctx;
    ctx.save();
    ctx.globalAlpha = b.enabled ? 1 : 0.34;
    ctx.fillStyle = 'rgba(10,22,40,0.92)';
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 11); ctx.fill();
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = b.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
    ctx.restore();
  }

  /** ¿Qué botón está bajo el punto? Devuelve el id o null. */
  hitTest(x, y) {
    for (const b of this.buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return b.enabled ? b.id : null;
      }
    }
    return null;
  }

  _panel(x, y, w, h, color) {
    const ctx = this.game.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(120,170,220,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  _drawBanner(banner) {
    const ctx = this.game.ctx;
    const k = banner.t / 1.25;
    const a = k < 0.15 ? k / 0.15 : k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 52px "Segoe UI", system-ui, sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(4,12,24,0.78)';
    ctx.strokeText(banner.text, this.W / 2, this.H / 2 - 20);
    ctx.fillStyle = banner.color;
    ctx.fillText(banner.text, this.W / 2, this.H / 2 - 20);
    ctx.restore();
  }
}

export default HUD;
