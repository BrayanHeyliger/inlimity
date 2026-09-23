// ═══ archivo: js/ui/Menu.js ═══
// Gestión de todas las pantallas del menú: principal, niveles, tienda,
// opciones, pausa, victoria y derrota. Manipula el DOM del index.html.

import { CHARACTERS, UPGRADES, ECONOMY } from '../utils/Constants.js';

export class Menu {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('menu-root');
    this.current = null;
    this._bind();
  }

  get isOpen() { return !this.root.classList.contains('hidden'); }

  _bind() {
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) { this.game.audio.resume(); this.game.audio.ui(); this._action(btn.dataset.action); return; }

      const lvl = e.target.closest('[data-level]');
      if (lvl) { this.game.audio.ui(); this.game.startLevel(Number(lvl.dataset.level)); return; }

      const up = e.target.closest('[data-upgrade]');
      if (up) { this.game.audio.ui(); this._buyUpgrade(up.dataset.upgrade); return; }

      const ch = e.target.closest('[data-char]');
      if (ch) { this.game.audio.ui(); this._unlockChar(ch.dataset.char); return; }
    });

    // Opciones: checkboxes
    this.root.addEventListener('change', (e) => {
      const opt = e.target.closest('[data-opt]');
      if (!opt) return;
      const key = opt.dataset.opt;
      const value = opt.type === 'checkbox' ? opt.checked : opt.value;
      this.game.save.setOption(key, value);
      if (key === 'sound') this.game.audio.setEnabled(value);
      if (key === 'highContrast') document.body.classList.toggle('high-contrast', value);
      if (key === 'particles') this.game.world && (this.game.world.particles.enabled = value);
    });
  }

  _action(action) {
    const g = this.game;
    switch (action) {
      case 'play':    g.startLevel(g.save.data.currentLevel); break;
      case 'levels':  this.show('levels'); break;
      case 'shop':    this.show('shop'); break;
      case 'options': this.show('options'); break;
      case 'credits': this.show('credits'); break;
      case 'back':    this.back(); break;
      case 'resume':  g.resume(); break;
      case 'restart': g.killMenu(); g.restartLevel(); break;
      case 'quit':    g.quitToMenu(); break;
      case 'next': {
        const next = (g.world?.levelNumber || 1) + 1;
        g.killMenu();
        if (next <= 5) g.startLevel(next); else this.showVictoryFinal();
        break;
      }
      case 'wipe': {
        if (confirm('¿Borrar todo el progreso? Esta acción no se puede deshacer.')) {
          g.save.wipe();
          g.toast('Progreso borrado');
          this.show('main');
        }
        break;
      }
      default: break;
    }
  }

  _buyUpgrade(key) {
    const g = this.game;
    if (g.save.buyUpgrade(key)) {
      g.audio.coin();
      g.toast(`${UPGRADES[key].label} mejorado`);
      this.show('shop');
    } else {
      g.audio.error();
      const def = UPGRADES[key];
      const maxed = (g.save.data.upgrades[key] || 0) >= def.max;
      g.toast(maxed ? 'Nivel máximo alcanzado' : 'Monedas insuficientes');
    }
  }

  _unlockChar(id) {
    const g = this.game;
    if (g.save.data.unlockedChars.includes(id)) { g.toast('Ya desbloqueado'); return; }
    if (g.save.unlockChar(id)) {
      g.audio.coin();
      g.toast(`¡${CHARACTERS[id].name} desbloqueado!`);
      this.show('shop');
    } else {
      g.audio.error();
      const def = CHARACTERS[id];
      if (id === 'ghost' && g.save.getStars(3) < 3) {
        g.toast('Necesitas 3 estrellas en el nivel 3');
      } else {
        g.toast(`Necesitas ${def.cost} monedas`);
      }
    }
  }

  /** Muestra una pantalla concreta y refresca sus datos. */
  show(name) {
    this.current = name;
    this.root.classList.remove('hidden');
    this.root.querySelectorAll('.screen').forEach((s) => {
      s.classList.toggle('hidden', s.dataset.screen !== name);
    });
    this._refresh(name);
  }

  hide() {
    this.root.classList.add('hidden');
    this.current = null;
  }

  /** Cierra el menú sin tocar el estado del juego (para arrancar nivel). */
  killMenu() { this.root.classList.add('hidden'); this.current = null; }

  back() {
    const g = this.game;
    if (this.current === 'options' && g.state === 'paused') { this.show('pause'); return; }
    if (this.current === 'main') return;
    this.show('main');
  }

  _refresh(name) {
    const g = this.game;
    this.root.querySelectorAll('[data-bind="coins"]').forEach((el) => { el.textContent = g.save.data.coins; });
    this.root.querySelectorAll('[data-bind="xp"]').forEach((el) => { el.textContent = g.save.data.xp; });

    if (name === 'levels') this._renderLevels();
    if (name === 'shop') this._renderShop();
    if (name === 'options') this._renderOptions();
  }

  _renderLevels() {
    const g = this.game;
    const grid = this.root.querySelector('[data-bind="level-grid"]');
    if (!grid) return;
    grid.innerHTML = '';
    const names = ['Primer Contacto', 'Pasillo Angosto', 'Sala de Rebotes', 'Emboscada', 'OMEGA'];
    for (let i = 1; i <= 5; i++) {
      const unlocked = g.save.isLevelUnlocked(i);
      const stars = g.save.getStars(i);
      const card = document.createElement('div');
      card.className = `level-card${unlocked ? '' : ' locked'}`;
      if (unlocked) card.dataset.level = String(i);
      card.innerHTML = `
        <div class="num">${unlocked ? i : '🔒'}</div>
        <div class="nm">${names[i - 1]}</div>
        <div class="st">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>`;
      grid.appendChild(card);
    }
  }

  _renderShop() {
    const g = this.game;
    const upList = this.root.querySelector('[data-bind="upgrade-list"]');
    const unList = this.root.querySelector('[data-bind="unlock-list"]');
    if (upList) {
      upList.innerHTML = '';
      for (const [key, def] of Object.entries(UPGRADES)) {
        const lvl = g.save.data.upgrades[key] || 0;
        const maxed = lvl >= def.max;
        const afford = g.save.data.coins >= def.cost;
        const row = document.createElement('div');
        row.className = 'shop-row';
        row.innerHTML = `
          <div class="info">${def.label}<small>Nivel ${lvl}/${def.max} · ${def.cost} monedas</small></div>
          <button data-upgrade="${key}" ${maxed || !afford ? 'disabled' : ''}>
            ${maxed ? 'MÁX' : 'MEJORAR'}
          </button>`;
        upList.appendChild(row);
      }
    }
    if (unList) {
      unList.innerHTML = '';
      for (const [id, def] of Object.entries(CHARACTERS)) {
        const own = g.save.data.unlockedChars.includes(id);
        const afford = g.save.data.coins >= def.cost;
        const reqOk = id !== 'ghost' || g.save.getStars(3) >= 3;
        const row = document.createElement('div');
        row.className = 'shop-row';
        row.innerHTML = `
          <div class="info">${def.name}<small>${own ? 'Desbloqueado' : def.desc}${
            !own && def.unlockNote && !reqOk ? `<br>⚠ ${def.unlockNote}` : ''}</small></div>
          <button data-char="${id}" ${own || !afford || !reqOk ? 'disabled' : ''}>
            ${own ? '✓' : `${def.cost}`}
          </button>`;
        unList.appendChild(row);
      }
    }
  }

  _renderOptions() {
    const g = this.game;
    this.root.querySelectorAll('[data-opt]').forEach((el) => {
      const key = el.dataset.opt;
      const val = g.save.getOption(key);
      if (el.type === 'checkbox') el.checked = !!val;
      else el.value = val;
    });
  }

  // ── victoria / derrota ──────────────────────────────────────────────
  showVictory({ stars, reward, stats, xp }) {
    this.show('victory');
    const el = this.root.querySelector('[data-bind="stars"]');
    if (el) el.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);

    const list = this.root.querySelector('[data-bind="result-list"]');
    if (list) {
      list.innerHTML = `
        <li><span>Enemigos eliminados</span><b>${stats.kills}</b></li>
        <li><span>Disparos realizados</span><b>${stats.totalShots}</b></li>
        <li><span>Rebotes totales</span><b>${stats.totalBounces}</b></li>
        <li><span>XP ganada</span><b>✦ ${xp}</b></li>
        <li><span>Monedas ganadas</span><b>◈ ${reward.coins}</b></li>`;
    }
    const nextBtn = this.root.querySelector('[data-action="next"]');
    if (nextBtn) nextBtn.textContent = this.game.world?.levelNumber >= 5 ? 'VER FINAL' : 'SIGUIENTE NIVEL';
  }

  showVictoryFinal() {
    this.show('victory');
    const el = this.root.querySelector('[data-bind="stars"]');
    if (el) el.textContent = '★★★';
    const list = this.root.querySelector('[data-bind="result-list"]');
    if (list) list.innerHTML = `<li><span>¡Has completado Inlimity!</span><b>🎉</b></li>`;
    const nextBtn = this.root.querySelector('[data-action="next"]');
    if (nextBtn) nextBtn.disabled = true;
  }

  showDefeat(reason) {
    this.show('defeat');
    const el = this.root.querySelector('[data-bind="defeat-reason"]');
    if (el) el.textContent = reason || 'Inténtalo de nuevo';
  }
}

export default Menu;
