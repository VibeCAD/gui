import { Vector3, Mesh } from 'babylonjs';
import type { SceneObject } from '../types/types';

export interface FurnitureSpec {
  id: string;
  name: string;
  type: string; // GLB object type or primitive type
  category: 'desk' | 'seating' | 'storage' | 'bed' | 'appliance' | 'table' | 'lighting' | 'other';
  
  // Physical dimensions (extracted from mesh or estimated)
  dimensions: {
    width: number;   // X dimension
    height: number;  // Y dimension
    depth: number;   // Z dimension
  };
  
  // Space requirements around the object
  clearanceRequirements: {
    front: number;    // Primary access/interaction space
    back: number;     // Back clearance (cables, ventilation)
    left: number;     // Left side clearance
    right: number;    // Right side clearance
    access: number;   // Overall access zone radius
  };
  
  // Usage patterns and behavior
  usagePattern: {
    primaryDirection: Vector3;     // Which way the "front" faces
    accessPoints: Vector3[];       // Key interaction points
    groupingRules: string[];       // How it can be grouped with others
    wallPlacement: 'required' | 'optional' | 'avoid'; // Wall relationship
  };
  
  // Placement constraints
  constraints: {
    cornerPlacement: boolean;      // Can be placed in corners
    requiresElectricity: boolean;  // Needs power outlet nearby
    requiresPlumbing: boolean;     // Needs water connection
    minRoomSize: number;          // Minimum room dimension needed
    maxQuantityPerRoom?: number;   // Limit per room (e.g., 1 bed per bedroom)
  };
  
  // Additional metadata
  metadata: {
    description: string;
    tags: string[];
    estimatedCost?: number;
    weight?: number;
    material?: string;
  };
}

export interface FurniturePlacementRule {
  objectType: string;
  rules: {
    spacing: {
      minDistance: number;        // Minimum distance from walls
      preferredDistance: number;  // Optimal distance from walls
      clearanceZones: {
        front: number;
        back: number;
        sides: number;
      };
    };
    orientation: {
      preferredFacing: 'wall' | 'center' | 'window' | 'door' | 'flexible';
      allowedRotations: number[]; // Allowed Y rotations in radians
    };
    grouping: {
      canGroup: boolean;
      groupSpacing: number;       // Distance between grouped items
      maxGroupSize: number;
    };
  };
}

/**
 * Furniture Database - manages furniture specifications and space requirements
 */
export class FurnitureDatabase {
  private furniture = new Map<string, FurnitureSpec>();
  private placementRules = new Map<string, FurniturePlacementRule>();

  constructor() {
    this.initializeDatabase();
  }

  /**
   * Initialize the database with known furniture specifications
   */
  private initializeDatabase(): void {
    // Office furniture
    this.addFurniture({
      id: 'Desk',
      name: 'Office Desk',
      type: 'Desk',
      category: 'desk',
      dimensions: { width: 1.2, height: 0.75, depth: 0.6 },
      clearanceRequirements: { front: 1.2, back: 0.3, left: 0.3, right: 0.3, access: 1.5 },
      usagePattern: {
        primaryDirection: new Vector3(0, 0, -1), // Faces user (south)
        accessPoints: [new Vector3(0, 0, -0.8)], // Chair position
        groupingRules: ['linear', 'cluster'],
        wallPlacement: 'optional'
      },
      constraints: {
        cornerPlacement: true,
        requiresElectricity: true,
        requiresPlumbing: false,
        minRoomSize: 2.5
      },
      metadata: {
        description: 'Standard office desk with storage',
        tags: ['office', 'work', 'storage'],
        estimatedCost: 200
      }
    });

    this.addFurniture({
      id: 'Standing Desk',
      name: 'Height Adjustable Standing Desk',
      type: 'Standing Desk',
      category: 'desk',
      dimensions: { width: 1.4, height: 1.2, depth: 0.7 },
      clearanceRequirements: { front: 1.0, back: 0.3, left: 0.4, right: 0.4, access: 1.3 },
      usagePattern: {
        primaryDirection: new Vector3(0, 0, -1),
        accessPoints: [new Vector3(0, 0, -0.6)],
        groupingRules: ['linear'],
        wallPlacement: 'optional'
      },
      constraints: {
        cornerPlacement: true,
        requiresElectricity: true,
        requiresPlumbing: false,
        minRoomSize: 3.0
      },
      metadata: {
        description: 'Ergonomic height-adjustable desk',
        tags: ['office', 'ergonomic', 'adjustable'],
        estimatedCost: 400
      }
    });

    this.addFurniture({
      id: 'Chair',
      name: 'Office Chair',
      type: 'Chair',
      category: 'seating',
      dimensions: { width: 0.6, height: 1.0, depth: 0.6 },
      clearanceRequirements: { front: 0.3, back: 0.6, left: 0.2, right: 0.2, access: 0.8 },
      usagePattern: {
        primaryDirection: new Vector3(0, 0, 1), // Faces forward
        accessPoints: [new Vector3(0, 0, 0)],
        groupingRules: ['around_table'],
        wallPlacement: 'avoid'
      },
      constraints: {
        cornerPlacement: false,
        requiresElectricity: false,
        requiresPlumbing: false,
        minRoomSize: 1.5
      },
      metadata: {
        description: 'Ergonomic office chair with wheels',
        tags: ['seating', 'office', 'mobile'],
        estimatedCost: 150
      }
    });

    this.addFurniture({
      id: 'Table',
      name: 'Conference Table',
      type: 'Table',
      category: 'table',
      dimensions: { width: 2.0, height: 0.75, depth: 1.0 },
      clearanceRequirements: { front: 0.8, back: 0.8, left: 0.8, right: 0.8, access: 1.2 },
      usagePattern: {
        primaryDirection: new Vector3(0, 0, 1), // Flexible orientation
        accessPoints: [
          new Vector3(0, 0, 0.8),   // North
          new Vector3(0, 0, -0.8),  // South
          new Vector3(0.8, 0, 0),   // East
          new Vector3(-0.8, 0, 0)   // West
        ],
        groupingRules: ['center'],
        wallPlacement: 'avoid'
      },
      constraints: {
        cornerPlacement: false,
        requiresElectricity: false,
        requiresPlumbing: false,
        minRoomSize: 4.0
      },
      metadata: {
        description: 'Large conference table for meetings',
        tags: ['meeting', 'table', 'conference'],
        estimatedCost: 600
      }
    });

    this.addFurniture({
      id: 'Sofa',
      name: 'Three-Seat Sofa',
      type: 'Sofa',
      category: 'seating',
      dimensions: { width: 2.1, height: 0.85, depth: 0.9 },
      clearanceRequirements: { front: 1.0, back: 0.2, left: 0.3, right: 0.3, access: 1.3 },
      usagePattern: {
        primaryDirection: new Vector3(0, 0, 1), // Faces forward
        accessPoints: [new Vector3(0, 0, 1.2)],
        groupingRules: ['L-shape', 'facing'],
        wallPlacement: 'optional'
      },
      constraints: {
        cornerPlacement: true,
        requiresElectricity: false,
        requiresPlumbing: false,
        minRoomSize: 3.5
      },
      metadata: {
        description: 'Comfortable three-seat sofa',
        tags: ['seating', 'living', 'comfort'],
        estimatedCost: 800
      }
    });

    this.addFurniture({
      id: 'Bed Single',
      name: 'Single Bed',
      type: 'Bed Single',
      category: 'bed',
      dimensions: { width: 0.9, height: 0.5, depth: 2.0 },
      clearanceRequirements: { front: 0.8, back: 0.3, left: 0.6, right: 0.6, access: 1.0 },
      usagePattern: {
        primaryDirection: new Vector3(0, 0, 1), // Head toward wall typically
        accessPoints: [
          new Vector3(0.6, 0, 0),   // Right side access
          new Vector3(-0.6, 0, 0)   // Left side access
        ],
        groupingRules: ['parallel'],
        wallPlacement: 'optional'
      },
      constraints: {
        cornerPlacement: true,
        requiresElectricity: false,
        requiresPlumbing: false,
        minRoomSize: 2.5,
        maxQuantityPerRoom: 2
      },
      metadata: {
        description: 'Single bed with mattress',
        tags: ['bed', 'sleep', 'bedroom'],
        estimatedCost: 300
      }
    });

    this.addFurniture({
      id: 'Bookcase',
      name: 'Bookcase',
      type: 'Bookcase',
      category: 'storage',
      dimensions: { width: 0.8, height: 2.0, depth: 0.3 },
      clearanceRequirements: { front: 0.9, back: 0.1, left: 0.1, right: 0.1, access: 1.0 },
      usagePattern: {
        primaryDirection: new Vector3(0, 0, -1), // Front faces outward
        accessPoints: [new Vector3(0, 0, -0.6)],
        groupingRules: ['linear'],
        wallPlacement: 'required'
      },
      constraints: {
        cornerPlacement: true,
        requiresElectricity: false,
        requiresPlumbing: false,
        minRoomSize: 1.5
      },
      metadata: {
        description: 'Tall bookcase with shelves',
        tags: ['storage', 'books', 'display'],
        estimatedCost: 200
      }
    });

    // Add placement rules
    this.initializePlacementRules();
  }

  /**
   * Initialize placement rules for different furniture types
   */
  private initializePlacementRules(): void {
    // Desk placement rules
    this.addPlacementRule('Desk', {
      spacing: {
        minDistance: 0.3,
        preferredDistance: 0.5,
        clearanceZones: { front: 1.2, back: 0.3, sides: 0.3 }
      },
      orientation: {
        preferredFacing: 'wall',
        allowedRotations: [0, Math.PI/2, Math.PI, 3*Math.PI/2]
      },
      grouping: {
        canGroup: true,
        groupSpacing: 1.5,
        maxGroupSize: 6
      }
    });

    // Chair placement rules
    this.addPlacementRule('Chair', {
      spacing: {
        minDistance: 0.2,
        preferredDistance: 0.4,
        clearanceZones: { front: 0.3, back: 0.6, sides: 0.2 }
      },
      orientation: {
        preferredFacing: 'flexible',
        allowedRotations: [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4]
      },
      grouping: {
        canGroup: true,
        groupSpacing: 0.8,
        maxGroupSize: 12
      }
    });

    // Table placement rules
    this.addPlacementRule('Table', {
      spacing: {
        minDistance: 0.8,
        preferredDistance: 1.2,
        clearanceZones: { front: 0.8, back: 0.8, sides: 0.8 }
      },
      orientation: {
        preferredFacing: 'center',
        allowedRotations: [0, Math.PI/2, Math.PI, 3*Math.PI/2]
      },
      grouping: {
        canGroup: false,
        groupSpacing: 2.0,
        maxGroupSize: 1
      }
    });
  }

  /**
   * Add furniture specification to database
   */
  public addFurniture(spec: FurnitureSpec): void {
    this.furniture.set(spec.id, spec);
    console.log(`📚 Added furniture: ${spec.name} (${spec.id})`);
  }

     /**
    * Add placement rule for furniture type
    */
   public addPlacementRule(objectType: string, rules: FurniturePlacementRule['rules']): void {
     this.placementRules.set(objectType, { objectType, rules });
   }

  /**
   * Get furniture specification by ID or type
   */
  public getFurniture(idOrType: string): FurnitureSpec | undefined {
    return this.furniture.get(idOrType);
  }

  /**
   * Get placement rules for furniture type
   */
  public getPlacementRules(objectType: string): FurniturePlacementRule | undefined {
    return this.placementRules.get(objectType);
  }

  /**
   * Extract dimensions from a scene object's mesh
   */
  public extractDimensionsFromMesh(sceneObject: SceneObject): { width: number; height: number; depth: number } {
    console.log(`📏 Extracting dimensions from ${sceneObject.id} (${sceneObject.type})`);

    // If the object has a mesh, use its bounding box
    if (sceneObject.mesh) {
      const mesh = sceneObject.mesh;
      
      // Force update of world matrix
      mesh.computeWorldMatrix(true);
      
      // Get bounding info
      const boundingInfo = mesh.getBoundingInfo();
      const boundingBox = boundingInfo.boundingBox;
      
      // Calculate actual dimensions including scale
      const min = boundingBox.minimumWorld;
      const max = boundingBox.maximumWorld;
      
      const actualDimensions = {
        width: Math.abs(max.x - min.x),
        height: Math.abs(max.y - min.y),
        depth: Math.abs(max.z - min.z)
      };

      console.log(`📦 Extracted dimensions: ${actualDimensions.width.toFixed(2)}×${actualDimensions.height.toFixed(2)}×${actualDimensions.depth.toFixed(2)}`);
      
      return actualDimensions;
    }

    // Fallback: calculate from scale and known base dimensions
    const baseDimensions = this.getBaseDimensions(sceneObject.type);
    const actualDimensions = {
      width: baseDimensions.width * sceneObject.scale.x,
      height: baseDimensions.height * sceneObject.scale.y,
      depth: baseDimensions.depth * sceneObject.scale.z
    };

    console.log(`📏 Calculated dimensions from scale: ${actualDimensions.width.toFixed(2)}×${actualDimensions.height.toFixed(2)}×${actualDimensions.depth.toFixed(2)}`);
    
    return actualDimensions;
  }

  /**
   * Get base dimensions for known object types
   */
  private getBaseDimensions(objectType: string): { width: number; height: number; depth: number } {
    // Check if we have furniture spec for this type
    const spec = this.getFurniture(objectType);
    if (spec) {
      return spec.dimensions;
    }

    // Default dimensions for common types
    const defaults: { [key: string]: { width: number; height: number; depth: number } } = {
      'cube': { width: 2, height: 2, depth: 2 },
      'sphere': { width: 2, height: 2, depth: 2 },
      'cylinder': { width: 2, height: 2, depth: 2 },
      'plane': { width: 2, height: 0.1, depth: 2 },
      
      // GLB objects (estimated if not in database)
      'Desk': { width: 1.2, height: 0.75, depth: 0.6 },
      'Chair': { width: 0.6, height: 1.0, depth: 0.6 },
      'Table': { width: 2.0, height: 0.75, depth: 1.0 },
      'Sofa': { width: 2.1, height: 0.85, depth: 0.9 },
      'TV': { width: 1.2, height: 0.7, depth: 0.15 },
      'Bookcase': { width: 0.8, height: 2.0, depth: 0.3 }
    };

    return defaults[objectType] || { width: 1, height: 1, depth: 1 };
  }

  /**
   * Create furniture specification from scene object
   */
  public createSpecFromSceneObject(sceneObject: SceneObject): FurnitureSpec {
    const actualDimensions = this.extractDimensionsFromMesh(sceneObject);
    
    // Get existing spec as template, or create basic one
    const existingSpec = this.getFurniture(sceneObject.type);
    
    if (existingSpec) {
      // Update existing spec with actual dimensions
      return {
        ...existingSpec,
        id: sceneObject.id,
        name: sceneObject.id,
        dimensions: actualDimensions
      };
    }

    // Create new spec for unknown object type
    return this.createGenericSpec(sceneObject, actualDimensions);
  }

  /**
   * Create generic furniture spec for unknown object types
   */
  private createGenericSpec(sceneObject: SceneObject, dimensions: { width: number; height: number; depth: number }): FurnitureSpec {
    // Estimate category based on dimensions
    const { width, height, depth } = dimensions;
    const volume = width * height * depth;
    
    let category: FurnitureSpec['category'] = 'other';
    let clearance = { front: 0.6, back: 0.3, left: 0.3, right: 0.3, access: 0.8 };

    // Simple heuristics for category detection
    if (height < 0.6) {
      category = 'table'; // Low objects are likely tables/surfaces
      clearance = { front: 0.8, back: 0.8, left: 0.8, right: 0.8, access: 1.0 };
    } else if (height > 1.5) {
      category = 'storage'; // Tall objects are likely storage
      clearance = { front: 0.9, back: 0.1, left: 0.1, right: 0.1, access: 1.0 };
    } else if (width > 1.5 && depth > 0.8) {
      category = 'seating'; // Wide, deep objects might be seating
      clearance = { front: 1.0, back: 0.3, left: 0.3, right: 0.3, access: 1.2 };
    } else if (width > depth && height < 1.0) {
      category = 'desk'; // Wide, shallow objects might be desks
      clearance = { front: 1.2, back: 0.3, left: 0.3, right: 0.3, access: 1.5 };
    }

    return {
      id: sceneObject.id,
      name: sceneObject.id,
      type: sceneObject.type,
      category,
      dimensions,
      clearanceRequirements: clearance,
      usagePattern: {
        primaryDirection: new Vector3(0, 0, 1),
        accessPoints: [new Vector3(0, 0, clearance.front / 2)],
        groupingRules: ['flexible'],
        wallPlacement: 'optional'
      },
      constraints: {
        cornerPlacement: category === 'storage' || category === 'desk',
        requiresElectricity: category === 'desk',
        requiresPlumbing: false,
        minRoomSize: Math.max(width, depth) + 2.0
      },
      metadata: {
        description: `Custom ${category} object`,
        tags: [category, 'custom'],
        estimatedCost: volume * 100 // Rough estimate
      }
    };
  }

  /**
   * Get all furniture of a specific category
   */
  public getFurnitureByCategory(category: FurnitureSpec['category']): FurnitureSpec[] {
    return Array.from(this.furniture.values()).filter(spec => spec.category === category);
  }

  /**
   * Get all available furniture types
   */
  public getAllFurnitureTypes(): string[] {
    return Array.from(this.furniture.keys());
  }

  /**
   * Get furniture specifications for multiple objects
   */
  public getSpecsForObjects(sceneObjects: SceneObject[]): FurnitureSpec[] {
    return sceneObjects.map(obj => this.createSpecFromSceneObject(obj));
  }

  /**
   * Calculate space efficiency for furniture placement
   */
  public calculateSpaceEfficiency(
    furnitureSpecs: FurnitureSpec[], 
    roomArea: number
  ): {
    totalFootprint: number;
    totalClearance: number;
    efficiency: number;
    density: number;
  } {
    let totalFootprint = 0;
    let totalClearance = 0;

    for (const spec of furnitureSpecs) {
      // Object footprint
      const footprint = spec.dimensions.width * spec.dimensions.depth;
      totalFootprint += footprint;

      // Clearance area (approximated as circle)
      const clearanceRadius = spec.clearanceRequirements.access;
      const clearanceArea = Math.PI * clearanceRadius * clearanceRadius;
      totalClearance += clearanceArea;
    }

    const efficiency = Math.min(1.0, (totalFootprint + totalClearance) / roomArea);
    const density = furnitureSpecs.length / roomArea;

    return {
      totalFootprint,
      totalClearance,
      efficiency,
      density
    };
  }
}

// Export singleton instance
export const furnitureDatabase = new FurnitureDatabase(); 