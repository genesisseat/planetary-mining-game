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
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('resize', () => this.handleResize());
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.camera.zoom;
    const y = (e.clientY - rect.top) / this.camera.zoom;

    for (const planet of this.gameState.planets) {
      const dist = Math.hypot(planet.x - x, planet.y - y);
      if (dist < 20) {
        this.selectedPlanet = planet.id;
        this.gameState.selectedPlanetId = planet.id;
        return;
      }
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.camera.zoom;
    const y = (e.clientY - rect.top) / this.camera.zoom;

    this.hoveredPlanet = null;
    for (const planet of this.gameState.planets) {
      const dist = Math.hypot(planet.x - x, planet.y - y);
      if (dist < 20) {
        this.hoveredPlanet = planet.id;
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

  /**
   * Draw the galaxy view
   */
  render() {
    const ctx = this.ctx;
    
    // Clear
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // Draw connection lines
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < this.gameState.planets.length; i++) {
      const p1 = this.gameState.planets[i];
      const p2 = this.gameState.planets[(i + 1) % this.gameState.planets.length];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Draw planets
    for (const planet of this.gameState.planets) {
      const isSelected = this.selectedPlanet === planet.id;
      const isHovered = this.hoveredPlanet === planet.id;
      
      // Planet glow
      if (isHovered || isSelected) {
        ctx.fillStyle = `rgba(100, 180, 255, ${isSelected ? 0.4 : 0.2})`;
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      // Planet body
      ctx.fillStyle = isSelected ? '#64b5f6' : '#4a9fd8';
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, isSelected ? 12 : 8, 0, Math.PI * 2);
      ctx.fill();

      // Planet border
      if (isSelected) {
        ctx.strokeStyle = '#64b5f6';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Visited indicator
      if (planet.visited) {
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();

    // Draw center indicator
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.width / 2 - 10, this.height / 2);
    ctx.lineTo(this.width / 2 + 10, this.height / 2);
    ctx.moveTo(this.width / 2, this.height / 2 - 10);
    ctx.lineTo(this.width / 2, this.height / 2 + 10);
    ctx.stroke();
  }
}

export default GalaxyView;
