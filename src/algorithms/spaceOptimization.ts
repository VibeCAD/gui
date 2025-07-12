import { Vector3, Mesh } from 'babylonjs';
import { findContainingRoom } from '../babylon/roomPhysicsUtils';

/**
 * Checks if a 2D point is inside a 2D polygon using the ray-casting algorithm.
 */
function isPointInPolygon(point: { x: number; z: number }, polygon: { x: number; z: number }[]): boolean {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;

    const intersect = ((zi > point.z) !== (zj > point.z))
        && (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi);
    
    if (intersect) {
      isInside = !isInside;
    }
  }
  return isInside;
}

export interface SpaceOptimizationConfig {
  objectType: string;
  minClearance: number;     // Minimum space around object
  accessClearance: number;  // Additional clearance for access
  wallOffset: number;       // Distance from walls
  cornerUsage: boolean;     // Can be placed in corners
  grouping: boolean;        // Can be grouped with similar objects
  gridResolution: number;   // Grid cell size for placement analysis
}

export interface OptimizationResult {
  maxObjects: number;
  layouts: PlacementLayout[];
  efficiency: number;       // Space utilization percentage
  warnings: string[];
  alternativeLayouts?: PlacementLayout[][];  // Different arrangement options
}

export interface PlacementLayout {
  id: string;
  position: Vector3;
  rotation: Vector3;
  clearanceRadius: number;
  accessZones: AccessZone[];
  groupId?: string;        // For grouped objects
}

export interface AccessZone {
  center: Vector3;
  radius: number;
  type: 'front' | 'back' | 'side' | 'corner';
  required: boolean;       // Must be clear vs. preferred clear
}

export interface RoomBounds {
  floorPolygon: { x: number; z: number }[];
  wallSegments: WallSegment[];
  area: number;
  usableArea: number;
  corners: Vector3[];
  center: Vector3;
}

export interface WallSegment {
  start: Vector3;
  end: Vector3;
  normal: Vector3;
  length: number;
  type: 'exterior' | 'interior';
}

export interface PlacementGrid {
  cells: GridCell[][];
  resolution: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  width: number;
  height: number;
}

export interface GridCell {
  x: number;
  z: number;
  worldPos: Vector3;
  isValid: boolean;        // Can place objects here
  isOccupied: boolean;     // Already has object
  distanceToWall: number;  // Distance to nearest wall
  isCorner: boolean;       // Near room corner
  clearanceRadius: number; // Available clearance from this position
}

export interface OptimizationStrategy {
  name: string;
  priority: 'maximize' | 'comfort' | 'ergonomic' | 'aesthetic';
  description: string;
}

/**
 * Core space optimization algorithm for furniture placement in custom rooms
 */
export class SpaceOptimizer {
  private defaultConfigs: Map<string, SpaceOptimizationConfig> = new Map();

  constructor() {
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize default configurations for common furniture types
   */
  private initializeDefaultConfigs(): void {
    // Desk configurations - need space for chair and access
    this.defaultConfigs.set('Desk', {
      objectType: 'Desk',
      minClearance: 0.3,      // 30cm around desk
      accessClearance: 1.2,   // 120cm in front for chair + walking
      wallOffset: 0.1,        // 10cm from wall for cables
      cornerUsage: true,      // Desks work well in corners
      grouping: true,         // Can group desks together
      gridResolution: 0.2     // 20cm grid resolution
    });

    this.defaultConfigs.set('Chair', {
      objectType: 'Chair',
      minClearance: 0.2,
      accessClearance: 0.6,   // Space to pull out and sit
      wallOffset: 0.1,
      cornerUsage: false,     // Chairs need access from multiple sides
      grouping: true,
      gridResolution: 0.2
    });

    this.defaultConfigs.set('Table', {
      objectType: 'Table',
      minClearance: 0.5,
      accessClearance: 0.8,   // Space around table for chairs
      wallOffset: 0.2,
      cornerUsage: false,     // Tables need all-around access
      grouping: false,        // Usually standalone
      gridResolution: 0.2
    });

    this.defaultConfigs.set('Sofa', {
      objectType: 'Sofa',
      minClearance: 0.4,
      accessClearance: 1.0,   // Space in front for coffee table + walking
      wallOffset: 0.1,        // Can be against wall
      cornerUsage: true,      // Good corner placement
      grouping: false,
      gridResolution: 0.3
    });

    this.defaultConfigs.set('Bed Single', {
      objectType: 'Bed Single',
      minClearance: 0.6,      // Space to walk around
      accessClearance: 0.8,   // Space on access sides
      wallOffset: 0.1,        // Can be against wall on one side
      cornerUsage: true,      // Corner placement OK
      grouping: false,        // Usually standalone
      gridResolution: 0.3
    });

    this.defaultConfigs.set('Bookcase', {
      objectType: 'Bookcase',
      minClearance: 0.2,
      accessClearance: 0.9,   // Space to access books
      wallOffset: 0.05,       // Usually against wall
      cornerUsage: true,      // Good for corners
      grouping: true,         // Can line up multiple bookcases
      gridResolution: 0.2
    });
  }

  /**
   * Analyze a room and calculate optimal object placement
   */
  public optimizeSpace(
    roomMesh: Mesh,
    objectType: string,
    strategy: OptimizationStrategy = { name: 'maximize', priority: 'maximize', description: 'Maximize capacity' },
    customConfig?: Partial<SpaceOptimizationConfig>
  ): OptimizationResult {
    console.log(`🔍 Starting space optimization for ${objectType} in room ${roomMesh.id}`);

    // Get configuration for this object type
    const config = this.getOptimizationConfig(objectType, customConfig);
    
    // Analyze room geometry
    const roomBounds = this.analyzeRoomGeometry(roomMesh);
    
    // Generate placement grid
    const placementGrid = this.generatePlacementGrid(roomBounds, config);
    
    // Filter valid placement positions
    const validPositions = this.filterValidPositions(placementGrid, roomBounds, config);
    
    // Generate optimal layouts based on strategy
    const layouts = this.generateOptimalLayouts(validPositions, roomBounds, config, strategy);
    
    // Calculate metrics
    const efficiency = this.calculateSpaceEfficiency(layouts, roomBounds);
    const warnings = this.generateWarnings(layouts, roomBounds, config);

    const result: OptimizationResult = {
      maxObjects: layouts.length,
      layouts,
      efficiency,
      warnings,
      alternativeLayouts: this.generateAlternativeLayouts(validPositions, roomBounds, config)
    };

    console.log(`✅ Optimization complete: ${result.maxObjects} objects, ${(result.efficiency * 100).toFixed(1)}% efficiency`);
    
    return result;
  }

  /**
   * Get configuration for object type with optional overrides
   */
  private getOptimizationConfig(objectType: string, customConfig?: Partial<SpaceOptimizationConfig>): SpaceOptimizationConfig {
    const defaultConfig = this.defaultConfigs.get(objectType);
    
    if (!defaultConfig) {
      console.warn(`⚠️ No default config for ${objectType}, using generic configuration`);
      const genericConfig: SpaceOptimizationConfig = {
        objectType,
        minClearance: 0.5,
        accessClearance: 0.8,
        wallOffset: 0.2,
        cornerUsage: false,
        grouping: false,
        gridResolution: 0.2
      };
      return { ...genericConfig, ...customConfig };
    }

    return { ...defaultConfig, ...customConfig };
  }

  /**
   * Analyze room geometry to extract usable space information
   */
  private analyzeRoomGeometry(roomMesh: Mesh): RoomBounds {
    const floorPolygon = roomMesh.metadata?.floorPolygon || [];
    if (floorPolygon.length < 3) {
      throw new Error('Invalid room: floor polygon must have at least 3 points');
    }

    // Calculate total floor area using shoelace formula
    let area = 0;
    for (let i = 0; i < floorPolygon.length; i++) {
      const j = (i + 1) % floorPolygon.length;
      area += floorPolygon[i].x * floorPolygon[j].z;
      area -= floorPolygon[j].x * floorPolygon[i].z;
    }
    area = Math.abs(area) / 2;

    // Generate wall segments
    const wallSegments: WallSegment[] = [];
    for (let i = 0; i < floorPolygon.length; i++) {
      const start = new Vector3(floorPolygon[i].x, 0, floorPolygon[i].z);
      const next = floorPolygon[(i + 1) % floorPolygon.length];
      const end = new Vector3(next.x, 0, next.z);
      
      const direction = end.subtract(start).normalize();
      const normal = new Vector3(-direction.z, 0, direction.x); // Perpendicular pointing inward
      
      wallSegments.push({
        start,
        end,
        normal,
        length: Vector3.Distance(start, end),
        type: 'exterior' // Assume exterior for now
      });
    }

    // Find corners
    const corners: Vector3[] = floorPolygon.map((p: { x: number; z: number }) => new Vector3(p.x, 0, p.z));

    // Calculate center point
    const centerX = floorPolygon.reduce((sum: number, p: { x: number; z: number }) => sum + p.x, 0) / floorPolygon.length;
    const centerZ = floorPolygon.reduce((sum: number, p: { x: number; z: number }) => sum + p.z, 0) / floorPolygon.length;
    const center = new Vector3(centerX, 0, centerZ);

    // Estimate usable area (subtract space near walls)
    const wallBuffer = 0.5; // 50cm buffer from walls
    const usableArea = Math.max(0, area - (this.calculatePerimeter(floorPolygon) * wallBuffer));

    return {
      floorPolygon,
      wallSegments,
      area,
      usableArea,
      corners,
      center
    };
  }

  /**
   * Calculate perimeter of polygon
   */
  private calculatePerimeter(polygon: { x: number; z: number }[]): number {
    let perimeter = 0;
    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      const dx = next.x - current.x;
      const dz = next.z - current.z;
      perimeter += Math.sqrt(dx * dx + dz * dz);
    }
    return perimeter;
  }

  /**
   * Generate placement grid for the room
   */
  private generatePlacementGrid(roomBounds: RoomBounds, config: SpaceOptimizationConfig): PlacementGrid {
    // Find bounding box of room
    const minX = Math.min(...roomBounds.floorPolygon.map(p => p.x));
    const maxX = Math.max(...roomBounds.floorPolygon.map(p => p.x));
    const minZ = Math.min(...roomBounds.floorPolygon.map(p => p.z));
    const maxZ = Math.max(...roomBounds.floorPolygon.map(p => p.z));

    const bounds = { minX, maxX, minZ, maxZ };
    const resolution = config.gridResolution;

    // Generate grid cells
    const width = Math.ceil((maxX - minX) / resolution);
    const height = Math.ceil((maxZ - minZ) / resolution);
    
    const cells: GridCell[][] = [];
    
    for (let i = 0; i < width; i++) {
      cells[i] = [];
      for (let j = 0; j < height; j++) {
        const worldX = minX + i * resolution;
        const worldZ = minZ + j * resolution;
        const worldPos = new Vector3(worldX, 0, worldZ);
        
        // Check if position is inside room
        const isValid = isPointInPolygon({ x: worldX, z: worldZ }, roomBounds.floorPolygon);
        
        // Calculate distance to nearest wall
        const distanceToWall = this.calculateDistanceToWall(worldPos, roomBounds.wallSegments);
        
        // Check if near corner
        const isCorner = roomBounds.corners.some(corner => 
          Vector3.Distance(worldPos, corner) < resolution * 2
        );

        // Calculate available clearance
        const clearanceRadius = this.calculateAvailableClearance(worldPos, roomBounds, config);

        cells[i][j] = {
          x: i,
          z: j,
          worldPos,
          isValid: isValid && distanceToWall >= config.wallOffset,
          isOccupied: false,
          distanceToWall,
          isCorner,
          clearanceRadius
        };
      }
    }

    return {
      cells,
      resolution,
      bounds,
      width,
      height
    };
  }

  /**
   * Calculate distance from point to nearest wall
   */
  private calculateDistanceToWall(point: Vector3, wallSegments: WallSegment[]): number {
    let minDistance = Infinity;
    
    for (const wall of wallSegments) {
      const distance = this.distancePointToLineSegment(point, wall.start, wall.end);
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
  }

  /**
   * Calculate distance from point to line segment
   */
  private distancePointToLineSegment(point: Vector3, lineStart: Vector3, lineEnd: Vector3): number {
    const lineVec = lineEnd.subtract(lineStart);
    const pointVec = point.subtract(lineStart);
    
    const lineLength = lineVec.length();
    if (lineLength === 0) return Vector3.Distance(point, lineStart);
    
    const t = Math.max(0, Math.min(1, Vector3.Dot(pointVec, lineVec) / (lineLength * lineLength)));
    const projection = lineStart.add(lineVec.scale(t));
    
    return Vector3.Distance(point, projection);
  }

  /**
   * Calculate available clearance around a position
   */
  private calculateAvailableClearance(position: Vector3, roomBounds: RoomBounds, config: SpaceOptimizationConfig): number {
    const maxClearance = Math.max(config.minClearance, config.accessClearance) + 1.0;
    
    // Check clearance in multiple directions
    const testDirections = [
      new Vector3(1, 0, 0),   // East
      new Vector3(-1, 0, 0),  // West
      new Vector3(0, 0, 1),   // North
      new Vector3(0, 0, -1),  // South
      new Vector3(0.707, 0, 0.707),   // NE
      new Vector3(-0.707, 0, 0.707),  // NW
      new Vector3(0.707, 0, -0.707),  // SE
      new Vector3(-0.707, 0, -0.707)  // SW
    ];

    let minClearance = maxClearance;

    for (const direction of testDirections) {
      // Test clearance in this direction
      for (let distance = 0.1; distance <= maxClearance; distance += 0.1) {
        const testPoint = position.add(direction.scale(distance));
        
        // Check if still inside room
        if (!isPointInPolygon({ x: testPoint.x, z: testPoint.z }, roomBounds.floorPolygon)) {
          minClearance = Math.min(minClearance, distance);
          break;
        }
      }
    }

    return minClearance;
  }

  /**
   * Filter valid placement positions based on configuration
   */
  private filterValidPositions(grid: PlacementGrid, roomBounds: RoomBounds, config: SpaceOptimizationConfig): GridCell[] {
    const validCells: GridCell[] = [];

    for (let i = 0; i < grid.width; i++) {
      for (let j = 0; j < grid.height; j++) {
        const cell = grid.cells[i][j];
        
        if (!cell.isValid || cell.isOccupied) continue;
        
        // Check minimum clearance requirement
        if (cell.clearanceRadius < config.minClearance) continue;
        
        // Check corner usage preference
        if (cell.isCorner && !config.cornerUsage) continue;
        
        // Check wall offset
        if (cell.distanceToWall < config.wallOffset) continue;
        
        validCells.push(cell);
      }
    }

    return validCells;
  }

  /**
   * Generate optimal layouts based on strategy
   */
  private generateOptimalLayouts(
    validPositions: GridCell[],
    roomBounds: RoomBounds,
    config: SpaceOptimizationConfig,
    strategy: OptimizationStrategy
  ): PlacementLayout[] {
    const layouts: PlacementLayout[] = [];
    const occupiedPositions = new Set<string>();

    // Sort positions based on strategy
    const sortedPositions = this.sortPositionsByStrategy(validPositions, roomBounds, strategy);

    for (const position of sortedPositions) {
      const positionKey = `${position.x},${position.z}`;
      
      if (occupiedPositions.has(positionKey)) continue;
      
      // Check if this position conflicts with existing placements
      if (this.hasConflictWithExistingPlacements(position, layouts, config)) continue;
      
      // Create placement layout
      const layout: PlacementLayout = {
        id: `${config.objectType}-${layouts.length + 1}`,
        position: position.worldPos.clone(),
        rotation: this.calculateOptimalRotation(position, roomBounds, config),
        clearanceRadius: Math.max(config.minClearance, config.accessClearance),
        accessZones: this.generateAccessZones(position, config)
      };

      layouts.push(layout);
      
      // Mark occupied area
      this.markOccupiedArea(position, config, occupiedPositions, validPositions);
    }

    return layouts;
  }

  /**
   * Sort positions based on optimization strategy
   */
  private sortPositionsByStrategy(
    positions: GridCell[],
    roomBounds: RoomBounds,
    strategy: OptimizationStrategy
  ): GridCell[] {
    const sortedPositions = [...positions];

    switch (strategy.priority) {
      case 'maximize':
        // Prioritize positions that allow maximum packing
        return sortedPositions.sort((a, b) => {
          // Prefer corners and walls for better packing
          const aScore = (a.isCorner ? 2 : 0) + (a.distanceToWall < 0.5 ? 1 : 0);
          const bScore = (b.isCorner ? 2 : 0) + (b.distanceToWall < 0.5 ? 1 : 0);
          return bScore - aScore;
        });

      case 'comfort':
        // Prioritize positions with more clearance
        return sortedPositions.sort((a, b) => b.clearanceRadius - a.clearanceRadius);

      case 'ergonomic':
        // Prioritize positions away from high-traffic areas
        return sortedPositions.sort((a, b) => {
          const aCenterDist = Vector3.Distance(a.worldPos, roomBounds.center);
          const bCenterDist = Vector3.Distance(b.worldPos, roomBounds.center);
          return bCenterDist - aCenterDist; // Prefer edges for ergonomics
        });

      case 'aesthetic':
        // Prioritize symmetric and balanced placements
        return sortedPositions.sort((a, b) => {
          const aCenterDist = Vector3.Distance(a.worldPos, roomBounds.center);
          const bCenterDist = Vector3.Distance(b.worldPos, roomBounds.center);
          return Math.abs(aCenterDist - bCenterDist); // Prefer balanced distribution
        });

      default:
        return sortedPositions;
    }
  }

  /**
   * Check if position conflicts with existing placements
   */
  private hasConflictWithExistingPlacements(
    position: GridCell,
    existingLayouts: PlacementLayout[],
    config: SpaceOptimizationConfig
  ): boolean {
    const requiredClearance = Math.max(config.minClearance, config.accessClearance);

    for (const layout of existingLayouts) {
      const distance = Vector3.Distance(position.worldPos, layout.position);
      const combinedClearance = requiredClearance + layout.clearanceRadius;
      
      if (distance < combinedClearance) {
        return true; // Conflict detected
      }
    }

    return false;
  }

  /**
   * Calculate optimal rotation for object at position
   */
  private calculateOptimalRotation(
    position: GridCell,
    roomBounds: RoomBounds,
    config: SpaceOptimizationConfig
  ): Vector3 {
    // For objects with directional access (like desks), orient toward room center
    if (config.accessClearance > config.minClearance) {
      const toCenter = roomBounds.center.subtract(position.worldPos);
      toCenter.y = 0;
      toCenter.normalize();
      
      const angle = Math.atan2(toCenter.x, toCenter.z);
      return new Vector3(0, angle, 0);
    }

    // Default rotation
    return Vector3.Zero();
  }

  /**
   * Generate access zones for an object placement
   */
  private generateAccessZones(position: GridCell, config: SpaceOptimizationConfig): AccessZone[] {
    const zones: AccessZone[] = [];

    // Front access zone (primary)
    if (config.accessClearance > 0) {
      zones.push({
        center: position.worldPos.add(new Vector3(0, 0, config.accessClearance / 2)),
        radius: config.accessClearance,
        type: 'front',
        required: true
      });
    }

    // Side clearance zones
    if (config.minClearance > 0) {
      zones.push({
        center: position.worldPos.add(new Vector3(config.minClearance / 2, 0, 0)),
        radius: config.minClearance,
        type: 'side',
        required: false
      });

      zones.push({
        center: position.worldPos.add(new Vector3(-config.minClearance / 2, 0, 0)),
        radius: config.minClearance,
        type: 'side',
        required: false
      });
    }

    return zones;
  }

  /**
   * Mark area around placement as occupied
   */
  private markOccupiedArea(
    position: GridCell,
    config: SpaceOptimizationConfig,
    occupiedPositions: Set<string>,
    allPositions: GridCell[]
  ): void {
    const clearanceRadius = Math.max(config.minClearance, config.accessClearance);
    const gridResolution = config.gridResolution;
    const clearanceCells = Math.ceil(clearanceRadius / gridResolution);

    // Mark cells within clearance radius as occupied
    for (const cell of allPositions) {
      const distance = Vector3.Distance(cell.worldPos, position.worldPos);
      if (distance <= clearanceRadius) {
        const key = `${cell.x},${cell.z}`;
        occupiedPositions.add(key);
      }
    }
  }

  /**
   * Calculate space utilization efficiency
   */
  private calculateSpaceEfficiency(layouts: PlacementLayout[], roomBounds: RoomBounds): number {
    if (layouts.length === 0) return 0;

    // Calculate total area used by objects and their clearances
    let usedArea = 0;
    for (const layout of layouts) {
      const clearanceArea = Math.PI * layout.clearanceRadius * layout.clearanceRadius;
      usedArea += clearanceArea;
    }

    return Math.min(1.0, usedArea / roomBounds.usableArea);
  }

  /**
   * Generate warnings about the layout
   */
  private generateWarnings(
    layouts: PlacementLayout[],
    roomBounds: RoomBounds,
    config: SpaceOptimizationConfig
  ): string[] {
    const warnings: string[] = [];

    if (layouts.length === 0) {
      warnings.push('No valid placements found. Room may be too small or constraints too strict.');
    }

    // Check for crowded conditions
    const efficiency = this.calculateSpaceEfficiency(layouts, roomBounds);
    if (efficiency > 0.8) {
      warnings.push('Space utilization is very high. Consider reducing objects for better comfort.');
    }

    // Check for accessibility issues
    const hasAccessibilityIssues = layouts.some(layout => 
      layout.accessZones.some(zone => zone.required && zone.radius < 0.9)
    );
    if (hasAccessibilityIssues) {
      warnings.push('Some placements may not meet accessibility requirements (minimum 90cm pathways).');
    }

    return warnings;
  }

  /**
   * Generate alternative layout arrangements
   */
  private generateAlternativeLayouts(
    validPositions: GridCell[],
    roomBounds: RoomBounds,
    config: SpaceOptimizationConfig
  ): PlacementLayout[][] {
    const alternatives: PlacementLayout[][] = [];

    // Generate layouts with different strategies
    const strategies: OptimizationStrategy[] = [
      { name: 'comfort', priority: 'comfort', description: 'Prioritize comfort and spacing' },
      { name: 'ergonomic', priority: 'ergonomic', description: 'Optimize for ergonomics' },
      { name: 'aesthetic', priority: 'aesthetic', description: 'Balanced and visually appealing' }
    ];

    for (const strategy of strategies) {
      const layout = this.generateOptimalLayouts(validPositions, roomBounds, config, strategy);
      if (layout.length > 0) {
        alternatives.push(layout);
      }
    }

    return alternatives;
  }

  /**
   * Get default configuration for an object type
   */
  public getDefaultConfig(objectType: string): SpaceOptimizationConfig | undefined {
    return this.defaultConfigs.get(objectType);
  }

  /**
   * Add or update configuration for an object type
   */
  public setObjectConfig(objectType: string, config: SpaceOptimizationConfig): void {
    this.defaultConfigs.set(objectType, config);
  }
}

// Export singleton instance
export const spaceOptimizer = new SpaceOptimizer(); 