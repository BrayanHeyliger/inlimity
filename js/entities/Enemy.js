// ═══ archivo: js/entities/Enemy.js ═══
// Todos los tipos de enemigos + el boss. El comportamiento concreto lo
// decide AISystem leyendo `aiProfile`; aquí sólo vive el estado.

import { Entity } from './Entity.js';
import { ENEMIES, BALLISTICS } from '../utils/Constants.js';

export class Enemy extends Entity {
  constructor(typeId, spawn = {}, scale = 1) {
    const def = ENEMIES[typeId] || ENEMIES.grunt;
    super({
      name: def.name,
      team: 'enemy',
      cx: spawn.cx ?? 0,
      cy: spawn.cy ?? 0,
      hp: Math.round(def.hp * scale),
      damage: def.damage,
      movement: def.movement,
      accuracy: 3,
      color: def.color,
      accent: '#ffe0d0',
    });

    this.typeId = def.id;
    this.aiProfile = def.ai;
    this.range = def.range;
    this.isBoss = def.id === 'boss';
    if (this.isBoss) this.radius = this.tile * 0.42;

    // Estado del boss: alterna fases según vida restante.
    this.phase = 1;
    this.telegraphAngle = null;   // disparo anunciado un turno antes
    this.stunned = 0;
  }

  get maxBounces() {
    // Los enemigos rebotan menos que el jugador: el rebote es la ventaja del jugador.
    return this.isBoss ? BALLISTICS.MAX_BOUNCES : 2;
  }

  damageFor(bounceCount) {
    const mult = 1 + bounceCount * BALLISTICS.DMG_BOUNCE_BONUS;
    return Math.round(this.damage * mult);
  }

  traceOptions(targets) {
    return {
      maxBounces: this.maxBounces,
      targets,
      ignoreTeam: 'enemy',
    };
  }

  update(dt) {
    super.update(dt);
    // El boss cambia de fase al bajar de umbrales de vida.
    if (this.isBoss) {
      const p = this.hpPct;
      this.phase = p > 0.66 ? 1 : p > 0.33 ? 2 : 3;
    }
  }
}

export default Enemy;
