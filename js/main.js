// ═══ archivo: js/main.js ═══
// Punto de entrada de Inlimity.

import { GameManager } from './core/GameManager.js';
import { GAME } from './utils/Constants.js';

function boot() {
  const canvas = document.getElementById('game');
  if (!canvas) {
    console.error('[Inlimity] No se encontró el canvas #game');
    return;
  }

  // Red de seguridad: si algo revienta antes de que exista el juego,
  // lo mostramos en pantalla en vez de dejar una página muda.
  window.addEventListener('error', (e) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = 'Error: ' + (e.message || e.error);
    el.classList.remove('hidden');
    el.style.background = 'rgba(80,10,20,.96)';
    el.style.borderColor = '#f43f5e';
  });

  let game;
  try {
    game = new GameManager(canvas);
  } catch (err) {
    console.error('[Inlimity] Fallo al crear el juego:', err);
    const el = document.getElementById('toast');
    if (el) {
      el.textContent = 'Fallo al iniciar: ' + err.message;
      el.classList.remove('hidden');
    }
    return;
  }

  window.game = game;                     // acceso desde consola para depurar

  // El audio necesita un gesto del usuario antes de sonar.
  const unlockAudio = () => {
    game.audio.resume();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // Aplicar opciones guardadas al arrancar.
  document.body.classList.toggle('high-contrast', !!game.save.getOption('highContrast'));

  // Avisar si el guardado no está disponible (modo privado, etc).
  if (!game.save.available) {
    setTimeout(() => game.toast('Sin almacenamiento local: el progreso no se guardará', 3200), 900);
  }

  game.start();
  console.log(`%c${GAME.NAME} v${GAME.VERSION}`, 'color:#4dd6ff;font-weight:bold;font-size:14px');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
