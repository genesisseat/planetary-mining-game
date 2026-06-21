import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class PlanetView {
  constructor(baseCanvas, gameState) {
    this.baseCanvas = baseCanvas;
    this.canvas = null;
    this.gameState = gameState;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.planetGroup = new THREE.Group();
    this.nodeMeshes = [];
    this.animationId = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this._handleRightClick = this.handleRightClick.bind(this);
    this._handleResize = this.handleResize.bind(this);
  }

  init(planetId) {
    const planet = this.gameState.planets[planetId];
    if (!planet) return;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'planet-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.baseCanvas.parentNode.insertBefore(this.canvas, this.baseCanvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1628);
    this.camera = new THREE.PerspectiveCamera(60, this.canvas.offsetWidth / this.canvas.offsetHeight, 0.1, 1000);
    this.camera.position.z = 3;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.scene.add(this.planetGroup);

    this.buildGeometricPlanet(planet);
    this.createNodes(planet);

    this.canvas.addEventListener('contextmenu', this._handleRightClick);
    window.addEventListener('resize', this._handleResize);
    this.animate();
  }

  handleRightClick(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.nodeMeshes);

    if (intersects.length > 0) {
      window.gameInstance.openBuildMenu(e.clientX, e.clientY, intersects[0].object);
    }
  }

  handleResize() {
    if (!this.camera || !this.renderer || !this.canvas) return;
    
    // Update camera aspect ratio
    this.camera.aspect = this.canvas.offsetWidth / this.canvas.offsetHeight;
    this.camera.updateProjectionMatrix();
    
    // Update renderer size
    this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
  }

  /**
   * REPLACING A NODE WITH A DRILL
   * This is called by index.js after the user clicks "Build Drill"
   */
  buildDrillVisual(nodeMesh) {
    // 1. Remove the old dot from the scene and array
    this.planetGroup.remove(nodeMesh);
    this.nodeMeshes = this.nodeMeshes.filter(m => m !== nodeMesh);

    // 2. Create a simple "Drill" visual 
    // We use a small cylinder to represent the drill bit
    const drillGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.15);
    const drillMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const drill = new THREE.Mesh(drillGeo, drillMat);
    
    // Position it at the node's location
    drill.position.copy(nodeMesh.position);
    
    // Orient it to point away from the planet center
    drill.lookAt(new THREE.Vector3(0, 0, 0));
    drill.rotateX(Math.PI / 2);
    
    this.planetGroup.add(drill);
  }
a
  buildGeometricPlanet(planet) {
    const baseColor = 0x4a9fd8;
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const wireframe = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({ color: baseColor, opacity: 0.3, transparent: true }));
    this.planetGroup.add(wireframe);
  }

  createNodes(planet) {
    planet.nodes.forEach((node) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const x = Math.sin(node.theta) * Math.cos(node.phi);
      const y = Math.cos(node.theta);
      const z = Math.sin(node.theta) * Math.sin(node.phi);
      mesh.position.set(x, y, z);
      mesh.userData = { nodeId: node.id, planetId: planet.id, ore: node.ore };
      this.planetGroup.add(mesh);
      this.nodeMeshes.push(mesh);
    });
  }

  animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    cancelAnimationFrame(this.animationId);
    this.canvas.removeEventListener('contextmenu', this._handleRightClick);
    window.removeEventListener('resize', this._handleResize);
    
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

export default PlanetView;