// ═══ archivo: js/core/TurnManager.js ═══
// Máquina de estados de turnos: jugador → enemigos → jugador.
// La resolución es secuencial (una acción por paso) para que cada disparo
// se vea entero antes de que empiece el siguiente.

import { TURN, ACTION } from '../utils/Constants.js';

export class TurnManager {
  constructor(world, events = {}) {
    this.world = world;
    this.events = events;      // { onTurnStart }
    this.side = TURN.PLAYER;
    this.action = ACTION.NONE;
    this.turnNumber = 1;
    this.queue = [];           // acciones enemigas pendientes
    this.busy = false;
    this.banner = null;        // { text, color, t }
    this._wait = 0;            // pausa dramática pendiente
  }

  startPlayerTurn() {
    this.side = TURN.PLAYER;
    this.action = ACTION.NONE;
    this.busy = false;
    this.world.players.forEach((p) => p.resetTurnFlags());
    this.banner = { text: 'TU TURNO', color: '#7ff0ef', t: 0 };
    this.events.onTurnStart?.(TURN.PLAYER, this.turnNumber);
  }

  endPlayerTurn() {
    if (this.busy) return;
    this.side = TURN.ENEMY;
    this.action = ACTION.NONE;
    this.world.enemies.forEach((e) => e.resetTurnFlags());
    this.banner = { text: 'TURNO ENEMIGO', color: '#ff8f8f', t: 0 };
    this.queue = this.world.ai.planAll(this.world);
    this.busy = true;
    this._wait = 0.4;
    this.events.onTurnStart?.(TURN.ENEMY, this.turnNumber);
  }

  update(dt) {
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 1.25) this.banner = null;
    }
    if (this._wait > 0) {
      this._wait -= dt;
      return true;
    }
    return this.busy;
  }

  nextEnemyAction() { return this.queue.length ? this.queue.shift() : null; }

  finishEnemyTurn() {
    this.busy = false;
    this.action = ACTION.NONE;
    this.turnNumber++;
    if (!this.world.gameOver) this.startPlayerTurn();
  }

  /** Pausa dramática configurable desde el orquestador. */
  wait(seconds) { this._wait = seconds; }

  get isPlayerTurn() { return this.side === TURN.PLAYER && !this.busy; }
  get isEnemyTurn()  { return this.side === TURN.ENEMY; }
  get canInteract()  { return this.isPlayerTurn && this.action === ACTION.NONE; }
}

export default TurnManager;
