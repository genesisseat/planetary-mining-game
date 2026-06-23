# 🎮 Planetary Mining Game — Developer & AI Reference Guide

> **Purpose**: This document is the single source of truth for the current game state, architecture, and planned direction. It is written for both human developers and AI assistants picking up this codebase to plan or implement new features.

---

## 📁 File Structure

```
src/
├── index.js          # Game controller — orchestrates all views, HUD, build menu
├── GameState.js      # Pure data store — inventory, planets, tech tree, radar
├── PlanetView.js     # Three.js 3D planet scene — nodes, drills, solar panels
├── GalaxyView.js     # Canvas 2D galaxy map — planet selection, radar overlay
index.html            # Shell — HUD, build panel, controls UI
```

---

## 🏗️ Architecture Overview

```
Game (index.js)
  ├── GameState          — all mutable game data, no rendering
  ├── GalaxyView         — 2D canvas, reads GameState, fires zoom()
  └── PlanetView         — Three.js scene, reads/writes GameState inventory
        ├── nodeMeshes[]       — invisible hit spheres over ore craters
        ├── emptyVertMeshes[]  — invisible hit spheres over empty vertices
        ├── drillMeshes[]      — active drill groups (animated)
        ├── solarMeshes[]      — active solar panel groups (animated)
        └── productionIntervals{} — setInterval handles for passive output
```

### Data flow
```
Right-click on planet canvas
  → PlanetView.handleRightClick()
  → raycaster hits nodeMesh or emptyVertMesh
  → Game.openBuildMenu(x, y, mesh, slotType)
  → player clicks Build button
  → GameState.inventory deducted
  → PlanetView.buildDrillVisual() or buildSolarPanelVisual()
  → setInterval starts passive production
  → Game.updateHUD() reflects new inventory
```

---

## 🌍 Current Game Systems (Fully Implemented)

### 1. Planet View (3D — Three.js)
- **Renderer**: `WebGLRenderer` with `OrbitControls` (rotate only, no pan)
- **Planet mesh**: `IcosahedronGeometry(1, detail=2)` wireframe — low-poly aesthetic
- **Node placement**: Ore nodes snap to actual icosahedron vertices (not random positions). Vertices extracted via `getIcosahedronVertices()`, shuffled with planet ID as seed for deterministic variation per planet.
- **Interaction**: Right-click (`contextmenu` event + `preventDefault`) → raycaster → build menu
- **Drag guard**: `mousedown` position stored, click ignored if mouse moved >5px (prevents OrbitControls drag triggering builds)
- **Canvas sizing**: Deferred to `requestAnimationFrame` via `_setup()` to ensure non-zero `offsetWidth/offsetHeight`
- **Lighting**: `AmbientLight(0.6)` + `DirectionalLight(1)` at (5,5,5) — required for `MeshStandardMaterial`

### 2. Ore Crater Nodes
- Visual: `RingGeometry` (outer) + `CircleGeometry` disc (inner, emissive, pulsing)
- Hit target: Invisible `SphereGeometry(r=0.07)` at same position — reliable raycasting
- Colors by ore type: iron=orange-red, copper=teal, gold=yellow, lithium=electric-blue, platinum=cold-white
- Pulse animation: per-node random phase offset, `emissiveIntensity` oscillates via `Math.sin`

### 3. Buildings

| Building | Slot | Cost | Output | Visual |
|---|---|---|---|---|
| **Drill** | Ore node | 20 ⚡ | +1 ore / 5 sec | Cylinder + spinning shaft + ore-colored cone tip |
| **Solar Panel** | Empty vertex | 5 Cu | +2 ⚡ / 3 sec | Pole + tilted blue panel + pulsing emissive |

- Both buildings place a `PointLight` at their position for ambient color bleed
- Production runs via `setInterval`, cleared in `destroy()` when leaving planet
- Empty vertices shown as dim `SphereGeometry(r=0.018)` dots — subtle interactive hints

### 4. Galaxy View (2D — Canvas)
- Renders visible planets as circles with connection lines
- Starter planet has green border ring
- Visited planets have blue orbit ring
- Radar range shown as dashed circle when built
- Click a planet → `gameState.selectedPlanetId` set → `zoom()` → `PlanetView.init()`

### 5. Radar System
- **Cost**: 50 Gold + 25 Platinum (press `R` in planet view — *currently missing key binding in index.js, was in old version*)
- **Effect**: Scans all planets within 300 units of starter planet, adds to `scannedPlanets` Set
- `getVisiblePlanets()` returns only scanned planets if radar built, else just starter

### 6. HUD
- Top-left: location label + live inventory (`⚡ energy | Fe Cu Au Li Pt`)
- Top-right: FPS counter + entity count
- Bottom-left: Zoom In / Back to Galaxy / Help buttons
- Build panel: fixed-position overlay, appears on right-click near cursor, closes on left-click outside or Escape

---

## 📊 GameState Data Model

```javascript
inventory: { iron, copper, gold, lithium, platinum, energy, maxEnergy }
tech: { basicPickaxe, stoneDrill, ironDrill, autoExtractor, droneMiner, radar }
planets[]: {
  id, name, x, y, z,
  surfaceOres: { iron, copper, gold, lithium, platinum },
  nodes[]: { id, ore, amount, collected, drilled, phi, theta, _vertexPos, _vertexKey },
  _occupiedKeys: Set,   // vertex keys used by ore nodes
  temperature, hazardLevel, visited, depleted
}
scannedPlanets: Set<planetId>
radarRange: 300
radarBuilt: boolean
```

---

## ⚡ Resource Economy (Current)

| Resource | Source | Sink |
|---|---|---|
| Energy | Start 500, +2/3s per Solar Panel | Drill build (20), future: travel |
| Iron | Drill passive | (unused — future structures) |
| Copper | Drill passive | Solar Panel build (5) |
| Gold | Drill passive | Radar build (50) |
| Lithium | Drill passive | (unused — future: energy storage) |
| Platinum | Drill passive | Radar build (25) |

**Current loop**: Mine copper → build solar panel → recharge energy → build more drills

---

## 🐛 Known Issues / Tech Debt

| Issue | File | Notes |
|---|---|---|
| Radar `R` key binding missing | `index.js` | Was in old version, dropped in refactor |
| `back-btn` never shown | `index.html` | `display:none` never toggled to block |
| Production stops on planet leave | `PlanetView.destroy()` | By design currently, but breaks factory feel |
| No persistence | — | Drills/solars lost on refresh; `GameState.toJSON` exists but not called |
| `node.drilled` not saved in `toJSON` | `GameState.js` | Save format only tracks `collected` |
| Empty vertex dots too subtle | `PlanetView.js` | Players may not discover solar panel slots |
| `infoEntities` counter never updated | `index.js` | Always shows 0 |

---

## 🗺️ Planned Features (Prioritized for Next AI Session)

### 🔴 Priority 1 — Core Loop Fixes
These are blocking good gameplay:

1. **Restore radar R-key binding** in `index.js` `init()` keydown handler
2. **Show/hide Back button** — toggle `back-btn` display in `renderPlanet()` / `back()`
3. **Persist production across planet visits** — move `setInterval` to `GameState`, not `PlanetView`
4. **localStorage save/load** — call `gameState.toJSON()` on page unload, load on start

### 🟡 Priority 2 — Gameplay Depth
These add meaningful decisions:

5. **Battery/Capacitor building** — costs Lithium, increases `maxEnergy` (currently capped at 500)
6. **Ore Processor** — costs Iron + Gold, doubles drill output rate (game-changer upgrade)
7. **Travel cost system** — moving between planets costs energy, creates risk/reward
8. **Planet info panel** — show ore composition before zooming in (spend a scan token?)

### 🟢 Priority 3 — Polish & Feel
9. **Tooltip on hover** — show ore type + amount remaining before right-clicking
10. **Build animation** — brief scale-up tween when placing a structure
11. **Notification system** — "+1 Iron" floating text on passive production tick
12. **`infoEntities` counter** — show total drills + solar panels built
13. **Distinct planet visuals** — vary wireframe color by hazard level or temperature

### 🔵 Priority 4 — Endgame Systems
14. **Tech tree UI** — spend Gold/Platinum to unlock faster drills, larger cargo
15. **Megastructure** — multi-planet construction project as win condition
16. **Drone Miner** — autonomous unit that travels between nodes (uses `tech.droneMiner`)
17. **Asteroid fields** — random events with high-risk/high-reward ore pockets
18. **NPC traders** — appear in galaxy view, offer resource exchanges

---

## 🤖 Instructions for AI Assistants

When implementing a new feature:

1. **Read all 4 source files** before writing any code — the architecture is tightly coupled
2. **GameState is the data layer** — any new resource, building type, or flag lives here first
3. **PlanetView owns Three.js** — all mesh creation, animation, and raycasting lives here
4. **index.js is the controller** — wires UI events to GameState + PlanetView calls
5. **Never add game logic to GalaxyView** — it is a pure renderer
6. **New buildings follow this pattern**:
   - Add cost to `COSTS` in `index.js`
   - Add a hit mesh array in `PlanetView` constructor
   - Add slot detection in `handleRightClick`
   - Add `buildXVisual()` method in `PlanetView`
   - Add menu branch in `Game.openBuildMenu()`
   - Add `setInterval` in `buildXVisual`, clear in `destroy()`
7. **Vertex positions**: Always use `node._vertexPos` (set by `assignNodesToVertices`), never recalculate from `phi/theta`
8. **Canvas sizing**: Never read `offsetWidth/offsetHeight` synchronously after DOM insert — always defer to `requestAnimationFrame`
9. **Right-click only** opens build menus — left-click is reserved for OrbitControls camera

---

## 🎮 Controls Reference (Current)

| Input | Action |
|---|---|
| Right-click ore crater | Open drill build menu |
| Right-click empty vertex dot | Open solar panel build menu |
| Left-click (planet view) | Camera orbit (OrbitControls) |
| Escape | Close build menu + return to galaxy |
| Click planet (galaxy view) | Select + zoom to planet |
| Zoom In button | Enter planet view for selected planet |
| Back to Galaxy button | Return to galaxy view |

---

**Last updated**: Reflects codebase state after drill + solar panel implementation with right-click building, vertex-snapped nodes, and deferred canvas initialization.
