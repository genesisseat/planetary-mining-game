import GameState from './GameState.js';
import GalaxyView from './GalaxyView.js';
import PlanetView from './PlanetView.js';

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
      if (e.key === 'Escape') this.back();
    });

    // Close menu when clicking away
    document.addEventListener('click', (e) => {
        const buildPanel = document.getElementById('build-panel');
        // FIX: Add a check to ensure buildPanel exists before changing its style
        if (buildPanel && !e.target.closest('#build-panel')) {
            buildPanel.style.display = 'none';
        }
    });

    this.gameLoop();
  }

  // FIX: Added the missing zoom() method
  zoom() {
    if (this.gameState.selectedPlanetId !== null) {
      this.renderPlanet();
    }
  }

  openBuildMenu(screenX, screenY, nodeMesh) {
    const panel = document.getElementById('build-panel');
    const container = document.getElementById('build-options-container');
    const title = document.getElementById('build-target-name');
    
    // Ensure elements exist before manipulating them
    if (!panel || !container || !title) return;

    panel.style.left = `${screenX + 10}px`;
    panel.style.top = `${screenY + 10}px`;
    panel.style.display = 'block';
    container.innerHTML = '';
    title.innerText = nodeMesh.userData.ore ? `${nodeMesh.userData.ore.toUpperCase()} Node` : "Empty Node";

    const btn = document.createElement('button');
    btn.className = 'build-option';
    btn.textContent = `Build Drill (Cost: 20 Energy)`;
    
    btn.onclick = () => {
      if (this.gameState.inventory.energy >= 20) {
        panel.style.display = 'none';
        this.gameState.inventory.energy -= 20;
        this.planetView.buildDrillVisual(nodeMesh); // Replace visual
        this.updateHUD();
      } else {
        alert("Not enough energy!");
      }
    };
    container.appendChild(btn);
  }

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

  updateHUD() { /* ... existing code ... */ }
  updateFPS() { /* ... existing code ... */ }
}

window.addEventListener('DOMContentLoaded', () => { new Game(); });
export default Game;