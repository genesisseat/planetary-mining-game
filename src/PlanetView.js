import * as THREE from 'three';

/**
 * PlanetView
 * Renders and manages the 3D spherical planet surface
 */
class PlanetView {
  constructor(canvas, gameState) {
    this.canvas = canvas;
    this.gameState = gameState;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.planet = null;
    this.nodeMeshes = [];
    this.animationId = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.selectedNode = null;
  }

  /**
   * Initialize the 3D scene for a planet
   */
  init(planetId) {
    const planet = this.gameState.planets[planetId];
    if (!planet) return;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1628);
    this.scene.fog = new THREE.Fog(0x0a1628, 10, 50);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.canvas.offsetWidth / this.canvas.offsetHeight,
      0.1,
      1000
    );
    this.camera.position.z = 2.5;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas, 
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.shadowMap.enabled = true;

    // Planet sphere
    const planetGeometry = new THREE.SphereGeometry(1, 128, 128);
    
    // Texture-like coloring based on temperature
    const planetMaterial = new THREE.MeshPhongMaterial({
      color: this.getTemperatureColor(planet.temperature),
      roughness: 0.8,
      metalness: 0.1
    });
    
    this.planet = new THREE.Mesh(planetGeometry, planetMaterial);
    this.planet.castShadow = true;
    this.planet.receiveShadow = true;
    this.scene.add(this.planet);

    // Lighting
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(5, 5, 5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    this.scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    // Ore nodes
    this.createNodes(planet);

    // Event listeners
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    window.addEventListener('resize', () => this.handleResize());

    // Start animation
    this.animate();
  }

  /**
   * Get planet color based on temperature
   */
  getTemperatureColor(temp) {
    // 0-30: icy blue
    // 30-60: green/brown
    // 60-100: orange/red
    if (temp < 30) return 0x4a9fd8; // Blue
    if (temp < 60) return 0x6b8e23; // Olive
    return 0xd85a30; // Orange
  }

  /**
   * Create ore node meshes on planet surface
   */
  createNodes(planet) {
    this.nodeMeshes = [];

    const oreColors = {
      iron: 0x8b7355,
      copper: 0xb87333,
      gold: 0xffd700,
      lithium: 0x87ceeb,
      platinum: 0xe5e4e2
    };

    planet.nodes.forEach((node, idx) => {
      if (node.collected) return; // Skip collected nodes

      // Convert spherical coords to cartesian
      const x = Math.sin(node.theta) * Math.cos(node.phi);
      const y = Math.cos(node.theta);
      const z = Math.sin(node.theta) * Math.sin(node.phi);

      // Create node mesh
      const geometry = new THREE.SphereGeometry(0.06, 16, 16);
      const material = new THREE.MeshPhongMaterial({
        color: oreColors[node.ore] || 0xffffff,
        emissive: oreColors[node.ore] || 0xffffff,
        emissiveIntensity: 0.3
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x * 1.12, y * 1.12, z * 1.12);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      mesh.userData = {
        nodeId: node.id,
        planetId: this.gameState.selectedPlanetId,
        ore: node.ore,
        amount: node.amount
      };

      this.scene.add(mesh);
      this.nodeMeshes.push(mesh);
    });
  }

  /**
   * Handle click on ore nodes
   */
  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.nodeMeshes);

    if (intersects.length > 0) {
      const clicked = intersects[0].object;
      const mined = this.gameState.mineNode(
        clicked.userData.planetId,
        clicked.userData.nodeId
      );

      if (mined) {
        // Remove from scene
        this.scene.remove(clicked);
        this.nodeMeshes = this.nodeMeshes.filter(m => m !== clicked);
        
        // Visual feedback
        this.createMineEffect(clicked.position);
      }
    }
  }

  /**
   * Create a particle effect for mining
   */
  createMineEffect(position) {
    // Simple flash effect
    const flashGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    this.scene.add(flash);

    // Fade out and remove
    let opacity = 1;
    const interval = setInterval(() => {
      opacity -= 0.1;
      flashMaterial.opacity = opacity;
      if (opacity <= 0) {
        this.scene.remove(flash);
        clearInterval(interval);
      }
    }, 30);
  }

  /**
   * Handle window resize
   */
  handleResize() {
    if (!this.camera || !this.renderer) return;
    
    const width = this.canvas.offsetWidth;
    const height = this.canvas.offsetHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Animation loop
   */
  animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.planet) {
      this.planet.rotation.x += 0.0003;
      this.planet.rotation.y += 0.0008;
    }

    // Pulse nodes
    this.nodeMeshes.forEach(node => {
      const pulse = Math.sin(Date.now() * 0.003 + node.position.length()) * 0.3 + 0.7;
      node.scale.set(pulse, pulse, pulse);
    });

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Dispose and cleanup
   */
  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.nodeMeshes = [];
  }
}

export default PlanetView;
