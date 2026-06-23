/**
 * GAME CONTROLLER ORBITAL EXTENSIONS
 * 
 * Handles:
 * - Launch facility building
 * - Naval station construction
 * - Spacecraft dock placement
 * - Spacecraft launch and travel
 */

// ============================================================================
// ADD TO GAME.INIT() KEYDOWN HANDLER
// ============================================================================

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { this.closeBuildMenu(); this.back(); }
  
  // NEW: Toggle orbital view (O key)
  if ((e.key === 'o' || e.key === 'O') && this.gameState.view === 'planet') {
    this.planetView.toggleOrbitalView();
  }

  // NEW: Build launch facility (L key) on surface
  if ((e.key === 'l' || e.key === 'L') && this.gameState.view === 'planet') {
    if (!this.planetView.orbitalMode) {
      const success = this.gameState.buildLaunchFacility(this.gameState.selectedPlanetId);
      if (success) {
        const visualGroup = this.planetView.buildLaunchFacilityVisual();
        console.log('✓ Launch Facility built');
        this.updateHUD();
      }
    }
  }

  // NEW: Launch spacecraft (SPACE bar) from orbit
  if (e.code === 'Space' && this.gameState.view === 'planet' && this.planetView.orbitalMode) {
    this.openSpacecraftLaunchMenu();
  }
});

// ============================================================================
// ORBITAL BUILD MENU (RIGHT-CLICK IN ORBIT)
// ============================================================================

/**
 * Open build menu for orbital nodes (naval station or dock)
 */
openOrbitalBuildMenu(screenX, screenY, mesh, slotType) {
  const panel = document.getElementById('build-panel');
  const container = document.getElementById('build-options-container');
  const title = document.getElementById('build-target-name');
  if (!panel || !container || !title) return;

  const planet = this.gameState.planets[this.gameState.selectedPlanetId];
  const node = planet.orbital.nodes[mesh.userData.nodeId];

  // Already built
  if (node.occupied) {
    title.innerText = `${node.built === 'naval' ? 'Naval Station' : 'Spacecraft Dock'} (Built)`;
    container.innerHTML = '<p class="build-info">Already constructed</p>';
    panel.style.left = `${screenX + 10}px`;
    panel.style.top = `${screenY + 10}px`;
    panel.style.display = 'block';
    return;
  }

  this._pendingOrbitalMesh = mesh;
  this._pendingOrbitalNode = node;
  this._pendingPlanetId = this.gameState.selectedPlanetId;

  container.innerHTML = '';

  if (slotType === 'naval') {
    title.innerText = 'Naval Station Slot';
    this._addInfoLine(container, 'Orbital command center. Unlocks spacecraft docks.');
    this._addOrbitalBuildButton(container, {
      label: `⚓ Naval Station (150 Au + 50 Pt)`,
      canAfford: this.gameState.inventory.gold >= 150 && this.gameState.inventory.platinum >= 50,
      reason: 'Need 150 Gold + 50 Platinum',
      onConfirm: () => {
        const success = this.gameState.buildNavalStation(this._pendingPlanetId);
        if (success) {
          this.planetView.buildNavalStationVisual(this._pendingOrbitalNode);
          console.log('✓ Naval Station built');
        }
      },
    });
  } else {
    title.innerText = 'Spacecraft Dock Slot';
    this._addInfoLine(container, 'Docking station for interplanetary travel.');
    this._addOrbitalBuildButton(container, {
      label: `🛰 Dock (80 Au + 30 Cu)`,
      canAfford: this.gameState.inventory.gold >= 80 && this.gameState.inventory.copper >= 30,
      reason: 'Need 80 Gold + 30 Copper',
      onConfirm: () => {
        const success = this.gameState.buildSpacecraftDock(
          this._pendingPlanetId,
          this._pendingOrbitalNode.id
        );
        if (success) {
          this.planetView.buildSpacecraftDockVisual(this._pendingOrbitalNode);
          console.log('✓ Dock built');
        }
      },
    });
  }

  const left = Math.min(screenX + 12, window.innerWidth - 220);
  const top = Math.min(screenY + 12, window.innerHeight - 140);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.display = 'block';
}

/**
 * Build button for orbital structures
 */
_addOrbitalBuildButton(container, { label, canAfford, reason, onConfirm }) {
  const btn = document.createElement('button');
  btn.className = 'build-option';
  btn.disabled = !canAfford;
  btn.textContent = canAfford ? label : `✗ ${reason}`;
  btn.onmousedown = (e) => e.stopPropagation();
  btn.onclick = (e) => {
    e.stopPropagation();
    this.closeBuildMenu();
    onConfirm();
    this.updateHUD();
  };
  container.appendChild(btn);
}

// ============================================================================
// SPACECRAFT LAUNCH MENU
// ============================================================================

/**
 * Open menu to select spacecraft launch destination
 * Press SPACE in orbital view
 */
openSpacecraftLaunchMenu() {
  const originPlanet = this.gameState.planets[this.gameState.selectedPlanetId];

  // Check prerequisites
  if (!originPlanet.orbital.navalStationBuilt) {
    alert('Requires Naval Station to launch spacecraft');
    return;
  }
  if (originPlanet.orbital.docks.length === 0) {
    alert('Requires Spacecraft Dock to launch');
    return;
  }

  // Show dialog with available targets
  const visiblePlanets = this.gameState.getVisiblePlanets();
  const targets = visiblePlanets.filter(p => p.id !== originPlanet.id);

  if (targets.length === 0) {
    alert('No visible target planets. Build Radar first.');
    return;
  }

  let html = '<div style="color: #64b5f6; font-weight: 600; margin-bottom: 12px;">Select Launch Target</div>';
  html += '<div style="max-height: 200px; overflow-y: auto;">';

  targets.forEach(target => {
    const distance = Math.hypot(
      target.x - originPlanet.x,
      target.y - originPlanet.y,
      target.z - originPlanet.z
    );
    const fuelNeeded = 20;
    const canLaunch = this.gameState.inventory.fuelCell >= fuelNeeded;

    html += `
      <button class="spacecraft-target" style="
        width: 100%;
        text-align: left;
        padding: 8px 12px;
        margin-bottom: 6px;
        background: rgba(100,181,246,0.1);
        border: 1px solid rgba(100,181,246,0.3);
        border-radius: 4px;
        color: #64b5f6;
        cursor: ${canLaunch ? 'pointer' : 'not-allowed'};
        opacity: ${canLaunch ? 1 : 0.5};
      " onclick="window.gameInstance.launchSpacecraft(${target.id})">
        ${target.name} (${Math.floor(distance)}u) - ${fuelNeeded} ⚡
      </button>
    `;
  });

  html += '</div>';

  const panel = document.getElementById('build-panel');
  const title = document.getElementById('build-target-name');
  const container = document.getElementById('build-options-container');

  title.innerText = '🚀 Spacecraft Launch';
  container.innerHTML = html;
  panel.style.left = `${window.innerWidth / 2 - 110}px`;
  panel.style.top = `${window.innerHeight / 2 - 70}px`;
  panel.style.display = 'block';
  panel.style.minWidth = '220px';
}

/**
 * Launch spacecraft to target planet
 */
launchSpacecraft(targetPlanetId) {
  const originId = this.gameState.selectedPlanetId;
  const ship = this.gameState.launchSpacecraft(originId, targetPlanetId);

  if (ship) {
    const target = this.gameState.planets[targetPlanetId];
    console.log(`✓ Spacecraft launched to ${target.name}`);
    this.closeBuildMenu();
    this.updateHUD();
  } else {
    alert('Launch failed. Check fuel and dock availability.');
  }
}

/**
 * Dock spacecraft at current planet orbit
 */
dockSpacecraft(spacecraftId) {
  const planetId = this.gameState.selectedPlanetId;
  const success = this.gameState.dockSpacecraft(spacecraftId, planetId);

  if (success) {
    console.log(`✓ Spacecraft docked`);
    this.updateHUD();
  }
}

// ============================================================================
// HUD UPDATES
// ============================================================================

/**
 * Extend updateHUD() to show orbital status
 */
extendHUDWithOrbitalInfo() {
  const planet = this.gameState.planets[this.gameState.selectedPlanetId];
  if (!planet || !planet.orbital) return '';

  let info = '';

  if (planet.launchFacilityBuilt) {
    info += `<div style="font-size: 11px; color: #00ff88; margin-top: 4px;">📡 Launch Facility</div>`;
  }

  if (planet.orbital.navalStationBuilt) {
    info += `<div style="font-size: 11px; color: #ff6600; margin-top: 2px;">⚓ Naval Station</div>`;
    info += `<div style="font-size: 11px; color: #00ccff;">Docks: ${planet.orbital.docks.length}</div>`;
  }

  if (planet.orbital.inOrbit.length > 0) {
    info += `<div style="font-size: 11px; color: #ffff00; margin-top: 2px;">⛩ ${planet.orbital.inOrbit.length} Spacecraft in Orbit</div>`;
  }

  return info;
}

// ============================================================================
// GAME LOOP EXTENSION
// ============================================================================

/**
 * Add to gameLoop = () => { ... }
 */
// Update spacecraft during frame
this.gameState.updateSpacecraft();
if (this.gameState.view === 'planet') {
  this.planetView.updateOrbitalVisuals();
}

// ============================================================================
// HELP TEXT
// ============================================================================

const ORBITAL_HELP = `
╔════════════════════════════════════════╗
║        ORBITAL INFRASTRUCTURE          ║
╚════════════════════════════════════════╝

SURFACE LAYER (Press O to switch):
  L  - Build Launch Facility (100 Gold)
       Giant antenna to reach orbit

ORBITAL LAYER:
  Right-click empty slot -> Build:
    ⚓ Naval Station (150 Gold + 50 Platinum)
       Command center, unlocks docks
    
    🛰 Spacecraft Dock (80 Gold + 30 Copper)
       Allows spacecraft docking

  SPACE - Launch spacecraft to target orbit
       Costs 20 Fuel per jump
       Distance affects travel time

PROGRESSION:
  1. Mine resources → Collect 100 Gold
  2. Build Launch Facility
  3. Switch to Orbital view (O)
  4. Right-click naval slot, build Naval Station
  5. Right-click dock slot, build Dock
  6. Press SPACE, select target, launch!
  7. Spacecraft arrives at target orbit
  8. Dock with arriving spacecraft

RESOURCES:
  🔧 Fuel Cell - Spacecraft fuel (20 per jump)
     Produced by: Hydrogen extractors (future)
`;

export { openOrbitalBuildMenu, launchSpacecraft, dockSpacecraft, ORBITAL_HELP };
