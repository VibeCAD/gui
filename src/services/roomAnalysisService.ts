import { Vector3, Mesh } from 'babylonjs';
import type { SceneObject } from '../types/types';
import { calculateRoomArea } from '../algorithms/spaceOptimizationUtils';

export interface RoomConstraint {
  id: string;
  type: 'wall' | 'door' | 'window' | 'obstacle' | 'existing-object' | 'utility';
  position: Vector3;
  dimensions: { width: number; height: number; depth: number };
  clearanceRequired: number; // Minimum clearance from this constraint
  blocksPlacement: boolean; // Whether objects can be placed here
  affectsAccess: boolean; // Whether this affects accessibility paths
  priority: 'critical' | 'high' | 'medium' | 'low'; // Constraint importance
  metadata?: {
    isLoadBearing?: boolean;
    hasElectricalOutlet?: boolean;
    hasPlumbing?: boolean;
    isFireExit?: boolean;
    description?: string;
  };
}

export interface PlacementZone {
  id: string;
  type: 'optimal' | 'good' | 'acceptable' | 'poor' | 'restricted';
  polygon: { x: number; z: number }[]; // Zone boundary
  center: Vector3;
  area: number;
  accessibilityScore: number; // 0-1, how accessible this zone is
  clearanceScore: number; // 0-1, how much clearance is available
  wallProximity: number; // Distance to nearest wall
  constraints: string[]; // IDs of affecting constraints
  recommendedFor: string[]; // Object types that work well here
  restrictions: string[]; // Limitations or warnings
}

export interface AccessibilityPath {
  id: string;
  start: Vector3;
  end: Vector3;
  width: number;
  clearance: number;
  isRequired: boolean; // ADA/accessibility requirement
  blockedBy: string[]; // Constraint IDs that block this path
  alternativeRoutes: Vector3[][]; // Alternative path options
}

export interface RoomAnalysisResult {
  roomId: string;
  roomGeometry: {
    floorPolygon: { x: number; z: number }[];
    area: number;
    perimeter: number;
    corners: Vector3[];
    boundingBox: { min: Vector3; max: Vector3 };
  };
  constraints: RoomConstraint[];
  placementZones: PlacementZone[];
  accessibilityPaths: AccessibilityPath[];
  spaceUtilization: {
    totalArea: number;
    usableArea: number;
    restrictedArea: number;
    accessArea: number; // Area needed for circulation
    efficiency: number; // Usable / total
  };
  recommendations: {
    optimalFurnitureTypes: string[];
    layoutSuggestions: string[];
    accessibilityNotes: string[];
    constraints: string[];
  };
}

/**
 * Room Analysis Service - comprehensive room space and constraint analysis
 */
export class RoomAnalysisService {

  /**
   * Perform comprehensive room analysis
   */
  public analyzeRoom(
    roomMesh: Mesh, 
    sceneObjects: SceneObject[],
    roomId: string
  ): RoomAnalysisResult {
    console.log(`🏠 Analyzing room: ${roomId}`);
    
    // Extract room geometry
    const roomGeometry = this.extractRoomGeometry(roomMesh);
    
    // Identify constraints
    const constraints = this.identifyConstraints(roomMesh, sceneObjects, roomGeometry);
    
    // Generate placement zones
    const placementZones = this.generatePlacementZones(roomGeometry, constraints);
    
    // Analyze accessibility paths
    const accessibilityPaths = this.analyzeAccessibilityPaths(roomGeometry, constraints, placementZones);
    
    // Calculate space utilization
    const spaceUtilization = this.calculateSpaceUtilization(roomGeometry, constraints, placementZones);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(roomGeometry, constraints, placementZones, spaceUtilization);
    
    const result: RoomAnalysisResult = {
      roomId,
      roomGeometry,
      constraints,
      placementZones,
      accessibilityPaths,
      spaceUtilization,
      recommendations
    };

    console.log(`✅ Room analysis complete: ${placementZones.length} zones, ${constraints.length} constraints`);
    
    return result;
  }

  /**
   * Extract room geometry information
   */
  private extractRoomGeometry(roomMesh: Mesh): RoomAnalysisResult['roomGeometry'] {
    const floorPolygon = roomMesh.metadata?.floorPolygon || [];
    
    if (floorPolygon.length === 0) {
      throw new Error('Room mesh missing floor polygon metadata');
    }

    const area = calculateRoomArea(floorPolygon);
    const perimeter = this.calculatePerimeter(floorPolygon);
    const corners = floorPolygon.map((p: { x: number; z: number }) => new Vector3(p.x, 0, p.z));
    const boundingBox = this.calculateBoundingBox(corners);

    return {
      floorPolygon,
      area,
      perimeter,
      corners,
      boundingBox
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
   * Calculate bounding box from corners
   */
  private calculateBoundingBox(corners: Vector3[]): { min: Vector3; max: Vector3 } {
    if (corners.length === 0) {
      return { min: Vector3.Zero(), max: Vector3.Zero() };
    }

    let minX = corners[0].x, maxX = corners[0].x;
    let minZ = corners[0].z, maxZ = corners[0].z;

    for (const corner of corners) {
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minZ = Math.min(minZ, corner.z);
      maxZ = Math.max(maxZ, corner.z);
    }

    return {
      min: new Vector3(minX, 0, minZ),
      max: new Vector3(maxX, 2.5, maxZ) // Assume 2.5m ceiling height
    };
  }

  /**
   * Identify constraints in the room
   */
  private identifyConstraints(
    roomMesh: Mesh, 
    sceneObjects: SceneObject[], 
    roomGeometry: RoomAnalysisResult['roomGeometry']
  ): RoomConstraint[] {
    const constraints: RoomConstraint[] = [];

    // Add wall constraints (from room perimeter)
    constraints.push(...this.generateWallConstraints(roomGeometry));

    // Add existing object constraints
    constraints.push(...this.generateObjectConstraints(sceneObjects, roomGeometry));

    // Add door and window constraints (if metadata available)
    constraints.push(...this.generateArchitecturalConstraints(roomMesh));

    return constraints;
  }

  /**
   * Generate wall constraints from room perimeter
   */
  private generateWallConstraints(roomGeometry: RoomAnalysisResult['roomGeometry']): RoomConstraint[] {
    const constraints: RoomConstraint[] = [];
    const { floorPolygon } = roomGeometry;

    for (let i = 0; i < floorPolygon.length; i++) {
      const current = floorPolygon[i];
      const next = floorPolygon[(i + 1) % floorPolygon.length];
      
      // Calculate wall segment
      const wallStart = new Vector3(current.x, 0, current.z);
      const wallEnd = new Vector3(next.x, 0, next.z);
      const wallCenter = wallStart.add(wallEnd).scale(0.5);
      const wallLength = Vector3.Distance(wallStart, wallEnd);

      constraints.push({
        id: `wall-${i}`,
        type: 'wall',
        position: wallCenter,
        dimensions: { width: wallLength, height: 2.5, depth: 0.2 },
        clearanceRequired: 0.3, // 30cm from walls
        blocksPlacement: true,
        affectsAccess: false,
        priority: 'critical',
        metadata: {
          isLoadBearing: true,
          description: `Wall segment ${i + 1}`
        }
      });
    }

    return constraints;
  }

  /**
   * Generate constraints from existing objects
   */
  private generateObjectConstraints(
    sceneObjects: SceneObject[], 
    roomGeometry: RoomAnalysisResult['roomGeometry']
  ): RoomConstraint[] {
    const constraints: RoomConstraint[] = [];

    for (const obj of sceneObjects) {
      // Skip the room itself
      if (obj.type === 'custom-room') continue;

      // Check if object is inside this room
      if (!this.isPointInRoom(obj.position, roomGeometry.floorPolygon)) continue;

      // Extract object dimensions
      const dimensions = this.extractObjectDimensions(obj);
      
      // Determine clearance based on object type
      const clearance = this.getObjectClearance(obj.type);

      constraints.push({
        id: `object-${obj.id}`,
        type: 'existing-object',
        position: obj.position.clone(),
        dimensions,
        clearanceRequired: clearance,
        blocksPlacement: true,
        affectsAccess: true,
        priority: 'high',
        metadata: {
          description: `${obj.type} object: ${obj.id}`
        }
      });
    }

    return constraints;
  }

  /**
   * Generate architectural constraints (doors, windows)
   */
  private generateArchitecturalConstraints(roomMesh: Mesh): RoomConstraint[] {
    const constraints: RoomConstraint[] = [];
    
    // Check for door/window metadata
    const doors = roomMesh.metadata?.doors || [];
    const windows = roomMesh.metadata?.windows || [];

    // Add door constraints
    for (let i = 0; i < doors.length; i++) {
      const door = doors[i];
      constraints.push({
        id: `door-${i}`,
        type: 'door',
        position: new Vector3(door.x || 0, 0, door.z || 0),
        dimensions: { width: door.width || 0.9, height: 2.0, depth: 0.05 },
        clearanceRequired: 1.2, // Door swing clearance
        blocksPlacement: true,
        affectsAccess: true,
        priority: 'critical',
        metadata: {
          isFireExit: door.isFireExit || false,
          description: door.description || `Door ${i + 1}`
        }
      });
    }

    // Add window constraints
    for (let i = 0; i < windows.length; i++) {
      const window = windows[i];
      constraints.push({
        id: `window-${i}`,
        type: 'window',
        position: new Vector3(window.x || 0, 1.0, window.z || 0),
        dimensions: { width: window.width || 1.2, height: 0.8, depth: 0.05 },
        clearanceRequired: 0.5, // Access for cleaning/opening
        blocksPlacement: false, // Windows don't block floor placement
        affectsAccess: false,
        priority: 'medium',
        metadata: {
          description: window.description || `Window ${i + 1}`
        }
      });
    }

    return constraints;
  }

  /**
   * Generate placement zones based on room geometry and constraints
   */
  private generatePlacementZones(
    roomGeometry: RoomAnalysisResult['roomGeometry'], 
    constraints: RoomConstraint[]
  ): PlacementZone[] {
    const zones: PlacementZone[] = [];
    const { floorPolygon, boundingBox } = roomGeometry;

    // Create grid for zone analysis
    const gridSize = 0.5; // 50cm grid resolution
    const minX = boundingBox.min.x;
    const maxX = boundingBox.max.x;
    const minZ = boundingBox.min.z;
    const maxZ = boundingBox.max.z;

    // Analyze grid points
    const gridPoints: { x: number; z: number; score: number; type: PlacementZone['type'] }[] = [];

    for (let x = minX; x <= maxX; x += gridSize) {
      for (let z = minZ; z <= maxZ; z += gridSize) {
        const point = { x, z };
        
        // Check if point is in room
        if (!this.isPointInRoom(new Vector3(x, 0, z), floorPolygon)) continue;

        // Calculate zone score
        const analysis = this.analyzeGridPoint(point, constraints, roomGeometry);
        gridPoints.push({
          x, z,
          score: analysis.score,
          type: analysis.type
        });
      }
    }

    // Group grid points into zones
    const zoneGroups = this.groupGridPointsIntoZones(gridPoints, gridSize);

    // Convert zone groups to placement zones
    for (let i = 0; i < zoneGroups.length; i++) {
      const group = zoneGroups[i];
      if (group.length === 0) continue;

      const zone = this.createPlacementZoneFromGroup(group, constraints, i);
      zones.push(zone);
    }

    return zones;
  }

  /**
   * Analyze a grid point for placement suitability
   */
  private analyzeGridPoint(
    point: { x: number; z: number }, 
    constraints: RoomConstraint[],
    roomGeometry: RoomAnalysisResult['roomGeometry']
  ): { score: number; type: PlacementZone['type'] } {
    let score = 1.0;
    let type: PlacementZone['type'] = 'optimal';

    const position = new Vector3(point.x, 0, point.z);

    // Check distance to constraints
    for (const constraint of constraints) {
      const distance = Vector3.Distance(position, constraint.position);
      const requiredClearance = constraint.clearanceRequired;

      if (distance < requiredClearance) {
        if (constraint.blocksPlacement) {
          score = 0; // Blocked
          type = 'restricted';
          break;
        } else {
          score *= 0.5; // Reduced score
        }
      } else if (distance < requiredClearance * 2) {
        score *= 0.8; // Slightly reduced
      }

      // Bonus for being near walls (for certain furniture)
      if (constraint.type === 'wall' && distance > requiredClearance && distance < 1.0) {
        score *= 1.1;
      }
    }

    // Determine type based on score
    if (score >= 0.8) type = 'optimal';
    else if (score >= 0.6) type = 'good';
    else if (score >= 0.4) type = 'acceptable';
    else if (score > 0) type = 'poor';
    else type = 'restricted';

    return { score, type };
  }

  /**
   * Group grid points into contiguous zones
   */
  private groupGridPointsIntoZones(
    gridPoints: { x: number; z: number; score: number; type: PlacementZone['type'] }[],
    gridSize: number
  ): { x: number; z: number; score: number; type: PlacementZone['type'] }[][] {
    const groups: { x: number; z: number; score: number; type: PlacementZone['type'] }[][] = [];
    const visited = new Set<string>();

    for (const point of gridPoints) {
      const key = `${point.x},${point.z}`;
      if (visited.has(key) || point.type === 'restricted') continue;

      // Start new group
      const group: { x: number; z: number; score: number; type: PlacementZone['type'] }[] = [];
      const queue = [point];
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentKey = `${current.x},${current.z}`;
        
        if (visited.has(currentKey)) continue;
        visited.add(currentKey);
        group.push(current);

        // Find adjacent points of same type
        for (const neighbor of gridPoints) {
          const neighborKey = `${neighbor.x},${neighbor.z}`;
          if (visited.has(neighborKey)) continue;
          
          const distance = Math.sqrt(
            Math.pow(neighbor.x - current.x, 2) + 
            Math.pow(neighbor.z - current.z, 2)
          );
          
          if (distance <= gridSize * 1.5 && neighbor.type === current.type) {
            queue.push(neighbor);
          }
        }
      }

      if (group.length >= 4) { // Minimum zone size
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Create placement zone from grid point group
   */
  private createPlacementZoneFromGroup(
    group: { x: number; z: number; score: number; type: PlacementZone['type'] }[],
    constraints: RoomConstraint[],
    index: number
  ): PlacementZone {
    // Calculate zone polygon (simplified as bounding box for now)
    const minX = Math.min(...group.map(p => p.x));
    const maxX = Math.max(...group.map(p => p.x));
    const minZ = Math.min(...group.map(p => p.z));
    const maxZ = Math.max(...group.map(p => p.z));

    const polygon = [
      { x: minX, z: minZ },
      { x: maxX, z: minZ },
      { x: maxX, z: maxZ },
      { x: minX, z: maxZ }
    ];

    const center = new Vector3(
      (minX + maxX) / 2,
      0,
      (minZ + maxZ) / 2
    );

    const area = (maxX - minX) * (maxZ - minZ);
    const avgScore = group.reduce((sum, p) => sum + p.score, 0) / group.length;
    const type = group[0].type; // Use first point's type

    // Find nearest wall
    const wallConstraints = constraints.filter(c => c.type === 'wall');
    const wallDistances = wallConstraints.map(wall => Vector3.Distance(center, wall.position));
    const wallProximity = Math.min(...wallDistances);

    // Determine what objects this zone is good for
    const recommendedFor: string[] = [];
    if (type === 'optimal' || type === 'good') {
      if (wallProximity < 1.0) {
        recommendedFor.push('Desk', 'Bookcase', 'TV');
      }
      if (area > 4.0) {
        recommendedFor.push('Table', 'Sofa');
      }
      recommendedFor.push('Chair');
    }

    return {
      id: `zone-${index}`,
      type,
      polygon,
      center,
      area,
      accessibilityScore: avgScore,
      clearanceScore: avgScore,
      wallProximity,
      constraints: constraints
        .filter(c => Vector3.Distance(center, c.position) < 2.0)
        .map(c => c.id),
      recommendedFor,
      restrictions: type === 'poor' ? ['Limited clearance'] : []
    };
  }

  /**
   * Analyze accessibility paths
   */
  private analyzeAccessibilityPaths(
    roomGeometry: RoomAnalysisResult['roomGeometry'],
    constraints: RoomConstraint[],
    placementZones: PlacementZone[]
  ): AccessibilityPath[] {
    const paths: AccessibilityPath[] = [];

    // Find door constraints (entry/exit points)
    const doors = constraints.filter(c => c.type === 'door');
    
    if (doors.length === 0) {
      // No doors found, create default entry at room center
      const center = new Vector3(
        (roomGeometry.boundingBox.min.x + roomGeometry.boundingBox.max.x) / 2,
        0,
        roomGeometry.boundingBox.min.z
      );
      doors.push({
        id: 'default-entry',
        type: 'door',
        position: center,
        dimensions: { width: 0.9, height: 2.0, depth: 0.05 },
        clearanceRequired: 1.2,
        blocksPlacement: true,
        affectsAccess: true,
        priority: 'critical'
      });
    }

    // Create paths from doors to each placement zone
    for (const door of doors) {
      for (let i = 0; i < placementZones.length; i++) {
        const zone = placementZones[i];
        
        const path: AccessibilityPath = {
          id: `path-${door.id}-zone-${i}`,
          start: door.position.clone(),
          end: zone.center.clone(),
          width: 0.9, // Standard accessibility width
          clearance: 0.9,
          isRequired: true,
          blockedBy: this.findPathBlockages(door.position, zone.center, constraints),
          alternativeRoutes: [] // Could be enhanced with pathfinding
        };

        paths.push(path);
      }
    }

    return paths;
  }

  /**
   * Find constraints that block a path
   */
  private findPathBlockages(start: Vector3, end: Vector3, constraints: RoomConstraint[]): string[] {
    const blockedBy: string[] = [];
    
    // Simple line intersection check (could be enhanced)
    for (const constraint of constraints) {
      if (!constraint.blocksPlacement) continue;
      
      const distance = this.distancePointToLine(constraint.position, start, end);
      if (distance < constraint.clearanceRequired) {
        blockedBy.push(constraint.id);
      }
    }

    return blockedBy;
  }

  /**
   * Calculate distance from point to line segment
   */
  private distancePointToLine(point: Vector3, lineStart: Vector3, lineEnd: Vector3): number {
    const lineVec = lineEnd.subtract(lineStart);
    const pointVec = point.subtract(lineStart);
    const lineLength = lineVec.length();
    
    if (lineLength === 0) return Vector3.Distance(point, lineStart);
    
    const t = Math.max(0, Math.min(1, Vector3.Dot(pointVec, lineVec) / (lineLength * lineLength)));
    const projection = lineStart.add(lineVec.scale(t));
    
    return Vector3.Distance(point, projection);
  }

  /**
   * Calculate space utilization metrics
   */
  private calculateSpaceUtilization(
    roomGeometry: RoomAnalysisResult['roomGeometry'],
    constraints: RoomConstraint[],
    placementZones: PlacementZone[]
  ): RoomAnalysisResult['spaceUtilization'] {
    const totalArea = roomGeometry.area;
    
    // Calculate restricted area (blocked by constraints)
    const restrictedArea = constraints
      .filter(c => c.blocksPlacement)
      .reduce((sum, c) => sum + (c.dimensions.width * c.dimensions.depth), 0);
    
    // Calculate usable area from placement zones
    const usableArea = placementZones
      .filter(z => z.type !== 'restricted')
      .reduce((sum, z) => sum + z.area, 0);
    
    // Estimate access area (circulation space)
    const accessArea = totalArea * 0.2; // 20% for circulation
    
    const efficiency = totalArea > 0 ? usableArea / totalArea : 0;

    return {
      totalArea,
      usableArea,
      restrictedArea,
      accessArea,
      efficiency
    };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    roomGeometry: RoomAnalysisResult['roomGeometry'],
    constraints: RoomConstraint[],
    placementZones: PlacementZone[],
    spaceUtilization: RoomAnalysisResult['spaceUtilization']
  ): RoomAnalysisResult['recommendations'] {
    const recommendations: RoomAnalysisResult['recommendations'] = {
      optimalFurnitureTypes: [],
      layoutSuggestions: [],
      accessibilityNotes: [],
      constraints: []
    };

    // Analyze optimal furniture types
    const optimalZones = placementZones.filter(z => z.type === 'optimal' || z.type === 'good');
    const furnitureTypes = new Set<string>();
    
    optimalZones.forEach(zone => {
      zone.recommendedFor.forEach(type => furnitureTypes.add(type));
    });
    
    recommendations.optimalFurnitureTypes = Array.from(furnitureTypes);

    // Layout suggestions
    if (roomGeometry.area < 10) {
      recommendations.layoutSuggestions.push('Small room: Consider wall-mounted or compact furniture');
    } else if (roomGeometry.area > 30) {
      recommendations.layoutSuggestions.push('Large room: Can accommodate multiple furniture groupings');
    }

    if (constraints.some(c => c.type === 'window')) {
      recommendations.layoutSuggestions.push('Position seating to take advantage of natural light');
    }

    // Accessibility notes
    const doorConstraints = constraints.filter(c => c.type === 'door');
    if (doorConstraints.length === 1) {
      recommendations.accessibilityNotes.push('Single entry point: Ensure clear path from door');
    }

    if (spaceUtilization.efficiency < 0.6) {
      recommendations.accessibilityNotes.push('Low space efficiency: Consider smaller furniture or better layout');
    }

    // Constraint warnings
    const criticalConstraints = constraints.filter(c => c.priority === 'critical');
    if (criticalConstraints.length > 0) {
      recommendations.constraints.push(`${criticalConstraints.length} critical constraints affecting placement`);
    }

    return recommendations;
  }

  /**
   * Helper: Check if point is inside room polygon
   */
  private isPointInRoom(point: Vector3, polygon: { x: number; z: number }[]): boolean {
    const x = point.x;
    const z = point.z;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, zi = polygon[i].z;
      const xj = polygon[j].x, zj = polygon[j].z;

      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Helper: Extract object dimensions from scene object
   */
  private extractObjectDimensions(obj: SceneObject): { width: number; height: number; depth: number } {
    // Use bounding box if available, otherwise estimate from scale
    if (obj.mesh) {
      const boundingInfo = obj.mesh.getBoundingInfo();
      const min = boundingInfo.boundingBox.minimumWorld;
      const max = boundingInfo.boundingBox.maximumWorld;
      
      return {
        width: Math.abs(max.x - min.x),
        height: Math.abs(max.y - min.y),
        depth: Math.abs(max.z - min.z)
      };
    }

    // Fallback to default dimensions with scale
    const defaults = { width: 1, height: 1, depth: 1 };
    return {
      width: defaults.width * obj.scale.x,
      height: defaults.height * obj.scale.y,
      depth: defaults.depth * obj.scale.z
    };
  }

  /**
   * Helper: Get clearance requirement for object type
   */
  private getObjectClearance(objectType: string): number {
    const clearances: { [key: string]: number } = {
      'Desk': 1.2,
      'Chair': 0.8,
      'Table': 1.0,
      'Sofa': 1.0,
      'Bed Single': 0.8,
      'Bed Double': 1.0,
      'Bookcase': 0.9,
      'TV': 0.5
    };

    return clearances[objectType] || 0.6;
  }
}

// Export singleton instance
export const roomAnalysisService = new RoomAnalysisService(); 