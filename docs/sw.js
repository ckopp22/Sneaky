const CACHE = 'sneaky-v3';
const FILES = [
 "./",
 "index.html",
 "game.js",
 "peerjs.min.js",
 "assets/levels/coop/coop1.json",
 "assets/levels/coop/coop2.json",
 "assets/levels/coop/coop3.json",
 "assets/levels/coop/coop4.json",
 "assets/levels/coop/coop5.json",
 "manifest.webmanifest",
 "icon.png",
 "icon-192.png",
 "icon-512.png",
 "apple-touch-icon.png",
 "assets/.gitkeep",
 "assets/ui/buttons/btn_danger.png",
 "assets/ui/buttons/btn_danger_pressed.png",
 "assets/ui/buttons/btn_disabled.png",
 "assets/ui/buttons/btn_primary.png",
 "assets/ui/buttons/btn_primary_pressed.png",
 "assets/ui/buttons/btn_secondary.png",
 "assets/ui/buttons/btn_secondary_pressed.png",
 "assets/ui/buttons/btn_square_danger.png",
 "assets/ui/buttons/btn_square_danger_pressed.png",
 "assets/ui/buttons/btn_square_disabled.png",
 "assets/ui/buttons/btn_square_primary.png",
 "assets/ui/buttons/btn_square_primary_pressed.png",
 "assets/ui/buttons/btn_square_secondary.png",
 "assets/ui/buttons/btn_square_secondary_pressed.png",
 "assets/ui/buttons/btn_success.png",
 "assets/ui/buttons/btn_success_pressed.png",
 "assets/ui/buttons/level_done.png",
 "assets/ui/buttons/level_locked.png",
 "assets/ui/buttons/level_open.png",
 "assets/ui/buttons/level_open_pressed.png",
 "assets/ui/panels/panel.png",
 "assets/ui/panels/panel_light.png",
 "assets/ui/icons/icon_alert.png",
 "assets/ui/icons/icon_back.png",
 "assets/ui/icons/icon_check.png",
 "assets/ui/icons/icon_close.png",
 "assets/ui/icons/icon_coop.png",
 "assets/ui/icons/icon_eye.png",
 "assets/ui/icons/icon_flag.png",
 "assets/ui/icons/icon_home.png",
 "assets/ui/icons/icon_lock.png",
 "assets/ui/icons/icon_next.png",
 "assets/ui/icons/icon_pause.png",
 "assets/ui/icons/icon_play.png",
 "assets/ui/icons/icon_restart.png",
 "assets/ui/icons/icon_settings.png",
 "assets/ui/icons/icon_sound_off.png",
 "assets/ui/icons/icon_sound_on.png",
 "assets/ui/icons/icon_star.png",
 "assets/ui/icons/icon_star_empty.png",
 "assets/ui/icons/icon_wifi.png",
 "assets/ui/joystick/joystick_base.png",
 "assets/ui/joystick/joystick_knob.png",
 "assets/ui/joystick/joystick_knob_active.png",
 "assets/ui/graphics/alert_bubble.png",
 "assets/ui/graphics/goal_glow.png",
 "assets/ui/graphics/light_circle.png",
 "assets/ui/graphics/light_cone.png",
 "assets/ui/graphics/logo_sneaky.png",
 "assets/ui/graphics/vignette.png",
 "assets/audio/alert.mp3",
 "assets/audio/music1.mp3",
 "assets/audio/music2.mp3",
 "assets/audio/music3.mp3",
 "assets/audio/rolling.mp3",
 "assets/audio/win.mp3",
 "assets/levels/level1.json",
 "assets/levels/level10.json",
 "assets/levels/level11.json",
 "assets/levels/level12.json",
 "assets/levels/level2.json",
 "assets/levels/level3.json",
 "assets/levels/level4.json",
 "assets/levels/level5.json",
 "assets/levels/level6.json",
 "assets/levels/level7.json",
 "assets/levels/level8.json",
 "assets/levels/level9.json"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function ranged(request, response) {
  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range'));
  const blob = await response.blob();
  const start = range[1] ? parseInt(range[1], 10) : 0;
  const end = range[2] ? Math.min(parseInt(range[2], 10), blob.size - 1) : blob.size - 1;
  return new Response(blob.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers: {
    'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
    'Content-Range': `bytes ${start}-${end}/${blob.size}`, 'Content-Length': String(end - start + 1) } });
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const code = req.mode === 'navigate' || /\.(html|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (code) {
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req.mode === 'navigate' ? './' : req, fresh.clone());
        return fresh;
      } catch {
        return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./'));
      }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return req.headers.has('range') ? ranged(req, hit) : hit;
    const res = await fetch(req);
    if (res.ok && res.status === 200) cache.put(req, res.clone());
    return res;
  })());
});
