// ═══ archivo: js/core/AudioManager.js ═══
// Sonido 100% procedural con Web Audio API: sin archivos externos.
// Cada efecto se sintetiza con osciladores y envolventes.

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
  }

  /** El contexto se crea en el primer gesto del usuario (política del navegador). */
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch {
      this.enabled = false;
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.value = v ? 0.22 : 0; }

  /** Tono básico con envolvente ADSR simplificada. */
  _tone({ freq = 440, type = 'square', dur = 0.12, gain = 0.3, slideTo = null, delay = 0 }) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env); env.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  _noise({ dur = 0.1, gain = 0.25, filterFreq = 1400, delay = 0 }) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(env); env.connect(this.master);
    src.start(t0);
  }

  // ── efectos ──────────────────────────────────────────────────────────
  shoot()        { this._tone({ freq: 620, slideTo: 180, type: 'square', dur: 0.12, gain: 0.22 }); }
  bounce(n = 1)  { this._tone({ freq: 380 + n * 90, slideTo: 620 + n * 90, type: 'triangle', dur: 0.09, gain: 0.20 }); }
  hit()          { this._noise({ dur: 0.12, gain: 0.3, filterFreq: 2200 }); }
  death()        { this._tone({ freq: 320, slideTo: 60, type: 'sawtooth', dur: 0.34, gain: 0.26 }); }
  breakCover()   { this._noise({ dur: 0.2, gain: 0.28, filterFreq: 900 }); }
  select()       { this._tone({ freq: 740, type: 'sine', dur: 0.06, gain: 0.14 }); }
  move()         { this._tone({ freq: 520, slideTo: 700, type: 'sine', dur: 0.07, gain: 0.10 }); }
  ui()           { this._tone({ freq: 880, type: 'sine', dur: 0.05, gain: 0.12 }); }
  error()        { this._tone({ freq: 180, type: 'square', dur: 0.14, gain: 0.16 }); }
  coin()         { this._tone({ freq: 990, type: 'square', dur: 0.07, gain: 0.16 });
                   this._tone({ freq: 1320, type: 'square', dur: 0.09, gain: 0.14, delay: 0.07 }); }

  victory() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this._tone({ freq: f, type: 'triangle', dur: 0.22, gain: 0.2, delay: i * 0.11 }));
  }

  defeat() {
    [440, 370, 294, 220].forEach((f, i) =>
      this._tone({ freq: f, type: 'sawtooth', dur: 0.26, gain: 0.18, delay: i * 0.13 }));
  }
}

export default AudioManager;
