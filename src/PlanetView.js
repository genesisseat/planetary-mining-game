import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ORE_COLORS = {
  iron:     0xff4500,
  copper:   0x00bcd4,
  gold:     0xffd700,
  lithium:  0x448aff,
  platinum: 0xe0e0ff,
};

function getIcosahedronVertices(detail) {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  const seen = new Map();
  const verts = [];
  for (let i = 0; i < pos.count; i++) {
    const x = parseFloat(pos.getX(i).toFixed(5));
    const y = parseFloat(pos.getY(i).toFixed(5));
    const z = parseFloat(pos.getZ(i).toFixed(5));
    const key = `${x},${y},${z}`;
    if (!seen.has(key)) {
      seen.set(key, true);
      verts.push(new THREE.Vector3(x, y, z).normalize());
    }
  }
  geo.dispose();
  return verts;
}

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
    this.nodeMeshes = [];       // ore node hit spheres
    this.emptyVertMeshes = [];  // empty vertex hit spheres
    this.drillMeshes = [];
    this.solarMeshes = [];
    this.glowDiscs = [];
    this.animationId = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.productionIntervals = {};

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
    this.canvas.style.zIndex = '1';
    this.baseCanvas.parentNode.insertBefore(this.canvas, this.baseCanvas);

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

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 5, 5);
    this.scene.add(dir);

    this.scene.add(this.planetGroup);

    const vertices = this.buildGeometricPlanet();
    this.assignNodesToVertices(planet, vertices);
    this.createNodes(planet);
    this.createEmptyVertices(planet, vertices);

    // RIGHT-CLICK handler — preventDefault stops browser context menu
    this.canvas.addEventListener('contextmenu', this._handleRightClick);
    window.addEventListener('resize', this._handleResize);

    this.animate();
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  handleRightClick(e) {
    e.preventDefault(); // block browser context menu

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check ore nodes first
    const oreHits = this.raycaster.intersectObjects(this.nodeMeshes);
    if (oreHits.length > 0) {
      window.gameInstance.openBuildMenu(e.clientX, e.clientY, oreHits[0].object, 'ore');
      return;
    }

    // Then check empty vertices (for solar panel)
    const emptyHits = this.raycaster.intersectObjects(this.emptyVertMeshes);
    if (emptyHits.length > 0) {
      window.gameInstance.openBuildMenu(e.clientX, e.clientY, emptyHits[0].object, 'empty');
    }
  }

  handleResize() {
    if (!this.camera || !this.renderer || !this.canvas) return;
    this.camera.aspect = this.canvas.offsetWidth / this.canvas.offsetHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
  }

  // ─── Planet geometry ──────────────────────────────────────────────────────

  buildGeometricPlanet() {
    const DETAIL = 2;
    const geo = new THREE.IcosahedronGeometry(1, DETAIL);
    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x4a9fd8, opacity: 0.35, transparent: true })
    );
    this.planetGroup.add(wireframe);
    return getIcosahedronVertices(DETAIL);
  }

  // ─── Snap ore nodes to vertices ──────────────────────────────────────────

  assignNodesToVertices(planet, vertices) {
    const shuffled = [...vertices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const seed = planet.id * 1000 + i;
      const rand = (Math.sin(seed) * 10000) % 1;
      const j = Math.floor(Math.abs(rand) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    planet.nodes.forEach((node, idx) => {
      node._vertexPos = shuffled[idx % shuffled.length].clone();
      node._vertexKey = shuffled[idx % shuffled.length].toArray().map(v => v.toFixed(3)).join(',');
    });
    // Store which vertex keys are occupied by ore nodes
    planet._occupiedKeys = new Set(planet.nodes.map(n => n._vertexKey));
  }

  // ─── Ore crater nodes ─────────────────────────────────────────────────────

  createNodes(planet) {
    planet.nodes.forEach((node) => {
      if (node.collected || node.drilled) return;
      if (!node._vertexPos) return;

      const color = ORE_COLORS[node.ore] ?? 0xffffff;
      const pos = node._vertexPos.clone();
      const rotMatrix = this._surfaceRotation(pos);

      // Outer ring
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.04, 0.065, 8),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
      );
      ring.position.copy(pos.clone().multiplyScalar(1.005));
      ring.setRotationFromMatrix(rotMatrix);
      this.planetGroup.add(ring);

      // Glow disc
      const discMat = new THREE.MeshStandardMaterial({
        color, emissive: new THREE.Color(color), emissiveIntensity: 1.2,
        transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.035, 8), discMat);
      disc.position.copy(pos.clone().multiplyScalar(1.006));
      disc.setRotationFromMatrix(rotMatrix);
      disc.userData._pulsePhase = Math.random() * Math.PI * 2;
      this.planetGroup.add(disc);
      this.glowDiscs.push(disc);

      // Hit sphere
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.copy(pos.clone().multiplyScalar(1.005));
      hit.userData = { nodeId: node.id, planetId: planet.id, ore: node.ore, _ring: ring, _disc: disc, type: 'ore' };
      this.planetGroup.add(hit);
      this.nodeMeshes.push(hit);
    });
  }

  // ─── Empty vertices (solar panel slots) ──────────────────────────────────

  createEmptyVertices(planet, vertices) {
    const occupied = planet._occupiedKeys ?? new Set();

    vertices.forEach((vert, idx) => {
      const key = vert.toArray().map(v => v.toFixed(3)).join(',');
      if (occupied.has(key)) return;

      // Small dim dot to hint the vertex is interactive
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 5, 5),
        new THREE.MeshBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.5 })
      );
      const pos = vert.clone().multiplyScalar(1.003);
      dot.position.copy(pos);
      this.planetGroup.add(dot);

      // Invisible hit sphere
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 5, 5),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.copy(pos);
      hit.userData = { type: 'empty', vertexKey: key, _dot: dot, _vertPos: vert.clone() };
      this.planetGroup.add(hit);
      this.emptyVertMeshes.push(hit);
    });
  }

  // ─── Build structures ─────────────────────────────────────────────────────

  buildDrillVisual(nodeMesh) {
    const { _ring: ring, _disc: disc } = nodeMesh.userData;
    if (ring) this.planetGroup.remove(ring);
    if (disc) {
      this.planetGroup.remove(disc);
      this.glowDiscs = this.glowDiscs.filter(d => d !== disc);
    }
    this.planetGroup.remove(nodeMesh);
    this.nodeMeshes = this.nodeMeshes.filter(m => m !== nodeMesh);

    const pos = nodeMesh.position.clone();
    const rotMatrix = this._surfaceRotation(pos.clone().normalize());

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.015, 8),
      new THREE.MeshStandardMaterial({ color: 0x607d8b })
    );
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.022, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0x455a64 })
    );
    shaft.position.y = 0.07;

    const tipColor = ORE_COLORS[nodeMesh.userData.ore] ?? 0xff0000;
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.015, 0.045, 8),
      new THREE.MeshStandardMaterial({ color: tipColor, emissive: new THREE.Color(tipColor), emissiveIntensity: 0.9 })
    );
    tip.position.y = -0.085;
    tip.rotation.z = Math.PI;

    const group = new THREE.Group();
    group.add(base); group.add(shaft); group.add(tip);
    group.setRotationFromMatrix(rotMatrix);
    group.position.copy(pos);
    group.userData._shaft = shaft;
    group.userData.ore = nodeMesh.userData.ore;
    this.planetGroup.add(group);
    this.drillMeshes.push(group);

    const light = new THREE.PointLight(tipColor, 0.8, 0.5);
    light.position.copy(pos.clone().multiplyScalar(0.98));
    this.planetGroup.add(light);

    // Passive ore production
    const nodeId = nodeMesh.userData.nodeId;
    const ore = nodeMesh.userData.ore;
    const id = setInterval(() => {
      if (this.gameState.inventory[ore] !== undefined) {
        this.gameState.inventory[ore] += 1;
        const p = this.gameState.getCurrentPlanet();
        if (p?.nodes[nodeId]) p.nodes[nodeId].drilled = true;
      }
    }, 5000);
    this.productionIntervals[`drill_${nodeId}`] = { intervalId: id };
  }

  buildSolarPanelVisual(hitMesh) {
    // Remove dim dot + hit sphere
    if (hitMesh.userData._dot) this.planetGroup.remove(hitMesh.userData._dot);
    this.planetGroup.remove(hitMesh);
    this.emptyVertMeshes = this.emptyVertMeshes.filter(m => m !== hitMesh);

    const pos = hitMesh.position.clone();
    const rotMatrix = this._surfaceRotation(pos.clone().normalize());

    // Base pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6),
      new THREE.MeshStandardMaterial({ color: 0x78909c })
    );
    pole.position.y = 0.05;

    // Panel (flat box tilted slightly)
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.002, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0x1565c0,
        emissive: new THREE.Color(0x1a237e),
        emissiveIntensity: 0.6,
        metalness: 0.8,
        roughness: 0.2,
      })
    );
    panel.position.y = 0.11;
    panel.rotation.x = 0.3; // slight tilt toward sun

    // Solar cell grid lines
    const gridMat = new THREE.LineBasicMaterial({ color: 0x42a5f5, transparent: true, opacity: 0.6 });
    const gridGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.1, 0.002, 0.06));
    const grid = new THREE.LineSegments(gridGeo, gridMat);
    grid.position.copy(panel.position);
    grid.rotation.copy(panel.rotation);

    const group = new THREE.Group();
    group.add(pole); group.add(panel); group.add(grid);
    group.setRotationFromMatrix(rotMatrix);
    group.position.copy(pos);
    group.userData._panel = panel;
    this.planetGroup.add(group);
    this.solarMeshes.push(group);

    // Soft blue glow
    const light = new THREE.PointLight(0x42a5f5, 0.5, 0.4);
    light.position.copy(pos.clone().multiplyScalar(1.05));
    this.planetGroup.add(light);

    // Passive energy recharge: +2 energy every 3 seconds
    const key = `solar_${hitMesh.userData.vertexKey}`;
    const id = setInterval(() => {
      this.gameState.recharge(2);
    }, 3000);
    this.productionIntervals[key] = { intervalId: id };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _surfaceRotation(pos) {
    const normal = pos.clone().normalize();
    const up = Math.abs(normal.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangent   = new THREE.Vector3().crossVectors(up, normal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent);
    return new THREE.Matrix4().makeBasis(tangent, bitangent, normal);
  }

  // ─── Render loop ──────────────────────────────────────────────────────────

  animate = () => {
    if (!this.renderer) return;
    this.animationId = requestAnimationFrame(this.animate);
    const t = performance.now() * 0.001;

    // Pulse ore glows
    this.glowDiscs.forEach(m => {
      m.material.emissiveIntensity = 0.8 + Math.sin(t * 2 + (m.userData._pulsePhase ?? 0)) * 0.5;
    });

    // Spin drill shafts
    this.drillMeshes.forEach(g => {
      if (g.userData._shaft) g.userData._shaft.rotation.y += 0.05;
    });

    // Pulse solar panels
    this.solarMeshes.forEach(g => {
      if (g.userData._panel) {
        g.userData._panel.material.emissiveIntensity = 0.4 + Math.abs(Math.sin(t * 0.8)) * 0.4;
      }
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy() {
    cancelAnimationFrame(this.animationId);
    Object.values(this.productionIntervals).forEach(({ intervalId }) => clearInterval(intervalId));
    this.productionIntervals = {};

    if (this.canvas) {
      this.canvas.removeEventListener('contextmenu', this._handleRightClick);
    }
    window.removeEventListener('resize', this._handleResize);

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);

    this.nodeMeshes = [];
    this.emptyVertMeshes = [];
    this.drillMeshes = [];
    this.solarMeshes = [];
    this.glowDiscs = [];
    this.planetGroup = new THREE.Group();
    this.canvas = null;
    this.renderer = null;
  }
}

export default PlanetView;
