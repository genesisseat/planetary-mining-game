/**
 * GameState
 * Central store for all game data, resources, and progress
 */
class GameState {
  constructor() {
    // FIX #2: Start in PLANET view, not galaxy view
    this.view = 'planet'; // 'galaxy' | 'planet'
    this.selectedPlanetId = 0; // Start on first planet (starter planet)
    this.starterPlanetId = 0; // Reference to home planet
    
    // Player inventory
    this.inventory = {
      iron: 0,
      copper: 0,
      gold: 0,
      lithium: 0,
      platinum: 0,
      energy: 500,
      maxEnergy: 500
    };

    // Tech tree unlocks (0 = locked, 1 = unlocked)
    this.tech = {
      basicPickaxe: 1,
      stoneDrill: 0,
      ironDrill: 0,
      autoExtractor: 0,
      droneMiner: 0,
      radar: 0 // FIX #3: Radar building unlocks scanning
    };

    // Planets data (seeded and persisted)
    this.planets = this.generateGalaxy();
    
    // FIX #3: Radar scan data - which planets are visible
    this.scannedPlanets = new Set([0]); // Start with only starter planet visible
    this.radarRange = 300; // Distance in space units
    this.radarBuilt = false; // Whether radar is built
  }

  /**
   * Seeded pseudo-random for deterministic planet generation
   */
  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Generate galaxy with 20 planets
   */
  generateGalaxy() {
    const planets = [];
    const oreTypes = ['iron', 'copper', 'gold', 'lithium', 'platinum'];
    
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const baseDistance = 200;
      const distance = baseDistance + this.seededRandom(i * 1000) * 100;
      
      const planet = {
        id: i,
        name: `Planet ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}`,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        z: this.seededRandom(i * 2000) * 100 - 50,
        
        // Surface resources
        surfaceOres: {},
        nodes: [],
        
        // Planet properties
        temperature: this.seededRandom(i * 5000) * 100, // 0-100
        hazardLevel: Math.floor(this.seededRandom(i * 7000) * 3), // 0-2
        visited: false,
        depleted: false
      };

      // Generate random ore deposits
      oreTypes.forEach((ore, idx) => {
        const amount = Math.floor(this.seededRandom(i * 1000 + idx * 100) * 200) + 50;
        planet.surfaceOres[ore] = amount;
      });

      // Generate 20 mineable nodes per planet
      for (let j = 0; j < 20; j++) {
        const phi = this.seededRandom(i * 100 + j * 50) * Math.PI * 2;
        const theta = this.seededRandom(i * 100 + j * 51) * Math.PI;
        
        planet.nodes.push({
          id: j,
          ore: oreTypes[Math.floor(this.seededRandom(i * 200 + j) * oreTypes.length)],
          amount: Math.floor(this.seededRandom(i * 300 + j) * 30) + 10,
          collected: false,
          phi: phi,
          theta: theta
        });
      }

      planets.push(planet);
    }
    
    return planets;
  }

  /**
   * Mine ore from a node
   */
  mineNode(planetId, nodeId) {
    const planet = this.planets[planetId];
    if (!planet) return false;
    
    const node = planet.nodes[nodeId];
    if (!node || node.collected) return false;

    // Check energy
    const energyCost = 20;
    if (this.inventory.energy < energyCost) return false;

    // Deduct energy
    this.inventory.energy -= energyCost;

    // Add ore
    this.inventory[node.ore] += node.amount;
    node.collected = true;

    return true;
  }

  /**
   * Get current planet
   */
  getCurrentPlanet() {
    if (this.selectedPlanetId === null) return null;
    return this.planets[this.selectedPlanetId];
  }

  /**
   * FIX #3: Check if a planet is visible on the galaxy map
   */
  isPlanetScanned(planetId) {
    return this.scannedPlanets.has(planetId);
  }

  /**
   * FIX #3: Build radar on starter planet to scan nearby planets
   */
  buildRadar() {
    if (this.radarBuilt) return false;
    if (this.inventory.gold < 50 || this.inventory.platinum < 25) return false;

    // Deduct resources
    this.inventory.gold -= 50;
    this.inventory.platinum -= 25;
    this.radarBuilt = true;
    this.tech.radar = 1;

    // Scan all planets within range
    this.updateRadarScan();
    return true;
  }

  /**
   * FIX #3: Update which planets are visible based on radar range
   */
  updateRadarScan() {
    const starter = this.planets[this.starterPlanetId];
    
    for (let i = 0; i < this.planets.length; i++) {
      const planet = this.planets[i];
      const distance = Math.hypot(
        planet.x - starter.x,
        planet.y - starter.y,
        planet.z - starter.z
      );

      if (distance <= this.radarRange || i === this.starterPlanetId) {
        this.scannedPlanets.add(i);
      }
    }
  }

  /**
   * Get all visible planets for galaxy rendering
   */
  getVisiblePlanets() {
    if (!this.radarBuilt) {
      // Only show starter planet until radar is built
      return [this.planets[this.starterPlanetId]];
    }
    // Show all scanned planets
    return this.planets.filter((_, idx) => this.scannedPlanets.has(idx));
  }

  /**
   * Add energy (from power cells, etc)
   */
  recharge(amount) {
    this.inventory.energy = Math.min(
      this.inventory.energy + amount,
      this.inventory.maxEnergy
    );
  }

  /**
   * Serialize state for save/load
   */
  toJSON() {
    return {
      inventory: this.inventory,
      tech: this.tech,
      planets: this.planets.map(p => ({
        id: p.id,
        nodes: p.nodes.map(n => ({ id: n.id, collected: n.collected }))
      }))
    };
  }

  /**
   * Load from saved state
   */
  loadFromJSON(data) {
    if (data.inventory) this.inventory = data.inventory;
    if (data.tech) this.tech = data.tech;
    if (data.planets) {
      data.planets.forEach(saved => {
        const planet = this.planets[saved.id];
        if (planet) {
          saved.nodes.forEach(savedNode => {
            const node = planet.nodes[savedNode.id];
            if (node) node.collected = savedNode.collected;
          });
        }
      });
    }
  }
}

export default GameState;
