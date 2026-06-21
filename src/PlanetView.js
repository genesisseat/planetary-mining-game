import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Ore-specific glow colors for craters
const ORE_COLORS = {
  iron:     0xff4500,  // orange-red
  copper:   0x00bcd4,  // teal
  gold:     0xffd700,  // yellow
  lithium:  0x448aff,  // electric blue
  platinum: 0xe0e0ff,  // cold white
};

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
    this.nodeMeshes = [];       // clickable crater meshes
    this.drillMeshes = [];      // active drill meshes (for animation)
    this.animationId = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Drag detection — ignore clicks that were actually drags
    this._mouseDownPos = { x: 0, y: 0 };

    // Passive production: { nodeId -> { ore, intervalId } }
    this.productionIntervals = {};

    this._handleMouseDown = this.handleMouseDown.bind(this);
    this._handleClick = this.handleClick.bind(this);
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

    // Defer Three.js setup until after the browser has laid out the canvas
    // so offsetWidth/offsetHeight are non-zero
    requestAnimationFrame(() => this._setup(planet));
  }

  _setup(planet) {
    const w = this.canvas.offsetWidth  || window.innerWidth;
    const h = this.canvas.offsetHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1628);

    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    this.camera.position.z = 3;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;

    // Lights — required for MeshStandardMaterial to be visible
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    this.scene.add(dirLight);

    this.scene.add(this.planetGroup);

    this.buildGeometricPlanet(planet);
    this.createNodes(planet);

    this.canvas.addEventListener('mousedown', this._handleMouseDown);
    this.canvas.addEventListener('click', this._handleClick);
    window.addEventListener('resize', this._handleResize);

    this.animate();
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  handleMouseDown(e) {
    this._mouseDownPos = { x: e.clientX, y: e.clientY };
  }

  handleClick(e) {
    // Ignore if the mouse moved more than 5px — that was a drag, not a click
    const dx = e.clientX - this._mouseDownPos.x;
    const dy = e.clientY - this._mouseDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    // Cast against hit spheres (larger, invisible) stored in this.nodeMeshes
    const intersects = this.raycaster.intersectObjects(this.nodeMeshes);

    if (intersects.length > 0) {
      window.gameInstance.openBuildMenu(e.clientX, e.clientY, intersects[0].object);
    }
  }

  handleResize() {
    if (!this.camera || !this.renderer || !this.canvas) return;
    this.camera.aspect = this.canvas.offsetWidth / this.canvas.offsetHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
  }

  // ─── Planet geometry ──────────────────────────────────────────────────────

  buildGeometricPlanet(planet) {
    const baseColor = 0x4a9fd8;
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({ color: baseColor, opacity: 0.3, transparent: true })
    );
    this.planetGroup.add(wireframe);
  }

  // ─── Crater nodes ─────────────────────────────────────────────────────────

  createNodes(planet) {
    planet.nodes.forEach((node) => {
      if (node.collected) return;

      const color = ORE_COLORS[node.ore] ?? 0xffffff;

      const x = Math.sin(node.theta) * Math.cos(node.phi);
      const y = Math.cos(node.theta);
      const z = Math.sin(node.theta) * Math.sin(node.phi);
      const pos = new THREE.Vector3(x, y, z);

      // Orient crater faces outward
      const normal = pos.clone().normalize();
      const up = Math.abs(normal.y) < 0.99
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
      const tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
      const bitangent = new THREE.Vector3().crossVectors(normal, tangent);
      const rotMatrix = new THREE.Matrix4().makeBasis(tangent, bitangent, normal);

      // Outer crater ring (visual only)
      const ringGeo = new THREE.RingGeometry(0.045, 0.07, 8);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos.clone().multiplyScalar(1.01));
      ring.setRotationFromMatrix(rotMatrix);
      this.planetGroup.add(ring);

      // Inner glow disc (visual only)
      const discGeo = new THREE.CircleGeometry(0.04, 8);
      const discMat = new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color),
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.position.copy(pos.clone().multiplyScalar(1.011));
      disc.setRotationFromMatrix(rotMatrix);
      disc.userData._pulsePhase = Math.random() * Math.PI * 2;
      this.planetGroup.add(disc);
      this.glowDiscs = this.glowDiscs || [];
      this.glowDiscs.push(disc);

      // Invisible hit sphere — larger surface for reliable raycasting
      const hitGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitSphere = new THREE.Mesh(hitGeo, hitMat);
      hitSphere.position.copy(pos.clone().multiplyScalar(1.01));

      // Carry all the data and visual refs the build menu needs
      hitSphere.userData = {
        nodeId: node.id,
        planetId: planet.id,
        ore: node.ore,
        _ring: ring,
        _disc: disc,
      };

      this.planetGroup.add(hitSphere);
      this.nodeMeshes.push(hitSphere);
    });
  }

  // ─── Build drill ──────────────────────────────────────────────────────────

  /**
   * Called by index.js after the player confirms "Build Drill".
   * Replaces the crater visual with a drill and starts passive production.
   */
  buildDrillVisual(nodeMesh) {
    // Remove crater visuals
    const ring = nodeMesh.userData._ring;
    const disc = nodeMesh.userData._disc;
    if (ring) this.planetGroup.remove(ring);
    if (disc) {
      this.planetGroup.remove(disc);
      this.glowDiscs = (this.glowDiscs || []).filter(d => d !== disc);
    }
    // Remove hit sphere
    this.planetGroup.remove(nodeMesh);
    this.nodeMeshes = this.nodeMeshes.filter(m => m !== nodeMesh);

    const pos = nodeMesh.position.clone();
    const normal = pos.clone().normalize();

    // Drill base (flat cylinder sitting on surface)
    const baseGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x607d8b });
    const base = new THREE.Mesh(baseGeo, baseMat);

    // Drill shaft
    const shaftGeo = new THREE.CylinderGeometry(0.018, 0.025, 0.14, 8);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x455a64 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = 0.08;

    // Drill bit tip (cone)
    const tipGeo = new THREE.ConeGeometry(0.018, 0.05, 8);
    const tipColor = ORE_COLORS[nodeMesh.userData.ore] ?? 0xff0000;
    const tipMat = new THREE.MeshStandardMaterial({
      color: tipColor,
      emissive: new THREE.Color(tipColor),
      emissiveIntensity: 0.8,
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = -0.095; // pointing into the planet
    tip.rotation.z = Math.PI;

    // Group drill parts
    const drillGroup = new THREE.Group();
    drillGroup.add(base);
    drillGroup.add(shaft);
    drillGroup.add(tip);

    // Orient drill outward from planet surface
    const up = Math.abs(normal.y) < 0.99
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent);
    const rotMatrix = new THREE.Matrix4().makeBasis(tangent, bitangent, normal);
    drillGroup.setRotationFromMatrix(rotMatrix);

    drillGroup.position.copy(pos.clone().multiplyScalar(1.01));
    drillGroup.userData._shaft = shaft; // ref for spin animation
    drillGroup.userData.ore = nodeMesh.userData.ore;

    this.planetGroup.add(drillGroup);
    this.drillMeshes.push(drillGroup);

    // Small point light in the crater
    const light = new THREE.PointLight(tipColor, 0.6, 0.4);
    light.position.copy(pos.clone().multiplyScalar(0.98));
    this.planetGroup.add(light);

    // ── Passive production: +1 ore every 5 seconds ──
    const nodeId = nodeMesh.userData.nodeId;
    const ore = nodeMesh.userData.ore;

    const intervalId = setInterval(() => {
      if (this.gameState.inventory[ore] !== undefined) {
        this.gameState.inventory[ore] += 1;
        // Mark node as collected so GameState stays in sync
        const planet = this.gameState.getCurrentPlanet();
        if (planet) {
          const node = planet.nodes[nodeId];
          if (node) node.drilled = true;
        }
      }
    }, 5000);

    this.productionIntervals[nodeId] = { ore, intervalId };
  }

  // ─── Render loop ──────────────────────────────────────────────────────────

  animate = () => {
    if (!this.renderer) return;
    this.animationId = requestAnimationFrame(this.animate);

    const t = performance.now() * 0.001;

    // Pulse crater glows
    (this.glowDiscs || []).forEach((mesh) => {
      const phase = mesh.userData._pulsePhase ?? 0;
      mesh.material.emissiveIntensity = 0.8 + Math.sin(t * 2 + phase) * 0.5;
    });

    // Spin drill shafts
    this.drillMeshes.forEach((group) => {
      if (group.userData._shaft) {
        group.userData._shaft.rotation.y += 0.06;
      }
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy() {
    cancelAnimationFrame(this.animationId);

    // Stop all production timers
    Object.values(this.productionIntervals).forEach(({ intervalId }) => {
      clearInterval(intervalId);
    });
    this.productionIntervals = {};

    this.canvas.removeEventListener('mousedown', this._handleMouseDown);
    this.canvas.removeEventListener('click', this._handleClick);
    window.removeEventListener('resize', this._handleResize);

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    // Reset state for re-init
    this.nodeMeshes = [];
    this.drillMeshes = [];
    this.glowDiscs = [];
    this.planetGroup = new THREE.Group();
  }
}

export default PlanetView;
