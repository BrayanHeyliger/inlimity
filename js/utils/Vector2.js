// ═══ archivo: js/utils/Vector2.js ═══
export class Vector2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  static of(x, y) { return new Vector2(x, y); }
  static fromAngle(rad, len = 1) { return new Vector2(Math.cos(rad) * len, Math.sin(rad) * len); }
  clone() { return new Vector2(this.x, this.y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
  scale(s) { return new Vector2(this.x * s, this.y * s); }
  addSelf(v) { this.x += v.x; this.y += v.y; return this; }
  dot(v) { return this.x * v.x + this.y * v.y; }
  length() { return Math.hypot(this.x, this.y); }
  distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  normalize() {
    const l = this.length();
    return l < 1e-9 ? new Vector2(0, 0) : new Vector2(this.x / l, this.y / l);
  }
  /** Refleja sobre una normal unitaria: r = d - 2(d·n)n */
  reflect(n) {
    const d = this.dot(n) * 2;
    return new Vector2(this.x - d * n.x, this.y - d * n.y);
  }
  angle() { return Math.atan2(this.y, this.x); }
  rotate(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Vector2(this.x * c - this.y * s, this.x * s + this.y * c);
  }
  lerp(v, t) { return new Vector2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t); }
}
export default Vector2;
