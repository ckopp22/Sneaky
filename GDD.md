# Sneaky: Game Design Document

## 1. Overview
**Title:** Sneaky
**Genre:** Top-down 2D stealth / puzzle
**Platforms:** Web browser (desktop + mobile), installable as a PWA
**Hosting:** GitHub Pages (static files only, no backend)
**Players:** 1 (solo) and 2 (online co-op, added in a later phase)

**Pitch:** Sneak through dark maps, dodge patrolling guards and sweeping lights, and reach the goal zone without being spotted. Levels get harder and bigger. Later, team up with a friend; both players must reach the checkpoint to advance.

## 2. Core Gameplay Loop
1. Level loads. The player starts at a fixed spawn point in a dark map.
2. The player moves toward the highlighted goal zone.
3. Guards patrol set routes with vision cones. Lights sweep or pulse on patterns.
4. If the player is inside any vision cone or light for long enough, they are spotted and the level fails.
5. Reaching the goal completes the level and unlocks the next one.

## 3. Controls
| Platform | Input |
|---|---|
| Desktop | WASD (arrow keys as an alternative), 8-direction movement, normalized diagonal speed |
| Mobile | On-screen virtual joystick (bottom-left), analog movement |

- Single speed in v1. Optional later: hold Shift / second button to sneak (slower, harder to detect).
- Joystick appears only on touch devices (detect touch support).

## 4. Detection Rules
- **Vision cone (guards):** a triangle/arc with set angle and range, rotating with the guard's facing direction.
- **Light zones:** circles or cones that sweep, rotate, or toggle on/off on a timed pattern.
- **Line of sight:** walls and obstacles block vision cones and lights (raycast). Hiding behind obstacles is the core skill.
- **Spotted:** player center overlaps a vision area with an unblocked line of sight.
- **Grace timer (tunable):** about 0.15 s in the light before failing. Keeps it fair on mobile. Show a red flash or "!" above the guard during the grace window.
- All values (cone angle, range, speed, grace time) live in a single `config` file so they are easy to tune.

## 5. Fail and Win States
- **Fail:** screen dims, popup reads **"Bummer... try again?"** with a **Try Again** button. Clicking restarts the same level instantly (reset guards, lights, and player).
- **Win:** the player enters the goal zone. Show "Level Complete!" with a Next Level button. The next level unlocks and is saved.

## 6. Levels and Progression
- A level select screen shows locked and unlocked levels. Completed levels get a checkmark.
- Progress is saved in `localStorage` (highest level unlocked).
- Levels are data-driven (JSON), so new levels need no code changes.

**Level JSON shape (example):**
```json
{
  "id": 1,
  "name": "First Steps",
  "size": [20, 15],
  "tileSize": 32,
  "playerStart": [1, 13],
  "goal": { "rect": [17, 1, 2, 2] },
  "walls": [[4,0,1,10], [8,5,1,10]],
  "guards": [
    { "path": [[6,3],[6,12]], "speed": 40, "fov": 60, "range": 120, "pause": 1.0 }
  ],
  "lights": [
    { "type": "sweep", "pos": [12,7], "arc": [0,180], "period": 4 }
  ]
}
```

**Difficulty curve (suggested):**
| Levels | Theme | New elements |
|---|---|---|
| 1-3 | Tutorial | 1 guard, straight patrol, few walls |
| 4-6 | Warehouse | 2-3 guards, sweeping lights, crates to hide behind |
| 7-9 | Courtyard | Blinking lights, guards that pause and look around, longer routes |
| 10-12 | Facility | Faster guards, overlapping patrols, tight corridors, timing puzzles |
| 13+ | Expansion | Doors/switches, camera sweeps, decoys (to be decided) |

## 7. Art and Audio Direction
- Dark, moody palette: near-black ground, cool blues/teals for walls, warm yellow for lights, red for alerts. The goal zone has a soft green glow.
- Light cones are drawn as translucent gradients over the dark scene. Optional darkness overlay with the player's small visibility radius.
- Sprites: player, guard (4 or 8 directions with walk cycle), tiles, props, UI icons. **Supplied by the designer as sprite sheets.** Placeholder shapes are used until assets arrive.
- Audio (later phase): footsteps, alert sting, level-complete jingle, ambient loop, mute toggle.

## 8. UI Screens
1. Title screen (Play, Co-op, Settings)
2. Level select
3. Gameplay HUD (level name, restart button, pause)
4. "Bummer... try again?" popup
5. Level complete popup
6. Settings (sound, controls)
7. Co-op lobby (host / join), added in Phase 6

## 9. Technical Plan
- **Engine:** plain HTML5 Canvas + vanilla JavaScript (ES modules), no build step, matching the setup of your other web games. This is easy for Claude Code to edit and deploys directly to GitHub Pages. (If you would rather use Godot, the design carries over unchanged; only the Technical Plan changes.)
- **Rendering:** fixed internal resolution scaled to fit the screen, preserving aspect ratio, `image-rendering: pixelated` for pixel art.
- **Game loop:** `requestAnimationFrame` with a delta-time update.
- **Structure:**
```
/index.html
/manifest.json
/service-worker.js
/icons/
/assets/        (sprites, audio)
/levels/        (level1.json ...)
/src/
  main.js       (boot, state machine)
  game.js       (loop, level load/reset)
  input.js      (keyboard + joystick)
  player.js
  guard.js
  light.js
  vision.js     (cone + raycast detection)
  ui.js
  save.js
  net.js        (multiplayer, later)
  config.js
```
- **PWA:** `manifest.json` (name, icons 192/512, `display: standalone`, `orientation: landscape` or `any`), plus a service worker that caches the app shell and assets for offline solo play. Bump a cache version on each deploy.
- **Hosting:** push to a GitHub repo, enable Pages from the main branch. All asset paths must be relative (for example `./assets/...`) because Pages serves from a subfolder.

## 10. Multiplayer (Co-op) Design
**Important constraint:** GitHub Pages is static hosting, so there is no game server. The plan uses **WebRTC peer-to-peer** (via PeerJS or a similar library):
- The host creates a game and gets a short **room code** (for example `K7QP`).
- The second player enters the code. A free public signaling service helps the two browsers connect, then game data goes directly between them.
- It works on the same wifi and over the internet. A small number of strict networks may block direct connections; a TURN relay is the fallback if needed.

**Model:**
- **Host-authoritative.** The host runs the simulation (guards, lights, detection). The guest sends input (movement) and receives state snapshots about 20 times per second, with interpolation for smoothness.
- Guards and lights are deterministic from the level data and a shared timer, which keeps the two screens in sync with very little data.
- **Rules:** if **either** player is spotted, both see "Bummer... try again?" and the level restarts for both. **Both** players must be in the goal/checkpoint zone to complete the level.
- Co-op levels are a separate set (`levels/coop/`) with two spawns and, later, two-player mechanics (for example, one player holds a switch while the other crosses).
- Disconnect handling: show a "Partner left" message and return to the lobby.
- Players are distinguished by color or sprite tint (P1 and P2).

## 11. Development Phases
Each phase ends with something playable and a deploy to GitHub Pages.

**Phase 0: Setup**
- Repo, folder structure, `CLAUDE.md`, GitHub Pages deploy, blank canvas that scales to the screen.
- *Done when:* the live URL shows the canvas on desktop and phone.

**Phase 1: Player and Map (placeholder art)**
- Game loop, WASD movement, virtual joystick, tile/wall collision, camera, dark background, spawn and goal zone.
- *Done when:* you can walk around a test map on desktop and phone and enter the goal.

**Phase 2: Guards and Detection**
- Patrolling guards, vision cones, line-of-sight raycasting against walls, spotted logic with grace timer, "Bummer... try again?" popup and restart.
- *Done when:* a guard patrols, can spot you, and the popup restarts the level.

**Phase 3: Lights and Level System**
- Sweeping and blinking lights, JSON level loader, level complete popup, level select, locked/unlocked saving, levels 1-5.
- *Done when:* you can play levels 1-5 in order with progress saved.

**Phase 4: Art Pass**
- Import your sprite sheets: player, guard animations, tiles, props, UI. Replace placeholders, add the darkness/lighting overlay and visual polish.
- *Done when:* the game looks like the intended style.

**Phase 5: Content, Audio and PWA**
- Levels 6-12, difficulty tuning, sound effects and music, mute setting, manifest, icons, service worker, offline play, "Add to Home Screen" tested on iOS and Android.
- *Done when:* a full solo campaign is installable and plays offline.

**Phase 6: Co-op Foundation**
- `net.js` with PeerJS, host/join lobby with room code, two players moving in one shared level, state sync.
- *Done when:* two devices see each other moving in the same level.

**Phase 7: Co-op Gameplay**
- Shared fail/win rules, both-in-checkpoint requirement, co-op levels (1-5), disconnect handling, latency testing.
- *Done when:* two people can complete co-op levels together.

**Phase 8: Polish and Launch**
- Settings, tutorial hints, bug fixing, performance on low-end phones, share link and screenshots.

## 12. Asset Checklist (to be provided)
- [ ] Player sprite sheet (idle + walk, 4 or 8 directions), frame size: ___
- [ ] Guard sprite sheet (walk, alert), frame size: ___
- [ ] Tileset (floor, walls, crates, doors), tile size: ___
- [ ] Light/lamp props and camera sprite
- [ ] UI: buttons, joystick graphics, icons
- [ ] App icons: 192x192 and 512x512 PNG
- [ ] Audio: footsteps, alert, win, ambient (later)

When you upload a sheet, give the frame size, number of frames per animation, and which rows are which direction.

## 13. Open Questions
- Orientation: landscape-only, or support both?
- Is a "sneak" (slow) mode wanted in v1?
- Co-op: should the guest be able to also restart, or only the host?
- Any scoring (time, number of times spotted, stars per level)?
