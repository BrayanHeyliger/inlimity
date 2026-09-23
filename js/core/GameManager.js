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
import { TILE, GAME, ACTION, ECONOMY } from '../utils/Constants.js';
import { clamp, chebyshev } from '../utils/Math.js';

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
    this.scale = 1;
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
    this._enemyTimer = null;

    this._shake = { amount: 0, t: 0, dur: 1 };
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

  get _playing() {
    return (this.state === enumState.PLAYING || this.state === enumState.RESOLVING) &&
           this.world && !this.world.gameOver;
  }

  _onDown(p) {
    this.audio.resume();
    if (!this._playing) return;

    // Botones del HUD primero (se dibujan en canvas, hay que testearlos a mano).
    const btn = this.hud.hitTest(p.x, p.y);
    if (btn) { this._handleButton(btn); return; }

    if (this.state !== enumState.PLAYING) return;
    if (!this.world.turns || !this.world.turns.canInteract) return;
    if (this.hintTiles && this.hintTiles.length) this.hintTiles = null;

    if (this.mode === ACTION.AIM) return;

    const cell = this.world.grid.cellAtPx(p.x, p.y);
    const clicked = this.world.collisions.entityAtCell(this.world.players, cell.cx, cell.cy);
    if (clicked && clicked.alive) {
      this.selectPlayer(clicked);
    } else if (this.selectedPlayer) {
      const key = `${cell.cx},${cell.cy}`;
      if (this.moveTiles.has(key)) { this.moveSelectedTo(cell.cx, cell.cy); return; }
      this.startAim(p);
    }
  }

  _onDrag(p) {
    if (this.state !== enumState.PLAYING || this.mode !== ACTION.AIM) return;
    this._updateAimAngle(p);
  }

  _onDragEnd(p) {
    if (this.state !== enumState.PLAYING || this.mode !== ACTION.AIM) return;
    this._updateAimAngle(p);
    this.confirmShot();
  }

  _onTap(p) {
    if (!this._playing) return;
    const btn = this.hud.hitTest(p.x, p.y);
    if (btn) { this._handleButton(btn); return; }
    if (this.state !== enumState.PLAYING) return;
    if (!this.world.turns || !this.world.turns.canInteract) return;
    if (this.mode === ACTION.AIM) { this._updateAimAngle(p); this.confirmShot(); return; }

    const cell = this.world.grid.cellAtPx(p.x, p.y);
    const clicked = this.world.collisions.entityAtCell(this.world.players, cell.cx, cell.cy);
    if (clicked && clicked.alive) this.selectPlayer(clicked);
    else if (this.moveTiles.has(`${cell.cx},${cell.cy}`)) this.moveSelectedTo(cell.cx, cell.cy);
  }

  _handleButton(id) {
    this.audio.resume();
    switch (id) {
      case 'endTurn': this.endTurn(); break;
      case 'aim':     this.startAim(); break;
      case 'fire':    this.confirmShot(); break;
      case 'cancel':  this.cancelAim(); break;
      case 'hint':    this.useHint(); break;
      default: break;
    }
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

    switch (key.toLowerCase()) {
      case 'tab':   e.preventDefault(); this.cyclePlayer(); break;
      case ' ':     if (this.state === enumState.PLAYING) this.endTurn(); break;
      case 'enter': if (this.mode === ACTION.AIM) this.confirmShot(); break;
      case 'h':     this.useHint(); break;
      case '1': case '2': case '3': case '4': {
        const idx = Number(key) - 1;
        const p = this.world.players[idx];
        if (p && p.alive) this.selectPlayer(p);
        break;
      }
      case 'arrowup':    this._nudgeMove(0, -1); break;
      case 'arrowdown':  this._nudgeMove(0, 1);  break;
      case 'arrowleft':  this._nudgeMove(-1, 0); break;
      case 'arrowright': this._nudgeMove(1, 0);  break;
      default: break;
    }
  }

  _nudgeMove(dx, dy) {
    const p = this.selectedPlayer;
    if (!p || !p.alive || p.hasMoved) return;
    const nx = p.cx + dx, ny = p.cy + dy;
    const entities = [...this.world.players, ...this.world.enemies];
    if (!this.world.collisions.canEnter(this.world.grid, nx, ny, entities, p)) {
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
    this.moveTiles = new Map();
    const p = this.selectedPlayer;
    if (!p || !p.alive || p.hasMoved) return;
    const occupied = this.world.collisions.occupiedKeys(this.world.enemies, p);
    this.moveTiles = this.world.grid.reachable(p.cx, p.cy, p.movement, occupied);
  }

  moveSelectedTo(cx, cy) {
    const p = this.selectedPlayer;
    if (!p || p.hasMoved) return;
    const occupied = this.world.collisions.occupiedKeys(this.world.enemies, p);
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
    if (!p || !p.alive || p.hasShot) { this.audio.error(); return; }
    this.mode = ACTION.AIM;
    this.aimFrom = p;
    const target = fromPoint || new Vector2(p.pos.x + 60, p.pos.y);
    this._updateAimAngle(target);
  }

  cancelAim() {
    this.mode = ACTION.NONE;
    this.preview = null;
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
    this.mode = ACTION.RESOLVING;
    p.hasShot = true;
    this.preview = null;
    this.hintTiles = null;
    this.state = enumState.RESOLVING;
    this.world.turns.action = ACTION.RESOLVING;
    this.world.combat.fire(p, this.aimAngle);
  }

  /** Edge case 10: botón Pista. Muestra el tiro ideal si hay monedas. */
  useHint() {
    const p = this.selectedPlayer;
    if (!p || !p.alive) { this.toast('Selecciona un personaje primero'); return; }
    if (p.hasShot) { this.toast('Este personaje ya disparó'); return; }
    if (this.world.hintUsedThisLevel) { this.toast('Ya usaste la pista en este nivel'); return; }
    if (this.save.data.coins < ECONOMY.HINT_COST) {
      this.toast(`Necesitas ${ECONOMY.HINT_COST} monedas`);
      this.audio.error();
      return;
    }

    const allTargets = [...this.world.players, ...this.world.enemies];
    let best = null;
    for (const t of this.world.enemies) {
      if (!t.alive) continue;
      const r = this.world.ballistics.findBestShot(p.pos, t, {
        ...p.traceOptions(allTargets),
        samples: 720,
      });
      if (r && (!best || r.score > best.score)) best = r;
    }
    if (!best) { this.toast('Sin solución desde esta posición'); this.audio.error(); return; }

    this.save.spend(ECONOMY.HINT_COST);
    this.world.hintUsedThisLevel = true;
    this.hintTiles = best.result.points;
    this.aimAngle = best.angle;
    this.aimFrom = p;
    this.preview = best.result;
    this.mode = ACTION.AIM;
    this.toast('¡Pista desbloqueada! Pulsa DISPARAR');
    this.audio.coin();
  }

  endTurn() {
    if (this.state !== enumState.PLAYING) return;
    if (!this.world.turns || !this.world.turns.canInteract) return;
    this.cancelAim();
    this.moveTiles.clear();
    this.state = enumState.RESOLVING;
    this.world.turns.endPlayerTurn();
    this._scheduleNextEnemyAction();
  }

  // ══════════════════════════════════════════════════════════════════
  //  FLUJO DE NIVEL
  // ══════════════════════════════════════════════════════════════════
  startLevel(levelNumber) {
    try {
      const loader = new LevelLoader();
      const level = loader.load(levelNumber);
      const grid = Grid.fromLayout(level.layout, TILE);

      const world = {
        levelNumber,
        levelData: level,
        grid,
        ballistics: new BallisticsSystem(grid),
        collisions: new CollisionSystem(grid),
        particles: new ParticleSystem(),
        players: [], enemies: [], projectiles: [],
        turns: null, ai: null, combat: null,
        gameOver: false, result: null, reward: null,
        xpRun: 0,
        stats: { totalShots: 0, totalBounces: 0, kills: 0 },
        hintUsedThisLevel: false,
        currentShooter: null, currentTrace: null, lastOutcome: null,
        shake: (amount, dur) => this.shake(amount, dur),
        audio: this.audio,
        showFloatingText: (x, y, text, color) => {
          this.floatingText.push({ x, y, text, color, life: 1.1, maxLife: 1.1, big: false });
        },
      };

      // ── jugadores ──────────────────────────────────────────────────
      const upgrades = this.save.data.upgrades;
      const unlocked = this.save.data.unlockedChars;
      let squad = (level.squad && level.squad.length) ? level.squad.slice() : unlocked.slice(0, 3);
      // Sólo personajes desbloqueados (salvo el primero, que siempre lo está).
      squad = squad.filter((id) => unlocked.includes(id));
      if (squad.length === 0) squad = ['scout'];

      squad.forEach((charId, i) => {
        const spawn = (level.playerSpawns && level.playerSpawns[i]) || { cx: 1, cy: 1 + i };
        world.players.push(new Player(charId, spawn, upgrades));
      });

      // ── enemigos ───────────────────────────────────────────────────
      for (const e of level.enemies) {
        world.enemies.push(new Enemy(e.type, { cx: e.cx, cy: e.cy }, level.scaling || 1));
      }

      // ── sistemas ───────────────────────────────────────────────────
      world.ai = new AISystem(grid, world.ballistics);
      world.combat = new CombatSystem(world);
      world.turns = new TurnManager(world, {
        onTurnStart: () => { this.save.save(true); },
      });

      // Asignamos el mundo SÓLO cuando está completo: si algo falla arriba,
      // this.world sigue siendo el anterior y el juego no queda a medias.
      this.world = world;

      this.selectedPlayer = null;
      this.mode = ACTION.NONE;
      this.preview = null;
      this.moveTiles = new Map();
      this.floatingText = [];
      this.hintTiles = null;
      this._clearEnemyTimer();

      this.state = enumState.PLAYING;
      this.menu.hide();
      this.input.setEnabled(true);
      this._recomputeMoveTiles();
      world.turns.startPlayerTurn();
      this.selectPlayer(world.players[0] || null);
      this.save.save();
      if (level.tip) this.toast(level.tip, 3400);
    } catch (err) {
      console.error('[Inlimity] Error al cargar el nivel:', err);
      this.state = enumState.MENU;
      this.menu.show('main');
      this.toast('Error al cargar el nivel: ' + err.message, 4000);
    }
  }

  restartLevel() {
    this._clearEnemyTimer();
    if (this.world) this.startLevel(this.world.levelNumber);
    else this.menu.show('main');
  }

  pause() {
    if (this.state !== enumState.PLAYING && this.state !== enumState.RESOLVING) return;
    this._pausedFrom = this.state;
    this.state = enumState.PAUSED;
    this._clearEnemyTimer();
    this.menu.show('pause');
    this.input.setEnabled(false);
  }

  resume() {
    if (this.state !== enumState.PAUSED) return;
    this.state = this._pausedFrom || enumState.PLAYING;
    this.menu.hide();
    this.input.setEnabled(true);
    this.audio.resume();
    if (this.state === enumState.RESOLVING) this._scheduleNextEnemyAction();
  }

  quitToMenu() {
    this._clearEnemyTimer();
    this.world = null;
    this.state = enumState.MENU;
    this.input.setEnabled(true);
    this.menu.show('main');
  }

  _endLevel(victory, reason) {
    if (!this.world || this.world.gameOver) return;
    this.world.gameOver = true;
    this.world.result = { victory, reason };
    this._clearEnemyTimer();
    this.input.setEnabled(false);

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
  //  TURNO ENEMIGO
  // ══════════════════════════════════════════════════════════════════
  _clearEnemyTimer() {
    if (this._enemyTimer) { clearTimeout(this._enemyTimer); this._enemyTimer = null; }
  }

  _scheduleNextEnemyAction() {
    this._clearEnemyTimer();
    if (!this.world || this.world.gameOver) return;
    const delay = this.world.turns._wait > 0 ? this.world.turns._wait * 1000 : 150;
    this._enemyTimer = setTimeout(() => {
      this._enemyTimer = null;
      this._stepEnemyTurn();
    }, delay);
  }

  _stepEnemyTurn() {
    const w = this.world;
    if (!w || w.gameOver) return;
    if (!w.turns.isEnemyTurn) return;
    if (w.turns._wait > 0) { this._scheduleNextEnemyAction(); return; }

    const action = w.turns.nextEnemyAction();
    if (!action) {
      w.turns.finishEnemyTurn();
      this.state = enumState.PLAYING;
      this.selectedPlayer = this.selectedPlayer && this.selectedPlayer.alive
        ? this.selectedPlayer
        : (w.players.find((p) => p.alive) || null);
      this._recomputeMoveTiles();
      return;
    }

    const { enemy, plan } = action;
    if (!enemy || !enemy.alive) { this._scheduleNextEnemyAction(); return; }

    if (plan.move && plan.move.length) {
      enemy.moveAlong(plan.move);
      enemy.hasMoved = true;
      this._enemyTimer = setTimeout(() => {
        this._enemyTimer = null;
        this._enemyFireStep(enemy, plan);
      }, plan.move.length * 140 + 120);
    } else {
      this._enemyFireStep(enemy, plan);
    }
  }

  _enemyFireStep(enemy, plan) {
    const w = this.world;
    if (!w || w.gameOver) return;

    if (plan.shot) {
      if (plan.shot.telegraph) {
        enemy.telegraphAngle = plan.shot.angle;
        this.toast(`${enemy.name} está cargando un ataque...`);
        w.turns.wait(0.55);
      } else if (plan.shot.spread) {
        enemy.hasShot = true;
        w.combat.fireSpread(enemy, plan.shot.spread);
        w.turns.wait(0.3);
      } else if (typeof plan.shot.angle === 'number') {
        enemy.hasShot = true;
        w.combat.fire(enemy, plan.shot.angle);
        w.turns.wait(0.3);
      }
    }
    this._scheduleNextEnemyAction();
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
      try {
        this.update(dt);
        this.render();
      } catch (err) {
        // Un fallo en un frame no debe matar el bucle: lo registramos una vez.
        if (!this._loopError) {
          this._loopError = err;
          console.error('[Inlimity] Error en el bucle:', err);
        }
      }
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
    for (let i = this.floatingText.length - 1; i >= 0; i--) {
      const f = this.floatingText[i];
      f.life -= dt; f.y -= dt * 26;
      if (f.life <= 0) this.floatingText.splice(i, 1);
    }

    const w = this.world;
    if (!w) return;
    if (this.state === enumState.PAUSED) return;

    // El mundo puede estar a medio construir si startLevel falló.
    if (!w.turns || !w.combat) return;

    w.players.forEach((p) => p.update(dt));
    w.enemies.forEach((e) => e.update(dt));
    w.particles.update(dt);

    for (let i = w.projectiles.length - 1; i >= 0; i--) {
      const pr = w.projectiles[i];
      pr.update(dt);
      if (pr.alive && Math.random() < 0.55) {
        w.particles.trailPuff(pr.pos.x, pr.pos.y, '#fff3c4');
      }
      if (!pr.alive) w.projectiles.splice(i, 1);
    }

    w.turns.update(dt);

    // Fin de resolución del jugador → devolver el control.
    if (this.state === enumState.RESOLVING && w.turns.isPlayerTurn) {
      const busy = w.projectiles.length > 0 ||
                   w.players.some((p) => p.isMoving) ||
                   w.enemies.some((e) => e.isMoving);
      if (!busy) {
        this.state = enumState.PLAYING;
        w.turns.action = ACTION.NONE;
        this.selectedPlayer = this.selectedPlayer && this.selectedPlayer.alive
          ? this.selectedPlayer
          : (w.players.find((p) => p.alive) || null);
        this._recomputeMoveTiles();
        if (!w.players.some((p) => p.alive && (!p.hasMoved || !p.hasShot))) {
          this.endTurn();
        }
      }
    }

    this._checkEndConditions();
  }

  _checkEndConditions() {
    const w = this.world;
    if (!w || w.gameOver || !w.turns) return;
    if (w.enemies.length && w.enemies.every((e) => !e.alive)) {
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

  shake(amount, dur) {
    this._shake.amount = Math.max(this._shake.amount, amount);
    this._shake.t = Math.max(this._shake.t, dur);
    this._shake.dur = Math.max(this._shake.dur, dur);
  }

  // ══════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════
  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const w = this.world;
    const renderable = w && w.turns && w.combat && w.grid;

    if (renderable) {
      ctx.save();
      if (this._shake.t > 0) {
        const k = clamp(this._shake.t / (this._shake.dur || 1), 0, 1);
        const a = this._shake.amount * k;
        ctx.translate((Math.random() - 0.5) * a * 2, (Math.random() - 0.5) * a * 2);
      }
      this.renderer.drawBoard(w, this.time);
      this.renderer.drawMoveTiles(w, this.moveTiles);
      this.renderer.drawHint(this.hintTiles, this.time);
      this.renderer.drawPreview(this.preview, this.time);
      this.renderer.drawEntities(w, this.time, this.selectedPlayer);
      this.renderer.drawProjectiles(w);
      w.particles.draw(ctx);
      this.renderer.drawFloatingText(this.floatingText);
      ctx.restore();

      this.ui.drawFrame();
      this.hud.draw(w, {
        selected: this.selectedPlayer,
        mode: this.mode,
        preview: this.preview,
        fps: this.fps,
      });
    } else {
      this.renderer.drawMenuBackdrop(this.time);
    }
  }

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
      this.scale = this.canvas.width / GAME.BASE_W;
      this.renderer.setScale(this.scale);
      this.ui.setScale(this.scale);
      this.hud.setScale(this.scale);
    };
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', () => setTimeout(fit, 120));
    fit();
  }
}

export { enumState };
export default GameManager;
