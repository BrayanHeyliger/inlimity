// ═══ archivo: js/core/SaveSystem.js ═══
// Persistencia en localStorage con degradación elegante si no está
// disponible (modo incógnito agresivo, file:// restringido, etc).

import { STORAGE_KEY, CHARACTERS, UPGRADES, ECONOMY } from '../utils/Constants.js';

const DEFAULT_SAVE = () => ({
  version: 1,
  currentLevel: 1,
  levels: {},                       // { "1": {stars:3, best_score:120} }
  coins: 0,
  xp: 0,
  upgrades: { hp: 0, damage: 0, movement: 0, accuracy: 0 },
  unlockedChars: ['scout'],
  options: {
    sound: true,
    haptics: true,
    showTrajectory: true,
    particles: true,
    highContrast: false,
  },
  stats: { totalKills: 0, totalShots: 0, totalBounces: 0, levelsPlayed: 0 },
});

export class SaveSystem {
  constructor() {
    this.available = this._probe();
    this.data = this.load();
    this._lastWrite = 0;
  }

  _probe() {
    try {
      const k = '__inlimity_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      console.warn('[SaveSystem] localStorage no disponible: el progreso no se guardará.');
      return false;
    }
  }

  load() {
    const base = DEFAULT_SAVE();
    if (!this.available) return base;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      return this._migrate({ ...base, ...parsed, options: { ...base.options, ...(parsed.options || {}) } });
    } catch (err) {
      console.warn('[SaveSystem] guardado corrupto, se reinicia.', err);
      return base;
    }
  }

  /** Punto único de migración de versiones futuras. */
  _migrate(data) {
    if (data.version < 1) data.version = 1;
    // Saneado: nunca confiar en el contenido del storage.
    for (const key of Object.keys(UPGRADES)) {
      const v = Number(data.upgrades?.[key]);
      data.upgrades[key] = Number.isFinite(v) ? Math.max(0, Math.min(UPGRADES[key].max, Math.floor(v))) : 0;
    }
    data.coins = Math.max(0, Math.floor(Number(data.coins) || 0));
    data.xp = Math.max(0, Math.floor(Number(data.xp) || 0));
    data.currentLevel = Math.max(1, Math.floor(Number(data.currentLevel) || 1));
    if (!Array.isArray(data.unlockedChars) || data.unlockedChars.length === 0) {
      data.unlockedChars = ['scout'];
    }
    data.unlockedChars = data.unlockedChars.filter((c) => CHARACTERS[c]);
    if (!data.unlockedChars.includes('scout')) data.unlockedChars.unshift('scout');
    return data;
  }

  /** Escritura con throttling: evita spamear el storage cada frame. */
  save(force = false) {
    if (!this.available) return false;
    const now = performance.now();
    if (!force && now - this._lastWrite < 500) return false;
    this._lastWrite = now;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      return true;
    } catch (err) {
      console.warn('[SaveSystem] error al guardar', err);
      return false;
    }
  }

  wipe() {
    this.data = DEFAULT_SAVE();
    if (this.available) {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    }
    return this.data;
  }

  // ── progreso ─────────────────────────────────────────────────────────
  getStars(level) { return this.data.levels[String(level)]?.stars || 0; }

  /** Registra el resultado de un nivel. Devuelve monedas ganadas. */
  completeLevel(level, stars, meta = {}) {
    const key = String(level);
    const prev = this.data.levels[key] || { stars: 0, plays: 0 };
    const mejorEstrellas = Math.max(prev.stars, stars);

    const coinBase = Math.min(
      ECONOMY.COIN_PER_LEVEL_MAX,
      ECONOMY.COIN_PER_LEVEL_MIN + meta.kills * 8 + meta.turnsSaved * 5
    );
    // Recompensa decreciente si ya lo tenías perfecto (evita farmeo infinito).
    const repeatPenalty = prev.stars >= 3 ? 0.25 : prev.stars > 0 ? 0.6 : 1;
    const coins = Math.round(coinBase * repeatPenalty);
    const xp = Math.round((meta.xp || 0) * repeatPenalty);

    this.data.levels[key] = {
      stars: mejorEstrellas,
      best_score: Math.max(prev.best_score || 0, meta.score || 0),
      plays: (prev.plays || 0) + 1,
    };
    this.data.coins += coins;
    this.data.xp += xp;
    this.data.stats.totalKills += meta.kills || 0;
    this.data.stats.totalShots += meta.shots || 0;
    this.data.stats.totalBounces += meta.bounces || 0;
    this.data.stats.levelsPlayed++;
    this.data.currentLevel = Math.max(this.data.currentLevel, level + 1);

    this.save(true);
    return { coins, xp, stars: mejorEstrellas };
  }

  isLevelUnlocked(level) { return level <= this.data.currentLevel; }

  // ── tienda ───────────────────────────────────────────────────────────
  canBuyUpgrade(key) {
    const def = UPGRADES[key];
    if (!def) return false;
    const lvl = this.data.upgrades[key] || 0;
    return lvl < def.max && this.data.coins >= def.cost;
  }

  buyUpgrade(key) {
    if (!this.canBuyUpgrade(key)) return false;
    const def = UPGRADES[key];
    this.data.coins -= def.cost;
    this.data.upgrades[key] = (this.data.upgrades[key] || 0) + 1;
    this.save(true);
    return true;
  }

  canUnlockChar(id) {
    const def = CHARACTERS[id];
    if (!def || this.data.unlockedChars.includes(id)) return false;
    if (this.data.coins < def.cost) return false;
    if (id === 'ghost' && this.getStars(3) < 3) return false;   // requisito especial
    return true;
  }

  unlockChar(id) {
    if (!this.canUnlockChar(id)) return false;
    const def = CHARACTERS[id];
    this.data.coins -= def.cost;
    this.data.unlockedChars.push(id);
    this.save(true);
    return true;
  }

  spend(amount) {
    if (this.data.coins < amount) return false;
    this.data.coins -= amount;
    this.save(true);
    return true;
  }

  // ── opciones ─────────────────────────────────────────────────────────
  setOption(key, value) {
    this.data.options[key] = value;
    this.save(true);
  }
  getOption(key) { return this.data.options[key]; }
}

export default SaveSystem;
