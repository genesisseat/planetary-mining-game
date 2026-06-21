import GameState from './GameState.js';
import GalaxyView from './GalaxyView.js';
import PlanetView from './PlanetView.js';

const DRILL_ENERGY_COST = 20;

class Game {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.gameState = new GameState();

    this.galaxyView = new GalaxyView(this.canvas, this.gameState);
    this.planetView = new PlanetView(this.canvas, this.gameState);

    this.zoomBtn = document.getElementById('zoom-btn');
    this.backBtn = document.getElementById('back-btn');
    this.resourceDisplay = document.getElementById('resource-display');
    this.hudLocation = document.getElementById('hud-location');
    this.infoFps = document.getElementById('info-fps');
    this.infoEntities = document.getElementById('info-entities');

    this.fpsCounter = 0;
    this.lastFpsUpdate = Date.now();

    // Attach to window so PlanetView and HTML can call it
    window.gameInstance = this;

    this.init();
  }

  init() {
    this.renderPlanet();
    this.updateHUD();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeBuildMenu();
        this.back();
      }
    });

    // Close confirm panel when clicking outside it
    document.addEventListener('click', (e) => {
      const buildPanel = document.getElementById('build-panel');
      if (buildPanel && !e.target.closest('#build-panel')) {
        this.closeBuildMenu();
      }
    });

    this.gameLoop();
  }

  zoom() {
    if (this.gameState.selectedPlanetId !== null) {
      this.renderPlanet();
    }
  }

  // ─── Build menu (confirm dialog) ─────────────────────────────────────────

  openBuildMenu(screenX, screenY, nodeMesh) {
    const panel = document.getElementById('build-panel');
    const container = document.getElementById('build-options-container');
    const title = document.getElementById('build-target-name');

    if (!panel || !container || !title) return;

    // Store reference so the confirm button can access it
    this._pendingNodeMesh = nodeMesh;

    const oreName = nodeMesh.userData.ore
      ? nodeMesh.userData.ore.charAt(0).toUpperCase() + nodeMesh.userData.ore.slice(1)
      : 'Unknown';

    title.innerText = `${oreName} Deposit`;

    container.innerHTML = '';

    // Info line
    const info = document.createElement('p');
    info.className = 'build-info';
    info.textContent = `Drill yields +1 ${oreName} every 5 sec`;
    container.appendChild(info);

    // Energy check
    const canAfford = this.gameState.inventory.energy >= DRILL_ENERGY_COST;

    const btn = document.createElement('button');
    btn.className = 'build-option';
    btn.disabled = !canAfford;
    btn.textContent = canAfford
      ? `⚙ Build Drill  (${DRILL_ENERGY_COST} Energy)`
      : `✗ Need ${DRILL_ENERGY_COST} Energy  (have ${this.gameState.inventory.energy})`;

    btn.onclick = (e) => {
      e.stopPropagation(); // don't immediately re-close via document listener
      this.confirmBuildDrill();
    };

    container.appendChild(btn);

    // Position panel near click, keep it on screen
    const panelWidth = 200;
    const panelHeight = 110;
    const left = Math.min(screenX + 12, window.innerWidth - panelWidth - 8);
    const top  = Math.min(screenY + 12, window.innerHeight - panelHeight - 8);

    panel.style.left = `${left}px`;
    panel.style.top  = `${top}px`;
    panel.style.display = 'block';
  }

  confirmBuildDrill() {
    const nodeMesh = this._pendingNodeMesh;
    if (!nodeMesh) return;

    if (this.gameState.inventory.energy < DRILL_ENERGY_COST) {
      return; // double-guard (button should already be disabled)
    }

    this.closeBuildMenu();

    this.gameState.inventory.energy -= DRILL_ENERGY_COST;
    this.planetView.buildDrillVisual(nodeMesh);
    this.updateHUD();

    this._pendingNodeMesh = null;
  }

  closeBuildMenu() {
    const panel = document.getElementById('build-panel');
    if (panel) panel.style.display = 'none';
    this._pendingNodeMesh = null;
  }

  // ─── Game loop ────────────────────────────────────────────────────────────

  gameLoop = () => {
    requestAnimationFrame(this.gameLoop);
    if (this.gameState.view === 'galaxy') this.galaxyView.render();
    this.updateHUD();
    this.updateFPS();
  }

  // ─── View transitions ─────────────────────────────────────────────────────

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
      Fe ${inv.iron} &nbsp;
      Cu ${inv.copper} &nbsp;
      Au ${inv.gold} &nbsp;
      Li ${inv.lithium} &nbsp;
      Pt ${inv.platinum}
    `;
  }

  updateFPS() {
    this.fpsCounter++;
    const now = Date.now();
    if (now - this.lastFpsUpdate >= 1000) {
      if (this.infoFps) this.infoFps.textContent = `FPS: ${this.fpsCounter}`;
      this.fpsCounter = 0;
      this.lastFpsUpdate = now;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => { new Game(); });
export default Game;
