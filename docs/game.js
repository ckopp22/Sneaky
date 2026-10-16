'use strict';

const C = {
  VIEW_W: 960, VIEW_H: 540, LEVEL_COUNT: 12, STEP: 1 / 60,
  PLAYER_SPEED: 120, PLAYER_R: 10, JOY_R: 44, JOY_DEAD: 0.15, JOY_SCALE: 2,
  GRACE: 0.15, GUARD_SPEED: 40, GUARD_FOV: 60, GUARD_RANGE: 120, GUARD_PAUSE: 1, LOOK_DEG: 70,
  RAY_STEP_DEG: 2, PLAYER_LIGHT_SCALE: 3,
  BG: '#0a0d14', WALL: '#1f4057', GOAL: 'rgba(110,255,171,0.2)', PLAYER: '#d9e6ff', GUARD: '#e64d4d',
  VISION: 'rgba(217,230,255,0.16)', LIGHT: 'rgba(255,217,77,0.26)', ALERT: 'rgba(255,38,38,0.4)',
  LAMP_ON: '#ffe666', LAMP_OFF: '#665c29', AMBIENT: 'rgb(107,117,153)', PLAYER_LIGHT: [204, 230, 255],
};
const TAU = Math.PI * 2;
const rad = (d) => d * Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (id) => document.getElementById(id);

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
  const a = { music: saved.music !== false, sfx: saved.sfx !== false, track: 0, started: false, rolling: false };
  const tracks = [1, 2, 3].map((n) => make(`music${n}`, 0.4));
  const alert = make('alert', 0.63), win = make('win', 0.8), roll = make('rolling', 0.4, true);
  const level = () => (a.ducked ? 0.15 : 0.4);
  const playTrack = () => {
    const t = tracks[a.track];
    t.volume = level();
    t.currentTime = 0;
    t.onended = () => { a.track = (a.track + 1) % tracks.length; playTrack(); };
    if (a.music) t.play().catch(() => { a.started = false; });
  };
  a.start = () => { if (!a.started) { a.started = true; playTrack(); } };
  a.duck = (on) => { a.ducked = on; tracks[a.track].volume = level(); };
  a.setMusic = (on) => {
    a.music = on; store.set({ music: on });
    if (on && a.started) tracks[a.track].play().catch(() => {}); else tracks[a.track].pause();
  };
  a.setSfx = (on) => { a.sfx = on; store.set({ sfx: on }); a.setRolling(false); };
  const play = (s) => { if (a.sfx) { s.currentTime = 0; s.play().catch(() => {}); } };
  a.playAlert = () => play(alert);
  a.playWin = () => play(win);
  a.setRolling = (on) => {
    on = on && a.sfx;
    if (on === a.rolling) return;
    a.rolling = on;
    if (on) roll.play().catch(() => {}); else roll.pause();
  };
  return a;
})();

// ---------- state ----------
const S = {
  mode: 'loading', level: 1, names: [], walls: [], goal: null, map: { w: 0, h: 0 },
  player: { x: 0, y: 0 }, visions: [], keys: new Set(), joy: { id: -1, ox: 0, oy: 0, kx: 0, ky: 0, vx: 0, vy: 0 },
  cam: { x: 0, y: 0 }, view: { w: C.VIEW_W, h: C.VIEW_H, scale: 1, dpr: 1 },
};

// ---------- geometry ----------
function raycast(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  let best = 2;
  for (const r of S.walls) {
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
  const path = d.path.map((p) => ({ x: (p[0] + 0.5) * tile, y: (p[1] + 0.5) * tile }));
  const g = makeVision(path[0].x, path[0].y, d.fov ?? C.GUARD_FOV, d.range ?? C.GUARD_RANGE, C.VISION);
  Object.assign(g, { kind: 'guard', path, speed: d.speed ?? C.GUARD_SPEED, pause: d.pause ?? C.GUARD_PAUSE,
    erratic: d.erratic ?? 0, next: 1, dir: 1, pauseLeft: 0, pauseTotal: 1, lookBase: 0, mult: 1, multLeft: 0 });
  if (path.length > 1) g.ang = Math.atan2(path[1].y - path[0].y, path[1].x - path[0].x);
  return g;
}

function makeLight(d, tile) {
  const l = makeVision((d.pos[0] + 0.5) * tile, (d.pos[1] + 0.5) * tile, 0, 0, C.LIGHT);
  const period = d.period ?? 4;
  Object.assign(l, { kind: d.type ?? 'sweep', period, time: d.offset ?? 0 });
  if (l.kind === 'blink') {
    Object.assign(l, { fov: 360, range: d.radius ?? 80, onTime: d.on ?? period / 2 });
  } else {
    const arc = d.arc ?? [0, 180];
    Object.assign(l, { arcFrom: arc[0], arcTo: arc[1], fov: d.fov ?? 40, range: d.range ?? 140 });
  }
  return l;
}

function startPause(g, duration) {
  g.pauseTotal = duration; g.pauseLeft = duration; g.lookBase = g.ang;
}

function patrol(g, dt) {
  if (g.path.length < 2) return;
  if (g.pauseLeft > 0) {
    g.pauseLeft = Math.max(g.pauseLeft - dt, 0);
    g.ang = g.lookBase + Math.sin(TAU * (1 - g.pauseLeft / g.pauseTotal)) * rad(C.LOOK_DEG);
    return;
  }
  const e = g.erratic;
  if (e > 0) {
    g.multLeft -= dt;
    if (g.multLeft <= 0) {
      g.mult = rand(1 - 0.5 * e, 1 + 0.4 * e);
      g.multLeft = rand(0.5, 1.5);
      if (Math.random() < 0.2 * e) { startPause(g, rand(0.4, 0.9)); return; }
    }
  }
  const goal = g.path[g.next], dx = goal.x - g.x, dy = goal.y - g.y, dist = Math.hypot(dx, dy);
  const step = g.speed * g.mult * dt;
  if (dist <= step) {
    g.x = goal.x; g.y = goal.y;
    if (g.next + g.dir < 0 || g.next + g.dir >= g.path.length) g.dir = -g.dir;
    g.next += g.dir;
    startPause(g, g.pause * rand(1 - 0.4 * e, 1 + 0.6 * e));
    return;
  }
  g.ang = Math.atan2(dy, dx);
  g.x += Math.cos(g.ang) * step; g.y += Math.sin(g.ang) * step;
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
    const a = v.ang + lerp(-half, half, i / count);
    const ex = v.x + Math.cos(a) * v.range, ey = v.y + Math.sin(a) * v.range;
    const hit = raycast(v.x, v.y, ex, ey) || { x: ex, y: ey };
    v.poly.push({ x: hit.x - v.x, y: hit.y - v.y });
  }
}

function canSee(v, p) {
  const dx = p.x - v.x, dy = p.y - v.y;
  if (Math.hypot(dx, dy) > v.range) return false;
  if (Math.abs(angleDiff(v.ang, Math.atan2(dy, dx))) > rad(v.fov) / 2) return false;
  return !raycast(v.x, v.y, p.x, p.y);
}

function updateVision(v, dt) {
  if (v.kind === 'guard') patrol(v, dt); else sweepLight(v, dt);
  if (!v.active) { v.poly = []; v.seen = 0; return false; }
  updatePoly(v);
  v.seen = canSee(v, S.player) ? v.seen + dt : 0;
  if (v.seen >= C.GRACE && !v.alerted) { v.alerted = true; return true; }
  return false;
}

// ---------- level ----------
async function loadLevel(id) {
  const data = await (await fetch(`assets/levels/level${id}.json`)).json();
  const tile = data.tileSize ?? 32, rect = (a) => ({ x: a[0] * tile, y: a[1] * tile, w: a[2] * tile, h: a[3] * tile });
  S.level = id;
  S.map = { w: data.size[0] * tile, h: data.size[1] * tile };
  S.walls = data.walls.map(rect);
  S.goal = rect(data.goal.rect);
  S.player = { x: (data.playerStart[0] + 0.5) * tile, y: (data.playerStart[1] + 0.5) * tile };
  S.visions = [...(data.guards ?? []).map((g) => makeGuard(g, tile)), ...(data.lights ?? []).map((l) => makeLight(l, tile))];
  S.joy.vx = S.joy.vy = 0;
  followCamera();
}

function followCamera() {
  const { w, h } = S.view, { w: mw, h: mh } = S.map;
  S.cam.x = mw > w ? Math.min(Math.max(S.player.x, w / 2), mw - w / 2) : mw / 2;
  S.cam.y = mh > h ? Math.min(Math.max(S.player.y, h / 2), mh - h / 2) : mh / 2;
}

function inputVector() {
  const k = S.keys, x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
  const y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
  let v = { x, y };
  if (!x && !y) v = { x: S.joy.vx, y: S.joy.vy };
  const len = Math.hypot(v.x, v.y);
  return len > 1 ? { x: v.x / len, y: v.y / len } : v;
}

function step(dt) {
  const p = S.player, dir = inputVector();
  p.x += dir.x * C.PLAYER_SPEED * dt; p.y += dir.y * C.PLAYER_SPEED * dt;
  for (let i = 0; i < 3; i++) for (const w of S.walls) pushOut(p, w);
  audio.setRolling(dir.x !== 0 || dir.y !== 0);
  followCamera();
  if (touchesRect(p, S.goal)) return endLevel(true);
  let spotted = false;
  for (const v of S.visions) spotted = updateVision(v, dt) || spotted;
  if (spotted) endLevel(false);
}

function endLevel(won) {
  S.mode = won ? 'won' : 'failed';
  audio.setRolling(false);
  if (won) {
    audio.playWin();
    if (S.level > (store.get().highest ?? 0)) store.set({ highest: S.level });
  } else {
    audio.playAlert();
  }
  showPopup(won ? 'Level Complete!' : 'Bummer... try again?',
    { resume: false, retry: !won, next: won && S.level < C.LEVEL_COUNT });
}

// ---------- rendering ----------
const canvas = $('game'), ctx = canvas.getContext('2d');
const lightMap = document.createElement('canvas'), lctx = lightMap.getContext('2d');
const tinted = document.createElement('canvas');

function resize() {
  const dpr = window.devicePixelRatio || 1, W = window.innerWidth, H = window.innerHeight;
  const scale = Math.min(W / C.VIEW_W, H / C.VIEW_H);
  Object.assign(S.view, { w: W / scale, h: H / scale, scale, dpr });
  canvas.width = lightMap.width = Math.round(W * dpr);
  canvas.height = lightMap.height = Math.round(H * dpr);
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

function drawVision(v) {
  ctx.save();
  ctx.translate(v.x, v.y);
  if (v.poly.length > 2) {
    ctx.fillStyle = v.seen > 0 ? C.ALERT : v.cone;
    ctx.beginPath();
    v.poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath(); ctx.fill();
  }
  if (v.kind === 'guard') {
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

function drawWorld() {
  const { w, h, scale, dpr } = S.view, ox = w / 2 - S.cam.x, oy = h / 2 - S.cam.y;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.fillStyle = C.BG; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.translate(ox, oy);
  ctx.fillStyle = C.WALL;
  for (const r of S.walls) ctx.fillRect(r.x, r.y, r.w, r.h);
  const g = S.goal;
  ctx.drawImage(IMG.glow, g.x - 32, g.y - 32, g.w + 64, g.h + 64);
  ctx.fillStyle = C.GOAL; ctx.fillRect(g.x, g.y, g.w, g.h);
  S.visions.forEach(drawVision);
  ctx.fillStyle = C.PLAYER; ctx.beginPath(); ctx.arc(S.player.x, S.player.y, C.PLAYER_R, 0, TAU); ctx.fill();
  ctx.restore();
  // ambient darkness with a glow around the player
  lctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = C.AMBIENT; lctx.fillRect(0, 0, w, h);
  lctx.globalCompositeOperation = 'lighter';
  const lr = 64 * C.PLAYER_LIGHT_SCALE;
  lctx.drawImage(tinted, S.player.x + ox - lr, S.player.y + oy - lr, lr * 2, lr * 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lightMap, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.drawImage(IMG.vignette, 0, 0, w, h);
  drawJoystick();
}

function drawJoystick() {
  const j = S.joy;
  if (j.id === -1) return;
  ctx.imageSmoothingEnabled = false;
  for (const [img, x, y] of [[IMG.base, j.ox, j.oy], [IMG.knob, j.ox + j.kx, j.oy + j.ky]]) {
    const w = img.width * C.JOY_SCALE, h = img.height * C.JOY_SCALE;
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  }
  ctx.imageSmoothingEnabled = true;
}

// ---------- ui ----------
function show(el, on) { el.hidden = !on; }

function showPopup(title, buttons) {
  $('ptitle').textContent = title;
  for (const id of ['resume', 'retry', 'next']) show($(id), !!buttons[id]);
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
    if (id <= highest + 1) {
      b.textContent = `${id}\n${S.names[id] ?? ''}`;
      b.onclick = () => startLevel(id);
    } else {
      b.textContent = `${id}\n`; b.disabled = true;
      const lock = document.createElement('img');
      lock.src = 'assets/ui/icons/icon_lock.png';
      b.appendChild(lock);
    }
    grid.appendChild(b);
  }
}

function showSelect() {
  S.mode = 'select';
  audio.duck(false);
  audio.setRolling(false);
  show($('popup'), false); show($('pause'), false); show($('game'), false);
  buildSelect();
  show($('select'), true);
}

async function startLevel(id) {
  await loadLevel(id);
  show($('select'), false); show($('popup'), false); show($('game'), true); show($('pause'), true);
  S.mode = 'playing';
}

function pauseGame() {
  if (S.mode !== 'playing') return;
  S.mode = 'paused';
  audio.setRolling(false);
  audio.duck(true);
  showPopup('Paused', { resume: true });
}

function resumeGame() {
  if (S.mode !== 'paused') return;
  S.mode = 'playing';
  audio.duck(false);
  show($('popup'), false);
}

// ---------- input ----------
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener('keydown', (e) => {
  audio.start();
  if (e.code === 'Escape') { if (S.mode === 'playing') pauseGame(); else resumeGame(); return; }
  if (GAME_KEYS.has(e.code)) { S.keys.add(e.code); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => S.keys.delete(e.code));
window.addEventListener('blur', () => { S.keys.clear(); pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('pointerdown', () => audio.start());
window.addEventListener('resize', resize);

function joyMove(e) {
  const j = S.joy, k = S.view.scale;
  let dx = e.clientX / k - j.ox, dy = e.clientY / k - j.oy;
  const len = Math.hypot(dx, dy);
  if (len > C.JOY_R) { dx = dx / len * C.JOY_R; dy = dy / len * C.JOY_R; }
  j.kx = dx; j.ky = dy;
  const m = Math.hypot(dx, dy) / C.JOY_R;
  j.vx = m >= C.JOY_DEAD ? dx / C.JOY_R : 0; j.vy = m >= C.JOY_DEAD ? dy / C.JOY_R : 0;
}

function joyEnd() { Object.assign(S.joy, { id: -1, kx: 0, ky: 0, vx: 0, vy: 0 }); }

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || S.joy.id !== -1 || S.mode !== 'playing') return;
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
$('retry').onclick = () => startLevel(S.level);
$('next').onclick = () => startLevel(S.level + 1);
$('menu').onclick = showSelect;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- main loop ----------
let last = 0, acc = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (S.mode === 'playing') {
    acc += dt;
    while (acc >= C.STEP && S.mode === 'playing') { step(C.STEP); acc -= C.STEP; }
  } else {
    acc = 0;
  }
  if (S.mode !== 'select' && S.mode !== 'loading') drawWorld();
  requestAnimationFrame(frame);
}

async function boot() {
  resize();
  refreshToggles();
  await loadImages();
  tintLight();
  S.names = [''];
  await Promise.all(Array.from({ length: C.LEVEL_COUNT }, (_, i) =>
    fetch(`assets/levels/level${i + 1}.json`).then((r) => r.json()).then((d) => { S.names[i + 1] = d.name; }).catch(() => {})));
  showSelect();
  requestAnimationFrame(frame);
}
boot();

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
