// Usage: node tools/gen-mazes.js <firstLevel> <lastLevel>   (writes docs/assets/levels/levelN.json)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../docs/assets/levels');
const [from, to] = [Number(process.argv[2]), Number(process.argv[3])];
const NAMES = ['Lost Corridors', 'Wrong Turn', 'Winding Halls', 'Dead Ends', 'The Maze', 'Twisting Vaults', 'Labyrinth', 'No Way Back', 'Deep Maze', 'Minotaur'];

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function build(n) {
  const R = rng(n * 7919), k = n - from, pick = (a) => a[Math.floor(R() * a.length)];
  const P = 5, cw = 7 + Math.round(k * 0.8), ch = 5 + Math.round(k * 0.35), W = cw * P + 1, H = ch * P + 1;
  const open = new Set(), key = (x, y) => y * cw + x, edge = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
  // recursive backtracker = perfect maze (many dead ends), then punch a few loops
  const r0 = [Math.floor(R() * cw), Math.floor(R() * ch)], seen = new Set([key(...r0)]), stack = [r0];
  const nb = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < cw && b < ch);
  while (stack.length) {
    const [x, y] = stack[stack.length - 1], c = nb(x, y).filter(([a, b]) => !seen.has(key(a, b)));
    if (!c.length) { stack.pop(); continue; }
    const [a, b] = pick(c); seen.add(key(a, b)); open.add(edge(key(x, y), key(a, b))); stack.push([a, b]);
  }
  for (let i = 0; i < Math.floor(cw * ch / 25) + k % 3; i++) { const x = Math.floor(R() * cw), y = Math.floor(R() * ch), [a, b] = pick(nb(x, y)); open.add(edge(key(x, y), key(a, b))); }
  // start on a random edge cell, goal = farthest cell by walking distance
  const edges = []; for (let x = 0; x < cw; x++) edges.push([x, 0], [x, ch - 1]); for (let y = 1; y < ch - 1; y++) edges.push([0, y], [cw - 1, y]);
  const [sx, sy] = pick(edges), dist = new Map([[key(sx, sy), 0]]), q = [[sx, sy]];
  while (q.length) { const [x, y] = q.shift(); for (const [a, b] of nb(x, y)) if (open.has(edge(key(x, y), key(a, b))) && !dist.has(key(a, b))) { dist.set(key(a, b), dist.get(key(x, y)) + 1); q.push([a, b]); } }
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
  const guards = Array.from({ length: 2 + Math.floor(k / 3) }, () => ({
    wander: Array.from({ length: 4 }, () => cell(...pick(far))), speed: Math.round(50 + k * 1.5), pause: 1, erratic: 0.3 }));
  const lights = [];
  for (let i = 0; i < 1 + Math.floor(k / 3); i++) lights.push({ type: 'blink', pos: cell(...pick(far)), radius: 90, period: 3, on: 1.4, offset: Math.round(R() * 3 * 10) / 10 });
  if (k >= 3) for (let i = 0; i < 1 + Math.floor(k / 4); i++) lights.push({ type: 'sweep', pos: cell(...pick(far)), arc: pick([[0, 180], [90, 270], [180, 360], [270, 450]]), period: 5, fov: 40, range: 130 });
  const lvl = { id: n, diff: Math.round((1.15 + k * 0.02) * 100) / 100, name: NAMES[k % NAMES.length], size: [W, H], tileSize: 32, playerStart: cell(sx, sy), goal: { rect: [...cell(gx, gy), 2, 2] }, walls, guards, lights };
  if (n === from) lvl.hint = 'Find the way out. Some paths are dead ends.';
  return lvl;
}

for (let n = from; n <= to; n++) fs.writeFileSync(path.join(dir, `level${n}.json`), JSON.stringify(build(n)));
// register in service worker precache
let sw = fs.readFileSync(path.join(__dirname, '../docs/sw.js'), 'utf8');
for (let n = from; n <= to; n++) {
  const prev = ` "assets/levels/level${n - 1}.json",\n`;
  if (!sw.includes(`level${n}.json`) && sw.includes(prev)) sw = sw.replace(prev, prev + ` "assets/levels/level${n}.json",\n`);
}
sw = sw.replace(/sneaky-v(\d+)/, (_, v) => `sneaky-v${Number(v) + 1}`);
fs.writeFileSync(path.join(__dirname, '../docs/sw.js'), sw);
