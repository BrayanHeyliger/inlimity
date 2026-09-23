// ═══ archivo: js/core/GameManager.js ═══
// Orquestador: construye el mundo, gestiona turnos, entrada, render y menús.
// Es el único sitio que conoce todas las piezas a la vez.

import { Grid } from '../levels/Grid.js';
import { LevelLoader } from '../levels/LevelLoader.js';
import { BallisticsSystem } from '../systems/BallisticsSystem.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';

import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';

import { TurnManager } from './TurnManager.js';
import { InputManager } from './InputManager.js';
import { SaveSystem } from './SaveSystem.js';
import { AudioManager } from './AudioManager.js';

import { Renderer } from '../ui/Renderer.js';
import { UIRenderer } from '../ui/UIRenderer.js';
import { HUD } from '../ui/HUD.js';
import { Menu } from '../ui/Menu.js';

import { Vector2 } from '../utils/Vector2.js';
import { GRID, TILE, GAME, ACTION, BALLISTICS, ECONOMY } from '../utils/Constants.js';
import { clamp, chebyshev, easeOutCubic } from '../utils/Math.js';

const enumState = {
  BOOT: 'boot', MENU: 'menu', PLAYING: 'playing',
  RESOLVING: 'resolving', VICTORY: 'victory', DEFEAT: 'defeat', PAUSED: 'paused',
};

export class GameManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = enumState.BOOT;

    this.save = new SaveSystem();
    this.audio = new AudioManager();
    this.audio.setEnabled(this.save.getOption('sound') !== false);

    this.renderer = new Renderer(this.ctx);
    this.ui = new UIRenderer(this.ctx);
    this.hud = new HUD(this);
    this.menu = new Menu(this);

    this.input = null;
    this.world = null;
    this.time = 0;
    this.lastTs = 0;
    this.fps = 60;
    this._fpsAcc = 0;
    this._fpsFrames = 0;

    // Estado de interacción del jugador
    this.selectedPlayer = null;
    this.mode = ACTION.NONE;
    this.aimAngle = 0;
    this.aimFrom = null;
    this.preview = null;
    this.moveTiles = new Map();
    this.hintTiles = null;
    this.floatingText = [];
    this.toastEl = document.getElementById('toast');
    this._toastTimer = null;

    this._shake = { amount: 0, t: 0, dur: 0 };
    this._bindInput();
    this._bindResize();
    this.menu.show('main');
    this.state = enumState.MENU;
  }

  // ══════════════════════════════════════════════════════════════════
  //  INPUT
  // ══════════════════════════════════════════════════════════════════
  _bindInput() {
    this.input = new InputManager(this.canvas, {
      onDown: (p) => this._onDown(p),
      onDrag: (p) => this._onDrag(p),
      onDragEnd: (p) => this._onDragEnd(p),
      onTap: (p) => this._onTap(p),
      onKey: (k, e) => this._onKey(k, e),
    });
  }

  get _playing() { return this.state === enumState.PLAYING && this.world && !this.world.gameOver; }

  _onDown(p) {
    this.audio.resume();
    if (!this._playing) return;
    if (!this.world.turns.canInteract) return;
    if (this.hintTiles && this.hintTiles.length) this.hintTiles = null;

    // Si estamos apuntando, cualquier toque fuera del jugador confirma el tiro.
    if (this.mode === ACTION.AIM) return;

    const cell = this.world.grid.cellAtPx(p.x, p.y);
    const clicked = this.world.collisions.entityAtCell(this.world.players, cell.cx, cell.cy);
    if (clicked && clicked.alive) {
      this.selectPlayer(clicked);
    } else if (this.selectedPlayer) {
      // Toque en casilla alcanzable → mover.
      if (this.moveTiles.has(`${cell.cx},${cell.cy}`)) {
        this.moveSelectedTo(cell.cx, cell.cy);
        return;
      }
      // Toque lejos → empezar a apuntar desde ese punto.
      this.startAim(p);
    }
  }

  _onDrag(p) {
    if (!this._playing || this.mode !== ACTION.AIM) return;
    this._updateAimAngle(p);
  }

  _onDragEnd(p) {
    if (!this._playing || this.mode !== ACTION.AIM) return;
    this._updateAimAngle(p);
    this.confirmShot();
  }

  _onTap(p) {
    if (!this._playing) return;
    if (this.mode === ACTION.AIM) { this._updateAimAngle(p); this.confirmShot(); return; }
    const cell = this.world.grid.cellAtPx(p.x, p.y);
    const clicked = this.world.collisions.entityAtCell(this.world.players, cell.cx, cell.cy);
    if (clicked && clicked.alive) this.selectPlayer(clicked);
    else if (this.moveTiles.has(`${cell.cx},${cell.cy}`)) this.moveSelectedTo(cell.cx, cell.cy);
  }

  _onKey(key, e) {
    if (key === 'Escape') {
      if (this.state === enumState.PAUSED) this.resume();
      else if (this._playing) this.pause();
      else if (this.state === enumState.MENU) this.menu.back();
      return;
    }
    if (this.state === enumState.MENU) return;
    if (!this._playing) return;

    const p = this.selectedPlayer;
    switch (key.toLowerCase()) {
      case 'tab':
        e.preventDefault();
        this.cyclePlayer();
        break;
      case ' ':
        this.endTurn();
        break;
      case 'enter':
        if (this.mode === ACTION.AIM) this.confirmShot();
        break;
      case 'h':
        this.useHint();
        break;
      case '1': case '2': case '3': case '4': {
        const idx = Number(key) - 1;
        if (this.world.players[idx]?.alive) this.selectPlayer(this.world.players[idx]);
        break;
      }
      case 'arrowup':    if (p) this._nudgeMove(p, 0, -1); break;
      case 'arrowdown':  if (p) this._nudgeMove(p, 0, 1);  break;
      case 'arrowleft':  if (p) this._nudgeMove(p, -1, 0); break;
      case 'arrowright': if (p) this._nudgeMove(p, 1, 0);  break;
      default: break;
    }
  }

  _nudgeMove(p, dx, dy) {
    if (!p.alive || p.hasMoved) return;
    const nx = p.cx + dx, ny = p.cy + dy;
    if (!this.world.collisions.canEnter(this.world.grid, nx, ny, this.world.players, p)) {
      this.audio.error();
      return;
    }
    p.moveAlong([{ x: nx, y: ny }]);
    p.hasMoved = true;
    this.audio.move();
    this._recomputeMoveTiles();
  }

  // ══════════════════════════════════════════════════════════════════
  //  SELECCIÓN Y ACCIONES
  // ══════════════════════════════════════════════════════════════════
  selectPlayer(p) {
    if (!p || !p.alive) return;
    this.selectedPlayer = p;
    this.mode = ACTION.NONE;
    this.preview = null;
    this.audio.select();
    this._recomputeMoveTiles();
  }

  cyclePlayer() {
    const alive = this.world.players.filter((p) => p.alive);
    if (!alive.length) return;
    const i = alive.indexOf(this.selectedPlayer);
    this.selectPlayer(alive[(i + 1) % alive.length]);
  }

  _recomputeMoveTiles() {
    this.moveTiles.clear();
    const p = this.selectedPlayer;
    if (!p || !p.alive || p.hasMoved) return;
    const occupied = this.world.collisions.occupiedKeys([...this.world.enemies], p);
    const reach = this.world.grid.reachable(p.cx, p.cy, p.movement, occupied);
    this.moveTiles = reach;
  }

  moveSelectedTo(cx, cy) {
    const p = this.selectedPlayer;
    if (!p || p.hasMoved) return;
    const occupied = this.world.collisions.occupiedKeys([...this.world.enemies], p);
    const path = this.world.grid.findPath(p.cx, p.cy, cx, cy, occupied);
    if (!path || !path.length) { this.audio.error(); return; }
    p.moveAlong(path);
    p.hasMoved = true;
    this.moveTiles.clear();
    this.audio.move();
  }

  /** Entra en modo apuntado desde la posición del jugador seleccionado. */
  startAim(fromPoint) {
    const p = this.selectedPlayer;
    if (!p || !p.alive || p.hasShot) return;
    this.mode = ACTION.AIM;
    this.aimFrom = p;
    this._updateAimAngle(fromPoint || new Vector2(p.pos.x + 40, p.pos.y));
    this.input.lock();               // el siguiente gesto confirma el tiro
  }

  cancelAim() {
    this.mode = ACTION.NONE;
    this.preview = null;
    this.input.unlock();
  }

  _updateAimAngle(point) {
    const p = this.aimFrom || this.selectedPlayer;
    if (!p) return;
    const dx = point.x - p.pos.x, dy = point.y - p.pos.y;
    if (Math.hypot(dx, dy) < 4) return;
    this.aimAngle = Math.atan2(dy, dx);
    this.preview = this.world.combat.preview(p, this.aimAngle);
  }

  confirmShot() {
    const p = this.aimFrom || this.selectedPlayer;
    if (!p || !p.alive || p.hasShot || this.mode !== ACTION.AIM) return;
    this.input.unlock();
    this.mode = ACTION.RESOLVING;
    p.hasShot = true;
    this.audio.resume();
    this.world.combat.fire(p, this.aimAngle);
    this.preview = null;
    this.state = enumState.RESOLVING;
    this.world.turns.action = ACTION.RESOLVING;
  }

  /** Edge case 10: botón Pista. Muestra el tiro ideal si hay monedas. */
  useHint() {
    const p = this.selectedPlayer;
    if (!p || !p.alive) { this.toast('Selecciona un personaje primero'); return; }
    if (this.world.hintUsedThisLevel) { this.toast('Ya usaste la pista en este nivel'); return; }
    if (this.save.data.coins < ECONOMY.HINT_COST) {
      this.toast(`Necesitas ${ECONOMY.HINT_COST} monedas`);
      this.audio.error();
      return;
    }
    const targets = this.world.enemies.filter((e) => e.alive);
    let best = null;
    for (const t of targets) {
      const r = this.world.ballistics.findBestShot(p.pos, t, {
        ...p.traceOptions([...this.world.players, ...this.world.enemies]),
        samples: 720,
      });
      if (r && (!best || r.score > best.score)) best = r;
    }
    if (!best) { this.toast('Sin solución desde esta posición'); this.audio.error(); return; }

    this.save.spend(ECONOMY.HINT_COST);
    this.world.hintUsedThisLevel = true;
    this.hintTiles = best.result.points;
    this.aimAngle = best.angle;
    this.mode = ACTION.AIM;
    this.aimFrom = p;
    this.preview = best.result;
    this.input.lock();
    this.toast('¡Pista desbloqueada! Toca para disparar');
    this.audio.coin();
  }

  endTurn() {
    if (!this._playing) return;
    if (!this.world.turns.canInteract) return;
    this.cancelAim();
    this.moveTiles.clear();
    this.world.turns.endPlayerTurn();
    this.state = enumState.RESOLVING;
    this.world.resolveEnemyStep();
  }

  // ══════════════════════════════════════════════════════════════════
  //  FLUJO DE NIVEL
  // ══════════════════════════════════════════════════════════════════
  startLevel(levelNumber) {
    const loader = new LevelLoader();
    const level = loader.load(levelNumber);
    const grid = Grid.fromLayout(level.layout, TILE);

    const ballistics = new BallisticsSystem(grid);
    const collisions = new CollisionSystem(grid);
    const particles = new ParticleSystem();

    const world = {
      levelNumber,
      levelData: level,
      grid, ballistics, collisions, particles,
      players: [], enemies: [], projectiles: [],
      turns: null, ai: null, combat: null,
      gameOver: false, result: null,
      xpRun: 0, stats: { totalShots: 0, totalBounces: 0, kills: 0 },
      hintUsedThisLevel: false,
      currentShooter: null, currentTrace: null, lastOutcome: null,
      floatingText: [],
      shake: (amount, dur) => this.shake(amount, dur),
      audio: this.audio,
      showFloatingText: (x, y, text, color) => {
        this.floatingText.push({ x, y, text, color, life: 1.1, maxLife: 1.1, big: false });
      },
      onResolutionDone: null,
    };

    // ── jugadores ────────────────────────────────────────────────────
    const upgrades = this.save.data.upgrades;
    const unlocked = this.save.data.unlockedChars;
    const squad = level.squad && level.squad.length
      ? level.squad
      : unlocked.slice(0, 3);
    squad.forEach((charId, i) => {
      const spawn = level.playerSpawns?.[i] || { cx: 1, cy: 1 + i };
      const p = new Player(charId, spawn, upgrades);
      world.players.push(p);
    });

    // ── enemigos ─────────────────────────────────────────────────────
    for (const e of level.enemies) {
      const en = new Enemy(e.type, { cx: e.cx, cy: e.cy }, level.scaling || 1);
      world.enemies.push(en);
    }

    // ── sistemas ─────────────────────────────────────────────────────
    world.ai = new AISystem(grid, ballistics);
    world.ai.world = world;
    world.combat = new CombatSystem(world);
    world.turns = new TurnManager(world, {
      onTurnStart: (side) => this._onTurnStart(side),
    });
    this.world = world;

    this.selectedPlayer = null;
    this.mode = ACTION.NONE;
    this.preview = null;
    this.moveTiles.clear();
    this.floatingText = [];
    this.hintTiles = null;

    this.state = enumState.PLAYING;
    this.menu.hide();
    this.world.turns.startPlayerTurn();
    this.selectPlayer(world.players.find((p) => p.alive) || null);
    this.save.data.stats.levelsPlayed++;
    this.save.save();
  }

  _onTurnStart(side) {
    this.world.players.forEach((p) => p.resetTurnFlags());
    this.world.enemies.forEach((e) => e.resetTurnFlags());
    // Edge case 6: autoguardado al inicio de cada turno.
    this.save.save(true);
  }

  restartLevel() {
    if (this.world) this.startLevel(this.world.levelNumber);
    else this.menu.show('main');
  }

  pause() {
    if (!this._playing) return;
    this.state = enumState.PAUSED;
    this.menu.show('pause');
    this.input.setEnabled(false);
  }

  resume() {
    if (this.state !== enumState.PAUSED) return;
    this.state = enumState.PLAYING;
    this.menu.hide();
    this.input.setEnabled(true);
    this.audio.resume();
  }

  quitToMenu() {
    this.world = null;
    this.state = enumState.MENU;
    this.input.setEnabled(true);
    this.menu.show('main');
  }

  _endLevel(victory, reason) {
    if (!this.world || this.world.gameOver) return;
    this.world.gameOver = true;
    this.world.result = { victory, reason };

    if (victory) {
      const stars = this._computeStars();
      const meta = {
        kills: this.world.stats.kills,
        turnsSaved: Math.max(0, (this.world.levelData.turnLimit || 99) - this.world.turns.turnNumber),
        xp: this.world.xpRun,
        score: this.world.xpRun + stars * 100,
        shots: this.world.stats.totalShots,
        bounces: this.world.stats.totalBounces,
      };
      const reward = this.save.completeLevel(this.world.levelNumber, stars, meta);
      this.world.reward = reward;
      this.state = enumState.VICTORY;
      this.audio.victory();
      this.menu.showVictory({ stars, reward, stats: this.world.stats, xp: this.world.xpRun });
    } else {
      this.state = enumState.DEFEAT;
      this.audio.defeat();
      this.menu.showDefeat(reason);
    }
    this.input.setEnabled(false);
  }

  _computeStars() {
    const w = this.world;
    const allAlive = w.players.every((p) => p.alive);
    const limit = w.levelData.turnLimit || 99;
    let stars = 1;
    if (allAlive) stars++;
    if (w.turns.turnNumber <= limit) stars++;
    return clamp(stars, 1, 3);
  }

  // ══════════════════════════════════════════════════════════════════
  //  BUCLE PRINCIPAL
  // ══════════════════════════════════════════════════════════════════
  start() {
    this.lastTs = performance.now();
    const loop = (ts) => {
      const dt = Math.min((ts - this.lastTs) / 1000, GAME.MAX_DT);
      this.lastTs = ts;
      this._fpsAcc += dt; this._fpsFrames++;
      if (this._fpsAcc >= 0.5) {
        this.fps = Math.round(this._fpsFrames / this._fpsAcc);
        this._fpsAcc = 0; this._fpsFrames = 0;
      }
      this.update(dt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    this.time += dt;
    if (this._shake.t > 0) {
      this._shake.t -= dt;
      if (this._shake.t <= 0) this._shake.amount = 0;
    }
    this._updateFloatingText(dt);

    if (!this.world) return;
    const w = this.world;

    w.players.forEach((p) => p.update(dt));
    w.enemies.forEach((e) => e.update(dt));
    w.particles.update(dt);

    // proyectiles
    for (let i = w.projectiles.length - 1; i >= 0; i--) {
      const pr = w.projectiles[i];
      pr.update(dt);
      if (pr.alive && Math.random() < 0.6) {
        w.particles.trailPuff(pr.pos.x, pr.pos.y, '#fff3c4');
      }
      if (!pr.alive) w.projectiles.splice(i, 1);
    }

    w.turns.update(dt);

    if (this.state === enumState.RESOLVING) {
      const busy = w.projectiles.length > 0 || w.turns.busy || w.turns._wait > 0 ||
                   w.players.some((p) => p.isMoving) || w.enemies.some((e) => e.isMoving);
      if (!busy) this._onResolutionComplete();
    }

    this._checkEndConditions();
  }

  _onResolutionComplete() {
    const w = this.world;

    if (w.turns.isPlayerTurn) {
      // Volvemos al control del jugador.
      this.state = enumState.PLAYING;
      w.turns.action = ACTION.NONE;
      if (this.selectedPlayer && !this.selectedPlayer.alive) {
        this.selectPlayer(w.players.find((p) => p.alive) || null);
      }
      this._recomputeMoveTiles();
      const anyoneCanAct = w.players.some((p) => p.alive && (!p.hasMoved || !p.hasShot));
      if (!anyoneCanAct) this.endTurn();
      return;
    }

    // Turno enemigo: ejecutamos la siguiente acción planificada.
    const action = w.turns.nextEnemyAction();
    if (action) {
      this._executeEnemyAction(action);
    } else {
      w.turns.finishEnemyTurn();
      this.state = enumState.PLAYING;
      this.selectPlayer(this.selectedPlayer?.alive ? this.selectedPlayer
        : (w.players.find((p) => p.alive) || null));
      this._recomputeMoveTiles();
    }
  }

  _executeEnemyAction(action) {
    const { enemy, plan } = action;
    if (!enemy || !enemy.alive) return;

    const after = () => {
      if (plan.shot) {
        this._enemyShoot(enemy, plan.shot);
      } else {
        this.state = enumState.RESOLVING;   // fuerza otro paso de resolución
        this.world.turns._wait = 0.28;
      }
    };

    if (plan.move && plan.move.length) {
      enemy.moveAlong(plan.move);
      enemy.hasMoved = true;
      const travel = plan.move.length * 0.14 + 0.12;
      setTimeout(after, Math.min(900, travel * 1000));
    } else {
      after();
    }
  }

  _enemyShoot(enemy, shot) {
    if (shot.telegraph) {
      enemy.telegraphAngle = shot.angle;
      this.toast(`${enemy.name} está cargando un ataque...`);
      this.world.turns._wait = 0.5;
      return;
    }
    if (shot.spread) {
      this.world.combat.fireSpread(enemy, shot.spread);
    } else {
      this.world.combat.fire(enemy, shot.angle);
    }
    this.world.turns._wait = 0.25;
    enemy.hasShot = true;
  }

  _checkEndConditions() {
    const w = this.world;
    if (!w || w.gameOver) return;
    if (w.enemies.every((e) => !e.alive)) {
      this._endLevel(true, 'Todos los enemigos eliminados');
      return;
    }
    if (w.players.every((p) => !p.alive)) {
      this._endLevel(false, 'Todo el escuadrón ha caído');
      return;
    }
    const limit = w.levelData.turnLimit;
    if (limit && w.turns.turnNumber > limit) {
      this._endLevel(false, `Se agotaron los ${limit} turnos`);
    }
  }

  _updateFloatingText(dt) {
    for (let i = this.floatingText.length - 1; i >= 0; i--) {
      const f = this.floatingText[i];
      f.life -= dt;
      f.y -= dt * 26;
      if (f.life <= 0) this.floatingText.splice(i, 1);
    }
  }

  shake(amount, dur) {
    this._shake.amount = Math.max(this._shake.amount, amount);
    this._shake.t = Math.max(this._shake.t, dur);
    this._shake.dur = dur;
  }

  // ══════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════
  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.world) {
      ctx.save();
      if (this._shake.t > 0) {
        const k = this._shake.t / (this._shake.dur || 1);
        const a = this._shake.amount * k;
        ctx.translate((Math.random() - 0.5) * a * 2, (Math.random() - 0.5) * a * 2);
      }
      this.renderer.drawBoard(this.world, this.time);
      this.renderer.drawMoveTiles(this.world, this.moveTiles);
      this.renderer.drawHint(this.hintTiles, this.time);
      this.renderer.drawPreview(this.preview, this.time);
      this.renderer.drawEntities(this.world, this.time, this.selectedPlayer);
      this.renderer.drawProjectiles(this.world);
      this.world.particles.draw(ctx);
      this.renderer.drawFloatingText(this.floatingText);
      ctx.restore();

      this.hud.draw(this.world, {
        selected: this.selectedPlayer,
        mode: this.mode,
        aimAngle: this.aimAngle,
        preview: this.preview,
        fps: this.fps,
        hintTiles: this.hintTiles,
      });
    } else {
      this.renderer.drawMenuBackdrop(this.time);
    }
  }

  resolveEnemyStep() { /* compatibilidad: la cola se resuelve en el bucle */ }

  // ══════════════════════════════════════════════════════════════════
  //  UTILIDADES UI
  // ══════════════════════════════════════════════════════════════════
  toast(msg, ms = 1800) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  _bindResize() {
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const availW = window.innerWidth;
      const availH = window.innerHeight;
      const ratio = GAME.BASE_W / GAME.BASE_H;

      let w = availW, h = w / ratio;
      if (h > availH) { h = availH; w = h * ratio; }

      this.canvas.style.width = `${Math.floor(w)}px`;
      this.canvas.style.height = `${Math.floor(h)}px`;
      this.canvas.width = Math.floor(GAME.BASE_W * dpr);
      this.canvas.height = Math.floor(GAME.BASE_H * dpr);
      this.scale = (this.canvas.width / GAME.BASE_W);
      this.hud.setScale(this.scale);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.renderer.setScale(this.scale);
      this.ui.setScale(this.scale);
    };
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', () => setTimeout(fit, 120));
    fit();
  }
}

export { enumState };
export default GameManager;
