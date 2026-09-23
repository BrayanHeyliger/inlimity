// ═══ archivo: js/levels/LevelLoader.js ═══
// Carga de niveles. Los 5 niveles van embebidos como datos para que el
// juego funcione abriendo index.html sin servidor. Además se puede cargar
// un nivel externo con loadFromJSON(texto) desde un archivo .json.
//
// LEYENDA DEL LAYOUT (una cadena por fila):
//   '.'  suelo libre
//   '#'  muro (bloquea movimiento y bala, la bala rebota)
//   'c'  cobertura (bloquea movimiento, la bala la destruye)
//   'b'  bumper (rebote potenciado)
//   'o'  foso (bloquea movimiento, la bala pasa por encima)

import { TILE } from '../utils/Constants.js';

const LEVELS = {
  1: {
    number: 1,
    name: 'Primer Contacto',
    turnLimit: 14,
    squad: ['scout', 'bounce'],
    scaling: 1.0,
    playerSpawns: [{ cx: 1, cy: 5 }, { cx: 2, cy: 7 }],
    enemies: [
      { type: 'grunt', cx: 13, cy: 3 },
      { type: 'grunt', cx: 13, cy: 7 },
    ],
    layout: [
      '################',
      '#..............#',
      '#.....##.......#',
      '#.....##.......#',
      '#..............#',
      '#....##....b...#',
      '#....##........#',
      '#..............#',
      '#.......##.....#',
      '#.......##.....#',
      '################',
    ],
    tip: 'Aprovecha los rebotes: una bala puede alcanzar lo que no ves.',
  },

  2: {
    number: 2,
    name: 'Pasillo Angosto',
    turnLimit: 16,
    squad: ['scout', 'bounce', 'tank'],
    scaling: 1.0,
    playerSpawns: [{ cx: 1, cy: 1 }, { cx: 1, cy: 5 }, { cx: 1, cy: 9 }],
    enemies: [
      { type: 'grunt', cx: 14, cy: 2 },
      { type: 'sniper', cx: 14, cy: 8 },
      { type: 'drone', cx: 9, cy: 5 },
    ],
    layout: [
      '################',
      '#..........#...#',
      '#..........#...#',
      '#..####....#...#',
      '#..........#...#',
      '#....c.....b...#',
      '#..........#...#',
      '#..####....#...#',
      '#..........#...#',
      '#..........#...#',
      '################',
    ],
    tip: 'El muro central es tu mejor aliado. Busca el ángulo de rebote.',
  },

  3: {
    number: 3,
    name: 'Sala de Rebotes',
    turnLimit: 18,
    squad: ['scout', 'bounce', 'tank', 'ghost'],
    scaling: 1.1,
    playerSpawns: [{ cx: 1, cy: 1 }, { cx: 1, cy: 9 }, { cx: 2, cy: 5 }, { cx: 3, cy: 3 }],
    enemies: [
      { type: 'grunt', cx: 13, cy: 2 },
      { type: 'grunt', cx: 13, cy: 8 },
      { type: 'brute', cx: 11, cy: 5 },
      { type: 'sniper', cx: 14, cy: 5 },
    ],
    layout: [
      '################',
      '#.b..........b.#',
      '#..##..##..##..#',
      '#..............#',
      '#..##..##..##..#',
      '#.......c......#',
      '#..##..##..##..#',
      '#..............#',
      '#..##..##..##..#',
      '#.b..........b.#',
      '################',
    ],
    tip: 'Los bumpers conservan la energía de la bala: encadena rebotes.',
  },

  4: {
    number: 4,
    name: 'Emboscada',
    turnLimit: 20,
    squad: ['scout', 'bounce', 'tank', 'ghost'],
    scaling: 1.2,
    playerSpawns: [{ cx: 1, cy: 1 }, { cx: 1, cy: 9 }, { cx: 2, cy: 5 }, { cx: 2, cy: 7 }],
    enemies: [
      { type: 'sniper', cx: 14, cy: 1 },
      { type: 'sniper', cx: 14, cy: 9 },
      { type: 'brute', cx: 12, cy: 5 },
      { type: 'drone', cx: 7, cy: 3 },
      { type: 'drone', cx: 7, cy: 7 },
    ],
    layout: [
      '################',
      '#.....o..o.....#',
      '#..##......##..#',
      '#..............#',
      '#....bb..bb....#',
      '#......cc......#',
      '#....bb..bb....#',
      '#..............#',
      '#..##......##..#',
      '#.....o..o.....#',
      '################',
    ],
    tip: 'Cuidado con los fosos: bloquean el paso pero no las balas.',
  },

  5: {
    number: 5,
    name: 'OMEGA',
    turnLimit: 26,
    squad: ['scout', 'bounce', 'tank', 'ghost'],
    scaling: 1.25,
    playerSpawns: [{ cx: 1, cy: 1 }, { cx: 1, cy: 9 }, { cx: 2, cy: 4 }, { cx: 2, cy: 6 }],
    enemies: [
      { type: 'boss', cx: 13, cy: 5 },
      { type: 'grunt', cx: 11, cy: 1 },
      { type: 'grunt', cx: 11, cy: 9 },
      { type: 'drone', cx: 9, cy: 3 },
      { type: 'drone', cx: 9, cy: 7 },
    ],
    layout: [
      '################',
      '#..c........c..#',
      '#..##......##..#',
      '#..............#',
      '#....bb..bb....#',
      '#......##......#',
      '#....bb..bb....#',
      '#..............#',
      '#..##......##..#',
      '#..c........c..#',
      '################',
    ],
    tip: 'OMEGA cambia de fase al recibir daño. Vigila su telegrafía roja.',
  },
};

export class LevelLoader {
  constructor() {
    this.cache = new Map();
  }

  /** @returns {object} nivel listo para usar, con layout ya validado. */
  load(number) {
    const n = Math.max(1, Math.min(5, Number(number) || 1));
    if (this.cache.has(n)) return this.cache.get(n);
    const raw = LEVELS[n];
    if (!raw) throw new Error(`Nivel ${n} no existe`);
    const level = this.validate({ ...raw });
    this.cache.set(n, level);
    return level;
  }

  /** Carga un nivel desde texto JSON externo (js/levels/data/levelN.json). */
  loadFromJSON(text) {
    const data = typeof text === 'string' ? JSON.parse(text) : text;
    return this.validate(data);
  }

  /** Saneado: garantiza que el nivel tiene todo lo necesario. */
  validate(level) {
    if (!Array.isArray(level.layout) || level.layout.length === 0) {
      throw new Error('El nivel necesita un layout');
    }
    const rows = level.layout.length;
    const cols = level.layout[0].length;
    for (const r of level.layout) {
      if (r.length !== cols) throw new Error('Todas las filas del layout deben medir lo mismo');
    }
    const validChars = new Set(['.', '#', 'c', 'b', 'o']);
    for (const r of level.layout) {
      for (const ch of r) {
        if (!validChars.has(ch)) throw new Error(`Carácter inválido en layout: "${ch}"`);
      }
    }

    level.enemies = (level.enemies || []).filter(
      (e) => e.cx > 0 && e.cy > 0 && e.cx < cols - 1 && e.cy < rows - 1
    );
    level.playerSpawns = (level.playerSpawns || [{ cx: 1, cy: 1 }]).map((s) => ({
      cx: Math.max(1, Math.min(cols - 2, s.cx)),
      cy: Math.max(1, Math.min(rows - 2, s.cy)),
    }));
    level.turnLimit = level.turnLimit || 20;
    level.scaling = level.scaling || 1;
    level.squad = level.squad || ['scout'];
    level.name = level.name || `Nivel ${level.number || 1}`;
    level.cols = cols;
    level.rows = rows;
    return level;
  }

  /** Cuántos niveles hay disponibles. */
  get count() { return Object.keys(LEVELS).length; }

  /** Lista de metadatos, útil para el menú de selección. */
  list() {
    return Object.values(LEVELS).map((l) => ({
      number: l.number, name: l.name, turnLimit: l.turnLimit,
    }));
  }
}

export { LEVELS };
export default LevelLoader;
