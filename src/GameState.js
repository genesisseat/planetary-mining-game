import * as THREE from 'three'; // Required for THREE.IcosahedronGeometry

class GameState {
  constructor() {
    // --- BASE INITIALIZATION ---
    this.view = 'galaxy';
    this.selectedPlanetId = null;
    this.starterPlanetId = 0;

    this.planets = []; 
    this.inventory = {
      iron: 0,
      copper: 0,
      gold: 0,
      lithium: 0,
      platinum: 0,
      fuelCell: 0 // New resource type
    };
    this.tech = {};
    
    // --- PLANET GENERATION ---
    // Must be called before orbital data structures
    this.generatePlanets();

    // --- ORBITAL INITIALIZATION ---
    this.addOrbitalDataStructures();
  }

  // Fixed: Removed the local post-increment which did nothing for the caller
  // and adjusted to use a standard pseudo-random hash
  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Generates the base planets for the galaxy
   */
  generatePlanets() {
    const numPlanets = 10; // Example count
    for (let i = 0; i < numPlanets; i++) {
      this.planets.push({
        id: i,
        name: `Sector ${i + 1} Prime`,
        // Spread planets out in a 3D volume
        x: (this.seededRandom(i * 100) - 0.5) * 200,
        y: (this.seededRandom(i * 200) - 0.5) * 200,
        z: (this.seededRandom(i * 300) - 0.5) * 200,
        launchFacilityBuilt: false
      });
    }
  }

  /**
   * Returns planets to be rendered by the GalaxyView
   */
  getVisiblePlanets() {
    // Currently returns all planets. Can be expanded with frustum culling 
    // or distance-based filtering if the galaxy gets too large.
    return this.planets;
  }

  // ============================================================================
  // ORBITAL INFRASTRUCTURE & SPACECRAFT SYSTEM
  // ============================================================================

  /**
   * Initialize all orbital data arrays, tech, and fuel
   */
  addOrbitalDataStructures() {
    // Initialize all planets with orbital data
    this.planets.forEach(planet => {
      planet.orbital = {
        nodes: [],              // Space infrastructure nodes
        navalStationBuilt: false,
        docks: [],              // Spacecraft docks (built after naval station)
        inOrbit: [],            // Currently orbiting spacecraft
      };
    });

    // Spacecraft registry
    this.spacecraft = [];
    this.nextSpacecraftId = 0;

    // Tech tree addition
    this.tech.launchFacility = 0;
    this.tech.navalStation = 0;
    this.tech.spacecraft = 0;
  }

  /**
   * Generate orbital nodes (same vertex-snapping as surface, but on larger sphere)
   */
  generateOrbitalNodes(planetId) {
    const planet = this.planets[planetId];
    const orbitalRadius = 2.5;

    // Use icosahedron vertices at orbital radius
    const geometry = new THREE.IcosahedronGeometry(orbitalRadius, 2);
    const positions = geometry.attributes.position.array;
    
    const nodes = [];
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      
      // Deterministic slot type per planet + position
      const slotSeed = planetId * 1000 + (i / 3);
      const isNavalSlot = this.seededRandom(slotSeed) > 0.7; // 30% are naval station slots

      nodes.push({
        id: i / 3,
        x, y, z,
        slotType: isNavalSlot ? 'naval' : 'dock',  // naval or dock slot
        built: null,  // 'naval' | 'dock' | null
        occupied: false,
      });
    }

    planet.orbital.nodes = nodes;
  }

  /**
   * Build launch facility on planet surface
   * Costs: 100 Gold (expensive infrastructure)
   * Effect: Unlocks rocket launch to orbit
   */
  buildLaunchFacility(planetId) {
    const planet = this.planets[planetId];
    if (!planet || planet.launchFacilityBuilt) return false;

    if (this.inventory.gold < 100) {
      console.log('Need 100 Gold to build Launch Facility');
      return false;
    }

    this.inventory.gold -= 100;
    planet.launchFacilityBuilt = true;
    this.tech.launchFacility = 1;

    // Generate orbital nodes when facility is built
    if (planet.orbital.nodes.length === 0) {
      this.generateOrbitalNodes(planetId);
    }

    return true;
  }

  /**
   * Build naval station in orbit
   * Costs: 150 Gold + 50 Platinum (very expensive)
   * Effect: Unlocks spacecraft dock construction
   */
  buildNavalStation(planetId) {
    const planet = this.planets[planetId];
    if (!planet || planet.orbital.navalStationBuilt) return false;

    if (!planet.launchFacilityBuilt) {
      console.log('Must build Launch Facility first');
      return false;
    }

    if (this.inventory.gold < 150 || this.inventory.platinum < 50) {
      console.log('Need 150 Gold + 50 Platinum for Naval Station');
      return false;
    }

    this.inventory.gold -= 150;
    this.inventory.platinum -= 50;
    planet.orbital.navalStationBuilt = true;
    this.tech.navalStation = 1;

    // Find first naval slot and mark it as built
    const navalSlot = planet.orbital.nodes.find(n => n.slotType === 'naval');
    if (navalSlot) {
      navalSlot.built = 'naval';
      navalSlot.occupied = true;
    }

    return true;
  }

  /**
   * Build spacecraft dock in orbit
   * Costs: 80 Gold + 30 Copper
   * Effect: Unlocks spacecraft construction
   */
  buildSpacecraftDock(planetId, nodeId) {
    const planet = this.planets[planetId];
    if (!planet || !planet.orbital.navalStationBuilt) return false;

    const node = planet.orbital.nodes[nodeId];
    if (!node || node.slotType !== 'dock' || node.occupied) return false;

    if (this.inventory.gold < 80 || this.inventory.copper < 30) {
      console.log('Need 80 Gold + 30 Copper for Dock');
      return false;
    }

    this.inventory.gold -= 80;
    this.inventory.copper -= 30;
    node.built = 'dock';
    node.occupied = true;
    planet.orbital.docks.push(nodeId);
    this.tech.spacecraft = 1;

    return true;
  }

  /**
   * Launch spacecraft from docked orbit
   * Costs: 20 Fuel Cells per jump
   * Route: starts in origin orbit, travels for duration, arrives in target orbit
   */
  launchSpacecraft(originPlanetId, targetPlanetId) {
    // Validation
    const origin = this.planets[originPlanetId];
    const target = this.planets[targetPlanetId];

    if (!origin || !target) return false;
    if (!origin.orbital.navalStationBuilt || origin.orbital.docks.length === 0) {
      console.log('Need Naval Station + Dock at origin');
      return false;
    }

    // Check fuel
    const fuelCost = 20;
    if (this.inventory.fuelCell < fuelCost) {
      console.log(`Need ${fuelCost} Fuel Cells`);
      return false;
    }

    this.inventory.fuelCell -= fuelCost;

    // Create spacecraft
    const distance = Math.hypot(
      target.x - origin.x,
      target.y - origin.y,
      target.z - origin.z
    );
    const travelTime = Math.max(5000, distance * 20); // ms: 5s minimum, scales with distance

    const spacecraft = {
      id: this.nextSpacecraftId++,
      originPlanetId: originPlanetId,
      targetPlanetId: targetPlanetId,
      launchTime: Date.now(),
      travelTime: travelTime,
      status: 'traveling', // 'traveling' | 'arrived' | 'docked'
      cargo: {
        iron: 0, copper: 0, gold: 0, lithium: 0, platinum: 0, fuelCell: 5
      }
    };

    this.spacecraft.push(spacecraft);
    return spacecraft;
  }

  /**
   * Update spacecraft status (called every frame from Game.gameLoop)
   */
  updateSpacecraft() {
    this.spacecraft.forEach((ship) => {
      if (ship.status === 'traveling') {
        const elapsed = Date.now() - ship.launchTime;
        if (elapsed >= ship.travelTime) {
          // Arrived at target orbit
          ship.status = 'arrived';
          const target = this.planets[ship.targetPlanetId];
          if (target) target.orbital.inOrbit.push(ship.id);
          console.log(`Spacecraft ${ship.id} arrived at ${target.name}`);
        }
      }
    });
  }

  /**
   * Dock spacecraft at target planet
   * Requires target to have naval station
   */
  dockSpacecraft(spacecraftId, targetPlanetId) {
    const ship = this.spacecraft.find(s => s.id === spacecraftId);
    const planet = this.planets[targetPlanetId];

    if (!ship || !planet || !planet.orbital.navalStationBuilt) return false;
    if (ship.status !== 'arrived') return false;

    ship.status = 'docked';
    ship.targetPlanetId = targetPlanetId;

    // Unload cargo to inventory
    Object.keys(ship.cargo).forEach(ore => {
      this.inventory[ore] = (this.inventory[ore] || 0) + ship.cargo[ore];
      ship.cargo[ore] = 0;
    });

    // Remove from orbit
    planet.orbital.inOrbit = planet.orbital.inOrbit.filter(id => id !== spacecraftId);

    return true;
  }
}

// ============================================================================
// COSTS REFERENCE
// ============================================================================

const ORBITAL_COSTS = {
  launchFacility: { gold: 100 },
  navalStation:   { gold: 150, platinum: 50 },
  dock:           { gold: 80, copper: 30 },
  spacecraft:     { gold: 200, platinum: 100 }, // Refined but not yet built in-game
};

export default GameState;
export { ORBITAL_COSTS };