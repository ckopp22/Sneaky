'use strict';

const C = {
  VIEW_W: 960, VIEW_H: 540, LEVEL_COUNT: 100, COOP_LEVEL_COUNT: 100, COOP_NAMES: ['Two Doors', 'Split Paths', 'Crossing', 'Pincer', 'Together',
    'First Gate', 'Leapfrog', 'Switchback', 'Three Locks', 'Lockdown', 'Side by Side', 'Hold the Gate', 'Split Halls', 'Relay',
    'Double Lock', 'Hall of Plates', 'Tag Team', 'Long Way Round', 'Gauntlet', 'Final Maze', 'Vast Halls', 'Endless Maze', 'Lost Together',
    'The Great Maze', 'Grand Labyrinth', 'Twin Dome', 'Crossroads', 'The Ring', 'Starfield', 'Crescent Moon',
    'Dogleg', 'Teardrop', 'Figure Eight', 'Wave Cave', 'Horseshoe', 'Pods', 'Lightning', 'Roots', 'Sunburst', 'Grand Vault',
    'Duo Hello', 'Side Nooks', 'Three Cannons', 'T-Junction', 'Roaming Shooter', 'Stair Hall', 'Twin Shooters', 'The U', 'Pillar Hall', 'Long Gauntlet',
    'Duet Shallows', 'Decoy', 'Wet Gate', 'Two Reeds', 'Tide Pair', 'Lure Left', 'Lagoon Duo', 'Gate Current', 'Deep Pair', 'Abyss Duo',
    'Lights Out', 'Open Floor', 'Crowd', 'Four Corners', 'Wide Open', 'Patrol Ring', 'Big Hall', 'Cross Fire', 'Full House', 'Alarm Bells',
    'Duo Aim', 'Cover Fire', 'Back to Back', 'Two Shots', 'Overwatch', 'Clear the Hall', 'Pair Shot', 'Hot Lead', 'Standoff', 'Final Volley',
    'Wingmates', 'Formation', 'Crosswind Duo', 'Twin Flak', 'Hedge Hop', 'Close Air', 'Barrel Roll', 'Dogfight', 'Storm Front', 'Final Approach',
    'Coin Rush', 'Glint', 'Gold Dust', 'Treasure Hall', 'Pocket Change', 'Gilded Floor', 'Bounty', 'Mint', 'Vault Run', 'Jackpot'], STEP: 1 / 60,
  PLAYER_SPEED: 120, PLAYER_R: 10, JOY_R: 60, JOY_KNOB_R: 26, JOY_DEAD: 0.15,
  GRACE: 0.3, CATCH_TIME: 1.1, DRONE_SPEED: 70, DRONE_R: 56, DRONE_LOCK: 150, DRONE_TURN: 1.8, WINDUP: 0.4, GUARD_SPEED: 40, GUARD_FOV: 60, GUARD_RANGE: 120, GUARD_PAUSE: 1, LOOK_DEG: 70, GUARD_TURN_DEG: 75, GUARD_SWAY_DEG: 12, HEAR_RANGE: 200, TURN_PAUSE: 0.8, HEAR_DELAY: 1, SHOT_CD: 2, BULLET_SPEED: 340, WATER_HEAR: 230, SNEAK_MULT: 0.5, GUARD_ACCEL: 60,
  ZOOM_SOLO: 1.5, ZOOM_COOP: 1.2, RAY_STEP_DEG: 2, PLAYER_LIGHT_SCALE: 5.5,
  BG: '#0a0d14', WALL: '#1f4057', GOAL: 'rgba(110,255,171,0.2)', PLAYER: '#d9e6ff', PLAYER2: '#5aa0ff', GUARD: '#e64d4d',
  VISION: 'rgba(255,240,150,0.2)', LIGHT: 'rgba(255,217,77,0.26)', ALERT: 'rgba(255,38,38,0.4)',
  LAMP_ON: '#ffe666', LAMP_OFF: '#665c29', AMBIENT: 'rgb(4,5,9)', PLAYER_LIGHT: [204, 230, 255],
};
const TAU = Math.PI * 2;
const rad = (d) => d * Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (id) => document.getElementById(id);

const DEV = ['localhost', '127.0.0.1'].includes(location.hostname) || /[?&]dev\b/.test(location.search);

// ---------- assets ----------
const IMG = {};
function loadImages() {
  const files = { alert: 'graphics/alert_bubble', glow: 'graphics/goal_glow', circle: 'graphics/light_circle',
    vignette: 'graphics/vignette', base: 'joystick/joystick_base', knob: 'joystick/joystick_knob_active' };
  return Promise.all(Object.entries(files).map(([key, name]) => new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = `assets/ui/${name}.png`;
    IMG[key] = img;
  })));
}

// ---------- save + audio ----------
const store = {
  get() { try { return JSON.parse(localStorage.getItem('sneaky') || '{}'); } catch { return {}; } },
  set(patch) { try { localStorage.setItem('sneaky', JSON.stringify({ ...store.get(), ...patch })); } catch { /* ignore */ } },
};

const audio = (() => {
  const saved = store.get();
  const make = (name, volume, loop = false) => Object.assign(new Audio(`assets/audio/${name}.mp3`), { volume, loop });
  const a = { active: true, music: saved.music !== false, sfx: saved.sfx !== false, track: 0, started: false, rolling: false };
  const tracks = [1, 2, 3].map((n) => make(`music${n}`, 0.4));
  const alert = make('alert', 0.63), win = make('win', 0.8), keySnd = make('key', 0.7), unlockSnd = make('unlock', 0.7), roll = make('rolling', 0.4, true), walk = make('water', 0.6, true);
  const level = () => (a.ducked ? 0.15 : 0.4);
  const playTrack = () => {
    const t = tracks[a.track];
    t.volume = level();
    t.currentTime = 0;
    t.onended = () => { a.track = (a.track + 1) % tracks.length; playTrack(); };
    if (a.music && a.active) t.play().catch(() => { a.started = false; });
  };
  a.start = () => {
    const ac = getAc();
    if (ac && ac.state !== 'running') ac.resume();
    load(alert, 'alert'); load(win, 'win'); load(keySnd, 'key'); load(unlockSnd, 'unlock');
    if (!a.started) { a.started = true; playTrack(); }
  };
  a.duck = (on) => { a.ducked = on; tracks[a.track].volume = level(); };
  a.setMusic = (on) => {
    a.music = on; store.set({ music: on });
    if (on && a.started) tracks[a.track].play().catch(() => {}); else tracks[a.track].pause();
  };
  a.setSfx = (on) => { a.sfx = on; store.set({ sfx: on }); a.setRolling(false); };
  const getAc = () => {
    try { return a.ac || (a.ac = new (window.AudioContext || window.webkitAudioContext)()); } catch { return null; }
  };
  const bufs = new Map();
  const load = (s, name) => {
    const ac = getAc();
    if (!ac || bufs.has(s)) return;
    bufs.set(s, null);
    fetch(`assets/audio/${name}.mp3`).then((r) => r.arrayBuffer()).then((d) => new Promise((ok, no) => ac.decodeAudioData(d, ok, no)))
      .then((b) => bufs.set(s, b)).catch(() => bufs.delete(s));
  };
  const play = (s, name, vol) => {
    if (!a.sfx || !a.active) return;
    const ac = a.ac, b = bufs.get(s);
    if (ac && b) {
      if (ac.state !== 'running') ac.resume();
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = b; g.gain.value = vol;
      src.connect(g).connect(ac.destination);
      src.start();
    } else { s.currentTime = 0; s.play().catch(() => {}); load(s, name); }
  };
  a.setActive = (on) => {
    a.active = on;
    if (!on) {
      for (const s of [...tracks, alert, win, keySnd, unlockSnd, roll, walk]) s.pause();
      a.rolling = false;
    } else if (a.started && a.music) {
      tracks[a.track].play().catch(() => {});
    }
  };
  a.playAlert = () => play(alert, 'alert', 0.63);
  a.playWin = () => play(win, 'win', 0.8);
  a.playKey = () => play(keySnd, 'key', 0.7);
  a.playUnlock = () => play(unlockSnd, 'unlock', 0.7);
  a.playCoin = () => {
    if (!a.sfx || !a.active) return;
    try {
      const ac = getAc(), t0 = ac.currentTime;
      [988, 1319].forEach((f, i) => {
        const t = t0 + i * 0.07, o = ac.createOscillator(), g = ac.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (i ? 0.28 : 0.09));
        o.connect(g).connect(ac.destination);
        o.start(t); o.stop(t + 0.3);
      });
    } catch { /* ignore */ }
  };
  a.playCelebrate = () => {
    if (!a.sfx || !a.active) return;
    try {
      const ac = getAc();
      const t0 = ac.currentTime + 0.1;
      [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => {
        const t = t0 + i * 0.13, last = i === 7;
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (last ? 1.2 : 0.25));
        o.connect(g).connect(ac.destination);
        o.start(t); o.stop(t + (last ? 1.3 : 0.3));
      });
    } catch { /* ignore */ }
  };
  a.setRolling = (on) => {
    on = on && a.sfx && a.active;
    if (on === a.rolling) return;
    a.rolling = on;
    const cur = a.water ? walk : roll;
    roll.pause(); walk.pause();
    if (on) cur.play().catch(() => {});
  };
  return a;
})();

// ---------- state ----------
const S = {
  mode: 'loading', level: 1, names: [], walls: [], goal: null, plates: [], switches: [], barriers: [], solid: [], map: { w: 0, h: 0 },
  players: [{ x: 0, y: 0 }], me: 0, remoteInput: { x: 0, y: 0 }, coopMenu: false, visions: [], drones: [], keys: new Set(), joy: { id: -1, ox: 0, oy: 0, kx: 0, ky: 0, vx: 0, vy: 0 },
  cam: { x: 0, y: 0 }, view: { w: C.VIEW_W, h: C.VIEW_H, scale: 1, dpr: 1 },
};

// ---------- geometry ----------
function raycast(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  let best = 2;
  for (const r of S.solid) {
    let t0 = 0, t1 = 1, miss = false;
    for (const [a, d, lo, hi] of [[ax, dx, r.x, r.x + r.w], [ay, dy, r.y, r.y + r.h]]) {
      if (Math.abs(d) < 1e-9) {
        if (a < lo || a > hi) { miss = true; break; }
      } else {
        let u = (lo - a) / d, v = (hi - a) / d;
        if (u > v) [u, v] = [v, u];
        t0 = Math.max(t0, u); t1 = Math.min(t1, v);
        if (t0 > t1) { miss = true; break; }
      }
    }
    if (!miss && t0 < best) best = t0;
  }
  return best <= 1 ? { x: ax + dx * best, y: ay + dy * best } : null;
}

function pushOut(p, r) {
  const cx = Math.min(Math.max(p.x, r.x), r.x + r.w), cy = Math.min(Math.max(p.y, r.y), r.y + r.h);
  const dx = p.x - cx, dy = p.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= C.PLAYER_R * C.PLAYER_R) return;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2), k = (C.PLAYER_R - d) / d;
    p.x += dx * k; p.y += dy * k;
  } else {
    const left = p.x - r.x, right = r.x + r.w - p.x, top = p.y - r.y, bottom = r.y + r.h - p.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = r.x - C.PLAYER_R; else if (m === right) p.x = r.x + r.w + C.PLAYER_R;
    else if (m === top) p.y = r.y - C.PLAYER_R; else p.y = r.y + r.h + C.PLAYER_R;
  }
}

function touchesRect(p, r) {
  const cx = Math.min(Math.max(p.x, r.x), r.x + r.w), cy = Math.min(Math.max(p.y, r.y), r.y + r.h);
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 <= C.PLAYER_R * C.PLAYER_R;
}

function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return d;
}

// ---------- vision (guards + lights) ----------
function makeVision(x, y, fov, range, cone) {
  return { x, y, ang: 0, fov, range, cone, active: true, bubbleY: -42, seen: 0, alerted: false, poly: [] };
}

function makeGuard(d, tile) {
  const wander = !!d.wander || S.roam;
  const path = (d.wander ?? d.path).map((p) => ({ x: (p[0] + 0.5) * tile, y: (p[1] + 0.5) * tile }));
  const g = makeVision(path[0].x, path[0].y, Math.min((d.fov ?? C.GUARD_FOV) * (1 + 0.5 * (S.diff - 1)), 120), (d.range ?? C.GUARD_RANGE) * S.diff, C.VISION);
  Object.assign(g, { kind: 'guard', path, speed: d.speed ?? C.GUARD_SPEED, pause: d.pause ?? C.GUARD_PAUSE,
    erratic: d.erratic ?? 0, wander, vel: 0, cur: 0, last: -1, destIdx: -1, dest: null, route: null, next: 1, dir: 1, pauseLeft: 0, pauseTotal: 1, lookBase: 0, mult: 1, multLeft: 0 });
  if (!d.wander && path.length > 1) g.ang = Math.atan2(path[1].y - path[0].y, path[1].x - path[0].x);
  if (d.turret) Object.assign(g, { turret: true, active: false, wander: false, ang: rad(d.aim ?? 0) });
  if (d.shoot) g.shoot = { every: d.shoot.every ?? 3, speed: d.shoot.speed ?? C.DRONE_SPEED, t: d.shoot.offset ?? 0 };
  return g;
}

function makeDrone(x, y, ang, speed) {
  const d = makeVision(x, y, 360, C.DRONE_R, C.LIGHT);
  return Object.assign(d, { kind: 'drone', ang, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, bx: x, by: y, spd: speed, trav: 0 });
}

function spawnWave(dt) {
  const f = S.fly;
  if (!f || S.mode !== 'playing') return;
  f.t -= dt;
  if (f.t > 0) return;
  f.t = f.wave * rand(0.7, 1.3);
  const live = S.players.filter((p) => !p.dead);
  if (!live.length) return;
  if (S.mini) {
    if (S.drones.length >= 30) return;
    const n = f.count[0] + Math.floor(Math.random() * (f.count[1] - f.count[0] + 1)), R = Math.hypot(S.view.w, S.view.h) / 2 + 60;
    for (let i = 0; i < n; i++) {
      const c = live[Math.floor(Math.random() * live.length)];
      for (let tries = 0; tries < 12; tries++) {
        const a = rand(0, TAU), x = c.x + Math.cos(a) * R, y = c.y + Math.sin(a) * R;
        if (x < 50 || y < 50 || x > S.map.w - 50 || y > S.map.h - 50 || S.solid.some((w) => x > w.x - 10 && x < w.x + w.w + 10 && y > w.y - 10 && y < w.y + w.h + 10)) continue;
        const d = makeDrone(x, y, Math.atan2(c.y - y, c.x - x), rand(f.speed[0], f.speed[1]));
        Object.assign(d, { lock: true, turn: f.turn, active: false });
        S.drones.push(d);
        break;
      }
    }
    return;
  }
  const sx = S.cam.x + S.view.w / 2 + 40;
  if (sx > S.goal.x + S.goal.w / 2) return;
  const n = f.count[0] + Math.floor(Math.random() * (f.count[1] - f.count[0] + 1));
  for (let i = 0; i < n; i++) {
    const aim = Math.random() < 0.3 ? live[Math.floor(Math.random() * live.length)] : null;
    const y = aim ? clamp(aim.y + rand(-25, 25), 48, S.map.h - 48) : rand(48, S.map.h - 48);
    const d = makeDrone(sx + Math.random() * 140, y, Math.PI, rand(f.speed[0], f.speed[1]));
    Object.assign(d, { straight: true, active: false });
    S.drones.push(d);
  }
}

function updateShooters(dt) {
  spawnWave(dt);
  for (const v of S.visions) {
    if (v.dead) continue;
    if (S.alarm && v.kind === 'guard' && !v.turret && !v.shoot) v.shoot = { every: 3.5, speed: C.DRONE_SPEED, t: Math.random() * 3 };
    const s = v.shoot;
    if (!s) continue;
    s.t += dt;
    v.windup = s.t >= s.every - C.WINDUP;
    if (s.t >= s.every) { s.t = 0; v.windup = false; 
      if (S.chaseAll) {
        const tgt = S.players.filter((p) => !p.dead).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
        if (!tgt || S.drones.length >= 30) continue;
        S.drones.push(Object.assign(makeDrone(v.x, v.y, Math.atan2(tgt.y - v.y, tgt.x - v.x), s.speed), { active: false, lock: true, turn: 0.9, life: 9 }));
      } else S.drones.push(makeDrone(v.x, v.y, v.ang + (v.sway || 0), s.speed));
    }
  }
  for (let i = S.drones.length - 1; i >= 0; i--) {
    const d = S.drones[i];
    if (d.straight && d.bx < S.cam.x - S.view.w / 2 - 120) { S.drones.splice(i, 1); continue; }
    if (d.life !== undefined && (d.life -= dt) <= 0) { S.drones.splice(i, 1); continue; }
    if (!S.droneSway && d.spd && !d.straight) {
      let tgt = null, best = d.lock ? Infinity : C.DRONE_LOCK;
      for (const p of S.players) {
        const dist = Math.hypot(p.x - d.bx, p.y - d.by);
        if (!p.dead && p.invuln <= 0 && dist < best && (d.lock || !raycast(d.bx, d.by, p.x, p.y))) { best = dist; tgt = p; }
      }
      if (tgt) {
        const cur = Math.atan2(d.vy, d.vx), a = cur + clamp(angleDiff(cur, Math.atan2(tgt.y - d.by, tgt.x - d.bx)), -(d.turn || C.DRONE_TURN) * dt, (d.turn || C.DRONE_TURN) * dt);
        d.vx = Math.cos(a) * d.spd; d.vy = Math.sin(a) * d.spd; d.ang = a;
      }
    }
    const nx = d.bx + d.vx * dt, ny = d.by + d.vy * dt;
    if (d.lock) {
      // locked drones slide along walls instead of vanishing
      if (!raycast(d.bx, d.by, nx, ny)) { d.bx = nx; d.by = ny; }
      else if (!raycast(d.bx, d.by, nx, d.by)) d.bx = nx;
      else if (!raycast(d.bx, d.by, d.bx, ny)) d.by = ny;
      d.x = d.bx; d.y = d.by; d.trav += d.spd * dt;
      continue;
    }
    if (raycast(d.bx, d.by, nx, ny)) { S.drones.splice(i, 1); continue; }
    d.bx = nx; d.by = ny; d.trav += d.spd * dt;
    const off = S.droneSway * Math.min(1, d.trav / 200) * Math.sin(d.trav / 35), sx = nx - d.vy / d.spd * off, sy = ny + d.vx / d.spd * off;
    const inWall = S.solid.some((w) => sx >= w.x && sx <= w.x + w.w && sy >= w.y && sy <= w.y + w.h);
    d.x = inWall ? nx : sx; d.y = inWall ? ny : sy;
  }
}

function makeLight(d, tile) {
  const l = makeVision((d.pos[0] + 0.5) * tile, (d.pos[1] + 0.5) * tile, 0, 0, C.LIGHT);
  const period = d.period ?? 4;
  Object.assign(l, { kind: d.type ?? 'sweep', period, time: d.offset ?? 0 });
  if (l.kind === 'blink') {
    Object.assign(l, { fov: 360, range: (d.radius ?? 80) * (1 + 1.3 * (S.diff - 1)), onTime: d.on ?? period / 2 });
  } else {
    const arc = d.arc ?? [0, 180];
    Object.assign(l, { arcFrom: arc[0], arcTo: arc[1], fov: d.fov ?? 40, range: (d.range ?? 140) * S.diff });
  }
  return l;
}

function startPause(g, duration) {
  g.pauseTotal = duration; g.pauseLeft = duration; g.lookBase = g.ang;
}

function clearLine(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  return [-8, 0, 8].every((o) => !raycast(a.x + nx * o, a.y + ny * o, b.x + nx * o, b.y + ny * o));
}

function buildNav(tile, seed) {
  const cols = Math.ceil(S.map.w / tile), rows = Math.ceil(S.map.h / tile), blocked = new Uint8Array(cols * rows);
  for (const r of S.walls) {
    for (let y = Math.floor(r.y / tile); y < Math.ceil((r.y + r.h) / tile); y++) {
      for (let x = Math.floor(r.x / tile); x < Math.ceil((r.x + r.w) / tile); x++) {
        if (x >= 0 && y >= 0 && x < cols && y < rows) blocked[y * cols + x] = 1;
      }
    }
  }
  // anything walled off from the start (the void outside an odd-shaped map, sealed pockets) is off limits to guards
  const reach = new Uint8Array(cols * rows), sx = clamp(seed.x, 0, cols - 1), sy = clamp(seed.y, 0, rows - 1), stack = [sy * cols + sx];
  if (!blocked[stack[0]]) reach[stack[0]] = 1; else stack.length = 0;
  while (stack.length) {
    const c = stack.pop(), x = c % cols, y = (c - x) / cols;
    for (const n of [x > 0 && c - 1, x < cols - 1 && c + 1, y > 0 && c - cols, y < rows - 1 && c + cols]) {
      if (n !== false && !blocked[n] && !reach[n]) { reach[n] = 1; stack.push(n); }
    }
  }
  if (reach.includes(1)) for (let i = 0; i < blocked.length; i++) if (!reach[i]) blocked[i] = 1;
  S.nav = { tile, cols, rows, blocked };
}

const navCell = (p) => {
  const { tile, cols, rows } = S.nav;
  return clamp(Math.floor(p.y / tile), 0, rows - 1) * cols + clamp(Math.floor(p.x / tile), 0, cols - 1);
};
const cellPos = (i) => ({ x: (i % S.nav.cols + 0.5) * S.nav.tile, y: (Math.floor(i / S.nav.cols) + 0.5) * S.nav.tile });

// A* over the wall grid, then string-pulled so guards cut corners but never clip walls.
function findRoute(from, to) {
  const { cols, rows, blocked } = S.nav, start = navCell(from), end = navCell(to);
  if (blocked[start] || blocked[end] || (!S.maze && clearLine(from, to))) return [to];
  const g = new Map([[start, 0]]), prev = new Map(), open = [start], closed = new Set();
  const h = (i) => Math.hypot(i % cols - end % cols, Math.floor(i / cols) - Math.floor(end / cols));
  const f = new Map([[start, h(start)]]);
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f.get(open[k]) < f.get(open[bi])) bi = k;
    const cur = open.splice(bi, 1)[0];
    if (cur === end) break;
    closed.add(cur);
    const cx = cur % cols, cy = Math.floor(cur / cols);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if ((!dx && !dy) || (S.maze && dx && dy) || nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const n = ny * cols + nx;
        if (blocked[n] || closed.has(n)) continue;
        if (dx && dy && (blocked[cy * cols + nx] || blocked[ny * cols + cx])) continue;
        const near = S.maze && [-1, 0, 1].some((oy) => [-1, 0, 1].some((ox) => blocked[(ny + oy) * cols + nx + ox]));
        const cost = g.get(cur) + (dx && dy ? 1.414 : 1) + (near ? 2 : 0);
        if (cost < (g.get(n) ?? Infinity)) {
          g.set(n, cost); prev.set(n, cur); f.set(n, cost + h(n));
          if (!open.includes(n)) open.push(n);
        }
      }
    }
  }
  if (!prev.has(end)) return [to];
  const cells = [];
  for (let c = end; c !== start; c = prev.get(c)) cells.unshift(cellPos(c));
  cells[cells.length - 1] = to;
  if (S.maze) {
    // hug the hall centre: keep only the corners, and mark them so the guard stops there to look around
    const pts = [from, ...cells], out = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      if (Math.sign(b.x - a.x) !== Math.sign(c.x - b.x) || Math.sign(b.y - a.y) !== Math.sign(c.y - b.y)) out.push({ x: b.x, y: b.y, turn: true });
    }
    out.push(to);
    return out;
  }
  const out = [];
  let anchor = from;
  for (let i = 0; i < cells.length; i++) {
    if (i + 1 < cells.length && clearLine(anchor, cells[i + 1])) continue;
    out.push(cells[i]); anchor = cells[i];
  }
  return out;
}

// Roaming guards drift to random open floor (preferring hall centres), otherwise to one of their waypoints.
function pickDest(g) {
  g.destIdx = -1;
  if (S.roam && Math.random() < 0.7) {
    const { cols, rows, blocked, tile } = S.nav, c0 = navCell(g), cx = c0 % cols, cy = Math.floor(c0 / cols);
    for (let tries = 0; tries < 20; tries++) {
      const nx = clamp(cx + Math.round(rand(-10, 10)), 1, cols - 2), ny = clamp(cy + Math.round(rand(-7, 7)), 1, rows - 2), n = ny * cols + nx;
      if (blocked[n] || Math.hypot(nx - cx, ny - cy) < 4) continue;
      if (tries < 12 && [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => blocked[(ny + dy) * cols + nx + dx]))) continue;
      return cellPos(n);
    }
  }
  const all = g.path.map((_, i) => i).filter((i) => i !== g.cur);
  const fresh = all.filter((i) => i !== g.last);
  const pool = fresh.length ? fresh : all;
  g.destIdx = pool[Math.floor(Math.random() * pool.length)];
  return g.path[g.destIdx];
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const turnToward = (g, target, dt) => { g.ang += clamp(angleDiff(g.ang, target), -rad(C.GUARD_TURN_DEG) * dt, rad(C.GUARD_TURN_DEG) * dt); };

function patrol(g, dt) {
  if (g.path.length < 2) return;
  if (g.pauseLeft > 0) {
    g.pauseLeft = Math.max(g.pauseLeft - dt, 0);
    g.vel = Math.max(0, g.vel - C.GUARD_ACCEL * dt);
    turnToward(g, g.lookBase + Math.sin(TAU * (1 - g.pauseLeft / g.pauseTotal)) * rad(C.LOOK_DEG), dt);
    return;
  }
  const e = g.erratic;
  if (e > 0) {
    g.multLeft -= dt;
    if (g.multLeft <= 0) {
      g.mult = rand(1 - 0.5 * e, 1 + 0.4 * e);
      g.multLeft = rand(0.5, 1.5);
      if (Math.random() < 0.2 * e) { g.mult = 0; g.multLeft = rand(0.6, 1.2); }
    }
  }
  if (!g.dest) g.dest = g.wander ? pickDest(g) : g.path[g.next];
  if (!g.route) g.route = findRoute(g, g.dest);
  const goal = g.route[0], last = g.route.length === 1, dx = goal.x - g.x, dy = goal.y - g.y, dist = Math.hypot(dx, dy);
  if (dist <= 2) {
    g.x = goal.x; g.y = goal.y;
    const reached = g.route.shift();
    if (g.route.length) { if (reached.turn) startPause(g, C.TURN_PAUSE); return; }
    g.vel = 0; g.route = null; g.dest = null;
    if (g.wander) {
      if (g.destIdx >= 0) { g.last = g.cur; g.cur = g.destIdx; }
    } else {
      if (g.next + g.dir < 0 || g.next + g.dir >= g.path.length) g.dir = -g.dir;
      g.next += g.dir;
    }
    startPause(g, g.pause * (g.wander ? rand(0.3, 1.7) : 1) * rand(1 - 0.4 * e, 1 + 0.6 * e));
    return;
  }
  const desired = Math.atan2(dy, dx);
  turnToward(g, desired, dt);
  const align = Math.max(0, Math.cos(angleDiff(g.ang, desired))) ** 3;
  const top = last ? Math.min(g.speed * g.mult * align, 15 + dist * 2.5) : g.speed * g.mult * align;
  g.vel += clamp(top - g.vel, -C.GUARD_ACCEL * dt, C.GUARD_ACCEL * dt);
  const move = Math.min(g.vel * dt, dist);
  g.x += dx / dist * move; g.y += dy / dist * move;
}

function sweepLight(l, dt) {
  l.time += dt;
  if (l.kind === 'blink') {
    l.active = ((l.time % l.period) + l.period) % l.period < l.onTime;
  } else {
    const t = 0.5 - 0.5 * Math.cos(TAU * l.time / l.period);
    l.ang = rad(lerp(l.arcFrom, l.arcTo, t));
  }
}

function updatePoly(v) {
  const count = Math.max(1, Math.ceil(v.fov / C.RAY_STEP_DEG)), half = rad(v.fov) / 2;
  v.poly = [{ x: 0, y: 0 }];
  for (let i = 0; i <= count; i++) {
    const a = v.ang + (v.sway || 0) + lerp(-half, half, i / count);
    const ex = v.x + Math.cos(a) * v.range, ey = v.y + Math.sin(a) * v.range;
    const hit = raycast(v.x, v.y, ex, ey) || { x: ex, y: ey };
    v.poly.push({ x: hit.x - v.x, y: hit.y - v.y });
  }
}

function canSee(v, p) {
  const dx = p.x - v.x, dy = p.y - v.y;
  if (Math.hypot(dx, dy) > v.range) return false;
  if (Math.abs(angleDiff(v.ang + (v.sway || 0), Math.atan2(dy, dx))) > rad(v.fov) / 2) return false;
  return !raycast(v.x, v.y, p.x, p.y);
}

function listen(g, dt) {
  g.coolT = Math.max(0, (g.coolT || 0) - dt);
  const p = S.players.find((q) => !q.dead && q.invuln <= 0 && Math.hypot(q.x - g.x, q.y - g.y) < C.HEAR_RANGE
    && Math.abs(angleDiff(g.ang, Math.atan2(q.y - g.y, q.x - g.x))) > rad(110));
  if (!p || g.pauseLeft > 0 || g.coolT > 0) { g.hearT = 0; return; }
  g.hearT = (g.hearT || 0) + dt;
  if (g.hearT < C.HEAR_DELAY) return;
  g.hearT = 0; g.coolT = 4;
  startPause(g, 3);
  g.lookBase = g.ang + Math.PI;
}

function spawnDefender() {
  const t = S.nav.tile, g = makeGuard({ path: [[(S.goal.x + S.goal.w / 2) / t - 0.5, (S.goal.y + S.goal.h / 2) / t - 0.5]], fov: 100, range: 170 }, t);
  return Object.assign(g, { defender: true, home: { x: g.x, y: g.y }, ang: Math.PI });
}

function hunt(g, dt) {
  const near = S.players.filter((q) => !q.dead && q.invuln <= 0).sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0];
  const p = g.defender ? near && Math.hypot(near.x - g.home.x, near.y - g.home.y) < 170 && near : S.alarm || S.chaseAll ? near : S.players.find((q) => !q.dead && q.noisy && q.invuln <= 0 && Math.hypot(q.x - g.x, q.y - g.y) < C.WATER_HEAR);
  if (p) {
    let t = { x: p.x, y: p.y };
    if (S.alarm || S.chaseAll) {
      const gs = S.visions.filter((v) => v.kind === 'guard' && !v.turret && !v.defender), a = TAU * gs.indexOf(g) / gs.length;
      const rad = clamp((Math.hypot(p.x - g.x, p.y - g.y) - 50) * 0.6, 0, 110);
      const o = { x: clamp(p.x + Math.cos(a) * rad, 40, S.map.w - 40), y: clamp(p.y + Math.sin(a) * rad, 40, S.map.h - 40) };
      if (!S.nav.blocked[navCell(o)]) t = o;
    }
    g.chase = t; g.chaseLeft = 1.5;
  }
  if (g.defender && !p && Math.hypot(g.home.x - g.x, g.home.y - g.y) > 4) { g.chase = g.home; g.chaseLeft = 1; }
  if (!(g.chaseLeft > 0)) return false;
  g.chaseLeft -= dt;
  g.pauseLeft = 0; g.dest = null;
  g.reT = (g.reT || 0) - dt;
  if (!g.route || g.reT <= 0 || p) { g.route = findRoute(g, g.chase); g.reT = 0.4; }
  const goal = g.route[0], dx = goal.x - g.x, dy = goal.y - g.y, dist = Math.hypot(dx, dy);
  if (dist <= 2) { g.route.shift(); if (!g.route.length) g.chaseLeft = Math.min(g.chaseLeft, 0); }
  else {
    turnToward(g, Math.atan2(dy, dx), dt * 2);
    const move = Math.min(g.speed * (S.alarm ? 2 : S.chaseAll ? 1.4 : 1.6) * dt, dist);
    g.x += dx / dist * move; g.y += dy / dist * move; g.vel = g.speed;
    if (S.alarm || S.chaseAll) for (const o of S.visions) {
      if (o === g || o.kind !== 'guard' || o.turret) continue;
      const ox = g.x - o.x, oy = g.y - o.y, od = Math.hypot(ox, oy);
      if (od > 0 && od < 40) { g.x += ox / od * (40 - od) * 0.15; g.y += oy / od * (40 - od) * 0.15; }
    }
  }
  if (g.chaseLeft <= 0) { g.route = null; g.vel = 0; startPause(g, 1.5); }
  return true;
}

function updateVision(v, dt) {
  if (v.dead) { v.poly = []; v.seen = 0; return []; }
  if (v.kind === 'guard') {
    if (!v.turret) {
      if (!((S.water || S.alarm || S.chaseAll) && hunt(v, dt))) { listen(v, dt); patrol(v, dt); }
      v.swayT = (v.swayT ?? Math.random() * TAU) + (v.seen > 0 ? 0 : dt * 2.4);
      v.sway = rad(C.GUARD_SWAY_DEG) * Math.sin(v.swayT);
    }
  } else if (v.kind !== 'drone') sweepLight(v, dt);
  const spotted = [];
  if (!v.active) { v.poly = []; v.seen = 0; v.times = []; return spotted; }
  updatePoly(v);
  v.times = v.times || [];
  let seen = 0;
  S.players.forEach((p, i) => {
    if (p.dead || p.invuln > 0 || !canSee(v, p)) { v.times[i] = 0; return; }
    v.times[i] = (v.times[i] || 0) + dt;
    seen = Math.max(seen, v.times[i]);
    if (v.times[i] >= C.GRACE) { spotted.push(i); v.times[i] = 0; }
  });
  v.seen = seen;
  return spotted;
}

// ---------- level ----------
function royaleData(coop) {
  const w = 70, h = 44, cx = w / 2, cy = h / 2;
  const walls = [[0, 0, w, 1], [0, h - 1, w, 1], [0, 0, 1, h], [w - 1, 0, 1, h]];
  for (const [x, y] of [[30, 20], [38, 20], [34, 16], [34, 26], [20, 10], [50, 10], [20, 33], [50, 33], [8, 22], [60, 22], [34, 6], [34, 37], [24, 16], [45, 16], [24, 27], [45, 27]]) walls.push([x, y, 2, 2]);
  const slots = Array.from({ length: 10 }, (_, i) => [Math.round(cx + 13 * Math.cos(TAU * i / 10 - Math.PI / 2)), Math.round(cy + 10 * Math.sin(TAU * i / 10 - Math.PI / 2))]);
  const humans = coop ? [0, 5] : [0];
  const d = { id: 'royale', name: 'Battle Royale', size: [w, h], tileSize: 32, goal: { rect: [0, 0, 0, 0] }, guards: [], lights: [], diff: 1, mini: 'royale', walls,
    bots: slots.filter((_, i) => !humans.includes(i)), hint: 'Last one standing wins! Double-tap or press SPACE to shoot. Stay inside the red ring.' };
  if (coop) d.playerStarts = humans.map((i) => slots[i]); else d.playerStart = slots[0];
  return d;
}

function miniData(type, coop) {
  if (type === 'royale') return royaleData(coop);
  const fly = type === 'fly', w = fly ? 66 : 60, h = fly ? 36 : 34, m = h / 2;
  const walls = [[0, 0, w, 1], [0, h - 1, w, 1], [0, 0, 1, h], [w - 1, 0, 1, h]];
  if (fly) for (const [x, y] of [[10, 8], [24, 8], [38, 8], [52, 8], [17, 18], [45, 18], [10, 28], [24, 28], [38, 28], [52, 28]]) walls.push([x, y, 2, 2]);
  else for (const [x, y] of [[8, 6], [18, 6], [28, 6], [38, 6], [48, 6], [13, 16], [23, 16], [43, 16], [8, 26], [18, 26], [28, 26], [38, 26], [48, 26]]) walls.push([x, y, 2, 3]);
  const d = { id: type, name: fly ? 'Fly' : 'Collect', size: [w, h], tileSize: 32, goal: { rect: [0, 0, 0, 0] }, guards: [], lights: [], diff: 1, mini: type, walls,
    hint: fly ? 'Fly anywhere and grab the stars. Drones lock on, so turn to dodge them. Red triangles show where they come from.'
      : 'Grab as many coins as you can. Guards hunt you down, and more arrive the longer you last.' };
  if (coop) d.playerStarts = [[w / 2 - 1, m], [w / 2 + 1, m]]; else d.playerStart = [w / 2, m];
  return d;
}

async function loadLevel(id, coop = false) {
  const data = typeof id === 'string' ? miniData(id, coop) : await (await fetch(coop ? `assets/levels/coop/coop${id}.json` : `assets/levels/level${id}.json`)).json();
  const tile = data.tileSize ?? 32, rect = (a) => ({ x: a[0] * tile, y: a[1] * tile, w: a[2] * tile, h: a[3] * tile });
  S.level = id;
  S.map = { w: data.size[0] * tile, h: data.size[1] * tile };
  S.walls = data.walls.map(rect);
  S.diff = data.diff ?? Math.min(1 + 0.035 * Math.max(0, id - 5), 1.75);
  S.roam = id > 5;
  S.maze = !!data.maze;
  const trig = (list) => (list ?? []).map((o) => ({ id: o.id, ...rect(o.rect), on: false }));
  const barrier = (list, kind) => (list ?? []).map((o) => ({ id: o.id, kind, ...rect(o.rect), open: false }));
  S.plates = trig(data.plates); S.switches = trig(data.switches);
  S.barriers = [...barrier(data.gates, 'gate'), ...barrier(data.doors, 'door'), ...barrier(data.lock ? [{ id: 'k', rect: data.lock.rect }] : [], 'lock')];
  S.key = data.key ? { x: (data.key[0] + 0.5) * tile, y: (data.key[1] + 0.5) * tile } : null;
  S.keyGot = false;
  updateSolids();
  S.goal = rect(data.goal.rect);
  const ps = data.playerStart ?? data.playerStarts[0];
  buildNav(tile, { x: ps[0], y: ps[1] });
  S.hideGoal = !!data.hideGoal;
  const sx = (ps[0] + 0.5) * tile, sy = (ps[1] + 0.5) * tile;
  const at = (a) => ({ x: (a[0] + 0.5) * tile, y: (a[1] + 0.5) * tile });
  S.players = coop
    ? (data.playerStarts ?? [[0, 0], [0, 0]]).map((a, i) => ({ ...(data.playerStarts ? at(a) : { x: sx, y: sy + (i ? 11 : -11) }), color: i ? C.PLAYER2 : C.PLAYER }))
    : [{ x: sx, y: sy, color: C.PLAYER }];
  S.players.forEach((p) => Object.assign(p, { alpha: 1, dead: false, invuln: 0, respawnT: 0, cd: 0, face: { x: 1, y: 0 } }));
  S.checkpoint = data.checkpoint ? rect(data.checkpoint.rect) : data.respawn ? rect(data.respawn) : null;
  S.cpRepeat = !!data.respawn;
  S.cpActive = false;
  S.hint = data.hint ?? ''; S.hintT = 8;
  S.failT = 1.2;
  S.remoteInput = { x: 0, y: 0 }; S.remoteSneak = false;
  S.coopMenu = false;
  S.drones = [];
  S.droneSway = data.droneSway ?? 0;
  S.water = !!data.water; audio.water = S.water;
  S.alarmLevel = !!data.alarm; S.alarm = false; S.alarmK = data.mini && data.mini !== 'collect' ? 1 : 0;
  S.mini = data.mini ? { type: data.mini, t: 0, starT: 1, best: (store.get().mini ?? {})[data.mini + (coop ? '_coop' : '')] ?? 0 } : null;
  S.chaseAll = data.mini === 'collect';
  S.fly = data.mini === 'fly' ? { wave: 3.6, count: [1, 2], speed: [80, 100], turn: 0.7, t: 2 } : data.fly ? { ...data.fly, t: 2 } : null;
  S.coinList = (data.coins ?? []).map((a) => ({ ...at(a), got: false })); S.coinNeed = data.coinNeed ?? 0; S.coins = 0;
  S.royale = data.mini === 'royale'; S.results = null;
  S.bots = (data.bots ?? []).map((a) => ({ ...at(a), dead: false, cd: rand(1, 3), strafe: 1, wt: 0 }));
  S.zone = { r: ROYALE_R0 }; S.alive = S.players.length + S.bots.length;
  S.shoot = !!data.shoot || S.royale; S.need = data.kills ?? 0; S.kills = 0; S.bullets = [];
  S.sneakKey = S.sneakLatch = false; S.lastTap = 0;
  S.visions = [...(data.guards ?? []).map((g) => makeGuard(g, tile)), ...(data.lights ?? []).map((l) => makeLight(l, tile))];
  S.joy.vx = S.joy.vy = 0;
  S.zoom = coop ? C.ZOOM_COOP : C.ZOOM_SOLO;
  resize();
}

const me = () => S.players[S.me];
const camTarget = () => (me().dead && S.players.find((p) => !p.dead)) || me();

function updateSolids() {
  S.solid = S.walls.concat(S.barriers.filter((b) => !b.open));
}

function updateMechanics() {
  const alive = S.players.filter((p) => !p.dead);
  for (const pl of S.plates) pl.on = alive.some((p) => touchesRect(p, pl));
  for (const sw of S.switches) if (!sw.on && alive.some((p) => touchesRect(p, sw))) sw.on = true;
  if (S.key && !S.keyGot && alive.some((p) => Math.hypot(p.x - S.key.x, p.y - S.key.y) < C.PLAYER_R + 12)) {
    S.keyGot = true; S.hint = 'Key found! The door is unlocked.'; S.hintT = 4; audio.playKey();
  }
  for (const b of S.barriers) b.open = b.kind === 'lock' ? S.keyGot : (b.kind === 'gate' ? S.plates : S.switches).some((t) => t.id === b.id && t.on);
  updateSolids();
}

function followCamera() {
  const p = camTarget();
  S.cam.x = p.x; S.cam.y = p.y;
}

function inputVector() {
  const k = S.keys, x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
  const y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
  let v = { x, y };
  if (!x && !y) v = { x: S.joy.vx, y: S.joy.vy };
  const len = Math.hypot(v.x, v.y);
  return len > 1 ? { x: v.x / len, y: v.y / len } : v;
}

function movePlayer(p, dir, dt) {
  const sp = C.PLAYER_SPEED * (p.sneak ? C.SNEAK_MULT : 1);
  p.x += dir.x * sp * dt; p.y += dir.y * sp * dt;
  for (let i = 0; i < 3; i++) for (const w of S.solid) pushOut(p, w);
}

function revive(p, i) {
  const c = S.checkpoint;
  Object.assign(p, { dead: false, invuln: 1.5, x: c.x + c.w / 2 + (i ? 10 : -10), y: c.y + c.h / 2 });
}

function killPlayer(i) {
  if (S.players.length === 1) { S.mode = 'catching'; S.catchT = 0; audio.setRolling(false); audio.playAlert(); return; }
  const p = S.players[i];
  if (p.dead) return;
  p.dead = true;
  audio.playAlert();
}

function makeChaser(x, y, speed = C.GUARD_SPEED) {
  const t = S.nav.tile;
  const g = makeGuard({ path: [[x / t - 0.5, y / t - 0.5]], fov: 50, range: 90, speed }, t), age = S.mini ? S.mini.t : 0;
  return Object.assign(g, { active: false, glow: 56, shoot: { every: Math.max(2.5, 5.5 - age * 0.02), speed: Math.min(80 + age * 0.4, 130), t: Math.random() * 3 } });
}

function killFighter(f) {
  if (f.dead) return;
  f.dead = true; f.place = S.alive; S.alive--;
  if (S.players.includes(f)) audio.playAlert();
}

function stepBot(b, dir, dt) {
  b.x += dir.x * 95 * dt; b.y += dir.y * 95 * dt;
  for (let i = 0; i < 3; i++) for (const w of S.solid) pushOut(b, w);
}

function updateBots(dt) {
  const cx = S.map.w / 2, cy = S.map.h / 2, norm = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
  for (const b of S.bots) {
    if (b.dead) continue;
    b.cd = Math.max(0, b.cd - dt);
    if ((b.sw = (b.sw ?? 0) - dt) <= 0) { b.sw = rand(1, 2.2); b.strafe = Math.random() < 0.5 ? 1 : -1; }
    let tgt = null, best = 360;
    for (const o of [...S.players.filter((p) => !p.dead), ...S.bots.filter((q) => q !== b && !q.dead)]) {
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < best && !raycast(b.x, b.y, o.x, o.y)) { best = d; tgt = o; }
    }
    let dir = { x: 0, y: 0 };
    if (Math.hypot(b.x - cx, b.y - cy) > S.zone.r - 70) dir = norm(cx - b.x, cy - b.y);
    else if (tgt) {
      const n = norm(tgt.x - b.x, tgt.y - b.y);
      dir = best > 170 ? n : best < 110 ? { x: -n.x, y: -n.y } : { x: -n.y * b.strafe, y: n.x * b.strafe };
      if (b.cd <= 0 && S.mini.t > 3) {
        const a = Math.atan2(n.y, n.x) + rand(-0.22, 0.22);
        spawnBullet(b, { x: Math.cos(a), y: Math.sin(a) });
        b.cd = 2 + rand(0.2, 1.4);
      }
    } else {
      if ((b.wt -= dt) <= 0 || !b.wp) {
        const a = rand(0, TAU), r = rand(0, Math.max(S.zone.r - 100, 20));
        b.wp = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; b.wt = rand(3, 6);
      }
      if (Math.hypot(b.wp.x - b.x, b.wp.y - b.y) > 12) dir = norm(b.wp.x - b.x, b.wp.y - b.y);
    }
    stepBot(b, dir, dt);
  }
}

function updateRoyale(dt) {
  const t = S.mini.t, cx = S.map.w / 2, cy = S.map.h / 2;
  S.zone.r = t < 20 ? ROYALE_R0 : Math.max(90, ROYALE_R0 - (ROYALE_R0 - 90) * (t - 20) / 130);
  updateBots(dt);
  for (const f of [...S.players, ...S.bots]) {
    if (f.dead) continue;
    if (Math.hypot(f.x - cx, f.y - cy) > S.zone.r) { if ((f.out = (f.out || 0) + dt) > 2.5) killFighter(f); } else f.out = Math.max(0, (f.out || 0) - dt);
  }
  if (S.alive <= 1) {
    const w = S.players.find((p) => !p.dead);
    if (w) w.place = 1;
    endLevel(true);
  }
}

function updateMini(dt) {
  const m = S.mini;
  if (!m) return;
  m.t += dt;
  const t = m.t, live = S.players.filter((p) => !p.dead);
  if (m.type === 'royale') return updateRoyale(dt);
  if (m.type === 'fly') {
    const f = S.fly;
    f.wave = Math.max(1.6, 3.6 - t * 0.02);
    f.count = [Math.min(1 + Math.floor(t / 40), 4), Math.min(2 + Math.floor(t / 20), 7)];
    f.speed = [Math.min(80 + t * 0.6, 150), Math.min(100 + t * 0.8, 185)];
    f.turn = Math.min(0.7 + t * 0.006, 1.4);
  } else if ((m.spawnT = (m.spawnT ?? 0) - dt) <= 0) {
    m.spawnT = Math.max(3, 9 - t * 0.05);
    const n = m.t < 1 ? 2 : Math.min(1 + Math.floor(t / 45), 4);
    for (let i = 0; i < n && S.visions.length < 14; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const x = rand(60, S.map.w - 60), y = rand(60, S.map.h - 60);
        if (S.nav.blocked[navCell({ x, y })] || live.some((p) => Math.hypot(p.x - x, p.y - y) < 380)) continue;
        S.visions.push(makeChaser(x, y, Math.min(C.GUARD_SPEED + t * 0.4, 90)));
        break;
      }
    }
  }
  S.coinList = S.coinList.filter((c) => !c.got);
  const want = S.players.length > 1 ? 12 : 8;
  for (let tries = 0; S.coinList.length < want && tries < 60; tries++) {
    const x = rand(60, S.map.w - 60), y = rand(60, S.map.h - 60);
    if (S.walls.some((w) => x > w.x - 18 && x < w.x + w.w + 18 && y > w.y - 18 && y < w.y + w.h + 18)) continue;
    if (live.some((p) => Math.hypot(p.x - x, p.y - y) < 130)) continue;
    S.coinList.push({ x, y, got: false, star: m.type === 'fly' });
  }
}

function updateCoins() {
  for (const c of S.coinList) {
    if (c.got || !S.players.some((p) => !p.dead && Math.hypot(p.x - c.x, p.y - c.y) < C.PLAYER_R + 9)) continue;
    c.got = true; S.coins++; audio.playCoin();
  }
}

function spawnBullet(p, d) {
  S.bullets.push({ x: p.x + d.x * 14, y: p.y + d.y * 14, vx: d.x * C.BULLET_SPEED, vy: d.y * C.BULLET_SPEED, life: 1.6, owner: p });
}

function tryFire() {
  const p = me();
  if (!S.shoot || S.mode !== 'playing' || p.dead || (p.cd || 0) > 0) return;
  p.cd = C.SHOT_CD;
  if (inCoop() && net.role === 'guest') netSend({ t: 'f', x: p.face.x, y: p.face.y }); else spawnBullet(p, p.face);
}

function updateBullets(dt) {
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i], nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || raycast(b.x, b.y, nx, ny)) { S.bullets.splice(i, 1); continue; }
    b.x = nx; b.y = ny;
    if (S.royale) {
      const f = S.players.find((q) => q !== b.owner && !q.dead && q.invuln <= 0 && Math.hypot(q.x - nx, q.y - ny) < 13)
        || S.bots.find((q) => q !== b.owner && !q.dead && Math.hypot(q.x - nx, q.y - ny) < 13);
      if (f) { killFighter(f); S.bullets.splice(i, 1); }
      continue;
    }
    const g = S.visions.find((v) => v.kind === 'guard' && !v.dead && Math.hypot(v.x - nx, v.y - ny) < 14);
    if (g) { g.dead = true; g.poly = []; g.seen = 0; S.kills++; audio.playKey(); S.bullets.splice(i, 1); }
  }
}

function step(dt) {
  S.players.forEach((p, i) => {
    if (p.dead) return;
    const dir = i === S.me ? inputVector() : S.remoteInput;
    const moving = dir.x !== 0 || dir.y !== 0;
    if (moving) { const l = Math.hypot(dir.x, dir.y); p.face = { x: dir.x / l, y: dir.y / l }; }
    p.cd = Math.max(0, (p.cd || 0) - dt);
    p.sneak = S.water && (i === S.me ? S.sneakKey || S.sneakLatch : S.remoteSneak);
    p.noisy = S.water && moving && !p.sneak;
    movePlayer(p, dir, dt);
    if (i === S.me) audio.setRolling(moving && !p.sneak);
  });
  if (me().dead) audio.setRolling(false);
  followCamera();
  updateMechanics();
  updateBullets(dt);
  updateMini(dt);
  updateCoins();
  if (S.coinNeed ? S.coins >= S.coinNeed : S.kills >= S.need && S.players.some((p) => !p.dead && touchesRect(p, S.goal))) return endLevel(true);
  if (S.cpRepeat) {
    if (S.players.some((p) => p.dead) && S.players.some((p) => !p.dead && touchesRect(p, S.checkpoint))) S.players.forEach((p, i) => { if (p.dead) revive(p, i); });
  } else if (S.checkpoint && !S.cpActive && S.players.some((p) => !p.dead && touchesRect(p, S.checkpoint))) {
    S.cpActive = true;
    S.players.forEach((p, i) => { if (p.dead) revive(p, i); });
  }
  S.players.forEach((p) => {
    p.alpha = Math.min(1, Math.max(0, p.alpha + (p.dead ? -dt / 1.5 : dt / 0.6)));
    p.invuln = Math.max(0, p.invuln - dt);
  });
  const spotted = new Set();
  updateShooters(dt);
  const droneHit = new Set();
  for (const v of S.visions) updateVision(v, dt).forEach((i) => spotted.add(i));
  for (const v of S.drones) updateVision(v, dt).forEach((i) => droneHit.add(i));
  if (S.alarmLevel) {
    if (!S.alarm && spotted.size) { S.alarm = true; audio.playAlert(); S.visions.push(spawnDefender()); }
    spotted.clear();
  }
  if (S.alarmLevel || S.fly || S.chaseAll) {
    droneHit.clear();
    for (const d of S.drones) S.players.forEach((p, i) => {
      if (!p.dead && p.invuln <= 0 && Math.hypot(p.x - d.x, p.y - d.y) < C.PLAYER_R + 6) droneHit.add(i);
    });
  }
  droneHit.forEach((i) => spotted.add(i));
  for (const v of S.visions) {
    if (v.kind !== 'guard' || v.turret || v.dead) continue;
    S.players.forEach((p, i) => {
      if (!p.dead && p.invuln <= 0 && Math.hypot(p.x - v.x, p.y - v.y) < C.PLAYER_R + 10) spotted.add(i);
    });
  }
  spotted.forEach(killPlayer);
  if (S.mode === 'playing' && S.players.every((p) => p.dead) && (S.failT -= dt) <= 0) endLevel(false);
}

function endLevel(won) {
  if (inCoop()) netSend({ t: 'end', won, pl: S.royale ? S.players.map((p) => p.place || 0) : undefined });
  finishLevel(won);
}

function finishRoyale() {
  S.mode = 'failed'; S.coopMenu = false; S.caught = false;
  audio.setRolling(false);
  const place = (S.results ? S.results[S.me] : S.players[S.me].place) || 0, champ = place === 1, coop = inCoop();
  if (champ) { store.set({ trophies: (store.get().trophies ?? 0) + 1 }); audio.playWin(); startConfetti(); } else audio.playAlert();
  showPopup(champ ? `Champion! Trophies: ${store.get().trophies}` : `Eliminated. You placed ${place || '?'} of 10`,
    { resume: false, retry: !coop || net.role === 'host', next: false, pick: coop && net.role === 'host' });
}

function finishMini() {
  if (S.mini.type === 'royale') return finishRoyale();
  S.mode = 'failed'; S.coopMenu = false;
  audio.setRolling(false);
  if (!S.caught) audio.playAlert();
  S.caught = false;
  const key = S.mini.type + (inCoop() ? '_coop' : ''), m = store.get().mini ?? {}, score = S.coins, isBest = score > (m[key] ?? 0);
  if (isBest) store.set({ mini: { ...m, [key]: score } });
  const coop = inCoop();
  showPopup(`${isBest ? 'New best! ' : 'Game over. '}${score} ${S.mini.type === 'fly' ? 'star' : 'coin'}${score === 1 ? '' : 's'}`,
    { resume: false, retry: !coop || net.role === 'host', next: false, pick: coop && net.role === 'host' });
}

function finishLevel(won) {
  if (S.mini) return finishMini();
  S.mode = won ? 'won' : 'failed';
  S.coopMenu = false;
  audio.setRolling(false);
  const cleared = (inCoop() ? store.get().coopHighest : store.get().highest) ?? 0;
  if (won) {
    audio.playWin();
    if (S.key) audio.playUnlock();
    if (!inCoop() && S.level > (store.get().highest ?? 0)) store.set({ highest: S.level });
    if (inCoop() && net.role === 'host' && S.level > (store.get().coopHighest ?? 0)) store.set({ coopHighest: S.level });
  } else if (!S.caught) {
    audio.playAlert();
  }
  S.caught = false;
  const coop = inCoop();
  const total = coop ? C.COOP_LEVEL_COUNT : C.LEVEL_COUNT;
  const beatAll = won && S.level === total && (DEV || cleared >= total - 1);
  if (won) startConfetti();
  if (beatAll) audio.playCelebrate();
  showPopup(beatAll ? 'Beat the Game! Well Done' : won ? 'Level Complete!' : 'Bummer... try again?',
    { resume: false, retry: !won && (!coop || net.role === 'host'), next: won && S.level < (coop ? C.COOP_LEVEL_COUNT : C.LEVEL_COUNT) && (!coop || net.role === 'host'),
      pick: coop && net.role === 'host' });
}

function startConfetti() {
  const cv = $('confetti'), c = cv.getContext('2d');
  cv.width = window.innerWidth; cv.height = window.innerHeight; cv.hidden = false;
  const cols = ['#ff5a5f', '#ffd23f', '#3bceac', '#4ea8de', '#b983ff', '#ff9f1c'];
  const bits = Array.from({ length: 160 }, () => ({ x: Math.random() * cv.width, y: -Math.random() * cv.height * 0.8,
    vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
    a: Math.random() * TAU, va: (Math.random() - 0.5) * 0.3, c: cols[(Math.random() * cols.length) | 0] }));
  const tick = () => {
    if ($('popup').hidden) { cv.hidden = true; return; }
    c.clearRect(0, 0, cv.width, cv.height);
    for (const b of bits) {
      b.x += b.vx; b.y += b.vy; b.a += b.va;
      if (b.y > cv.height + 20) { b.y = -20; b.x = Math.random() * cv.width; }
      c.save(); c.translate(b.x, b.y); c.rotate(b.a); c.fillStyle = b.c; c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); c.restore();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- rendering ----------
const canvas = $('game'), ctx = canvas.getContext('2d');
const lightMap = document.createElement('canvas'), lctx = lightMap.getContext('2d');
const tinted = document.createElement('canvas');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), W = canvas.clientWidth || window.innerWidth, H = canvas.clientHeight || window.innerHeight;
  // zoom in on the player, but never so far out that the map leaves empty bars; one uniform scale keeps pixels square
  const zoom = S.zoom || 1, scale = Math.max(Math.min(W / C.VIEW_W, H / C.VIEW_H) * zoom, S.map.w ? Math.max(W / S.map.w, H / S.map.h) : 0);
  Object.assign(S.view, { w: W / scale, h: H / scale, scale, dpr });
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  lightMap.width = Math.round(W * dpr / 2); lightMap.height = Math.round(H * dpr / 2);
  if (S.map.w) followCamera();
}

function tintLight() {
  const size = IMG.circle.width || 128;
  tinted.width = tinted.height = size;
  const t = tinted.getContext('2d'), [r, g, b] = C.PLAYER_LIGHT;
  t.drawImage(IMG.circle, 0, 0, size, size);
  t.globalCompositeOperation = 'multiply';
  t.fillStyle = `rgb(${r},${g},${b})`; t.fillRect(0, 0, size, size);
  t.globalCompositeOperation = 'destination-in';
  t.drawImage(IMG.circle, 0, 0, size, size);
}

const ID_COLORS = { a: '90,160,255', b: '255,159,67', c: '199,125,255', d: '255,93,143', s: '255,216,77', t: '255,120,200' };
const idColor = (id) => ID_COLORS[id] ?? '200,200,200';

function drawMechanics() {
  ctx.lineWidth = 2;
  for (const pl of S.plates) {
    const c = idColor(pl.id);
    ctx.fillStyle = `rgba(${c},${pl.on ? 0.6 : 0.18})`; ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.strokeStyle = `rgba(${c},0.9)`; ctx.strokeRect(pl.x + 3, pl.y + 3, pl.w - 6, pl.h - 6);
  }
  for (const sw of S.switches) {
    const c = idColor(sw.id), cx = sw.x + sw.w / 2, cy = sw.y + sw.h / 2;
    ctx.fillStyle = sw.on ? 'rgb(110,255,171)' : `rgb(${c})`;
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(10,13,20,0.7)'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.stroke();
  }
  for (const b of S.barriers) {
    const c = b.kind === 'lock' ? '255,217,77' : idColor(b.id);
    if (b.open) {
      ctx.strokeStyle = `rgba(${c},0.35)`; ctx.setLineDash([4, 6]); ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]);
      continue;
    }
    ctx.fillStyle = b.kind === 'gate' ? `rgba(${c},0.85)` : `rgb(${c})`;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(10,13,20,0.5)';
    ctx.beginPath();
    if (b.kind === 'gate') for (let y = b.y + 8; y < b.y + b.h; y += 10) { ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); }
    else { ctx.moveTo(b.x + 2, b.y + 2); ctx.lineTo(b.x + b.w - 2, b.y + b.h - 2); }
    ctx.stroke();
  }
}

function drawVision(v) {
  ctx.save();
  ctx.translate(v.x, v.y);
  if (v.poly.length > 2) {
    ctx.fillStyle = v.seen > 0 ? C.ALERT : v.cone;
    ctx.beginPath();
    v.poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath(); ctx.fill();
  }
  if (v.windup) {
    ctx.strokeStyle = 'rgba(255,90,60,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 22 + 6 * Math.sin(performance.now() / 50), 0, TAU); ctx.stroke();
  }
  if (v.turret) {
    ctx.fillStyle = C.GUARD; ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = '#ffb3a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(v.ang) * 16, Math.sin(v.ang) * 16); ctx.stroke();
  } else if (v.kind === 'guard') {
    const gr = v.glow ?? 34, hz = ctx.createRadialGradient(0, 0, 4, 0, 0, gr);
    hz.addColorStop(0, `rgba(255,38,38,${v.glow ? 0.6 : 0.4})`); hz.addColorStop(1, 'rgba(255,38,38,0)');
    ctx.fillStyle = hz; ctx.beginPath(); ctx.arc(0, 0, gr, 0, TAU); ctx.fill();
    ctx.fillStyle = C.GUARD; ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 === 0 ? 15 : 5, a = v.ang + Math.PI * i / 8;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = v.active ? C.LAMP_ON : C.LAMP_OFF;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
  }
  if (v.seen > 0) ctx.drawImage(IMG.alert, -11, v.bubbleY);
  ctx.restore();
}

const ROYALE_R0 = 760;
const SPACE_T = 1600;
const SPACE = [[0.12, 1, 0.5], [0.3, 1.6, 0.7], [0.55, 2.4, 0.9]].map(([par, size, alpha]) => (
  { par, size, alpha, pts: Array.from({ length: 80 }, () => [Math.random() * SPACE_T, Math.random() * SPACE_T, Math.random() * TAU]) }));

function drawSpace(w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#060820'); g.addColorStop(0.55, '#150b33'); g.addColorStop(1, '#0a1230');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const now = performance.now() / 1000;
  for (const L of SPACE) {
    for (const [px, py, ph] of L.pts) {
      const x = (((px - S.cam.x * L.par) % SPACE_T) + SPACE_T) % SPACE_T, y = (((py - S.cam.y * L.par) % SPACE_T) + SPACE_T) % SPACE_T;
      if (x > w || y > h) continue;
      ctx.globalAlpha = L.alpha * (0.7 + 0.3 * Math.sin(now * 2 + ph));
      ctx.fillStyle = '#e8eeff'; ctx.fillRect(x, y, L.size, L.size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawWorld() {
  const { w, h, scale, dpr } = S.view, ox = w / 2 - S.cam.x, oy = h / 2 - S.cam.y;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.fillStyle = C.BG; ctx.fillRect(0, 0, w, h);
  if (S.mini?.type === 'fly') drawSpace(w, h);
  ctx.save(); ctx.translate(ox, oy);
  ctx.fillStyle = C.WALL;
  for (const r of S.walls) ctx.fillRect(r.x, r.y, r.w, r.h);
  const g = S.goal;
  let ga = 1;
  if (S.hideGoal) {
    const d = Math.min(...S.players.filter((p) => !p.dead).map((p) => Math.hypot(p.x - (g.x + g.w / 2), p.y - (g.y + g.h / 2))));
    ga = clamp((260 - d) / 110, 0, 1);
  }
  if (ga > 0 && !S.coinNeed && S.goal.w > 0) {
    ctx.globalAlpha = ga;
    const locked = S.kills < S.need;
    if (!locked) ctx.drawImage(IMG.glow, g.x - 32, g.y - 32, g.w + 64, g.h + 64);
    ctx.fillStyle = locked ? 'rgba(255,90,90,0.25)' : C.GOAL; ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.globalAlpha = 1;
  }
  const cp = S.checkpoint;
  if (cp) {
    const col = S.cpActive ? '110,255,171' : '255,217,77';
    if (S.cpActive) ctx.drawImage(IMG.glow, cp.x - 32, cp.y - 32, cp.w + 64, cp.h + 64);
    ctx.fillStyle = `rgba(${col},0.2)`; ctx.fillRect(cp.x, cp.y, cp.w, cp.h);
    ctx.strokeStyle = `rgba(${col},0.7)`; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.strokeRect(cp.x, cp.y, cp.w, cp.h); ctx.setLineDash([]);
  }
  drawMechanics();
  if (S.royale) {
    const zx = S.map.w / 2, zy = S.map.h / 2;
    ctx.fillStyle = 'rgba(255,40,40,0.2)';
    ctx.beginPath(); ctx.rect(-3000, -3000, S.map.w + 6000, S.map.h + 6000); ctx.arc(zx, zy, S.zone.r, 0, TAU, true); ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,100,100,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(zx, zy, S.zone.r, 0, TAU); ctx.stroke();
  }
  for (const v of S.visions) {
    if (!v.dead && Math.abs(v.x - S.cam.x) < w / 2 + v.range + 40 && Math.abs(v.y - S.cam.y) < h / 2 + v.range + 40) {
      if (v.kind === 'guard' && !v.turret) drawTrail(v, '#ff2626', 7, 1, S.chaseAll ? 250 : 650);
      drawVision(v);
    }
  }
  for (const d of S.drones) drawVision(d);
  for (const p of S.players) {
    if (p.alpha <= 0.01) continue;
    drawTrail(p, p.color, C.PLAYER_R, p.alpha, S.mini ? (S.mini.type === 'fly' ? 1100 : 150) : 350);
    ctx.globalAlpha = p.alpha * (p.sneak ? 0.45 : 1);
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, C.PLAYER_R, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (S.shoot && !p.dead) {
      const cd = p.cd || 0;
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,217,77,0.25)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffd94d';
      if (cd <= 0) { ctx.shadowColor = '#ffd94d'; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - cd / C.SHOT_CD)); ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
  for (const b of S.bots) {
    if (b.dead) continue;
    drawTrail(b, '#ffb36b', C.PLAYER_R, 1, 120);
    ctx.fillStyle = '#ffb36b'; ctx.beginPath(); ctx.arc(b.x, b.y, C.PLAYER_R, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#ffd94d';
  for (const b of S.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, TAU); ctx.fill(); }
  ctx.restore();
  // ambient darkness with a glow around the player
  S.alarmK += ((S.alarm || (S.mini && S.mini.type !== 'collect') ? 1 : 0) - S.alarmK) * 0.12;
  if (S.alarmK < 0.99) {
    lctx.setTransform(dpr * scale / 2, 0, 0, dpr * scale / 2, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = C.AMBIENT; lctx.fillRect(0, 0, w, h);
    lctx.globalCompositeOperation = 'lighter';
    const lr = 64 * C.PLAYER_LIGHT_SCALE;
    const lp = camTarget();
    lctx.drawImage(tinted, lp.x + ox - lr, lp.y + oy - lr, lr * 2, lr * 2);
    lctx.drawImage(tinted, lp.x + ox - lr, lp.y + oy - lr, lr * 2, lr * 2);
    lctx.drawImage(tinted, lp.x + ox - lr, lp.y + oy - lr, lr * 2, lr * 2);
    const cr = lr * 0.55;
    lctx.drawImage(tinted, lp.x + ox - cr, lp.y + oy - cr, cr * 2, cr * 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 1 - S.alarmK;
    ctx.drawImage(lightMap, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  for (const d of S.drones) {
    ctx.save(); ctx.translate(ox, oy); drawTrail(d, '#ffe9a0', 7, 1, 700); ctx.restore();
    const gr = 32, dxp = d.x + ox, dyp = d.y + oy;
    ctx.drawImage(IMG.glow, dxp - gr, dyp - gr, gr * 2, gr * 2);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dxp, dyp, 3.5, 0, TAU); ctx.fill();
  }
  for (const c of S.coinList) {
    if (c.got) continue;
    const kx = c.x + ox, ky = c.y + oy, pulse = 1 + 0.15 * Math.sin(performance.now() / 250 + c.x), gr = 26 * pulse;
    ctx.drawImage(IMG.glow, kx - gr, ky - gr, gr * 2, gr * 2);
    ctx.fillStyle = '#ffd94d';
    if (c.star) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 12, a = -Math.PI / 2 + Math.PI * i / 5; ctx.lineTo(kx + Math.cos(a) * r, ky + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(kx, ky, 6, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(kx, ky, 3.5, 0, TAU); ctx.stroke();
    }
  }
  if (S.key && !S.keyGot) {
    const kx = S.key.x + ox, ky = S.key.y + oy, pulse = 1 + 0.15 * Math.sin(performance.now() / 250), gr = 34 * pulse;
    ctx.drawImage(IMG.glow, kx - gr, ky - gr, gr * 2, gr * 2);
    ctx.fillStyle = '#ffd94d'; ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(kx - 5, ky, 5, 0, TAU); ctx.stroke();
    ctx.fillRect(kx, ky - 1.25, 12, 2.5); ctx.fillRect(kx + 8, ky, 2.5, 5); ctx.fillRect(kx + 12, ky, 2.5, 4);
  }
  if (!S.mini || S.mini.type === 'collect') ctx.drawImage(IMG.vignette, 0, 0, w, h);
  if (S.mini) {
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 120);
    for (const d of S.drones) {
      const dx = d.x - S.cam.x, dy = d.y - S.cam.y;
      if (Math.abs(dx) < w / 2 && Math.abs(dy) < h / 2) continue;
      const k = Math.min((w / 2 - 22) / Math.abs(dx || 1e-6), (h / 2 - 22) / Math.abs(dy || 1e-6)), a = Math.atan2(dy, dx), px = w / 2 + dx * k, py = h / 2 + dy * k;
      ctx.save(); ctx.translate(px, py); ctx.rotate(a);
      ctx.fillStyle = `rgba(255,50,50,${pulse})`;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-9, -9); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  if (S.mode === 'catching') {
    const k = Math.sin(Math.PI * S.catchT / C.CATCH_TIME), z = 1 + 0.25 * k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, canvas.width * (1 - z) / 2, canvas.height * (1 - z) / 2, canvas.width * z, canvas.height * z);
    ctx.fillStyle = `rgba(255,255,255,${0.35 * k})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  }
  ctx.font = '16px system-ui, sans-serif'; ctx.textAlign = 'center';
  if (S.mini?.type === 'royale') { ctx.fillStyle = '#ffd94d'; ctx.fillText(`Alive: ${S.alive}`, w / 2, 28); }
  else if (S.mini) { ctx.fillStyle = '#ffd94d'; ctx.fillText(`${S.mini.type === 'fly' ? 'Stars' : 'Coins'}: ${S.coins}   Best: ${Math.max(S.coins, S.mini.best)}`, w / 2, 28); }
  if (S.coinNeed) { ctx.fillStyle = S.coins >= S.coinNeed ? '#6effab' : '#ffd94d'; ctx.fillText(`Coins: ${S.coins}/${S.coinNeed}`, w / 2, 28); }
  if (S.shoot && S.need) { ctx.fillStyle = S.kills >= S.need ? '#6effab' : '#ffd94d'; ctx.fillText(`Enemies down: ${S.kills}/${S.need}`, w / 2, 28); }
  const wrap = (text) => {
    const lines = []; let cur = '';
    for (const word of text.split(' ')) {
      if (cur && ctx.measureText(`${cur} ${word}`).width > w - 48) { lines.push(cur); cur = word; } else cur = cur ? `${cur} ${word}` : word;
    }
    return [...lines, cur];
  };
  if (me().dead && S.mode === 'playing') {
    ctx.fillStyle = 'rgba(232,238,250,0.9)';
    const ls = wrap(S.cpActive ? 'You were spotted. It\u2019s up to your partner to finish the level.' : 'You were spotted. Get your partner to the checkpoint!');
    ls.forEach((l, i) => ctx.fillText(l, w / 2, h - 24 - (ls.length - 1 - i) * 20));
  }
  if (S.hint && S.hintT > 0 && S.mode === 'playing') {
    const ls = wrap(S.hint), tw = Math.max(...ls.map((l) => ctx.measureText(l).width)) + 32, th = ls.length * 20 + 14, top = h - 52 - th;
    ctx.fillStyle = 'rgba(10,13,20,0.75)'; ctx.fillRect(w / 2 - tw / 2, top, tw, th);
    ctx.fillStyle = '#e8eefa';
    ls.forEach((l, i) => ctx.fillText(l, w / 2, top + 24 + i * 20));
  }
  drawJoystick();
}

function drawTrail(p, color = p.color, r = C.PLAYER_R, alpha = p.alpha, life = 350) {
  const now = performance.now(), t = p.trail || (p.trail = []), last = t[t.length - 1];
  if (last && Math.hypot(p.x - last.x, p.y - last.y) > 40) t.length = 0;
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > (p.sneak ? 1.2 : life > 500 ? 6 : 3)) t.push({ x: p.x, y: p.y, t: now });
  while (t.length && now - t[0].t > life) t.shift();
  ctx.fillStyle = color;
  const B = 4;
  for (let k = 0; k < B; k++) {
    ctx.beginPath();
    let any = false;
    for (const q of t) {
      const f = 1 - (now - q.t) / life;
      if (Math.min(B - 1, Math.floor(f * B)) !== k) continue;
      const rr = r * (0.4 + 0.5 * f);
      ctx.moveTo(q.x + rr, q.y); ctx.arc(q.x, q.y, rr, 0, TAU); any = true;
    }
    if (any) { ctx.globalAlpha = alpha * ((k + 0.5) / B) * 0.4 * (p.sneak ? 0.45 : 1); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

function drawJoystick() {
  const j = S.joy;
  if (j.id === -1) return;
  ctx.imageSmoothingEnabled = false;
  const k = S.view.scale;
  for (const [img, x, y, r] of [[IMG.base, j.ox, j.oy, C.JOY_R], [IMG.knob, j.ox + j.kx / k, j.oy + j.ky / k, C.JOY_KNOB_R]]) {
    const d = r * 2 / k;
    ctx.drawImage(img, x - d / 2, y - d / 2, d, d);
  }
  ctx.imageSmoothingEnabled = true;
}

// ---------- ui ----------
function show(el, on) { el.hidden = !on; }

function showPopup(title, buttons) {
  $('ptitle').textContent = title;
  for (const id of ['resume', 'retry', 'next', 'pick']) show($(id), !!buttons[id]);
  $('menu').textContent = inCoop() || net.role ? 'Leave' : 'Levels';
  show($('popup'), true);
}

function refreshToggles() {
  $('sfx').firstElementChild.src = `assets/ui/icons/icon_sound_${audio.sfx ? 'on' : 'off'}.png`;
  $('music').style.opacity = audio.music ? 1 : 0.45;
  $('music').textContent = audio.music ? 'Music' : 'Music off';
}

function buildSelect() {
  const grid = $('grid'), highest = store.get().highest ?? 0;
  grid.textContent = '';
  for (let id = 1; id <= C.LEVEL_COUNT; id++) {
    const b = document.createElement('button');
    b.className = 'btn level' + (id <= highest ? ' done' : '');
    if (DEV || id <= highest + 1) {
      b.textContent = `${id}\n${S.names[id] ?? ''}`;
      b.onclick = () => startLevel(id);
    } else {
      b.textContent = `${id}\n`; b.disabled = true;
    }
    grid.appendChild(b);
  }
}

const SCREENS = ['mainmenu', 'select', 'minisel', 'lobby', 'coopsel', 'popup', 'pause', 'game', 'settings', 'settingsbtn', 'backbtn'];
function hideAll() { for (const id of SCREENS) show($(id), false); }

function showMiniSelect() {
  S.mode = 'minisel';
  hideAll();
  const coop = net.role === 'host', best = store.get().mini ?? {}, box = $('minibtns');
  box.textContent = '';
  for (const [id, name, note] of [['fly', 'Fly', 'Stars & drones'], ['collect', 'Collect', 'Coins & guards'], ['royale', 'Battle Royale', 'Last one standing']]) {
    const b = document.createElement('button'), score = best[id + (coop ? '_coop' : '')];
    b.className = 'btn level';
    const trophies = store.get().trophies;
    b.textContent = `${name}\n${id === 'royale' ? (trophies ? `Trophies: ${trophies}` : note) : score ? `Best: ${score}` : note}`;
    b.onclick = () => (coop ? startCoop(id) : startLevel(id));
    box.appendChild(b);
  }
  show($('minisel'), true); show($('backbtn'), true);
}

function showMenu() {
  netClose();
  S.mode = 'menu';
  S.coopMenu = false;
  audio.duck(false);
  audio.setRolling(false);
  hideAll();
  show($('mainmenu'), true); show($('settingsbtn'), true);
}

function showSelect() {
  netClose();
  S.mode = 'select';
  S.coopMenu = false;
  audio.duck(false);
  audio.setRolling(false);
  hideAll();
  buildSelect();
  show($('select'), true); show($('backbtn'), true);
}

async function startLevel(id) {
  netClose();
  await loadLevel(id);
  S.me = 0;
  hideAll(); show($('game'), true); show($('pause'), true);
  S.mode = 'playing';
}

function pauseGame() {
  if (S.mode !== 'playing' || S.coopMenu) return;
  if (inCoop()) { S.coopMenu = true; showPopup('Co-op game', { resume: true, pick: net.role === 'host' }); return; }
  S.mode = 'paused';
  audio.setRolling(false);
  audio.duck(true);
  showPopup('Paused', { resume: true });
}

function resumeGame() {
  if (S.coopMenu) { S.coopMenu = false; show($('popup'), false); return; }
  if (S.mode !== 'paused') return;
  S.mode = 'playing';
  audio.duck(false);
  show($('popup'), false);
}

// ---------- input ----------
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener('keydown', (e) => {
  audio.start();
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Escape' && !$('settings').hidden) { closeSettings(); return; }
  if (e.code === 'Escape') { if (S.mode === 'playing' && !S.coopMenu) pauseGame(); else resumeGame(); return; }
  if (e.code === 'Space') { if (S.shoot) { if (!e.repeat) tryFire(); } else S.sneakKey = true; e.preventDefault(); return; }
  if (GAME_KEYS.has(e.code)) { S.keys.add(e.code); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => { S.keys.delete(e.code); if (e.code === 'Space') S.sneakKey = false; });
window.addEventListener('blur', () => { S.keys.clear(); S.sneakKey = false; if (!inCoop()) pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !inCoop()) pauseGame(); });
window.addEventListener('pointerdown', () => audio.start());
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));
const syncAudio = () => audio.setActive(!document.hidden && document.hasFocus());
document.addEventListener('visibilitychange', syncAudio);
for (const t of ['blur', 'focus', 'pagehide', 'pageshow']) window.addEventListener(t, syncAudio);

function joyMove(e) {
  const j = S.joy, k = S.view.scale;
  let dx = e.clientX - j.ox * k, dy = e.clientY - j.oy * k;
  const len = Math.hypot(dx, dy);
  if (len > C.JOY_R) { dx = dx / len * C.JOY_R; dy = dy / len * C.JOY_R; }
  j.kx = dx; j.ky = dy;
  const m = Math.hypot(dx, dy) / C.JOY_R;
  j.vx = m >= C.JOY_DEAD ? dx / C.JOY_R : 0; j.vy = m >= C.JOY_DEAD ? dy / C.JOY_R : 0;
}

function joyEnd() { Object.assign(S.joy, { id: -1, kx: 0, ky: 0, vx: 0, vy: 0 }); }

canvas.addEventListener('pointerdown', (e) => {
  if ((S.shoot || S.water) && e.pointerType !== 'mouse' && S.joy.id !== -1 && S.mode === 'playing') {
    if (S.shoot) tryFire(); else S.sneakLatch = !S.sneakLatch;
    return;
  }
  if (e.pointerType === 'mouse' || S.joy.id !== -1 || S.mode !== 'playing') return;
  if ((S.water || S.shoot) && e.timeStamp - S.lastTap < 350) { if (S.shoot) tryFire(); else S.sneakLatch = !S.sneakLatch; S.lastTap = 0; } else S.lastTap = e.timeStamp;
  canvas.setPointerCapture(e.pointerId);
  S.joy.id = e.pointerId; S.joy.ox = e.clientX / S.view.scale; S.joy.oy = e.clientY / S.view.scale;
  joyMove(e);
});
canvas.addEventListener('pointermove', (e) => { if (e.pointerId === S.joy.id) joyMove(e); });
for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, (e) => { if (e.pointerId === S.joy.id) joyEnd(); });

$('sfx').onclick = () => { audio.setSfx(!audio.sfx); refreshToggles(); };
$('music').onclick = () => { audio.setMusic(!audio.music); refreshToggles(); };
$('pause').onclick = pauseGame;
$('resume').onclick = resumeGame;
$('retry').onclick = () => (inCoop() ? startCoop(S.level) : startLevel(S.level));
$('next').onclick = () => (inCoop() ? startCoop(S.level + 1) : startLevel(S.level + 1));
$('menu').onclick = () => (inCoop() || net.role ? showMenu() : showSelect());
$('solo').onclick = showSelect;
$('settingsbtn').onclick = () => { show($('settings'), true); };
const closeSettings = () => { show($('settings'), false); $('reset').textContent = 'Reset Progress'; };
$('sclose').onclick = closeSettings;
$('share').onclick = async () => {
  const url = location.href.split('#')[0];
  try {
    if (navigator.share) { await navigator.share({ title: 'Sneaky', text: 'Sneak past the guards!', url }); return; }
    await navigator.clipboard.writeText(url);
    $('share').textContent = 'Link copied!';
    setTimeout(() => { $('share').textContent = 'Share Game'; }, 1500);
  } catch { /* cancelled */ }
};
$('reset').onclick = () => {
  if ($('reset').textContent === 'Reset Progress') { $('reset').textContent = 'Tap again to confirm'; return; }
  store.set({ highest: 0, coopHighest: 0 });
  closeSettings();
};
canvas.addEventListener('contextmenu', (e) => e.preventDefault());


// ---------- co-op (PeerJS, host-authoritative) ----------
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const net = { role: null, peer: null, conn: null, sendT: 0, inputT: 0 };
const inCoop = () => net.role !== null && S.players.length === 2;
const lobbyStatus = (text) => { $('lobbystatus').textContent = text; };

function netSend(msg) { if (net.conn && net.conn.open) net.conn.send(msg); }

function netClose() {
  try { if (net.conn) net.conn.close(); if (net.peer) net.peer.destroy(); } catch { /* ignore */ }
  Object.assign(net, { role: null, peer: null, conn: null, sendT: 0, inputT: 0 });
}

function wire(conn) {
  conn.on('data', onNetData);
  conn.on('close', onPartnerLeft);
  conn.on('error', onPartnerLeft);
}

function showLobby() {
  netClose();
  S.mode = 'lobby';
  hideAll();
  $('code').textContent = '';
  lobbyStatus('Host a game, or enter a friend’s code to join.');
  show($('lobby'), true); show($('backbtn'), true);
}

function hostGame() {
  if (typeof Peer === 'undefined') return lobbyStatus('Co-op needs an internet connection.');
  netClose();
  net.role = 'host';
  const code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const peer = net.peer = new Peer('sneaky-' + code);
  lobbyStatus('Creating room...');
  peer.on('open', () => { $('code').textContent = code; lobbyStatus('Share this code. Waiting for player 2...'); });
  peer.on('error', (e) => { if (e.type === 'unavailable-id') hostGame(); else lobbyStatus('Connection error: ' + e.type); });
  peer.on('connection', (conn) => {
    if (net.conn) { conn.close(); return; }
    net.conn = conn;
    wire(conn);
    if (conn.open) showCoopPicker(); else conn.on('open', showCoopPicker);
  });
}

function joinGame() {
  if (typeof Peer === 'undefined') return lobbyStatus('Co-op needs an internet connection.');
  const code = $('codeinput').value.trim().toUpperCase();
  if (code.length !== 4) return lobbyStatus('Enter the 4-letter room code.');
  netClose();
  net.role = 'guest';
  $('code').textContent = '';
  lobbyStatus('Connecting...');
  const peer = net.peer = new Peer();
  peer.on('open', () => {
    const conn = net.conn = peer.connect('sneaky-' + code, { reliable: true });
    wire(conn);
    conn.on('open', () => lobbyStatus('Connected. Waiting for host...'));
  });
  peer.on('error', (e) => lobbyStatus(e.type === 'peer-unavailable' ? 'Room not found.' : 'Connection error: ' + e.type));
}

async function startCoop(level) {
  await loadLevel(level, true);
  S.me = 0;
  enterGame();
  netSend({ t: 'start', level });
}

async function guestStart(level) {
  await loadLevel(level, true);
  S.me = 1;
  enterGame();
}

function enterGame() {
  hideAll(); show($('game'), true); show($('pause'), true);
  S.mode = 'playing';
}

function showCoopPicker(highest) {
  const host = net.role === 'host';
  if (host) { highest = store.get().coopHighest ?? 0; netSend({ t: 'picker', highest }); }
  S.mode = 'picker'; S.coopMenu = false;
  audio.setRolling(false); audio.duck(false);
  hideAll();
  $('cstatus').textContent = host ? 'Choose a Level' : 'Host is choosing a level...';
  const grid = $('cgrid');
  grid.className = host ? '' : 'watch';
  grid.textContent = '';
  for (let id = 1; id <= C.COOP_LEVEL_COUNT; id++) {
    const b = document.createElement('button');
    b.className = 'btn level' + (id <= highest ? ' done' : '');
    if (DEV || id <= highest + 1) {
      b.textContent = `${id}\n${C.COOP_NAMES[id - 1]}`;
      b.onclick = () => startCoop(id);
    } else {
      b.textContent = `${id}\n`; b.disabled = true;
    }
    grid.appendChild(b);
  }
  show($('minibtn2'), host);
  show($('coopsel'), true); show($('backbtn'), true);
}

function onNetData(m) {
  if (!m || typeof m !== 'object') return;
  if (net.role === 'guest') {
    if (m.t === 'picker') showCoopPicker(Number(m.highest) || 0);
    else if (m.t === 'start') guestStart(m.level);
    else if (m.t === 's' && S.mode === 'playing') applySnapshot(m);
    else if (m.t === 'end') { S.results = m.pl ?? null; finishLevel(!!m.won); }
  } else if (m.t === 'i') {
    const x = Number(m.x) || 0, y = Number(m.y) || 0, len = Math.hypot(x, y);
    S.remoteInput = len > 1 ? { x: x / len, y: y / len } : { x, y };
    S.remoteSneak = !!m.s;
  } else if (m.t === 'f') {
    const q = S.players.find((_, i) => i !== S.me), fx = Number(m.x) || 0, fy = Number(m.y) || 0, l = Math.hypot(fx, fy);
    if (S.shoot && q && !q.dead && l > 0 && (q.cd || 0) <= 0.3) { q.cd = C.SHOT_CD; spawnBullet(q, { x: fx / l, y: fy / l }); }
  }
}

function onPartnerLeft() {
  if (net.role === null) return;
  if (S.mode === 'lobby') { netClose(); lobbyStatus('Partner left.'); return; }
  if (S.mode === 'select') return;
  if (S.mode === 'picker') { showLobby(); lobbyStatus('Partner left.'); return; }
  S.mode = 'failed';
  S.coopMenu = false;
  audio.setRolling(false);
  showPopup('Partner left', {});
}

function snapshot() {
  const r = (n) => Math.round(n * 10) / 10;
  return { t: 's', al: S.alarm ? 1 : 0, c: S.cpActive ? 1 : 0, k: S.keyGot ? 1 : 0, o: S.barriers.map((b) => (b.open ? 1 : 0)),
    a: [...S.plates, ...S.switches].map((t) => (t.on ? 1 : 0)), p: S.players.map((p) => [r(p.x), r(p.y), Math.round(p.alpha * 100) / 100, p.dead ? 1 : 0, p.sneak ? 1 : 0, Math.round((p.cd || 0) * 10) / 10]),
    v: S.visions.map((v) => [r(v.x), r(v.y), Math.round(v.ang * 1000) / 1000, v.active ? 1 : 0, v.seen > 0 ? 1 : 0, v.windup ? 1 : 0, v.dead ? 1 : 0]),
    b: S.bullets.map((b) => [r(b.x), r(b.y)]), kl: S.kills,
    rb: S.royale ? S.bots.map((b) => [r(b.x), r(b.y), b.dead ? 1 : 0]) : undefined, rz: S.royale ? Math.round(S.zone.r) : 0, ra: S.alive, cn: S.mini ? undefined : S.coinList.map((c) => (c.got ? 1 : 0)),
    cm: S.mini ? S.coinList.filter((c) => !c.got).map((c) => [r(c.x), r(c.y)]) : undefined, cs: S.coins,
    d: S.drones.map((d) => [r(d.x), r(d.y), d.seen > 0 ? 1 : 0]) };
}

function applySnapshot(m) {
  S.cpActive = !!m.c;
  if (m.al && !S.alarm) audio.playAlert();
  S.alarm = !!m.al;
  if (m.k && !S.keyGot) { S.keyGot = true; S.hint = 'Key found! The door is unlocked.'; S.hintT = 4; audio.playKey(); }
  if (m.o) { m.o.forEach((o, i) => { if (S.barriers[i]) S.barriers[i].open = !!o; }); }
  if (m.a) { [...S.plates, ...S.switches].forEach((t, i) => { t.on = !!m.a[i]; }); }
  updateSolids();
  m.p.forEach(([x, y, alpha, dead, sn, cd], i) => {
    const q = S.players[i];
    if (!q) return;
    if (i !== S.me) { q.sneak = !!sn; q.cd = cd; }
    if (dead && !q.dead) audio.playAlert();
    q.ta = alpha; q.dead = !!dead;
    if (i === S.me) {
      if (q.dead) { q.x = x; q.y = y; return; }
      const ex = x - q.x, ey = y - q.y;
      if (Math.hypot(ex, ey) > 40) { q.x = x; q.y = y; } else { q.x += ex * 0.2; q.y += ey * 0.2; }
    } else {
      if (q.tx === undefined) { q.x = x; q.y = y; }
      q.tx = x; q.ty = y;
    }
  });
  if (m.d) {
    S.drones = m.d.map(([x, y, seen], i) => {
      const o = S.drones[i] || makeDrone(x, y, 0, 0);
      return Object.assign(o, { tx: x, ty: y, seen: seen ? 1 : 0, active: !(S.fly || S.chaseAll) });
    });
  }
  while (S.alarm && S.visions.length < m.v.length) S.visions.push(spawnDefender());
  while (S.chaseAll && S.visions.length < m.v.length) S.visions.push(makeChaser(...m.v[S.visions.length]));
  S.bullets = (m.b || []).map(([x, y]) => ({ x, y }));
  if (m.kl !== undefined) S.kills = m.kl;
  if (m.rb) {
    m.rb.forEach(([x, y, dead], i) => { const b = S.bots[i] || (S.bots[i] = { x, y }); b.tx = x; b.ty = y; b.dead = !!dead; });
    S.zone.r = m.rz; S.alive = m.ra;
  }
  if (m.cm) { S.coinList = m.cm.map(([x, y]) => ({ x, y, got: false, star: S.mini.type === 'fly' })); if (m.cs > S.coins) audio.playCoin(); S.coins = m.cs; }
  if (m.cn) { m.cn.forEach((g, i) => { const c = S.coinList[i]; if (c && g && !c.got) { c.got = true; audio.playCoin(); } }); S.coins = S.coinList.filter((c) => c.got).length; }
  m.v.forEach(([x, y, ang, active, seen, windup, dead], i) => {
    const v = S.visions[i];
    if (!v) return;
    v.dead = !!dead;
    if (v.tx === undefined) { v.x = x; v.y = y; v.ang = ang; }
    Object.assign(v, { tx: x, ty: y, tang: ang, active: !!active, seen: seen ? 1 : 0, windup: !!windup });
  });
}

function guestStep(dt) {
  const dir = me().dead ? { x: 0, y: 0 } : inputVector(), k = 1 - Math.exp(-dt * 20);
  me().sneak = S.water && (S.sneakKey || S.sneakLatch);
  me().cd = Math.max(0, (me().cd || 0) - dt);
  if (dir.x || dir.y) { const l = Math.hypot(dir.x, dir.y); me().face = { x: dir.x / l, y: dir.y / l }; }
  if (!me().dead) movePlayer(me(), dir, dt);
  audio.setRolling((dir.x !== 0 || dir.y !== 0) && !me().sneak);
  S.players.forEach((q, i) => {
    if (q.ta !== undefined) q.alpha += (q.ta - q.alpha) * k;
    if (i !== S.me && q.tx !== undefined) { q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k; }
  });
  for (const b of S.bots) if (b.tx !== undefined) { b.x += (b.tx - b.x) * k; b.y += (b.ty - b.y) * k; }
  for (const v of S.visions) {
    if (v.tx !== undefined) {
      v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; v.ang += angleDiff(v.ang, v.tang) * k;
    }
    if (v.active) updatePoly(v); else v.poly = [];
  }
  for (const d of S.drones) {
    if (d.tx !== undefined) { d.x += (d.tx - d.x) * k; d.y += (d.ty - d.y) * k; }
    if (d.active) updatePoly(d); else d.poly = [];
  }
  followCamera();
}

function netTick(dt) {
  if (!inCoop() || !net.conn || !net.conn.open) return;
  if (net.role === 'host') {
    net.sendT += dt;
    if (net.sendT >= 0.05) { net.sendT = 0; netSend(snapshot()); }
  } else {
    net.inputT += dt;
    if (net.inputT >= 1 / 30) { net.inputT = 0; const v = inputVector(); netSend({ t: 'i', x: v.x, y: v.y, s: S.sneakKey || S.sneakLatch ? 1 : 0 }); }
  }
}

$('coop').onclick = showLobby;
$('host').onclick = hostGame;
$('join').onclick = joinGame;
$('backbtn').onclick = () => (S.mode === 'minisel' ? (net.role === 'host' ? showCoopPicker() : showSelect()) : showMenu());
$('minibtn').onclick = showMiniSelect;
$('minibtn2').onclick = showMiniSelect;
$('pick').onclick = () => showCoopPicker();

// ---------- main menu guard ----------
const menuCanvas = $('menuguard'), mctx = menuCanvas.getContext('2d');
const menuGuard = { heading: 0, last: 0, trail: [] };
function drawMenuGuard(now) {
  const t = now / 1000, dpr = Math.min(window.devicePixelRatio || 1, 2), cw = window.innerWidth, ch = window.innerHeight;
  if (menuCanvas.width !== Math.round(cw * dpr) || menuCanvas.height !== Math.round(ch * dpr)) { menuCanvas.width = Math.round(cw * dpr); menuCanvas.height = Math.round(ch * dpr); }
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sp = $('menuspot').getBoundingClientRect(), W = sp.width, H = sp.height;
  const dt = Math.min(t - menuGuard.last, 0.1);
  menuGuard.last = t;
  mctx.clearRect(0, 0, cw, ch);
  const gx = sp.left + W / 2 + Math.sin(t * 0.55) * W * 0.3, gy = sp.top + H * 0.5 + Math.sin(t * 9) * 1;
  const want = Math.cos(t * 0.55) >= 0 ? 0 : Math.PI;
  menuGuard.heading += clamp(angleDiff(menuGuard.heading, want), -rad(150) * dt, rad(150) * dt);
  const tr = menuGuard.trail, life = 650;
  tr.push({ x: gx, y: gy, t: now });
  while (tr.length && now - tr[0].t > life) tr.shift();
  mctx.fillStyle = '#ff2626';
  for (const q of tr) {
    const f = 1 - (now - q.t) / life;
    mctx.globalAlpha = f * 0.4;
    mctx.beginPath(); mctx.arc(q.x, q.y, 7 * (0.4 + 0.5 * f), 0, TAU); mctx.fill();
  }
  mctx.globalAlpha = 1;
  const half = rad(32), range = 170, beam = menuGuard.heading + Math.sin(t * 1.6) * rad(18);
  mctx.save();
  mctx.translate(gx, gy);
  const grad = mctx.createRadialGradient(0, 0, 0, 0, 0, range);
  grad.addColorStop(0, 'rgba(255,240,150,0.45)'); grad.addColorStop(1, 'rgba(255,240,150,0)');
  mctx.fillStyle = grad;
  mctx.beginPath(); mctx.moveTo(0, 0); mctx.arc(0, 0, range, beam - half, beam + half); mctx.closePath(); mctx.fill();
  const hz = mctx.createRadialGradient(0, 0, 4, 0, 0, 34);
  hz.addColorStop(0, 'rgba(255,38,38,0.4)'); hz.addColorStop(1, 'rgba(255,38,38,0)');
  mctx.fillStyle = hz; mctx.beginPath(); mctx.arc(0, 0, 34, 0, TAU); mctx.fill();
  const pulse = 1 + 0.07 * Math.sin(t * 9);
  mctx.fillStyle = C.GUARD; mctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = (i % 2 === 0 ? 15 : 5) * pulse, a = menuGuard.heading + Math.PI * i / 8;
    mctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  mctx.closePath(); mctx.fill();
  mctx.restore();
}

// ---------- main loop ----------
let last = 0, acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (S.mode === 'playing') {
    acc += dt;
    S.hintT -= dt;
    while (acc >= C.STEP && S.mode === 'playing') { (net.role === 'guest' ? guestStep : step)(C.STEP); acc -= C.STEP; }
    netTick(dt);
  } else {
    acc = 0;
  }
  if (S.mode === 'catching' && (S.catchT += dt) >= C.CATCH_TIME) { S.caught = true; endLevel(false); }
  if (S.mode === 'menu') drawMenuGuard(now);
  if (S.goal && ['catching', 'playing', 'paused', 'won', 'failed'].includes(S.mode)) drawWorld();
}

async function boot() {
  resize();
  refreshToggles();
  await loadImages();
  tintLight();
  S.names = [''];
  await Promise.all(Array.from({ length: C.LEVEL_COUNT }, (_, i) =>
    fetch(`assets/levels/level${i + 1}.json`).then((r) => r.json()).then((d) => { S.names[i + 1] = d.name; }).catch(() => {})));
  showMenu();
  requestAnimationFrame(frame);
}
boot();

// ---------- update check ----------
(() => {
  const banner = $('update');
  const sig = async () => {
    try {
      const text = (await Promise.all(['game.js', 'index.html'].map((u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.text() : ''))))).join('');
      let h = 5381;
      for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
      return text ? h : null;
    } catch { return null; }
  };
  let base = null;
  const check = async () => {
    const now = await sig();
    if (now === null) return;
    if (base === null) base = now; else if (now !== base) banner.hidden = false;
  };
  banner.onclick = () => location.reload();
  window.addEventListener('load', check);
  setInterval(check, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
})();

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
