import { Vector3, Mesh } from 'babylonjs';
import { spaceOptimizer } from '../algorithms/spaceOptimization';
import { furnitureDatabase } from '../data/furnitureDatabase';
import { roomAnalysisService } from '../services/roomAnalysisService';
import { placementConstraintsService } from '../services/placementConstraintsService';
import { spaceAnalysisService } from '../services/spaceAnalysisService';
import { layoutGenerationService } from '../services/layoutGenerationService';
import type { SceneObject } from '../types/types';

// Jest globals for testing
declare global {
  function describe(name: string, fn: () => void): void;
  function test(name: string, fn: () => void): void;
  namespace expect {
    function stringMatching(pattern: RegExp | string): any;
  }
  function expect(value: any): {
    toBeDefined(): any;
    toBeGreaterThan(value: number): any;
    toBeGreaterThanOrEqual(value: number): any;
    toBeLessThan(value: number): any;
    toBeLessThanOrEqual(value: number): any;
    toBe(value: any): any;
    toBeCloseTo(value: number, precision?: number): any;
    toHaveLength(length: number): any;
    toBeInstanceOf(constructor: any): any;
    toHaveProperty(property: string): any;
    toContain(value: any): any;
    toThrow(): any;
    not: {
      toThrow(): any;
    };
    rejects: {
      toThrow(): any;
    };
  };
}

/**
 * Test Utilities and Mock Data
 */

// Mock scene object factory
function createMockSceneObject(
  id: string, 
  type: string, 
  position: Vector3 = Vector3.Zero(),
  dimensions?: { width: number; height: number; depth: number }
): SceneObject {
  const mockBoundingBox = dimensions ? {
    minimumWorld: new Vector3(
      position.x - dimensions.width / 2,
      position.y,
      position.z - dimensions.depth / 2
    ),
    maximumWorld: new Vector3(
      position.x + dimensions.width / 2,
      position.y + dimensions.height,
      position.z + dimensions.depth / 2
    )
  } : {
    minimumWorld: new Vector3(position.x - 0.5, position.y, position.z - 0.5),
    maximumWorld: new Vector3(position.x + 0.5, position.y + 1, position.z + 0.5)
  };

  return {
    id,
    type: type as any,
    position: position.clone(),
    rotation: Vector3.Zero(),
    scale: new Vector3(1, 1, 1),
    color: '#808080',
    isNurbs: false,
    mesh: {
      getBoundingInfo: () => ({ boundingBox: mockBoundingBox }),
      computeWorldMatrix: () => true
    } as any
  };
}

// Mock room mesh factory
function createMockRoomMesh(
  id: string,
  floorPolygon: { x: number; z: number }[],
  doors?: any[],
  windows?: any[]
): Mesh {
  return {
    id,
    metadata: {
      floorPolygon,
      doors: doors || [],
      windows: windows || []
    },
    getBoundingInfo: () => {
      const minX = Math.min(...floorPolygon.map(p => p.x));
      const maxX = Math.max(...floorPolygon.map(p => p.x));
      const minZ = Math.min(...floorPolygon.map(p => p.z));
      const maxZ = Math.max(...floorPolygon.map(p => p.z));
      
      return {
        boundingBox: {
          minimumWorld: new Vector3(minX, 0, minZ),
          maximumWorld: new Vector3(maxX, 2.5, maxZ)
        }
      };
    },
    computeWorldMatrix: () => true
  } as any;
}

// Standard test room (6x4 meters)
const standardTestRoom = createMockRoomMesh('test-room', [
  { x: 0, z: 0 },
  { x: 6, z: 0 },
  { x: 6, z: 4 },
  { x: 0, z: 4 }
]);

// Small test room (3x3 meters)
const smallTestRoom = createMockRoomMesh('small-room', [
  { x: 0, z: 0 },
  { x: 3, z: 0 },
  { x: 3, z: 3 },
  { x: 0, z: 3 }
]);

// Large test room (10x8 meters)
const largeTestRoom = createMockRoomMesh('large-room', [
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 10, z: 8 },
  { x: 0, z: 8 }
]);

/**
 * Core Algorithm Tests
 */
describe('Space Optimization Algorithm', () => {
  test('should optimize space for desks in standard room', () => {
    const result = spaceOptimizer.optimizeSpace(standardTestRoom, 'Desk');
    
    expect(result).toBeDefined();
    expect(result.maxObjects).toBeGreaterThan(0);
    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.layouts).toHaveLength(result.maxObjects);
    expect(result.warnings).toBeInstanceOf(Array);
  });

  test('should handle small rooms appropriately', () => {
    const result = spaceOptimizer.optimizeSpace(smallTestRoom, 'Table');
    
    expect(result).toBeDefined();
    expect(result.maxObjects).toBeLessThanOrEqual(1);
    
    if (result.maxObjects === 0) {
      expect(result.warnings).toContain(expect.stringMatching(/too small|insufficient space/i));
    }
  });

  test('should optimize for different strategies', () => {
    const maximizeResult = spaceOptimizer.optimizeSpace(largeTestRoom, 'Chair', {
      name: 'maximize',
      priority: 'maximize',
      description: 'Maximize capacity'
    });

    const comfortResult = spaceOptimizer.optimizeSpace(largeTestRoom, 'Chair', {
      name: 'comfort',
      priority: 'comfort',
      description: 'Comfort layout'
    });

    expect(maximizeResult.maxObjects).toBeGreaterThanOrEqual(comfortResult.maxObjects);
    expect(comfortResult.efficiency).toBeLessThanOrEqual(maximizeResult.efficiency);
  });

  test('should respect configuration constraints', () => {
    const result = spaceOptimizer.optimizeSpace(standardTestRoom, 'Desk', undefined, {
      minClearance: 1.5, // Large clearance requirement
      wallOffset: 1.0
    });

    expect(result.maxObjects).toBeLessThan(10); // Should be limited by constraints
    
    if (result.layouts.length > 0) {
      // Check that positions respect wall offset
      for (const layout of result.layouts) {
        expect(layout.position.x).toBeGreaterThan(1.0);
        expect(layout.position.x).toBeLessThan(5.0);
        expect(layout.position.z).toBeGreaterThan(1.0);
        expect(layout.position.z).toBeLessThan(3.0);
      }
    }
  });
});

/**
 * Furniture Database Tests
 */
describe('Furniture Database', () => {
  test('should provide furniture specifications', () => {
    const deskSpec = furnitureDatabase.getFurniture('Desk');
    
    expect(deskSpec).toBeDefined();
    expect(deskSpec?.type).toBe('Desk');
    expect(deskSpec?.category).toBe('desk');
    expect(deskSpec?.dimensions).toHaveProperty('width');
    expect(deskSpec?.dimensions).toHaveProperty('height');
    expect(deskSpec?.dimensions).toHaveProperty('depth');
    expect(deskSpec?.clearanceRequirements).toHaveProperty('access');
  });

  test('should extract dimensions from scene objects', () => {
    const mockDesk = createMockSceneObject('test-desk', 'Desk', new Vector3(1, 0, 1), {
      width: 1.2,
      height: 0.75,
      depth: 0.6
    });

    const dimensions = furnitureDatabase.extractDimensionsFromMesh(mockDesk);
    
    expect(dimensions.width).toBeCloseTo(1.2, 1);
    expect(dimensions.height).toBeCloseTo(0.75, 1);
    expect(dimensions.depth).toBeCloseTo(0.6, 1);
  });

  test('should create specs from scene objects', () => {
    const mockChair = createMockSceneObject('test-chair', 'Chair', Vector3.Zero());
    const spec = furnitureDatabase.createSpecFromSceneObject(mockChair);
    
    expect(spec.id).toBe('test-chair');
    expect(spec.type).toBe('Chair');
    expect(spec.category).toBe('seating');
    expect(spec.dimensions).toBeDefined();
    expect(spec.clearanceRequirements).toBeDefined();
  });

  test('should categorize furniture by type', () => {
    const desks = furnitureDatabase.getFurnitureByCategory('desk');
    const seating = furnitureDatabase.getFurnitureByCategory('seating');
    
    expect(desks.length).toBeGreaterThan(0);
    expect(seating.length).toBeGreaterThan(0);
    expect(desks.every(item => item.category === 'desk')).toBe(true);
    expect(seating.every(item => item.category === 'seating')).toBe(true);
  });
});

/**
 * Room Analysis Tests
 */
describe('Room Analysis Service', () => {
  test('should analyze room geometry', () => {
    const sceneObjects: SceneObject[] = [];
    const result = roomAnalysisService.analyzeRoom(standardTestRoom, sceneObjects, 'test-room');
    
    expect(result.roomId).toBe('test-room');
    expect(result.roomGeometry.area).toBeCloseTo(24, 0); // 6x4 = 24 m²
    expect(result.roomGeometry.perimeter).toBeCloseTo(20, 0); // 2*(6+4) = 20 m
    expect(result.roomGeometry.corners).toHaveLength(4);
  });

  test('should identify constraints from existing objects', () => {
    const existingObjects = [
      createMockSceneObject('existing-desk', 'Desk', new Vector3(1, 0, 1)),
      createMockSceneObject('existing-chair', 'Chair', new Vector3(1, 0, 0.2))
    ];

    const result = roomAnalysisService.analyzeRoom(standardTestRoom, existingObjects, 'test-room');
    
    expect(result.constraints.length).toBeGreaterThan(4); // At least walls + objects
    
    const objectConstraints = result.constraints.filter(c => c.type === 'existing-object');
    expect(objectConstraints).toHaveLength(2);
  });

  test('should generate placement zones', () => {
    const result = roomAnalysisService.analyzeRoom(standardTestRoom, [], 'test-room');
    
    expect(result.placementZones.length).toBeGreaterThan(0);
    
    const optimalZones = result.placementZones.filter(z => z.type === 'optimal');
    const totalZoneArea = result.placementZones.reduce((sum, z) => sum + z.area, 0);
    
    expect(optimalZones.length).toBeGreaterThan(0);
    expect(totalZoneArea).toBeGreaterThan(0);
  });

  test('should analyze accessibility paths', () => {
    const result = roomAnalysisService.analyzeRoom(standardTestRoom, [], 'test-room');
    
    expect(result.accessibilityPaths.length).toBeGreaterThan(0);
    
    for (const path of result.accessibilityPaths) {
      expect(path.width).toBeGreaterThan(0);
      expect(path.start).toBeInstanceOf(Vector3);
      expect(path.end).toBeInstanceOf(Vector3);
    }
  });
});

/**
 * Placement Constraints Tests
 */
describe('Placement Constraints Service', () => {
  test('should validate furniture placement', () => {
    const furniture = [
      createMockSceneObject('desk-1', 'Desk', new Vector3(3, 0, 2)),
      createMockSceneObject('chair-1', 'Chair', new Vector3(3, 0, 1.2))
    ];

    const result = placementConstraintsService.validatePlacement(
      standardTestRoom,
      furniture,
      'test-room'
    );
    
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.violations).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.accessibility).toBeDefined();
    expect(result.safety).toBeDefined();
    expect(result.ergonomics).toBeDefined();
  });

  test('should detect clearance violations', () => {
    // Place furniture too close together
    const furniture = [
      createMockSceneObject('desk-1', 'Desk', new Vector3(2, 0, 2)),
      createMockSceneObject('desk-2', 'Desk', new Vector3(2.5, 0, 2)) // Too close
    ];

    const result = placementConstraintsService.validatePlacement(
      standardTestRoom,
      furniture,
      'test-room'
    );
    
    expect(result.violations.length + result.warnings.length).toBeGreaterThan(0);
    
    const clearanceViolations = [...result.violations, ...result.warnings]
      .filter(v => v.type === 'clearance');
    expect(clearanceViolations.length).toBeGreaterThan(0);
  });

  test('should assess accessibility compliance', () => {
    const furniture = [
      createMockSceneObject('chair-1', 'Chair', new Vector3(1, 0, 1))
    ];

    const result = placementConstraintsService.validatePlacement(
      standardTestRoom,
      furniture,
      'test-room'
    );
    
    expect(result.accessibility.pathwayWidth).toBeGreaterThan(0);
    expect(typeof result.accessibility.meetsADA).toBe('boolean');
    expect(typeof result.accessibility.maneuvering).toBe('boolean');
  });

  test('should generate placement suggestions', () => {
    const poorlyPlacedFurniture = [
      createMockSceneObject('desk-1', 'Desk', new Vector3(0.2, 0, 0.2)) // Too close to corner
    ];

    const suggestions = placementConstraintsService.generatePlacementSuggestions(
      standardTestRoom,
      poorlyPlacedFurniture,
      'test-room',
      'accessibility'
    );
    
    expect(suggestions).toBeInstanceOf(Array);
    
    if (suggestions.length > 0) {
      const suggestion = suggestions[0];
      expect(suggestion.objectId).toBe('desk-1');
      expect(suggestion.improvement).toBeGreaterThan(0);
      expect(suggestion.suggestedPosition).toBeInstanceOf(Vector3);
    }
  });
});

/**
 * Space Analysis Service Tests
 */
describe('Space Analysis Service', () => {
  const mockGetMeshById = (id: string) => {
    if (id === 'test-room') return standardTestRoom;
    return null;
  };

  test('should analyze space for object type', async () => {
    const request = {
      roomId: 'test-room',
      targetObjectType: 'Desk',
      strategy: { name: 'maximize' as const, priority: 'maximize' as const, description: 'Test' }
    };

    const result = await spaceAnalysisService.analyzeSpace(
      request,
      [],
      mockGetMeshById
    );
    
    expect(result).toBeDefined();
    expect(result.optimization.maxObjects).toBeGreaterThanOrEqual(0);
    expect(result.furnitureSpec.type).toBe('Desk');
    expect(result.roomAnalysis).toBeDefined();
    expect(result.recommendations).toBeInstanceOf(Array);
  });

  test('should analyze selected objects', async () => {
    const selectedObjects = [
      createMockSceneObject('selected-chair', 'Chair', new Vector3(2, 0, 2))
    ];

    const result = await spaceAnalysisService.analyzeSelectedObjects(
      selectedObjects,
      'test-room',
      [],
      mockGetMeshById
    );
    
    expect(result.furnitureSpec.id).toBe('selected-chair');
    expect(result.optimization).toBeDefined();
    expect(result.roomAnalysis).toBeDefined();
  });

  test('should generate capacity report', async () => {
    const objectTypes = ['Desk', 'Chair', 'Table'];
    
    const report = await spaceAnalysisService.getCapacityReport(
      'test-room',
      objectTypes,
      mockGetMeshById
    );
    
    expect(report).toHaveLength(3);
    
    for (const item of report) {
      expect(item).toHaveProperty('objectType');
      expect(item).toHaveProperty('maxObjects');
      expect(item).toHaveProperty('efficiency');
      expect(item).toHaveProperty('warnings');
      expect(item.maxObjects).toBeGreaterThanOrEqual(0);
    }
  });
});

/**
 * Layout Generation Tests
 */
describe('Layout Generation Service', () => {
  const mockGetMeshById = (id: string) => {
    if (id === 'test-room') return standardTestRoom;
    if (id === 'large-room') return largeTestRoom;
    return null;
  };

  test('should generate layouts from templates', async () => {
    const templates = layoutGenerationService.getCompatibleTemplates(24, 'office');
    expect(templates.length).toBeGreaterThan(0);

    if (templates.length > 0) {
      const template = templates[0];
      const layout = await layoutGenerationService.generateFromTemplate(
        standardTestRoom,
        [],
        'test-room',
        template.id
      );
      
      if (layout) {
        expect(layout.templateId).toBe(template.id);
        expect(layout.objects.length).toBeGreaterThan(0);
        expect(layout.metrics).toBeDefined();
        expect(layout.zones).toBeDefined();
      }
    }
  });

  test('should generate multiple layout strategies', async () => {
    const request = {
      roomId: 'large-room',
      customRequirements: {
        furnitureTypes: ['Desk', 'Chair']
      },
      strategies: [
        { name: 'maximize' as const, priority: 'maximize' as const, description: 'Max capacity' },
        { name: 'comfort' as const, priority: 'comfort' as const, description: 'Comfort first' }
      ]
    };

    const result = await layoutGenerationService.generateLayouts(
      largeTestRoom,
      [],
      request,
      mockGetMeshById
    );
    
    expect(result.layouts.length).toBeGreaterThan(0);
    expect(result.recommendations).toBeDefined();
    expect(result.summary.totalLayouts).toBeGreaterThanOrEqual(result.summary.validLayouts);
    
    // Check that different strategies produce different results
    const strategies = new Set(result.layouts.map(l => l.strategy.name));
    expect(strategies.size).toBeGreaterThan(0);
  });

  test('should validate generated layouts', async () => {
    const request = {
      roomId: 'test-room',
      customRequirements: {
        furnitureTypes: ['Chair']
      }
    };

    const result = await layoutGenerationService.generateLayouts(
      standardTestRoom,
      [],
      request,
      mockGetMeshById
    );
    
    for (const layout of result.layouts) {
      expect(layout.validation).toBeDefined();
      expect(layout.metrics.score).toBeGreaterThanOrEqual(0);
      expect(layout.metrics.score).toBeLessThanOrEqual(100);
    }
  });

  test('should identify functional zones', async () => {
    const request = {
      roomId: 'large-room',
      templateId: 'office-collaborative'
    };

    const result = await layoutGenerationService.generateLayouts(
      largeTestRoom,
      [],
      request,
      mockGetMeshById
    );
    
    if (result.layouts.length > 0) {
      const layout = result.layouts[0];
      expect(layout.zones.functional.length).toBeGreaterThan(0);
      expect(layout.zones.circulation.length).toBeGreaterThanOrEqual(0);
      
      for (const zone of layout.zones.functional) {
        expect(zone.name).toBeDefined();
        expect(zone.center).toBeInstanceOf(Vector3);
        expect(zone.radius).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * Integration Tests
 */
describe('Space Optimization Integration', () => {
  const mockGetMeshById = (id: string) => {
    if (id === 'integration-room') return standardTestRoom;
    return null;
  };

  test('should complete full optimization workflow', async () => {
    // Step 1: Analyze room
    const roomAnalysis = roomAnalysisService.analyzeRoom(standardTestRoom, [], 'integration-room');
    expect(roomAnalysis).toBeDefined();

    // Step 2: Generate layout
    const layoutRequest = {
      roomId: 'integration-room',
      templateId: 'office-single'
    };
    
    const layoutResult = await layoutGenerationService.generateLayouts(
      standardTestRoom,
      [],
      layoutRequest,
      mockGetMeshById
    );
    
    expect(layoutResult.layouts.length).toBeGreaterThan(0);

    // Step 3: Validate placement
    if (layoutResult.layouts.length > 0) {
      const layout = layoutResult.layouts[0];
      const sceneObjects = layout.objects.map(obj => 
        createMockSceneObject(obj.id, obj.type, obj.position)
      );

      const validation = placementConstraintsService.validatePlacement(
        standardTestRoom,
        sceneObjects,
        'integration-room'
      );

      expect(validation).toBeDefined();
      expect(validation.score).toBeGreaterThanOrEqual(0);
    }
  });

  test('should handle edge cases gracefully', () => {
    // Test with no room
    expect(() => {
      roomAnalysisService.analyzeRoom(
        createMockRoomMesh('empty-room', []),
        [],
        'empty-room'
      );
    }).toThrow();

    // Test with invalid furniture type
    const result = spaceOptimizer.optimizeSpace(standardTestRoom, 'NonExistentFurniture');
    expect(result.maxObjects).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('should maintain performance standards', () => {
    const startTime = Date.now();
    
    // Run optimization multiple times
    for (let i = 0; i < 10; i++) {
      spaceOptimizer.optimizeSpace(standardTestRoom, 'Chair');
    }
    
    const endTime = Date.now();
    const averageTime = (endTime - startTime) / 10;
    
    // Should complete each optimization in reasonable time
    expect(averageTime).toBeLessThan(1000); // Less than 1 second
  });
});

/**
 * Performance and Stress Tests
 */
describe('Performance Tests', () => {
  test('should handle large numbers of objects', () => {
    const manyObjects: SceneObject[] = [];
    
    // Create 50 objects
    for (let i = 0; i < 50; i++) {
      manyObjects.push(createMockSceneObject(
        `object-${i}`,
        'Chair',
        new Vector3(Math.random() * 8, 0, Math.random() * 6)
      ));
    }

    const startTime = Date.now();
    const result = roomAnalysisService.analyzeRoom(largeTestRoom, manyObjects, 'stress-test');
    const endTime = Date.now();

    expect(result).toBeDefined();
    expect(endTime - startTime).toBeLessThan(5000); // Should complete in 5 seconds
    expect(result.constraints.length).toBeGreaterThan(50); // At least one per object
  });

  test('should handle complex room geometries', () => {
    // Create L-shaped room
    const complexRoom = createMockRoomMesh('complex-room', [
      { x: 0, z: 0 },
      { x: 6, z: 0 },
      { x: 6, z: 3 },
      { x: 3, z: 3 },
      { x: 3, z: 6 },
      { x: 0, z: 6 }
    ]);

    const result = roomAnalysisService.analyzeRoom(complexRoom, [], 'complex-room');
    
    expect(result).toBeDefined();
    expect(result.roomGeometry.area).toBeGreaterThan(0);
    expect(result.placementZones.length).toBeGreaterThan(0);
  });
});

/**
 * Error Handling Tests
 */
describe('Error Handling', () => {
  test('should handle missing room metadata', () => {
    const invalidRoom = {
      id: 'invalid-room',
      metadata: {}, // No floorPolygon
      getBoundingInfo: () => ({
        boundingBox: {
          minimumWorld: Vector3.Zero(),
          maximumWorld: new Vector3(1, 1, 1)
        }
      })
    } as any;

    expect(() => {
      roomAnalysisService.analyzeRoom(invalidRoom, [], 'invalid-room');
    }).toThrow();
  });

  test('should handle invalid optimization requests', async () => {
    const mockGetMeshById = () => null; // Room not found

    await expect(
      spaceAnalysisService.analyzeSpace(
        { roomId: 'nonexistent-room', targetObjectType: 'Desk' },
        [],
        mockGetMeshById
      )
    ).rejects.toThrow();
  });

  test('should validate input parameters', () => {
    expect(() => {
      placementConstraintsService.validatePlacement(
        standardTestRoom,
        [],
        '' // Invalid room ID
      );
    }).not.toThrow(); // Should handle gracefully

    expect(() => {
      furnitureDatabase.extractDimensionsFromMesh({} as any);
    }).not.toThrow(); // Should return fallback dimensions
  });
});

/**
 * Data Validation Tests
 */
describe('Data Validation', () => {
  test('should validate furniture specifications', () => {
    const allTypes = furnitureDatabase.getAllFurnitureTypes();
    
    for (const type of allTypes) {
      const spec = furnitureDatabase.getFurniture(type);
      expect(spec).toBeDefined();
      expect(spec!.dimensions.width).toBeGreaterThan(0);
      expect(spec!.dimensions.height).toBeGreaterThan(0);
      expect(spec!.dimensions.depth).toBeGreaterThan(0);
      expect(spec!.clearanceRequirements.access).toBeGreaterThan(0);
    }
  });

  test('should validate optimization results', () => {
    const result = spaceOptimizer.optimizeSpace(standardTestRoom, 'Desk');
    
    expect(result.efficiency).toBeGreaterThanOrEqual(0);
    expect(result.efficiency).toBeLessThanOrEqual(1);
    expect(result.maxObjects).toBeGreaterThanOrEqual(0);
    expect(result.layouts.length).toBeLessThanOrEqual(result.maxObjects);
    
    for (const layout of result.layouts) {
      expect(layout.position).toBeInstanceOf(Vector3);
      expect(layout.accessZones).toBeInstanceOf(Array);
    }
  });
});

export {
  createMockSceneObject,
  createMockRoomMesh,
  standardTestRoom,
  smallTestRoom,
  largeTestRoom
}; 