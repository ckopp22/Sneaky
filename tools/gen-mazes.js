// Usage: node tools/gen-mazes.js <firstLevel> <lastLevel> [coop]   (writes docs/assets/levels/levelN.json, or coop/coopN.json)
const fs = require('fs'), path = require('path');
const COOP = process.argv[4] === 'coop', prefix = COOP ? 'coop' : 'level';
const dir = path.join(__dirname, '../docs/assets/levels', COOP ? 'coop' : '');
const [from, to] = [Number(process.argv[2]), Number(process.argv[3])];
const NAMES = COOP ? ['Side by Side', 'Hold the Gate', 'Split Halls', 'Relay', 'Double Lock', 'Hall of Plates', 'Tag Team', 'Long Way Round', 'Gauntlet', 'Final Maze'] : ['Lost Corridors', 'Wrong Turn', 'Winding Halls', 'Dead Ends', 'The Maze', 'Twisting Vaults', 'Labyrinth', 'No Way Back', 'Deep Maze', 'Minotaur'];

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const BIG_NAMES = COOP ? ['Vast Halls', 'Endless Maze', 'Lost Together', 'The Great Maze', 'Grand Labyrinth']
  : ['Vast Labyrinth', 'Endless Halls', 'Lost for Good', 'The Great Maze', 'Grand Labyrinth'];

function build(n) {
  const BIG = COOP ? n >= 21 : n >= 31;
  const R = rng(n * 7919), k = n - from, pick = (a) => a[Math.floor(R() * a.length)];
  const P = 5, cw = BIG ? 20 + 2 * k : (COOP ? 6 : 7) + Math.round(k * 0.8), ch = BIG ? 12 + k : (COOP ? 4 : 5) + Math.round(k * 0.35), W = cw * P + 1, H = ch * P + 1;
  const open = new Set(), key = (x, y) => y * cw + x, edge = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
  // recursive backtracker = perfect maze (many dead ends), then punch a few loops
  const r0 = [Math.floor(R() * cw), Math.floor(R() * ch)], seen = new Set([key(...r0)]), stack = [r0];
  const nb = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < cw && b < ch);
  while (stack.length) {
    const [x, y] = stack[stack.length - 1], c = nb(x, y).filter(([a, b]) => !seen.has(key(a, b)));
    if (!c.length) { stack.pop(); continue; }
    const [a, b] = pick(c); seen.add(key(a, b)); open.add(edge(key(x, y), key(a, b))); stack.push([a, b]);
  }
  if (!COOP && !BIG) for (let i = 0; i < Math.floor(cw * ch / 25) + k % 3; i++) { const x = Math.floor(R() * cw), y = Math.floor(R() * ch), [a, b] = pick(nb(x, y)); open.add(edge(key(x, y), key(a, b))); }
  // start on a random edge cell, goal = farthest cell by walking distance
  const edges = []; for (let x = 0; x < cw; x++) edges.push([x, 0], [x, ch - 1]); for (let y = 1; y < ch - 1; y++) edges.push([0, y], [cw - 1, y]);
  const [sx, sy] = pick(edges), dist = new Map([[key(sx, sy), 0]]), par = new Map(), q = [[sx, sy]];
  while (q.length) { const [x, y] = q.shift(); for (const [a, b] of nb(x, y)) if (open.has(edge(key(x, y), key(a, b))) && !dist.has(key(a, b))) { dist.set(key(a, b), dist.get(key(x, y)) + 1); par.set(key(a, b), key(x, y)); q.push([a, b]); } }
  let gk = key(sx, sy); for (const [c, d] of dist) if (d > dist.get(gk)) gk = c;
  const gx = gk % cw, gy = Math.floor(gk / cw), cell = (x, y) => [x * P + 2, y * P + 2];
  // tile grid -> merged wall rects
  const wall = Array.from({ length: H }, () => Array(W).fill(true));
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    for (const dy of [1, 2, 3, 4]) for (const dx of [1, 2, 3, 4]) wall[y * P + dy][x * P + dx] = false;
    if (x + 1 < cw && open.has(edge(key(x, y), key(x + 1, y)))) for (const dy of [1, 2, 3, 4]) wall[y * P + dy][x * P + P] = false;
    if (y + 1 < ch && open.has(edge(key(x, y), key(x, y + 1)))) for (const dx of [1, 2, 3, 4]) wall[y * P + P][x * P + dx] = false;
  }
  const walls = [], active = new Map();
  for (let y = 0; y <= H; y++) {
    const runs = new Map();
    for (let x = 0; y < H && x < W; x++) if (wall[y][x]) { let e = x; while (e + 1 < W && wall[y][e + 1]) e++; runs.set(x + ',' + (e - x + 1), 1); x = e; }
    for (const [k2, r] of active) if (!runs.has(k2)) { walls.push([...k2.split(',').map(Number).slice(0, 1), r.y0, Number(k2.split(',')[1]), y - r.y0]); active.delete(k2); }
    for (const k2 of runs.keys()) if (!active.has(k2)) active.set(k2, { y0: y });
  }
  // guards / lights away from the start
  const far = [...dist].filter(([, d]) => d > 5).map(([c]) => [c % cw, Math.floor(c / cw)]);
  const guards = Array.from({ length: BIG ? (COOP ? 4 : 6) + k : 2 + Math.floor(k / 3) }, () => ({
    wander: Array.from({ length: 4 }, () => cell(...pick(far))), speed: Math.round(50 + k * 1.5), pause: 1, erratic: 0.3 }));
  const lights = [];
  for (let i = 0; i < (BIG ? 4 + k : 1 + Math.floor(k / 3)); i++) lights.push({ type: 'blink', pos: cell(...pick(far)), radius: 90, period: 5, on: 1.2, offset: Math.round(R() * 5 * 10) / 10 });
  if (BIG || k >= 3) for (let i = 0; i < (BIG ? 3 + k : 1 + Math.floor(k / 4)); i++) lights.push({ type: 'sweep', pos: cell(...pick(far)), arc: pick([[0, 180], [90, 270], [180, 360], [270, 450]]), period: 5, fov: 40, range: 130 });
  const cxy = (c) => [c % cw, Math.floor(c / cw)];
  let coopExtra = {};
  if (COOP) {
    const route = []; for (let c = gk; c !== undefined; c = par.get(c)) route.unshift(c);
    const gateCount = Math.min(BIG ? 3 + Math.ceil(k / 2) : 1 + Math.floor(k / 3), Math.floor((route.length - 4) / 3)), gates = [], plates = [];
    const slots = Array.from({ length: gateCount }, (_, i) => 3 + Math.floor((i + 0.5) * (route.length - 4) / gateCount));
    slots.forEach((r, i) => {
      const id = 'abcdef'[i], [ax, ay] = cxy(route[r - 1]), [bx, by] = cxy(route[r]);
      gates.push({ id, rect: bx !== ax ? [Math.max(ax, bx) * P, ay * P + 1, 1, 4] : [ax * P + 1, Math.max(ay, by) * P, 4, 1] });
      // plate on the near side (held by one player) and one just past the gate (held by the other while the first catches up)
      const reach = new Set([route[0]]), qq = [route[0]], blocked = route[r];
      while (qq.length) { const c = qq.shift(), [x, y] = cxy(c); for (const [a, b] of nb(x, y)) { const m = key(a, b); if (open.has(edge(c, m)) && m !== blocked && !reach.has(m)) { reach.add(m); qq.push(m); } } }
      const spurs = [...reach].filter((c) => !route.includes(c) && Math.abs(dist.get(c) - dist.get(route[r - 1])) < 10 && !slots.some((sl) => route[sl] === c));
      const [px, py] = cxy(spurs.length ? pick(spurs) : route[r - 1]), [qx, qy] = cxy(route[r]);
      plates.push({ id, rect: [px * P + 2, py * P + 2, 2, 2] }, { id, rect: [qx * P + 2, qy * P + 2, 2, 2] });
    });
    const [mx, my] = cxy(route[slots.length ? slots[0] + 1 : Math.floor(route.length / 2)]);
    coopExtra = { gates, plates, doors: [], switches: [], checkpoint: { rect: [mx * P + 1, my * P + 1, 4, 4] } };
    // keep guards off the start and clear of the plate cells' spawn; players start side by side
  }
  const lvl = COOP ? { id: n, maze: true, diff: Math.round(((BIG ? 1.2 : 1.1) + k * 0.02) * 100) / 100, name: (BIG ? BIG_NAMES : NAMES)[k % (BIG ? 5 : 10)], size: [W, H], tileSize: 32,
    playerStarts: [[sx * P + 2, sy * P + 1], [sx * P + 2, sy * P + 4]], goal: { rect: [...cell(gx, gy), 2, 2] }, walls, ...coopExtra, guards, lights } : { id: n, maze: true, diff: Math.round(((BIG ? 1.3 : 1.15) + k * 0.02) * 100) / 100, name: (BIG ? BIG_NAMES : NAMES)[k % (BIG ? 5 : 10)], size: [W, H], tileSize: 32, playerStart: cell(sx, sy), goal: { rect: [...cell(gx, gy), 2, 2] }, walls, guards, lights };
  if (BIG && n === from) lvl.hint = 'A huge maze with only one way through. Expect dead ends.';
  else if (n === from) lvl.hint = COOP ? 'Find the way out together. Stand on plates to open gates for your partner.' : 'Find the way out. Some paths are dead ends.';
  return lvl;
}

for (let n = from; n <= to; n++) fs.writeFileSync(path.join(dir, `${prefix}${n}.json`), JSON.stringify(build(n)));
// register in service worker precache
let sw = fs.readFileSync(path.join(__dirname, '../docs/sw.js'), 'utf8');
for (let n = from; n <= to; n++) {
  const sub = COOP ? 'coop/' : '', prev = ` "assets/levels/${sub}${prefix}${n - 1}.json",\n`;
  if (!sw.includes(`${prefix}${n}.json`) && sw.includes(prev)) sw = sw.replace(prev, prev + ` "assets/levels/${sub}${prefix}${n}.json",\n`);
}
sw = sw.replace(/sneaky-v(\d+)/, (_, v) => `sneaky-v${Number(v) + 1}`);
fs.writeFileSync(path.join(__dirname, '../docs/sw.js'), sw);
