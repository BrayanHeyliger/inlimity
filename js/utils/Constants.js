// ═══ archivo: js/utils/Constants.js ═══

export const GAME = {
  NAME: 'Inlimity',
  VERSION: '1.0.0',
  BASE_W: 960,
  BASE_H: 640,
  TARGET_FPS: 60,
  MAX_DT: 1 / 30,
};

export const GRID = {
  COLS: 16,
  ROWS: 11,
  TILE: 48,
  ORIGIN_X: 0,
  ORIGIN_Y: 0,
};

export const TILE = {
  FLOOR: 0,
  WALL: 1,      // bloquea movimiento y bala
  COVER: 2,     // bloquea movimiento, la bala la destruye
  BUMPER: 3,    // bloquea movimiento, rebote potenciado
  PIT: 4,       // bloquea movimiento, la bala pasa por encima
};

export const BALLISTICS = {
  MAX_BOUNCES: 6,
  MAX_PATH_LEN: 4000,
  STEP: 2.0,            // px por paso de raymarch
  SPEED: 760,           // px/s de la bala visual
  LIFETIME: 5.0,        // timeout anti-bug (segundos)
  LOOP_WINDOW: 8,       // rebotes recientes que se vigilan
  LOOP_EPS: 1.5,        // px de tolerancia para detectar loop
  NUDGE: 0.6,           // separación de la superficie tras rebotar
  BUMPER_GAIN: 1.0,     // el bumper no pierde energía
  WALL_GAIN: 1.0,
  DMG_BOUNCE_BONUS: 0.15, // +15% daño por rebote acumulado
};

export const TURN = {
  PLAYER: 'player',
  ENEMY: 'enemy',
  BANNER_MS: 1100,
};

export const ACTION = {
  NONE: 'none',
  MOVE: 'move',
  AIM: 'aim',
  RESOLVING: 'resolving',
};

export const PARTICLES = {
  MAX: 100,
  POOL: 140,
};

export const ECONOMY = {
  COIN_PER_LEVEL_MIN: 50,
  COIN_PER_LEVEL_MAX: 200,
  XP_KILL: 50,
  XP_MULTI_BOUNCE: 25,
  HINT_COST: 50,
};

export const UPGRADES = {
  hp:       { label: '+10 Vida máxima', cost: 100, max: 5, value: 10 },
  damage:   { label: '+1 Daño base',    cost: 150, max: 5, value: 1 },
  movement: { label: '+1 Movimiento',   cost: 200, max: 3, value: 1 },
  accuracy: { label: '+1 Precisión',    cost: 150, max: 5, value: 1 },
};

export const CHARACTERS = {
  scout: {
    id: 'scout', name: 'Scout', color: '#2ec6c6', accent: '#7ff0ef',
    hp: 80, damage: 3, movement: 5, accuracy: 4, bounceBonus: 0,
    unlocked: true, cost: 0,
    desc: 'Rápido y preciso. Mucho movimiento, poca vida.',
  },
  bounce: {
    id: 'bounce', name: 'Bounce', color: '#f5a623', accent: '#ffd08a',
    hp: 100, damage: 3, movement: 4, accuracy: 3, bounceBonus: 2,
    unlocked: false, cost: 500,
    desc: '+2 rebotes máximos. Especialista en tiros imposibles.',
  },
  tank: {
    id: 'tank', name: 'Tank', color: '#8bc34a', accent: '#c8e99a',
    hp: 160, damage: 4, movement: 3, accuracy: 2, bounceBonus: 0,
    unlocked: false, cost: 1000,
    desc: 'Mucha vida y daño. Lento y poco preciso.',
  },
  ghost: {
    id: 'ghost', name: 'Ghost', color: '#9b6dff', accent: '#d3bcff',
    hp: 90, damage: 3, movement: 5, accuracy: 5, bounceBonus: 1,
    unlocked: false, cost: 2000,
    unlockNote: 'Requiere nivel 3 con 3 estrellas',
    desc: 'La bala atraviesa la primera cobertura.',
    pierceFirstCover: true,
  },
};

export const ENEMIES = {
  grunt:   { id:'grunt',   name:'Grunt',   color:'#e5484d', hp:40,  damage:6,  movement:3, range:9,  ai:'aggressive' },
  sniper:  { id:'sniper',  name:'Sniper',  color:'#ff7ab2', hp:30,  damage:12, movement:2, range:20, ai:'camper'    },
  brute:   { id:'brute',   name:'Brute',   color:'#b5432f', hp:90,  damage:10, movement:2, range:5,  ai:'charger'   },
  drone:   { id:'drone',   name:'Drone',   color:'#f0a020', hp:25,  damage:4,  movement:5, range:7,  ai:'flanker'   },
  boss:    { id:'boss',    name:'OMEGA',   color:'#c0392b', hp:260, damage:14, movement:2, range:14, ai:'boss'      },
};

export const COLORS = {
  bgTop: '#1d9bd1',
  bgBot: '#5ec8e8',
  floorA: '#2f9c93',
  floorB: '#37aca2',
  floorLine: 'rgba(255,255,255,0.18)',
  wall: '#3a7bd5',
  wallTop: '#6fb0ff',
  cover: '#c98a4b',
  coverTop: '#e8b276',
  bumper: '#2f6fd0',
  bumperGlow: '#8fd4ff',
  pit: '#123047',
  hint: 'rgba(255,255,255,0.9)',
  moveTile: 'rgba(120,240,255,0.30)',
  moveTileEdge: 'rgba(200,255,255,0.65)',
  threat: 'rgba(255,90,90,0.22)',
  projectile: '#ffd45e',
  projectileGlow: '#fff3c4',
};

export const STORAGE_KEY = 'inlimity.save.v1';

export default {
  GAME, GRID, TILE, BALLISTICS, TURN, ACTION, PARTICLES,
  ECONOMY, UPGRADES, CHARACTERS, ENEMIES, COLORS, STORAGE_KEY,
};
