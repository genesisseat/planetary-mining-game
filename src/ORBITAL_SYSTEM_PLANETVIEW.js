/**
 * PLANETVIEW ORBITAL LAYER
 * 
 * Extends PlanetView to show:
 * 1. Orbital sphere at 2.5x radius
 * 2. Orbital nodes (space docks, naval station)
 * 3. Orbiting spacecraft with travel indicators
 */

// ============================================================================
// ADD TO PLANETVIEW CONSTRUCTOR
// ============================================================================

this.orbitalMode = false;  // false = surface, true = orbit
this.orbitalSphere = null;
this.orbitalNodeMeshes = [];
this.orbitalNodes = {};  // nodeId -> mesh
this.navalStationMesh = null;
this.spacecraftMeshes = [];
this.zoomLevelIndicator = null;

// ============================================================================
// INIT EXTENSION
// ============================================================================

/**
 * After buildGeometricPlanet(), add orbital sphere
 */
buildOrbitalSphere(planet) {
  const orbitalRadius = 2.5;
  
  // Transparent/wireframe orbital sphere for visual reference
  const geometry = new THREE.IcosahedronGeometry(orbitalRadius, 2);
  const material = new THREE.LineBasicMaterial({
    color: 0x00ff88,
    opacity: 0.15,
    transparent: true,
    linewidth: 1
  });
  const wireframe = new THREE.LineSegments(
    new THREE.WireframeGeometry(geometry),
    material
  );
  
  this.orbitalSphere = new THREE.Group();
  this.orbitalSphere.add(wireframe);
  this.planetGroup.add(this.orbitalSphere);
  this.orbitalSphere.visible = false; // Hidden by default
}

/**
 * Create interactive nodes in orbit
 */
createOrbitalNodes(planet) {
  if (!planet.orbital || planet.orbital.nodes.length === 0) return;

  planet.orbital.nodes.forEach(node => {
    // Invisible hit sphere
    const hitGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const hitMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0
    });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.set(node.x, node.y, node.z);
    hitMesh.userData = {
      nodeId: node.id,
      planetId: planet.id,
      isOrbital: true,
      slotType: node.slotType
    };

    this.orbitalSphere.add(hitMesh);
    this.orbitalNodeMeshes.push(hitMesh);
    this.orbitalNodes[node.id] = {
      hitMesh,
      visualMesh: null,
      node: node
    };

    // Visual indicator (dimmer than surface nodes)
    const visualGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const visualMat = new THREE.MeshBasicMaterial({
      color: node.slotType === 'naval' ? 0xff6600 : 0x00ccff,
      transparent: true,
      opacity: 0.6
    });
    const visualMesh = new THREE.Mesh(visualGeo, visualMat);
    visualMesh.position.copy(hitMesh.position);
    this.orbitalSphere.add(visualMesh);
    this.orbitalNodes[node.id].visualMesh = visualMesh;
  });
}

/**
 * Update orbital spacecraft positions during travel
 */
updateOrbitalSpacecraft(planet) {
  // Clear old meshes
  this.spacecraftMeshes.forEach(mesh => this.orbitalSphere.remove(mesh));
  this.spacecraftMeshes = [];

  // Draw arriving spacecraft
  planet.orbital.inOrbit.forEach(spacecraftId => {
    const ship = this.gameState.spacecraft.find(s => s.id === spacecraftId);
    if (!ship) return;

    // Traveling: show transit indicator between planets
    if (ship.status === 'traveling') {
      const originPlanet = this.gameState.planets[ship.originPlanetId];
      const targetPlanet = this.gameState.planets[ship.targetPlanetId];
      
      const progress = (Date.now() - ship.launchTime) / ship.travelTime;
      const tX = originPlanet.x + (targetPlanet.x - originPlanet.x) * progress;
      const tY = originPlanet.y + (targetPlanet.y - originPlanet.y) * progress;
      const tZ = originPlanet.z + (targetPlanet.z - originPlanet.z) * progress;

      // Show trajectory line
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(originPlanet.x, originPlanet.y, originPlanet.z),
        new THREE.Vector3(tX, tY, tZ),
        new THREE.Vector3(targetPlanet.x, targetPlanet.y, targetPlanet.z)
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.4 });
      const line = new THREE.Line(lineGeo, lineMat);
      this.orbitalSphere.add(line);
      this.spacecraftMeshes.push(line);

      // Show spacecraft as small glowing dot
      const shipGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const shipMat = new THREE.MeshBasicMaterial({ color: 0xffff00, emissive: 0xff8800 });
      const shipMesh = new THREE.Mesh(shipGeo, shipMat);
      shipMesh.position.set(tX, tY, tZ);
      shipMesh.userData = { spacecraftId };
      this.orbitalSphere.add(shipMesh);
      this.spacecraftMeshes.push(shipMesh);
    }

    // Arrived: show at target orbit with "dock here" indicator
    else if (ship.status === 'arrived') {
      const dockNode = this.gameState.planets[ship.targetPlanetId].orbital.nodes[0];
      if (!dockNode) return;

      const shipGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const shipMat = new THREE.MeshBasicMaterial({ 
        color: 0x00ff88, 
        emissive: 0x00ff00,
        transparent: true,
        opacity: 0.9
      });
      const shipMesh = new THREE.Mesh(shipGeo, shipMat);
      shipMesh.position.set(dockNode.x, dockNode.y, dockNode.z);
      shipMesh.userData = { spacecraftId };

      // Pulsing glow
      const scale = 1 + Math.sin(Date.now() * 0.003) * 0.2;
      shipMesh.scale.set(scale, scale, scale);

      this.orbitalSphere.add(shipMesh);
      this.spacecraftMeshes.push(shipMesh);
    }

    // Docked: remove from visual (docked = stationary)
  });
}

// ============================================================================
// INTERACTION HANDLERS
// ============================================================================

/**
 * Right-click on orbital node -> build menu
 * (Replaces/extends existing handleRightClick)
 */
handleOrbitalRightClick(e) {
  e.preventDefault();
  if (e.target !== this.canvas) return;

  // Only works in orbital mode
  if (!this.orbitalMode) return;

  const rect = this.canvas.getBoundingClientRect();
  this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  this.raycaster.setFromCamera(this.mouse, this.camera);
  const intersects = this.raycaster.intersectObjects(this.orbitalNodeMeshes);

  if (intersects.length > 0) {
    const mesh = intersects[0].object;
    window.gameInstance?.openOrbitalBuildMenu(
      e.clientX,
      e.clientY,
      mesh,
      mesh.userData.slotType
    );
  }
}

/**
 * Toggle between surface and orbital view
 * Press 'O' key to switch
 */
toggleOrbitalView() {
  this.orbitalMode = !this.orbitalMode;
  this.planetGroup.children.forEach(child => {
    // Hide surface layer when in orbital mode
    if (child !== this.orbitalSphere && child.userData?.isSurface) {
      child.visible = !this.orbitalMode;
    }
  });
  this.orbitalSphere.visible = this.orbitalMode;
  
  // Update indicator
  if (this.zoomLevelIndicator) {
    this.zoomLevelIndicator.textContent = this.orbitalMode ? 'ORBITAL VIEW' : 'SURFACE VIEW';
  }
}

// ============================================================================
// BUILDING VISUALS
// ============================================================================

/**
 * Build launch facility on surface
 */
buildLaunchFacilityVisual() {
  // Large antenna/tower structure on surface
  const group = new THREE.Group();

  // Base platform
  const basePlane = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.05, 8),
    new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 })
  );
  group.add(basePlane);

  // Tall antenna
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.5, 4),
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9 })
  );
  antenna.position.y = 0.3;
  group.add(antenna);

  // Parabolic dish
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xddaa00, metalness: 0.7 })
  );
  dish.position.y = 0.4;
  group.add(dish);

  // Position on surface (at zenith)
  group.position.y = 1.1;
  
  // Add glow light
  const light = new THREE.PointLight(0xffaa00, 0.5, 2);
  light.position.copy(group.position);
  this.planetGroup.add(light);

  this.planetGroup.add(group);
  return group;
}

/**
 * Build naval station in orbit
 */
buildNavalStationVisual(node) {
  // Large spherical space station
  const station = new THREE.Group();

  // Core sphere
  const coreSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xff6600, metalness: 0.9, roughness: 0.3 })
  );
  station.add(coreSphere);

  // Solar panels (3 rotating)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.05, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x0088ff, metalness: 0.8 })
    );
    panel.position.x = Math.cos(angle) * 0.4;
    panel.position.z = Math.sin(angle) * 0.4;
    panel.rotation.y = angle;
    station.add(panel);
  }

  // Docking ring
  const dockRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.05, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x00ff88, metalness: 0.7 })
  );
  dockRing.rotation.x = Math.PI / 4;
  station.add(dockRing);

  station.position.set(node.x, node.y, node.z);

  // Pulsing emissive glow
  const light = new THREE.PointLight(0xff6600, 1, 3);
  light.position.copy(station.position);
  this.planetGroup.add(light);

  this.planetGroup.add(station);
  this.navalStationMesh = station;
  return station;
}

/**
 * Build spacecraft dock at orbital node
 */
buildSpacecraftDockVisual(node) {
  const dock = new THREE.Group();

  // Docking platform
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0x00ccff, metalness: 0.8 })
  );
  dock.add(platform);

  // Docking clamps (4 arms)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const clamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.15, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x0099ff, metalness: 0.9 })
    );
    clamp.position.x = Math.cos(angle) * 0.2;
    clamp.position.z = Math.sin(angle) * 0.2;
    dock.add(clamp);
  }

  // Landing beacon light
  const beacon = new THREE.PointLight(0x00ccff, 0.8, 1);
  dock.add(beacon);

  dock.position.set(node.x, node.y, node.z);
  this.orbitalSphere.add(dock);
  return dock;
}

// ============================================================================
// ANIMATION UPDATES
// ============================================================================

/**
 * In animate() loop, add:
 */
updateOrbitalVisuals() {
  if (!this.orbitalMode) return;

  // Rotate naval station
  if (this.navalStationMesh) {
    this.navalStationMesh.rotation.y += 0.0005;
  }

  // Pulse orbital nodes
  this.orbitalNodeMeshes.forEach(mesh => {
    const pulse = Math.sin(Date.now() * 0.002 + mesh.position.length()) * 0.2 + 0.8;
    mesh.scale.set(pulse, pulse, pulse);
  });

  // Update spacecraft positions
  const planet = this.gameState.planets[this.gameState.selectedPlanetId];
  if (planet) this.updateOrbitalSpacecraft(planet);
}

export { buildOrbitalSphere, createOrbitalNodes, toggleOrbitalView };
