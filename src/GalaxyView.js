/**
 * GalaxyView
 * Renders and manages the 2D galaxy network view
 */
class GalaxyView {
  constructor(canvas, gameState) {
    this.canvas = canvas;
    this.gameState = gameState;
    this.ctx = canvas.getContext('2d');
    
    this.width = canvas.offsetWidth;
    this.height = canvas.offsetHeight;
    
    // Resize canvas for HiDPI
    canvas.width = this.width * devicePixelRatio;
    canvas.height = this.height * devicePixelRatio;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);

    this.selectedPlanet = null;
    this.hoveredPlanet = null;
    this.camera = { x: 0, y: 0, zoom: 1 };
    
    this.planetBounds = []; // { id, x, y, radius }
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('resize', () => this.handleResize());
  }

  handleClick(e) {
    if (this.gameState.view !== 'galaxy') return;

    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    for (const bound of this.planetBounds) {
      const dist = Math.hypot(
        bound.screenX - clickX,
        bound.screenY - clickY
      );

      if (dist < bound.screenRadius + 10) { 
        this.selectedPlanet = bound.id;
        this.gameState.selectedPlanetId = bound.id;
        window.gameInstance?.zoom();
        return;
      }
    }
  }

  handleMouseMove(e) {
    if (this.gameState.view !== 'galaxy') return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.hoveredPlanet = null;
    for (const bound of this.planetBounds) {
      const dist = Math.hypot(
        bound.screenX - mouseX,
        bound.screenY - mouseY
      );

      if (dist < bound.screenRadius + 10) {
        this.hoveredPlanet = bound.id;
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }
    this.canvas.style.cursor = 'default';
  }

  handleResize() {
    this.width = this.canvas.offsetWidth;
    this.height = this.canvas.offsetHeight;
    this.canvas.width = this.width * devicePixelRatio;
    this.canvas.height = this.height * devicePixelRatio;
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
  }

  render() {
    const ctx = this.ctx;
    
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, this.width, this.height);

    const visiblePlanets = this.gameState.getVisiblePlanets();

    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    this.planetBounds = [];

    // Connections
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < visiblePlanets.length; i++) {
      const p1 = visiblePlanets[i];
      const p2 = visiblePlanets[(i + 1) % visiblePlanets.length];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Planets
    for (const planet of visiblePlanets) {
      const isSelected = this.selectedPlanet === planet.id;
      const isHovered = this.hoveredPlanet === planet.id;
      
      const screenX = this.width / 2 + (planet.x * this.camera.zoom);
      const screenY = this.height / 2 + (planet.y * this.camera.zoom);
      const screenRadius = (isSelected ? 12 : 8) * this.camera.zoom;

      this.planetBounds.push({
        id: planet.id,
        screenX: screenX,
        screenY: screenY,
        screenRadius: screenRadius
      });

      if (isHovered || isSelected) {
        ctx.fillStyle = `rgba(100, 180, 255, ${isSelected ? 0.4 : 0.2})`;
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = isSelected ? '#64b5f6' : '#4a9fd8';
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, isSelected ? 12 : 8, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#64b5f6';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (planet.visited) {
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (planet.id === this.gameState.starterPlanetId) {
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, 24, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Radar Radius visualizer
    if (this.gameState.radarBuilt) {
      const starterPlanet = this.gameState.planets[this.gameState.starterPlanetId];
      ctx.strokeStyle = 'rgba(100, 150, 200, 0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(starterPlanet.x, starterPlanet.y, this.gameState.radarRange, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Crosshair
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.width / 2 - 10, this.height / 2);
    ctx.lineTo(this.width / 2 + 10, this.height / 2);
    ctx.moveTo(this.width / 2, this.height / 2 - 10);
    ctx.lineTo(this.width / 2, this.height / 2 + 10);
    ctx.stroke();

    if (!this.gameState.radarBuilt && visiblePlanets.length === 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Build Radar to scan nearby planets', this.width / 2, this.height / 2 + 40);
    }
  }
}

export default GalaxyView;