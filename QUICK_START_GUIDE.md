# 🎮 Planetary Mining Game - Quick Start Guide

## Game Flow (After Fixes)

```
START GAME
    ↓
PLANET VIEW (3D Sphere)
    ├─ Mine ore nodes
    ├─ Collect Gold + Platinum
    └─ When ready: Press R
        ↓
    BUILD RADAR
        ↓
    GALAXY VIEW (2D Network)
        ├─ See starter planet + nearby planets (within 300 units)
        ├─ Click any planet to explore
        └─ Each new planet has ore to mine
```

---

## ⌨️ Controls

| Key | Action | Notes |
|-----|--------|-------|
| **Click ore node** | Mine resource | Costs 20 energy per node |
| **Escape** | Return to galaxy | Only in planet view |
| **R** | Build radar | Need: 50 Gold + 25 Platinum |
| **F12** | Open dev tools | Debug mode |

---

## 🎯 Progression Goals

### Phase 1: Initial Mining (Planet View)
1. Start on starter planet (green border)
2. Mine iron/copper/lithium/platinum
3. **Goal: Collect 50 Gold + 25 Platinum**

### Phase 2: Build Radar
1. Press `R` when you have resources
2. Radar scans nearby planets (300 unit radius)
3. New planets now visible in galaxy view

### Phase 3: Exploration
1. Press `Escape` to see galaxy
2. See starter planet + scanned planets
3. Click any planet to zoom in
4. Mine resources on new planets
5. Repeat!

---

## 📊 Resource Types

| Resource | Color | Rarity | Use |
|----------|-------|--------|-----|
| Iron | 🟤 Brown | Common | Basic structures |
| Copper | 🟠 Orange | Common | Electronics |
| Gold | 🟡 Yellow | Rare | Radar + advanced tech |
| Lithium | 🔵 Cyan | Rare | Energy storage |
| Platinum | ⚪ Silver | Epic | Megastructure core |

---

## ⚡ Energy System

- **Start with**: 500 energy
- **Cost per mine**: 20 energy
- **Max mines per tank**: 25
- **Recovery**: Recharge stations (not yet built)

---

## 🛰️ Radar System

**Cost**: 50 Gold + 25 Platinum

**Range**: 300 space units

**Effect**: 
- Reveals all planets within range
- Shows dashed circle on galaxy map
- Enables exploration beyond starter planet

---

## 🌍 Galaxy Map

### Before Radar
```
        [Starter Planet]
        
(empty void everywhere else)
```

### After Radar
```
              [Planet 3]
             /
        [Starter] — [Planet 1]
             \
              [Planet 2]
              
(Dashed circle shows scan radius)
```

---

## 🎮 Pro Tips

1. **Mine efficiently**: Planets have different ore distributions
2. **Plan your route**: Check galaxy map before zooming
3. **Manage energy**: Don't get stranded on a planet
4. **Track resources**: HUD shows current inventory
5. **Visit all planets**: Each has unique ore mixtures

---

## 🐛 Troubleshooting

**Can't click ore nodes?**
- Make sure you're zoomed in (planet view)
- Hover over node - cursor should change
- Try clicking directly on the colored dot

**Can't build radar?**
- You need EXACTLY 50 Gold + 25 Platinum
- Check resource display in top-left
- The "R" key must be pressed while resources are available

**Radar doesn't show planets?**
- Radar range is 300 units
- Some planets might be beyond range
- Build more mining infrastructure to reach farther

**Game runs slow?**
- Close other browser tabs
- Check FPS counter (top-right)
- Reduce number of planets in GameState.js

---

## 📈 What's Coming Next

- [ ] Sound effects (mining, radar, explosions)
- [ ] NPC traders with dynamic pricing
- [ ] Automated mining stations
- [ ] Tech tree upgrades (faster drills, larger cargo)
- [ ] Asteroid fields (danger zones with rewards)
- [ ] Megastructure construction (end-game goal)
- [ ] Multiplayer leaderboard

---

## 🎓 Understanding Your Game

### Three Core Systems Working Together:

1. **GameState** = Data (inventory, planets, radar status)
2. **GalaxyView** = 2D Network View (canvas rendering, raycasting)
3. **PlanetView** = 3D Planet View (Three.js, resource nodes)

When you click:
```
Click Event
    ↓
GalaxyView detects (raycasting)
    ↓
GameState updates (selectedPlanetId)
    ↓
Game triggers zoom()
    ↓
PlanetView.init() creates 3D scene
    ↓
Player mines ore on new planet
```

---

## 📞 Questions?

- Check the **console** (F12) for debug messages
- Examine **GameState.js** for game logic
- Look at **GalaxyView.js** for rendering code
- Review **PlanetView.js** for 3D mechanics

**Happy mining! 🚀⛏️**
