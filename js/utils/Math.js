// ═══ archivo: js/utils/Math.js ═══
// Utilidades matemáticas puras (fáciles de testear).

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));
export const deg = (rad) => (rad * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;

export const randRange = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(randRange(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;

/** Easing suave para animaciones. */
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t) => {
  const c = 1.70158, c3 = c + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** Distancia Manhattan entre celdas (movimiento en 4 direcciones). */
export const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
/** Distancia Chebyshev (movimiento en 8 direcciones). */
export const chebyshev = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Normaliza un ángulo al rango (-PI, PI]. */
export function normalizeAngle(a) {
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

/** Diferencia angular más corta entre dos ángulos. */
export const angleDelta = (a, b) => normalizeAngle(b - a);

/**
 * Intersección segmento-segmento. Devuelve {x,y,t} o null.
 * t = parámetro sobre el primer segmento (0..1).
 */
export function segIntersect(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: p1.x + d1x * t, y: p1.y + d1y * t, t };
}

/** ¿El punto está dentro del rectángulo? */
export const pointInRect = (px, py, x, y, w, h) =>
  px >= x && px <= x + w && py >= y && py <= y + h;

/** Colisión círculo-rectángulo (AABB). */
export function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

/** Colisión círculo-círculo. */
export function circleCircle(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by, rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

/** Recorrido de línea en rejilla (Bresenham) para línea de visión. */
export function gridLine(x0, y0, x1, y1) {
  const pts = [];
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (let guard = 0; guard < 4096; guard++) {
    pts.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return pts;
}

export default {
  clamp, lerp, invLerp, deg, rad, randRange, randInt, pick, chance,
  easeOutCubic, easeInOutQuad, easeOutBack, manhattan, chebyshev,
  normalizeAngle, angleDelta, segIntersect, pointInRect, circleRect,
  circleCircle, gridLine,
};
