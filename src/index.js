import GameState from './GameState.js';
import GalaxyView from './GalaxyView.js';
import PlanetView from './PlanetView.js';

/**
 * Game
 * Main game controller - orchestrates all views and game logic
 */
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

    this.init();
  }

  init() {
    // FIX #2: Game should start in PLANET view on starter planet
    // Don't render galaxy initially - go straight to planet
    this.renderPlanet();
    this.updateHUD();

    // Handle keyboard
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.back();
      if (e.key === 'e' || e.key === 'E') this.toggleExploration();
      if (e.key === 'r' || e.key === 'R') this.tryBuildRadar();
    });

    // Start game loop
    this.gameLoop();
  }

  /**
   * Main game loop - runs every frame
   */
  gameLoop = () => {
    requestAnimationFrame(this.gameLoop);

    if (this.gameState.view === 'galaxy') {
      this.galaxyView.render();
    }

    this.updateHUD();
    this.updateFPS();
  }

  /**
   * Render planet view (THREE.js 3D)
   * FIX #2: Called on startup and when zooming in
   */
  renderPlanet() {
    this.gameState.view = 'planet';
    this.zoomBtn.style.display = 'none';
    this.backBtn.style.display = 'block';
    const planet = this.gameState.planets[this.gameState.selectedPlanetId];
    if (planet) planet.visited = true;
    this.planetView.init(this.gameState.selectedPlanetId);
  }

  /**
   * Zoom into selected planet
   * FIX #2: Properly transition from galaxy to planet view
   */
  zoom() {
    if (this.gameState.selectedPlanetId === null) {
      alert('Select a planet first');
      return;
    }

    this.renderPlanet();
    this.updateHUD();
  }

  /**
   * Try to build radar on starter planet
   * Press R to build after collecting enough resources
   */
  tryBuildRadar() {
    if (this.gameState.radarBuilt) {
      console.log('Radar already built');
      return;
    }

    const success = this.gameState.buildRadar();
    if (success) {
      console.log('Radar built! Scanning nearby planets...');
      this.updateHUD();
    } else {
      console.log('Need: 50 Gold + 25 Platinum to build Radar');
    }
  }

  /**
   * Zoom back to galaxy
   */
  back() {
    if (this.gameState.view !== 'planet') return;

    this.gameState.view = 'galaxy';
    this.zoomBtn.style.display = 'block';
    this.backBtn.style.display = 'none';
    this.planetView.destroy();
    this.render();
    this.updateHUD();
  }

  /**
   * Toggle exploration mode (not yet implemented)
   */
  toggleExploration() {
    console.log('Exploration mode toggled');
  }

  /**
   * Update HUD display
   */
  updateHUD() {
    const inv = this.gameState.inventory;

    // Location
    if (this.gameState.view === 'galaxy') {
      this.hudLocation.textContent = 'Galaxy View';
    } else {
      const planet = this.gameState.planets[this.gameState.selectedPlanetId];
      this.hudLocation.textContent = `${planet.name} (Temp: ${Math.floor(planet.temperature)}°)`;
    }

    // Resources
    const resources = [
      { name: 'Iron', value: inv.iron, color: '#8b7355' },
      { name: 'Copper', value: inv.copper, color: '#b87333' },
      { name: 'Gold', value: inv.gold, color: '#ffd700' },
      { name: 'Lithium', value: inv.lithium, color: '#87ceeb' }
    ];

    this.resourceDisplay.innerHTML = resources.map(r => `
      <div class="resource-item">
        <span>
          <span style="display: inline-block; width: 8px; height: 8px; background: ${r.color}; border-radius: 50%; margin-right: 4px; vertical-align: middle;"></span>
          ${r.name}
        </span>
        <span>${r.value}</span>
      </div>
    `).join('');

    // Energy bar
    const energyPercent = (inv.energy / inv.maxEnergy) * 100;
    const energyColor = energyPercent > 50 ? '#4ade80' : energyPercent > 20 ? '#facc15' : '#ef4444';
    const energyBar = document.createElement('div');
    energyBar.style.cssText = `
      margin-top: 8px;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
    `;
    energyBar.innerHTML = `<div style="width: ${energyPercent}%; height: 100%; background: ${energyColor}; transition: width 0.3s;"></div>`;
    
    // Remove old energy bar if exists
    const oldBar = this.resourceDisplay.querySelector('[data-energy]');
    if (oldBar) oldBar.remove();
    
    energyBar.setAttribute('data-energy', 'true');
    this.resourceDisplay.appendChild(energyBar);

    // Info panel
    const planet = this.gameState.planets[this.gameState.selectedPlanetId];
    let coords = '--';
    if (planet) {
      coords = `${planet.x.toFixed(0)}, ${planet.y.toFixed(0)}`;
    }
    this.infoEntities.textContent = `Nodes: ${this.planetView.nodeMeshes ? this.planetView.nodeMeshes.length : 0}`;
    document.getElementById('info-coords').textContent = coords;
  }

  /**
   * Update FPS counter
   */
  updateFPS() {
    this.fpsCounter++;
    const now = Date.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.infoFps.textContent = `FPS: ${this.fpsCounter}`;
      this.fpsCounter = 0;
      this.lastFpsUpdate = now;
    }
  }

  /**
   * Trigger a render
   */
  render() {
    if (this.gameState.view === 'galaxy') {
      this.galaxyView.render();
    }
  }
}

// Initialize game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new Game();
  });
} else {
  window.gameInstance = new Game();
}

export default Game;
