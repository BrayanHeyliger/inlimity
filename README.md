# 🎯 Inlimity

Un juego táctico por turnos donde las balas **rebotan**. Mueve tu escuadrón por la
rejilla, apunta y dispara: la trayectoria rebota en muros y bumpers, así que puedes
alcanzar enemigos que no ves directamente. Gana con el rebote cero, con uno, con
cinco — pero gana.

- **Género:** táctica por turnos + puzle de ángulos
- **Plataforma:** web (móvil y escritorio)
- **Stack:** JavaScript ES6+ vanilla + Canvas 2D. Cero dependencias, cero build.
- **Versión:** 1.0.0

---

## ✨ Características

- **Sistema de rebotes completo** — trayectoria calculada por raymarching, con
  reflexión real sobre normales de superficie, detección de loops infinitos y
  límite de rebotes. Lo que previsualizas es exactamente lo que ocurre.
- **Sistema de turnos** — jugador → enemigos → jugador, con resolución animada
  secuencial para que se entienda cada disparo.
- **4 personajes** con arquetipos distintos (Scout, Bounce, Tank, Ghost) y 5
  mejoras persistentes comprables.
- **5 tipos de enemigo + boss** con 5 perfiles de IA distintos y un boss de 3 fases.
- **5 niveles** con layouts, límites de turno y dificultad escalada.
- **Progresión persistente** — monedas, XP, estrellas por nivel, mejoras y
  desbloqueos, guardados en `localStorage`.
- **Soporte táctil y teclado** — arrastrar para apuntar, tocar para mover.
- **Responsive** de 320×480 a 1920×1080.
- **Audio procedural** con Web Audio API — sin archivos de sonido.
- **Accesibilidad** — modo alto contraste, textos legibles, botones grandes.

---

## 🚀 Cómo ejecutar

### Opción A — GitHub Pages (recomendado)

Este repo está listo para Pages: activa **Settings → Pages → Deploy from a branch →
`main` / `/ (root)`** y abre `https://TU_USUARIO.github.io/inlimity/`.

### Opción B — servidor local

El juego usa **módulos ES6**, y algunos navegadores bloquean `import` cuando se abre
desde `file://`. Un servidor local lo evita:

```bash
# Python 3
python3 -m http.server 8000
# → abre http://localhost:8000

# o con Node
npx serve .
```

### Opción C — abrir el archivo

Doble clic en `index.html`. Funciona en Chrome y Firefox recientes, pero puede fallar
en navegadores con CORS estricto para módulos locales.

### Requisitos

- Navegador moderno: Chrome 90+, Firefox 88+, Safari 15+, Edge 90+
- Soporte de ES6 modules, Canvas 2D y `localStorage`
- No requiere conexión a internet

---

## 🎮 Controles

### Móvil / táctil

| Acción | Gesto |
|---|---|
| Seleccionar personaje | Toca su ficha o su figura |
| Mover | Toca una casilla iluminada |
| Apuntar | Pulsa **APUNTAR ◎** y arrastra |
| Disparar | Suelta el dedo (o pulsa **DISPARAR ▶**) |
| Cancelar apuntado | Botón **✕ CANCELAR** |
| Terminar turno | Botón **TERMINAR TURNO** |

### Escritorio

| Tecla | Acción |
|---|---|
| `1`–`4` | Seleccionar personaje |
| `Tab` | Ciclar entre personajes vivos |
| Flechas | Mover una casilla |
| Clic y arrastrar | Apuntar |
| `Enter` | Confirmar disparo |
| `Espacio` | Terminar turno |
| `H` | Comprar pista (50 monedas) |
| `Esc` | Pausa |

---

## 📁 Estructura del proyecto

```
inlimity/
├── index.html                  # Estructura base + pantallas de menú
├── package.json                # Metadatos (no hay dependencias)
├── css/
│   └── style.css               # Estilos responsive y paleta
├── js/
│   ├── main.js                 # Punto de entrada
│   ├── core/
│   │   ├── GameManager.js      # Orquestador: mundo, bucle, render
│   │   ├── TurnManager.js      # Máquina de estados de turnos
│   │   ├── InputManager.js     # Input unificado (táctil/ratón/teclado)
│   │   ├── SaveSystem.js       # Persistencia en localStorage
│   │   └── AudioManager.js     # Sonido procedural (Web Audio)
│   ├── entities/
│   │   ├── Entity.js           # Clase base
│   │   ├── Player.js           # Personajes del escuadrón
│   │   ├── Enemy.js            # Enemigos + boss
│   │   └── Projectile.js       # Bala con animación de rebotes
│   ├── systems/
│   │   ├── BallisticsSystem.js # ⭐ Cálculo de rebotes (núcleo del juego)
│   │   ├── AISystem.js         # IA enemiga (5 perfiles)
│   │   ├── CombatSystem.js     # Une trazado, impacto y efectos
│   │   ├── CollisionSystem.js  # Ocupación e impactos
│   │   └── ParticleSystem.js   # Partículas con object pooling
│   ├── ui/
│   │   ├── Renderer.js         # Dibujo del tablero y entidades
│   │   ├── UIRenderer.js       # Marco, viñeta, pantalla de carga
│   │   ├── HUD.js              # HUD durante la partida
│   │   └── Menu.js             # Todos los menús
│   ├── levels/
│   │   ├── Grid.js             # Rejilla, LOS, BFS, pathfinding
│   │   ├── LevelLoader.js      # Carga y valida niveles
│   │   └── data/
│   │       ├── level1.json … level5.json
│   └── utils/
│       ├── Constants.js        # Toda la configuración del juego
│       ├── Math.js             # Utilidades matemáticas puras
│       └── Vector2.js          # Vector 2D
└── README.md
```

---

## 🧩 Cómo añadir un nivel nuevo

### 1. Crea el archivo JSON

`js/levels/data/level6.json`:

```json
{
  "number": 6,
  "name": "La Fortaleza",
  "turnLimit": 22,
  "scaling": 1.3,
  "squad": ["scout", "bounce", "tank", "ghost"],
  "playerSpawns": [{ "cx": 1, "cy": 2 }, { "cx": 1, "cy": 8 }],
  "enemies": [
    { "type": "brute", "cx": 13, "cy": 5 },
    { "type": "sniper", "cx": 14, "cy": 2 },
    { "type": "grunt", "cx": 10, "cy": 5 }
  ],
  "tip": "Los bumpers en las esquinas abren ángulos imposibles.",
  "layout": [
    "################",
    "#....b....b....#",
    "#..##......##..#",
    "#..............#",
    "#....##..##....#",
    "#......cc......#",
    "#....##..##....#",
    "#..............#",
    "#..##......##..#",
    "#....b....b....#",
    "################"
  ]
}
```

### 2. Leyenda del layout

| Carácter | Tipo | Bloquea movimiento | Comportamiento de la bala |
|---|---|---|---|
| `.` | Suelo | No | Pasa |
| `#` | Muro | Sí | **Rebota** |
| `c` | Cobertura | Sí | La **destruye** y se detiene |
| `b` | Bumper | Sí | Rebota (conserva energía) |
| `o` | Foso | Sí | Pasa por encima |

Todos los mapas deben tener las mismas columnas en cada fila y estar cerrados
por muros en el borde.

### 3. Añádelo al cargador

En `js/levels/LevelLoader.js` añade la entrada al objeto `LEVELS`, y en
`js/ui/Menu.js` amplía el rango del bucle (`for (let i = 1; i <= 5; i++)` → `<= 6`)
con el nombre en la lista `names`.

---

## 🦸 Cómo añadir un personaje nuevo

### 1. Define sus estadísticas en `js/utils/Constants.js`

```js
export const CHARACTERS = {
  scout: { /* ... */ },

  medic: {
    id: 'medic', name: 'Medic', color: '#4ade80', accent: '#a7f3c9',
    hp: 110, damage: 2, movement: 4, accuracy: 3, bounceBonus: 0,
    unlocked: false, cost: 1500,
    desc: 'Cura a los aliados al golpearlos con su propia bala.',
    healsAllies: true,          // ← comportamiento propio
  },
};
```

### 2. Implementa el comportamiento en `js/entities/Player.js`

```js
export class Player extends Entity {
  constructor(charId, spawn = {}, upgrades = {}) {
    // ...código existente...
    this.healsAllies = !!def.healsAllies;   // ← nuevo flag
  }

  /** Sobrescribe el efecto de impacto si el personaje lo necesita. */
  onHitAlly(ally, bounceCount) {
    if (this.healsAllies) ally.heal(this.damage * 3);
  }
}
```

### 3. Conéctalo en `CombatSystem._resolve()`

Dentro del bucle `for (const d of outcome.damaged)`, añade:

```js
if (d.entity.team === 'player' && this.world.currentShooter?.onHitAlly) {
  this.world.currentShooter.onHitAlly(d.entity, trace.bounceCount);
}
```

### 4. Añádelo al menú

Aparece automáticamente en la tienda porque `Menu._renderShop()` itera sobre
`CHARACTERS`. Para usarlo en un nivel, añade su id al campo `squad` del JSON.

---

## 👾 Cómo añadir un enemigo nuevo

### 1. Define el tipo en `js/utils/Constants.js`

```js
export const ENEMIES = {
  grunt: { /* ... */ },

  turret: {
    id: 'turret', name: 'Turret', color: '#a0a0c0',
    hp: 70, damage: 9, movement: 0, range: 18, ai: 'camper',
  },
};
```

### 2. (Opcional) Crea un perfil de IA en `js/systems/AISystem.js`

Si reutilizas un perfil existente (`aggressive`, `camper`, `charger`, `flanker`,
`boss`), no hay nada más que hacer. Para uno nuevo:

```js
planTurret(enemy, world) {
  // Las torretas no se mueven: solo buscan tiro y disparan.
  const players = world.players.filter((p) => p.alive);
  const targets = [...world.players, ...world.enemies];
  const shot = this._findShot(enemy, players, enemy.traceOptions(targets));
  return { move: null, shot };
}
```

Y en `plan()`, añade la bifurcación:

```js
if (enemy.aiProfile === 'turret') return this.planTurret(enemy, world);
```

### 3. Úsalo en un nivel

```json
{ "type": "turret", "cx": 14, "cy": 5 }
```

---

## 🔄 Cómo modificar las mecánicas de rebote

Todo vive en `js/utils/Constants.js`, bloque `BALLISTICS`:

```js
export const BALLISTICS = {
  MAX_BOUNCES: 6,         // rebotes máximos por disparo
  MAX_PATH_LEN: 4000,     // longitud máxima de la trayectoria (px)
  STEP: 2.0,              // precisión del raymarch (menor = más preciso)
  SPEED: 760,             // velocidad visual de la bala (px/s)
  LIFETIME: 5.0,          // timeout de seguridad (segundos)
  LOOP_WINDOW: 8,         // rebotes vigilados para detectar loops
  LOOP_EPS: 1.5,          // tolerancia en px para considerar "mismo punto"
  NUDGE: 0.6,             // separación de la superficie tras rebotar
  DMG_BOUNCE_BONUS: 0.15, // +15% de daño por cada rebote acumulado
};
```

**Cómo ajustar según lo que quieras:**

| Quiero… | Cambia |
|---|---|
| Tiros más limpios, menos rebotes | `MAX_BOUNCES: 3` |
| Que las balas hagan mucho más daño al rebotar | `DMG_BOUNCE_BONUS: 0.3` |
| Balas más rápidas y nerviosas | `SPEED: 1200` |
| Cero bucles infinitos posibles | `LOOP_WINDOW: 4`, `LOOP_EPS: 3` |

---

## 🗺️ Roadmap futuro

- **Multijugador online** — servidor Node + WebSockets, por turnos (el mismo
  `TurnManager` se presta a sincronización con validación en servidor).
- **Sprites e ilustración** — `Renderer.js` ya tiene el hueco `ASSETS` preparado:
  activar `ASSETS.enabled` y rellenar `ASSETS.images` con las imágenes.
- **Editor de niveles** — aprovechando que `LevelLoader.loadFromJSON()` ya existe.
- **Más modificadores** — viento, gravedad, portales, bumpers móviles.
- **Modo infinito** — oleadas con dificultad creciente.
- **Replays** — el determinismo del trazado permite reproducir partidas exactas.
- **Logros y ranking local**.

---

## ⚠️ Limitaciones conocidas

**Funciona bien:** rebotes, turnos, IA, colisiones, guardado, responsive,
rendimiento a 60 FPS con las partículas limitadas.

**Puntos débiles:**

- Los gráficos son geométricos procedurales, no ilustraciones. La paleta y la
  composición siguen el concepto visual, pero no hay personajes dibujados.
- El `Ghost` atraviesa la primera cobertura; en mapas con muchas coberturas
  seguidas puede sentirse potente. Balance pendiente.
- La IA no anticipa el movimiento del jugador: reacciona al estado actual.
- El sonido es sintético y funcional, no música.
- No hay modo online todavía (Fase 3 del proyecto).

**Edge cases cubiertos explícitamente:**

| Escenario | Solución implementada |
|---|---|
| Bala en loop entre paredes paralelas | Detección por ventana de rebotes + límite duro |
| Disparo fuera de pantalla | Los bordes del tablero actúan como muro: rebota |
| Dos personajes en la misma casilla | `CollisionSystem.canEnter()` antes de mover |
| Enemigo sin cobertura | `AISystem.retreat()` prioriza alejarse |
| Partículas acumulándose | Object pooling + límite de 100 activas |
| Cierre del navegador durante el turno | Autoguardado al inicio de cada turno |
| Disparo que nunca impacta | Timeout de 5 s y resolución garantizada |
| Pantalla muy pequeña | Canvas escalado, mínimo 320×480 |
| Toques simultáneos | `InputManager` ignora punteros adicionales |
| Nivel sin solución | Botón Pista, 50 monedas, calcula el mejor ángulo |

---

## 📜 Créditos y licencia

**Inlimity** — diseñado y programado en JavaScript vanilla sobre Canvas 2D.

- Motor, sistemas y arte procedural: propios.
- Sin dependencias externas. Sin assets de terceros.
- Tipografía: fuentes del sistema.

**Licencia:** MIT. Puedes usar, modificar y distribuir el proyecto libremente,
manteniendo el aviso de copyright.
