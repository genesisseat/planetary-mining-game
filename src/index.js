import GameState from './GameState.js';
import GalaxyView from './GalaxyView.js';
import PlanetView from './PlanetView.js';

const COSTS = {
  drill:       { energy: 20 },
  solarPanel:  { copper: 5 },
};

class Game {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.gameState = new GameState();

    this.galaxyView = new GalaxyView(this.canvas, this.gameState);
    this.planetView = new PlanetView(this.canvas, this.gameState);

    this.resourceDisplay = document.getElementById('resource-display');
    this.hudLocation     = document.getElementById('hud-location');
    this.infoFps         = document.getElementById('info-fps');
    this.infoEntities    = document.getElementById('info-entities');

    this.fpsCounter    = 0;
    this.lastFpsUpdate = Date.now();
    this._pendingNodeMesh = null;
    this._pendingSlotType = null;

    window.gameInstance = this;
    this.init();
  }

  init() {
    this.renderPlanet();
    this.updateHUD();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.closeBuildMenu(); this.back(); }
    });

    // Close panel on left-click outside — but NOT on right-click
    // (right-click opens a new menu at the new position)
    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // only left-click closes
      const panel = document.getElementById('build-panel');
      if (panel && !e.target.closest('#build-panel')) this.closeBuildMenu();
    });

    this.gameLoop();
  }

  zoom() {
    if (this.gameState.selectedPlanetId !== null) this.renderPlanet();
  }

  // ─── Build menu ───────────────────────────────────────────────────────────

  /**
   * slotType: 'ore' | 'empty'
   */
  openBuildMenu(screenX, screenY, mesh, slotType) {
    const panel     = document.getElementById('build-panel');
    const container = document.getElementById('build-options-container');
    const title     = document.getElementById('build-target-name');
    if (!panel || !container || !title) return;

    this._pendingNodeMesh = mesh;
    this._pendingSlotType = slotType;
    container.innerHTML  = '';

    if (slotType === 'ore') {
      const oreName = mesh.userData.ore
        ? mesh.userData.ore.charAt(0).toUpperCase() + mesh.userData.ore.slice(1)
        : 'Unknown';
      title.innerText = `${oreName} Deposit`;

      this._addInfoLine(container, `Produces +1 ${oreName} every 5 sec`);
      this._addBuildButton(container, {
        label:    `⚙ Drill  (${COSTS.drill.energy} ⚡)`,
        canAfford: this.gameState.inventory.energy >= COSTS.drill.energy,
        reason:   `Need ${COSTS.drill.energy} ⚡`,
        onConfirm: () => {
          this.gameState.inventory.energy -= COSTS.drill.energy;
          this.planetView.buildDrillVisual(mesh);
        },
      });

    } else {
      title.innerText = 'Empty Vertex';
      this._addInfoLine(container, `Recharges +2 ⚡ every 3 sec`);
      this._addBuildButton(container, {
        label:    `☀ Solar Panel  (${COSTS.solarPanel.copper} Cu)`,
        canAfford: this.gameState.inventory.copper >= COSTS.solarPanel.copper,
        reason:   `Need ${COSTS.solarPanel.copper} Cu`,
        onConfirm: () => {
          this.gameState.inventory.copper -= COSTS.solarPanel.copper;
          this.planetView.buildSolarPanelVisual(mesh);
        },
      });
    }

    // Position panel, keep it on-screen
    const left = Math.min(screenX + 12, window.innerWidth  - 220);
    const top  = Math.min(screenY + 12, window.innerHeight - 140);
    panel.style.left    = `${left}px`;
    panel.style.top     = `${top}px`;
    panel.style.display = 'block';
  }

  _addInfoLine(container, text) {
    const p = document.createElement('p');
    p.className   = 'build-info';
    p.textContent = text;
    container.appendChild(p);
  }

  _addBuildButton(container, { label, canAfford, reason, onConfirm }) {
    const btn = document.createElement('button');
    btn.className = 'build-option';
    btn.disabled  = !canAfford;
    btn.textContent = canAfford ? label : `✗ ${reason}`;
    btn.onmousedown = (e) => e.stopPropagation(); // don't trigger panel-close
    btn.onclick = (e) => {
      e.stopPropagation();
      this.closeBuildMenu();
      onConfirm();
      this.updateHUD();
    };
    container.appendChild(btn);
  }

  closeBuildMenu() {
    const panel = document.getElementById('build-panel');
    if (panel) panel.style.display = 'none';
    this._pendingNodeMesh = null;
    this._pendingSlotType = null;
  }

  // ─── Game loop ────────────────────────────────────────────────────────────

  gameLoop = () => {
    requestAnimationFrame(this.gameLoop);
    if (this.gameState.view === 'galaxy') this.galaxyView.render();
    this.updateHUD();
    this.updateFPS();
  }

  renderPlanet() {
    this.gameState.view = 'planet';
    this.canvas.style.display = 'none';
    this.planetView.init(this.gameState.selectedPlanetId);
  }

  back() {
    this.gameState.view = 'galaxy';
    this.canvas.style.display = 'block';
    this.planetView.destroy();
  }

  // ─── HUD ──────────────────────────────────────────────────────────────────

  updateHUD() {
    if (!this.resourceDisplay) return;
    const inv = this.gameState.inventory;
    this.resourceDisplay.innerHTML = `
      ⚡ ${inv.energy}/${inv.maxEnergy} &nbsp;|&nbsp;
      Fe&nbsp;${inv.iron} &nbsp;
      Cu&nbsp;${inv.copper} &nbsp;
      Au&nbsp;${inv.gold} &nbsp;
      Li&nbsp;${inv.lithium} &nbsp;
      Pt&nbsp;${inv.platinum}
    `;
  }

  updateFPS() {
    this.fpsCounter++;
    const now = Date.now();
    if (now - this.lastFpsUpdate >= 1000) {
      if (this.infoFps) this.infoFps.textContent = `FPS: ${this.fpsCounter}`;
      this.fpsCounter    = 0;
      this.lastFpsUpdate = now;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => { new Game(); });
export default Game;
