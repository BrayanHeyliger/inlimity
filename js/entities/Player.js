// ═══ archivo: js/entities/Player.js ═══
// Personajes del escuadrón. Los 4 arquetipos viven en CHARACTERS
// (Constants.js); esta clase aplica esa config + las mejoras persistentes.

import { Entity } from './Entity.js';
import { CHARACTERS, BALLISTICS, UPGRADES } from '../utils/Constants.js';

export class Player extends Entity {
  /**
   * @param {string} charId  clave en CHARACTERS
   * @param {object} spawn   {cx, cy}
   * @param {object} upgrades  {hp:n, damage:n, movement:n, accuracy:n}
   */
  constructor(charId, spawn = {}, upgrades = {}) {
    const def = CHARACTERS[charId] || CHARACTERS.scout;
    const bonusHp  = (upgrades.hp       || 0) * UPGRADES.hp.value;
    const bonusDmg = (upgrades.damage   || 0) * UPGRADES.damage.value;
    const bonusMov = (upgrades.movement || 0) * UPGRADES.movement.value;
    const bonusAcc = (upgrades.accuracy || 0) * UPGRADES.accuracy.value;

    super({
      name: def.name,
      team: 'player',
      cx: spawn.cx ?? 1,
      cy: spawn.cy ?? 1,
      hp: def.hp + bonusHp,
      damage: def.damage + bonusDmg,
      movement: def.movement + bonusMov,
      accuracy: def.accuracy + bonusAcc,
      color: def.color,
      accent: def.accent,
    });

    this.charId = def.id;
    this.desc = def.desc;
    this.bounceBonus = def.bounceBonus || 0;
    this.pierceFirstCover = !!def.pierceFirstCover;
    this.kills = 0;
    this.shotsFired = 0;
    this.bestBounceChain = 0;
  }

  /** Rebotes máximos de este personaje (base + arquetipo + precisión). */
  get maxBounces() {
    return BALLISTICS.MAX_BOUNCES + this.bounceBonus + Math.floor(this.accuracy / 3);
  }

  /** Daño final de un disparo según los rebotes acumulados. */
  damageFor(bounceCount) {
    const mult = 1 + bounceCount * BALLISTICS.DMG_BOUNCE_BONUS;
    return Math.round(this.damage * mult * 3.2);
  }

  /** Opciones de trazado para este personaje. */
  traceOptions(targets) {
    return {
      maxBounces: this.maxBounces,
      targets,
      ignoreTeam: 'player',
      pierceCover: this.pierceFirstCover,
    };
  }
}

export default Player;
